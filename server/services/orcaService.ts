import { GoogleGenAI } from '@google/genai';
import { COASTAL_LOCATIONS, MARINE_EVIDENCE_CORPUS } from '../../src/data/coastalData.ts';
import { calculateMarineRisk, generateGisLayers } from '../../src/utils/marineRiskEngine.ts';
import { predictMarineRiskWithMl } from '../../src/services/ml/riskService.ts';
import { fetchSatelliteData } from '../../src/services/satellite/satelliteService.ts';
import {
  AgentStepTrace,
  LanguageCode,
  OrcaAnalysisResponse,
} from '../../src/types.ts';
import {
  fetchMarineAndWeatherData,
  resolveLocation,
  resolveSatelliteObservationWindow,
  resolveTimeWindow,
} from './marineService.ts';
import { retrieveEvidence } from './evidenceService.ts';

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'orca-x-server' } },
    });
  }
  return genAIClient;
}

export async function runOrcaAgentWorkflow(
  query: string,
  locationOverride?: string,
  timeOverride?: string,
  language: LanguageCode = 'en',
): Promise<OrcaAnalysisResponse> {
  const queryId = `orca-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const traces: AgentStepTrace[] = [];
  const startTrace = (agentName: AgentStepTrace['agentName'], inputSummary: string) => {
    const trace: AgentStepTrace = {
      agentName,
      status: 'running',
      startedAt: new Date().toISOString(),
      inputSummary,
      outputSummary: '',
      logs: [`Started ${agentName} processing`],
    };
    traces.push(trace);
    return trace;
  };
  const completeTrace = (trace: AgentStepTrace, outputSummary: string, error?: string) => {
    trace.status = error ? 'failed' : 'completed';
    trace.completedAt = new Date().toISOString();
    trace.durationMs = Math.max(1, Date.now() - new Date(trace.startedAt).getTime());
    trace.outputSummary = outputSummary;
    if (error) trace.error = error;
  };

  const planner = startTrace('Planner', `Analyze query: "${query}"`);
  planner.logs.push('Workflow: location/time resolution, environmental connectors, ML risk, GIS, evidence, grounded synthesis');
  completeTrace(planner, 'Workflow execution graph created.');

  const resolver = startTrace('LocationTimeResolver', 'Resolve geographic and temporal intent');
  const location = resolveLocation(query, locationOverride);
  const timeWindow = resolveTimeWindow(query, timeOverride);
  resolver.logs.push(`Matched location: ${location.name} (${location.latitude}, ${location.longitude})`);
  completeTrace(resolver, `Target: ${location.name} | ${timeWindow.requestedText}`);

  const weatherTrace = startTrace('WeatherAgent', `Fetch weather for ${location.name}`);
  const oceanTrace = startTrace('OceanAgent', `Fetch marine conditions for ${location.name}`);
  const satelliteTrace = startTrace('SatelliteAgent', `Search Copernicus observations for ${location.name}`);

  const { weather, ocean, degraded } = await fetchMarineAndWeatherData(location.latitude, location.longitude);
  const satelliteWindow = resolveSatelliteObservationWindow(timeWindow);
  const satellite = await fetchSatelliteData(
    location.latitude,
    location.longitude,
    satelliteWindow.startTime,
    satelliteWindow.endTime,
  );

  completeTrace(weatherTrace, `Temperature ${weather.airTemperatureC}°C | Wind ${weather.windSpeedKts} kts | Gust ${weather.windGustKts} kts`);
  completeTrace(oceanTrace, `Wave ${ocean.waveHeightMeters}m | Swell ${ocean.swellHeightMeters}m | Current ${ocean.currentSpeedKts} kts`);
  completeTrace(satelliteTrace, `${satellite.status} | ${satellite.observations.length} observations`);

  const riskTrace = startTrace('RiskEngine', 'Run XGBoost ML risk service with deterministic fallback');
  const mlRisk = await predictMarineRiskWithMl(weather, ocean, satellite, location);
  const risk = mlRisk || calculateMarineRisk(weather, ocean, satellite, location);
  if (mlRisk) {
    riskTrace.logs.push(`XGBoost prediction received: ${mlRisk.riskLevel} (${mlRisk.confidenceScore}%).`);
    if (mlRisk.domainValidation) {
      riskTrace.logs.push(`ML deployment validation: ${mlRisk.domainValidation.deploymentValidationStatus}.`);
      if (mlRisk.domainValidation.status === 'UNVALIDATED_DEPLOYMENT_DOMAIN') {
        riskTrace.logs.push('Indian coastal deployment is not independently validated by the committed ML dataset.');
      }
    }
  } else {
    riskTrace.logs.push('ML API unavailable; deterministic fallback used.');
  }
  completeTrace(riskTrace, `${risk.riskScore}/100 ${risk.riskLevel}`);

  const gisTrace = startTrace('GisAgent', 'Generate GeoJSON hazard and navigation layers');
  const gisLayers = generateGisLayers(location, risk, ocean);
  completeTrace(gisTrace, `${gisLayers.features.length} GeoJSON features generated.`);

  const ragTrace = startTrace('EvidenceRetrieval', 'Retrieve marine safety evidence corpus');
  const evidence = retrieveEvidence(query, location, risk.riskLevel);
  completeTrace(ragTrace, `${evidence.length} evidence items retrieved.`);

  const responseTrace = startTrace('ResponseGrounding', 'Generate grounded marine intelligence briefing');
  let groundedSummary = '';
  const genAI = getGenAI();
  if (genAI) {
    const prompt = `You are ORCA-X (Ocean Reasoning & Collaborative AI), an authoritative marine intelligence assistant.\nUser Query: "${query}"\nLocation: ${location.name}, ${location.state || ''}, ${location.country}\nTime Window: ${timeWindow.requestedText}\n\nGROUND TRUTH:\nWave Height: ${ocean.waveHeightMeters}m; Max Wave: ${ocean.maxWaveHeightMeters}m\nSwell: ${ocean.swellHeightMeters}m / ${ocean.swellPeriodSec}s\nWind: ${weather.windSpeedKts} kts; Gusts: ${weather.windGustKts} kts; Direction: ${weather.windDirectionCompass}\nCurrent: ${ocean.currentSpeedKts} kts\nSea State: ${ocean.seaStateIndex} (${ocean.seaStateDescription})\nSST: ${ocean.seaSurfaceTemperatureC}°C\nVisibility: ${weather.visibilityKm} km\nRisk: ${risk.riskScore}/100 ${risk.riskLevel}; Confidence: ${risk.confidenceScore}%\nRecommendation: ${risk.primaryRecommendation}\nAdvisories: ${risk.actionableAdvisories.join('; ')}\nSources: ${evidence.map(e => e.title).join('; ')}\n\nRespond in ${language}. Never invent measurements. Give a concise verdict, key physical drivers, operational advisories, and a disclaimer that official INCOIS/IMD/MRCC warnings supersede this system.`;
    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.7-flash']) {
      try {
        const result = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: { temperature: 0.2, topP: 0.85 },
        });
        if (result.text) { groundedSummary = result.text; break; }
      } catch (error) {
        responseTrace.logs.push(`Model ${model} unavailable; trying next model.`);
      }
    }
  }

  if (!groundedSummary) {
    groundedSummary = `${risk.primaryRecommendation}\n\n${risk.safetySummary}\n\nKey Parameters for ${location.name}:\n• Significant Wave Height: ${ocean.waveHeightMeters}m\n• Wind: ${weather.windSpeedKts} kts (gusts ${weather.windGustKts} kts)\n• Swell Period: ${ocean.swellPeriodSec}s\n• Current: ${ocean.currentSpeedKts} kts\n• Sea State: ${ocean.seaStateIndex} (${ocean.seaStateDescription})\n\nSafety Advisories:\n${risk.actionableAdvisories.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
  }
  completeTrace(responseTrace, 'Grounded marine briefing generated.');

  return {
    queryId,
    originalQuery: query,
    language,
    detectedIntent: 'marine_safety_fishing_advisory',
    location,
    timeWindow,
    weather,
    ocean,
    satellite,
    risk,
    gisLayers,
    evidence,
    agentTraces: traces,
    groundedSummary,
    isDataDegraded: degraded || satellite.status !== 'LIVE',
    warnings: satellite.warnings,
    freshnessTimestamp: new Date().toISOString(),
    officialDisclaimer: 'ORCA-X is an AI decision-support platform for marine intelligence. It does NOT supersede statutory warnings from INCOIS, IMD, or Maritime Rescue Coordination Centres (MRCC).',
  };
}

export function getSupportedLocationCount(): number {
  return Object.keys(COASTAL_LOCATIONS).length;
}

export function getEvidenceCorpusSize(): number {
  return MARINE_EVIDENCE_CORPUS.length;
}
