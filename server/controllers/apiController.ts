import { Request, Response } from 'express';
import { calculateMarineRisk } from '../../src/utils/marineRiskEngine.ts';
import { predictMarineRiskWithMl } from '../../src/services/ml/riskService.ts';
import { fetchSatelliteData } from '../../src/services/satellite/satelliteService.ts';
import { COASTAL_LOCATIONS } from '../../src/data/coastalData.ts';
import { LanguageCode, SatelliteData } from '../../src/types.ts';
import { fetchMarineAndWeatherData } from '../services/marineService.ts';
import { retrieveEvidence } from '../services/evidenceService.ts';
import { getSupportedLocationCount, runOrcaAgentWorkflow } from '../services/orcaService.ts';

export async function orcaQuery(req: Request, res: Response) {
  try {
    const { query, locationOverride, timeOverride, language = 'en' } = req.body;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Query string is required.' });
    if (!['en', 'bn', 'hi', 'ta', 'or', 'te'].includes(language)) return res.status(400).json({ error: 'Unsupported language code.' });
    res.json(await runOrcaAgentWorkflow(query, locationOverride, timeOverride, language as LanguageCode));
  } catch (error) {
    console.error('ORCA query error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error processing ORCA query.' });
  }
}

export async function marineConditions(req: Request, res: Response) {
  try {
    const lat = Number(req.query.lat ?? 21.6266);
    const lon = Number(req.query.lon ?? 87.5074);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }
    res.json(await fetchMarineAndWeatherData(lat, lon));
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Marine data fetch failed.' });
  }
}

export async function marineRisk(req: Request, res: Response) {
  try {
    const { weather, ocean, satellite, location } = req.body;
    if (!weather || !ocean || !location) return res.status(400).json({ error: 'Missing required environmental observation inputs.' });
    const defaultSat = satellite || {
      status: 'UNAVAILABLE', satelliteName: 'No satellite observation supplied', processingTime: new Date().toISOString(),
      latitude: location.latitude, longitude: location.longitude, source: 'No satellite source', sourceUrl: '',
      observationType: 'NO_OBSERVATION', warnings: ['Satellite observation was not supplied to the risk endpoint.'], observations: [],
    } as SatelliteData;
    const mlRisk = await predictMarineRiskWithMl(weather, ocean, defaultSat, location);
    res.json(mlRisk || calculateMarineRisk(weather, ocean, defaultSat, location));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Risk calculation failed.' });
  }
}

export async function satelliteAnalysis(req: Request, res: Response) {
  try {
    const lat = Number(req.body.latitude);
    const lon = Number(req.body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }
    const now = new Date();
    let start = req.body.startTime ? new Date(req.body.startTime) : new Date(now.getTime() - 6 * 3600000);
    let end = req.body.endTime ? new Date(req.body.endTime) : now;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return res.status(400).json({ error: 'startTime and endTime must be valid ISO timestamps.' });
    if (start > now) { start = new Date(now.getTime() - 7 * 24 * 3600000); end = now; }
    else { if (end > now) end = now; if (start >= end) start = new Date(end.getTime() - 24 * 3600000); }
    res.json(await fetchSatelliteData(lat, lon, start.toISOString(), end.toISOString()));
  } catch (error) {
    console.error('Satellite analysis error:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Satellite observation search failed.' });
  }
}

export function evidenceSearch(req: Request, res: Response) {
  try {
    const { query = '', riskLevel = 'MODERATE', locationKey = 'digha' } = req.body;
    const location = COASTAL_LOCATIONS[locationKey] || COASTAL_LOCATIONS.digha;
    const evidence = retrieveEvidence(query, location, riskLevel);
    res.json({ results: evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Evidence search failed.' });
  }
}

export function health(_req: Request, res: Response) {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openMeteoConnector: 'online',
      copernicusMarineConnector: 'configured_via_open_meteo_marine',
      satelliteCatalog: 'copernicus_stac',
      satelliteProcessing: 'metadata_only',
      riskEngine: 'xgboost_with_rule_based_fallback',
      mlRiskApi: process.env.ORCA_ML_API_URL || 'http://127.0.0.1:8000',
      vectorRAG: 'not_connected_in_current_build',
      agentOrchestrator: 'server_workflow',
      geminiGroundingAgent: process.env.GEMINI_API_KEY ? 'configured' : 'standby_deterministic',
    },
    supportedLocations: getSupportedLocationCount(),
  });
}
