import React, { useState } from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  Radio, 
  Zap, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { AgentStepTrace } from '../types';

interface AgentExecutionTimelineProps {
  traces: AgentStepTrace[];
  queryId: string;
}

export const AgentExecutionTimeline: React.FC<AgentExecutionTimelineProps> = ({
  traces,
  queryId
}) => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const toggleExpand = (name: string) => {
    setExpandedAgent(expandedAgent === name ? null : name);
  };

  const getAgentIcon = (name: string) => {
    switch (name) {
      case 'Planner':
        return '🧠';
      case 'LocationTimeResolver':
        return '📍';
      case 'WeatherAgent':
        return '🌦️';
      case 'OceanAgent':
        return '🌊';
      case 'SatelliteAgent':
        return '🛰️';
      case 'RiskEngine':
        return '⚙️';
      case 'GisAgent':
        return '🗺️';
      case 'EvidenceRetrieval':
        return '📚';
      case 'ResponseGrounding':
        return '✨';
      default:
        return '🤖';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <GitBranch className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
            LangGraph Multi-Agent Orchestration Audit
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
          <span className="bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
            Trace ID: {queryId}
          </span>
          <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
            All Nodes Validated
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-300">
        Deterministic multi-agent execution pipeline with state isolation, parallelized environmental connectors, and strict grounding verification before LLM response generation.
      </p>

      {/* Interactive Workflow Node Chain */}
      <div className="space-y-2.5 pt-1">
        {traces.map((trace, index) => {
          const isExpanded = expandedAgent === trace.agentName;
          const isCompleted = trace.status === 'completed';
          const isFailed = trace.status === 'failed';
          const isRunning = trace.status === 'running';

          return (
            <div
              key={index}
              className={`border rounded-xl transition-all overflow-hidden ${
                isCompleted 
                  ? 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700' 
                  : isFailed
                  ? 'bg-rose-950/30 border-rose-800/60'
                  : 'bg-cyan-950/20 border-cyan-500/40'
              }`}
            >
              {/* Agent Node Header Bar */}
              <button
                onClick={() => toggleExpand(trace.agentName)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="text-base shrink-0">{getAgentIcon(trace.agentName)}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-100 font-mono">
                        {trace.agentName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({index + 1} of {traces.length})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[280px] sm:max-w-md">
                      {trace.outputSummary || trace.inputSummary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {trace.durationMs && (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-900">
                      {trace.durationMs}ms
                    </span>
                  )}
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : isRunning ? (
                    <Clock className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Execution Inspector */}
              {isExpanded && (
                <div className="px-3.5 py-3 border-t border-slate-800/80 bg-slate-950 space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">Input Schema:</span>
                    <p className="text-slate-200 mt-0.5 bg-slate-900/90 p-2 rounded border border-slate-800">
                      {trace.inputSummary}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">Output Result:</span>
                    <p className="text-emerald-300 mt-0.5 bg-slate-900/90 p-2 rounded border border-slate-800">
                      {trace.outputSummary || 'In progress...'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">Execution Telemetry Logs:</span>
                    <div className="bg-black/80 rounded p-2 text-[11px] text-slate-400 space-y-1 mt-0.5 border border-slate-800">
                      {trace.logs.map((log, lIdx) => (
                        <div key={lIdx} className="flex items-center space-x-1.5">
                          <span className="text-cyan-500">{'>'}</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
