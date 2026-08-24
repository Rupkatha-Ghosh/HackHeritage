import React, { useEffect, useState } from 'react';
import { LeftNavbar } from './components/LeftNavbar';
import { InteractiveMap } from './components/InteractiveMap';
import { QueryPanel } from './components/QueryPanel';
import { RiskCard } from './components/RiskCard';
import { MarineTelemetry } from './components/MarineTelemetry';
import { FeatureContributions } from './components/FeatureContributions';
import { AgentExecutionTimeline } from './components/AgentExecutionTimeline';
import { GroundedEvidenceDrawer } from './components/GroundedEvidenceDrawer';
import { SatelliteAnalysisView } from './components/SatelliteAnalysisView';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { OrcaAnalysisResponse, LanguageCode } from './types';
import { COASTAL_LOCATIONS, MULTILINGUAL_DICTIONARY } from './data/coastalData';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'analysis' | 'satellite' | 'evidence' | 'simulator'>('dashboard');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<OrcaAnalysisResponse | null>(null);

  const fetchAnalysis = async (queryText: string, locOverride?: string, timeOverride?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/orca/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, locationOverride: locOverride, timeOverride, language }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Server returned status ${response.status}`);
      }

      if (!payload?.weather || !payload?.ocean || !payload?.risk) {
        throw new Error('ORCA returned an incomplete live-data analysis. No synthetic telemetry will be displayed.');
      }

      setAnalysisData(payload as OrcaAnalysisResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to retrieve live ORCA data.';
      console.error('ORCA live-data request failed:', message);
      setAnalysisData(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis('Is it safe for small fishing boats near Digha right now?');
  }, []);

  const handleLocationSelect = (locKey: string) => {
    const loc = COASTAL_LOCATIONS[locKey];
    if (loc) fetchAnalysis(`Is it safe for small fishing boats near ${loc.name} right now?`, locKey);
  };

  const handleMapCoordinateClick = (lat: number, lon: number) => {
    fetchAnalysis(`Analyze live marine conditions at coordinates ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`);
  };

  const dict = MULTILINGUAL_DICTIONARY[language] || MULTILINGUAL_DICTIONARY.en;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <LeftNavbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        language={language}
        setLanguage={(nextLanguage) => {
          setLanguage(nextLanguage);
          if (analysisData) fetchAnalysis(analysisData.originalQuery, undefined, undefined);
        }}
        isProcessing={isLoading}
      />

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
          {isLoading && (
            <div className="bg-cyan-950/60 border border-cyan-500/50 rounded-xl p-3 flex items-center space-x-3 shadow-lg animate-pulse">
              <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-cyan-300 font-mono">ORCA-X Live Intelligence Pipeline Active: </span>
                <span className="text-slate-300">{dict.processing} (Open-Meteo live weather/marine + Copernicus latest observations + BGE-M3/Qdrant + risk engine)</span>
              </div>
            </div>
          )}

          {errorMessage && !isLoading && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Live marine data unavailable</p>
                <p className="text-xs text-slate-300 mt-1">{errorMessage}</p>
                <p className="text-[11px] text-slate-500 mt-2">ORCA-X intentionally does not substitute synthetic weather/ocean measurements when live providers fail.</p>
              </div>
            </div>
          )}

          {analysisData ? (
            <>
              {currentTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 space-y-4">
                      <QueryPanel onSearch={(q, loc, time) => fetchAnalysis(q, loc, time)} isLoading={isLoading} language={language} />
                      <MarineTelemetry weather={analysisData.weather} ocean={analysisData.ocean} satellite={analysisData.satellite} />
                    </div>
                    <div className="lg:col-span-7 space-y-4">
                      <RiskCard risk={analysisData.risk} location={analysisData.location} timeWindow={analysisData.timeWindow} language={language} groundedSummary={analysisData.groundedSummary} />
                      <InteractiveMap
                        location={analysisData.location}
                        gisLayers={analysisData.gisLayers}
                        ocean={analysisData.ocean}
                        riskLevel={analysisData.risk.riskLevel}
                        onSelectLocation={handleLocationSelect}
                        onCoordinateClick={handleMapCoordinateClick}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6"><FeatureContributions risk={analysisData.risk} /></div>
                    <div className="lg:col-span-6"><AgentExecutionTimeline traces={analysisData.agentTraces} queryId={analysisData.queryId} /></div>
                  </div>

                  <GroundedEvidenceDrawer evidence={analysisData.evidence} groundedSummary={analysisData.groundedSummary} />
                </div>
              )}

              {currentTab === 'analysis' && (
                <div className="space-y-6">
                  <RiskCard risk={analysisData.risk} location={analysisData.location} timeWindow={analysisData.timeWindow} language={language} groundedSummary={analysisData.groundedSummary} />
                  <FeatureContributions risk={analysisData.risk} />
                  <MarineTelemetry weather={analysisData.weather} ocean={analysisData.ocean} satellite={analysisData.satellite} />
                </div>
              )}

              {currentTab === 'satellite' && (
                <div className="space-y-6">
                  <SatelliteAnalysisView satellite={analysisData.satellite} location={analysisData.location} ocean={analysisData.ocean} />
                  <InteractiveMap
                    location={analysisData.location}
                    gisLayers={analysisData.gisLayers}
                    ocean={analysisData.ocean}
                    riskLevel={analysisData.risk.riskLevel}
                    onSelectLocation={handleLocationSelect}
                    onCoordinateClick={handleMapCoordinateClick}
                  />
                </div>
              )}

              {currentTab === 'evidence' && (
                <div className="space-y-6">
                  <GroundedEvidenceDrawer evidence={analysisData.evidence} groundedSummary={analysisData.groundedSummary} />
                  <AgentExecutionTimeline traces={analysisData.agentTraces} queryId={analysisData.queryId} />
                </div>
              )}

              {currentTab === 'simulator' && (
                <div className="space-y-6">
                  <WhatIfSimulator location={analysisData.location} initialWeather={analysisData.weather} initialOcean={analysisData.ocean} initialSatellite={analysisData.satellite} />
                  <InteractiveMap
                    location={analysisData.location}
                    gisLayers={analysisData.gisLayers}
                    ocean={analysisData.ocean}
                    riskLevel={analysisData.risk.riskLevel}
                    onSelectLocation={handleLocationSelect}
                    onCoordinateClick={handleMapCoordinateClick}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              {isLoading ? <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" /> : <AlertCircle className="h-8 w-8 text-red-400" />}
              <p className="text-sm font-mono text-center">
                {isLoading ? 'Connecting to live marine intelligence services...' : 'No live analysis is available yet.'}
              </p>
              {!isLoading && errorMessage && (
                <button className="px-4 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 text-xs hover:bg-cyan-950/50" onClick={() => fetchAnalysis('Is it safe for small fishing boats near Digha right now?')}>
                  Retry live data
                </button>
              )}
            </div>
          )}
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400"></div>
              <span className="font-semibold text-slate-400">ORCA-X — Ocean Reasoning & Collaborative AI</span>
              <span className="font-mono text-[10px] text-slate-600">| Smart India Hackathon Marine Intelligence</span>
            </div>
            <div className="text-[11px] text-slate-400 max-w-xl text-center sm:text-right leading-tight">
              ⚠️ <strong className="text-slate-300">Statutory Notice:</strong> {analysisData?.officialDisclaimer || dict.disclaimer}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
