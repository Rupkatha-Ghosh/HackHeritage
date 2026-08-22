import React from 'react';
import { Satellite, Sparkles, Droplet, Eye, CheckCircle, AlertTriangle, Clock, Scan, Compass, ExternalLink } from 'lucide-react';
import { SatelliteData, LocationInfo } from '../types';

interface SatelliteAnalysisViewProps {
  satellite: SatelliteData;
  location: LocationInfo;
}

const formatValue = (value: number | undefined, digits = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'N/A';

export const SatelliteAnalysisView: React.FC<SatelliteAnalysisViewProps> = ({ satellite, location }) => {
  const statusClass = satellite.status === 'LIVE'
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : satellite.status === 'DEGRADED'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-slate-400 bg-slate-800/50 border-slate-700';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Satellite className="h-5 w-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
              Satellite Observation Layer
            </h3>
            <p className="text-xs text-slate-400 font-mono">{satellite.satelliteName}</p>
          </div>
        </div>
        <span className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border ${statusClass}`}>
          {satellite.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Platform</div>
          <div className="text-sm font-bold text-slate-200 mt-1">{satellite.platform || 'Not reported'}</div>
        </div>
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Acquisition</div>
          <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            {satellite.acquisitionTime ? new Date(satellite.acquisitionTime).toLocaleString('en-IN', { timeZone: 'UTC' }) + ' UTC' : 'Unavailable'}
          </div>
        </div>
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Cloud cover</div>
          <div className="text-sm font-bold text-slate-200 mt-1">
            {typeof satellite.cloudCoverPct === 'number' ? `${formatValue(satellite.cloudCoverPct, 0)}%` : 'Not reported'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Metric title="Chlorophyll-a" icon={<Sparkles className="h-3.5 w-3.5 text-emerald-400" />} value={formatValue(satellite.chlorophyllConcentrationMgM3)} unit="mg/m³" note="Requires a retrieved Sentinel-3 water observation and pixel-level product processing." />
        <Metric title="SST Anomaly" icon={<Compass className="h-3.5 w-3.5 text-rose-400" />} value={formatValue(satellite.sstAnomalyC)} unit="°C" note="No synthetic anomaly is generated when a valid SST product is unavailable." />
        <Metric title="Turbidity / TSS" icon={<Droplet className="h-3.5 w-3.5 text-amber-400" />} value={formatValue(satellite.turbidityNTU)} unit="NTU" note="Derived only from an actual optical observation; not inferred from wave conditions." />
        <Metric title="SAR Roughness" icon={<Scan className="h-3.5 w-3.5 text-purple-400" />} value={formatValue(satellite.sarRoughnessIndex)} unit="index" note="Requires Sentinel-1 GRD backscatter processing; metadata alone is not treated as a roughness measurement." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <StatusCard title="Algal Bloom / Red Tide" active={satellite.algalBloomDetected} unavailable={satellite.algalBloomDetected === undefined} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatusCard title="Oceanic Frontal Zone" active={satellite.thermalFrontDetected} unavailable={satellite.thermalFrontDetected === undefined} icon={<Compass className="h-4 w-4" />} />
        <StatusCard title="Surface Slick Anomaly" active={satellite.surfaceSlickAnomalies} unavailable={satellite.surfaceSlickAnomalies === undefined} icon={<Eye className="h-4 w-4" />} />
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-200">Observation provenance</div>
            <div className="text-[11px] text-slate-500">{location.name} · {satellite.latitude.toFixed(4)}, {satellite.longitude.toFixed(4)}</div>
          </div>
          {satellite.productUrl && (
            <a href={satellite.productUrl} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-400 flex items-center gap-1">
              Product <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="text-[11px] text-slate-400">Source: {satellite.source}</div>
        {satellite.productId && <div className="text-[10px] font-mono text-slate-500 break-all">{satellite.productId}</div>}
      </div>

      {satellite.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
          {satellite.warnings.map((warning, index) => (
            <div key={index} className="text-[11px] text-amber-300 flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function Metric({ title, icon, value, unit, note }: { title: string; icon: React.ReactNode; value: string; unit: string; note: string }) {
  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
      <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">{icon}<span>{title}</span></div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-slate-100 font-mono">{value}</span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-tight pt-1 border-t border-slate-800/80">{note}</p>
    </div>
  );
}

function StatusCard({ title, active, unavailable, icon }: { title: string; active?: boolean; unavailable: boolean; icon: React.ReactNode }) {
  const text = unavailable ? 'Not derived from available observations' : active ? 'Detected by satellite processing' : 'No anomaly detected';
  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
      <div className={`p-2 rounded-lg ${unavailable ? 'bg-slate-800 text-slate-500' : active ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
        {unavailable ? icon : active ? icon : <CheckCircle className="h-4 w-4" />}
      </div>
      <div>
        <div className="font-bold text-slate-200">{title}</div>
        <div className="text-[11px] text-slate-400">{text}</div>
      </div>
    </div>
  );
}
