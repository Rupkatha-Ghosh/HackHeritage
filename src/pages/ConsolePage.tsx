import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, BrainCircuit, Database, FileText, Globe2, Layers3, Map, MessageSquare, Radio, Satellite, Search, ShieldCheck, SlidersHorizontal, Sparkles, Waves } from "lucide-react";
import { AgentExecutionTimeline } from "../components/AgentExecutionTimeline";
import { FeatureContributions } from "../components/FeatureContributions";
import { GroundedEvidenceDrawer } from "../components/GroundedEvidenceDrawer";
import { InteractiveMap } from "../components/InteractiveMap";
import { MarineTelemetry } from "../components/MarineTelemetry";
import { SatelliteAnalysisView } from "../components/SatelliteAnalysisView";
import { WhatIfSimulator } from "../components/WhatIfSimulator";
import { OrcaAnalysisResponse, LanguageCode } from "../types";
import { COASTAL_LOCATIONS, MULTILINGUAL_DICTIONARY } from "../data/coastalData";

interface ConsolePageProps {
  analysisData: OrcaAnalysisResponse;
  language: LanguageCode;
  onQuery: (query: string) => void;
}

export const ConsolePage: React.FC<ConsolePageProps> = ({ analysisData, language, onQuery }) => {
  const dict = MULTILINGUAL_DICTIONARY[language] || MULTILINGUAL_DICTIONARY.en;
  const [currentTab, setCurrentTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onQuery(trimmed);
  }, [onQuery, query]);

  const handleLocationSelect = useCallback((key: string) => {
    const location = COASTAL_LOCATIONS[key];
    if (!location) return;
    onQuery(`Show current marine risk for ${location.name}`);
  }, [onQuery]);

  const handleMapCoordinateClick = useCallback((latitude: number, longitude: number) => {
    onQuery(`Analyze marine conditions near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
  }, [onQuery]);

  const tabs = useMemo(() => [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "evidence", label: "Evidence", icon: FileText },
    { key: "satellite", label: "Satellite", icon: Satellite },
    { key: "telemetry", label: "Telemetry", icon: Radio },
  ], []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2">
              <Waves className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-[0.2em]">ORCA-X</h1>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Ocean Reasoning & Collaborative AI</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Decision-support mode
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask ORCA-X about current marine risk, forecasts, or evidence..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition focus:border-cyan-500/60"
              />
            </div>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">
              <Search className="h-4 w-4" />
              Analyze
            </button>
          </form>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCurrentTab(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${currentTab === key ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {currentTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><BrainCircuit className="h-4 w-4" /> Risk</div>
                <div className="text-3xl font-black">{analysisData.risk.riskLevel}</div>
                <div className="mt-1 text-xs text-slate-500">Score {Number(analysisData.risk.riskScore).toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Globe2 className="h-4 w-4" /> Location</div>
                <div className="text-xl font-black">{analysisData.location.name}</div>
                <div className="mt-1 text-xs text-slate-500">{analysisData.location.latitude.toFixed(4)}, {analysisData.location.longitude.toFixed(4)}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Database className="h-4 w-4" /> Evidence</div>
                <div className="text-3xl font-black">{analysisData.evidence?.length ?? 0}</div>
                <div className="mt-1 text-xs text-slate-500">Retrieved grounding items</div>
              </div>
            </div>

            <InteractiveMap
              location={analysisData.location}
              gisLayers={analysisData.gisLayers}
              ocean={analysisData.ocean}
              riskLevel={analysisData.risk.riskLevel}
              onSelectLocation={handleLocationSelect}
              onCoordinateClick={handleMapCoordinateClick}
              language={language}
            />

            <FeatureContributions risk={analysisData.risk} language={language} />
            <AgentExecutionTimeline traces={analysisData.agentTraces} />
          </div>
        )}

        {currentTab === "evidence" && (
          <div className="space-y-6">
            <GroundedEvidenceDrawer evidence={analysisData.evidence} language={language} />
            <button onClick={() => setShowEvidence(true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900">Open evidence details</button>
            {showEvidence && <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">{dict.evidenceSummary || "Grounded evidence retrieved from the configured knowledge sources."}</div>}
          </div>
        )}

        {currentTab === "satellite" && (
          <div className="space-y-6">
            <SatelliteAnalysisView
              satellite={analysisData.satellite}
              location={analysisData.location}
              language={language}
            />
            <InteractiveMap
              location={analysisData.location}
              gisLayers={analysisData.gisLayers}
              ocean={analysisData.ocean}
              riskLevel={analysisData.risk.riskLevel}
              onSelectLocation={handleLocationSelect}
              onCoordinateClick={handleMapCoordinateClick}
              language={language}
            />
          </div>
        )}

        {currentTab === "telemetry" && (
          <MarineTelemetry
            weather={analysisData.weather}
            ocean={analysisData.ocean}
            satellite={analysisData.satellite}
            language={language}
          />
        )}

        {analysisData.warnings?.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300">
            <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Operational warnings</div>
            <ul className="space-y-1">{analysisData.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </div>
        )}
      </main>
    </div>
  );
};
