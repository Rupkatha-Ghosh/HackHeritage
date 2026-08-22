import React from 'react';
import { 
  Waves, 
  Wind, 
  Compass, 
  Thermometer, 
  Gauge, 
  Eye, 
  Droplets, 
  Navigation2, 
  Clock, 
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { WeatherData, OceanData, SatelliteData } from '../types';

interface MarineTelemetryProps {
  weather: WeatherData;
  ocean: OceanData;
  satellite: SatelliteData;
}

export const MarineTelemetry: React.FC<MarineTelemetryProps> = ({
  weather,
  ocean,
  satellite
}) => {
  return (
    <div className="space-y-3">
      
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
            Marine & Atmospheric Telemetry
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          Source: Open-Meteo & Copernicus Marine
        </span>
      </div>

      {/* Grid of Key Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* 1. Significant Wave Height */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Waves className="h-3.5 w-3.5 text-cyan-400" />
              <span>Wave Height (Hs)</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400">Max {ocean.maxWaveHeightMeters}m</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {ocean.waveHeightMeters}
            </span>
            <span className="text-xs font-semibold text-slate-400">meters</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>Period: <strong className="text-slate-200">{ocean.wavePeriodSec}s</strong></span>
            <span>Dir: <strong className="text-slate-200">{ocean.waveDirectionDeg}°</strong></span>
          </div>
        </div>

        {/* 2. Swell Wave Surge */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />
              <span>Swell Wave Period</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400">{ocean.swellHeightMeters}m Swell</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {ocean.swellPeriodSec}
            </span>
            <span className="text-xs font-semibold text-slate-400">seconds</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>Dir: <strong className="text-slate-200">{ocean.swellDirectionDeg}°</strong></span>
            <span className={ocean.swellPeriodSec > 13 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
              {ocean.swellPeriodSec > 13 ? 'High Surge' : 'Stable'}
            </span>
          </div>
        </div>

        {/* 3. Wind Speed & Gusts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Wind className="h-3.5 w-3.5 text-sky-400" />
              <span>Wind Speed</span>
            </span>
            <span className="text-[10px] font-mono text-sky-400">{weather.windDirectionCompass} ({weather.windDirectionDeg}°)</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {weather.windSpeedKts}
            </span>
            <span className="text-xs font-semibold text-slate-400">knots</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>Gusts: <strong className="text-amber-400">{weather.windGustKts} kts</strong></span>
            <span>Beaufort 4</span>
          </div>
        </div>

        {/* 4. Ocean Currents */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Navigation2 className="h-3.5 w-3.5 text-teal-400" />
              <span>Current Velocity</span>
            </span>
            <span className="text-[10px] font-mono text-teal-400">{ocean.currentDirectionDeg}° Set</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {ocean.currentSpeedKts}
            </span>
            <span className="text-xs font-semibold text-slate-400">knots</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>Tide: <strong className="text-slate-200">{ocean.tidePhase}</strong></span>
            <span>{ocean.tideHeightMeters}m</span>
          </div>
        </div>

      </div>

      {/* Secondary Environmental Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        
        {/* Sea Surface Temp */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Thermometer className="h-4 w-4 text-rose-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase">Sea Surface Temp</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {ocean.seaSurfaceTemperatureC.toFixed(1)}°C
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-cyan-400">
            {typeof satellite.sstAnomalyC === 'number' ? `+${satellite.sstAnomalyC.toFixed(2)}°C Anom` : 'SST anomaly N/A'}
          </span>
        </div>

        {/* Douglas Sea State */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Compass className="h-4 w-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase">Douglas Sea State</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                Scale {ocean.seaStateIndex}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
            {ocean.seaStateDescription.split(' ')[0]}
          </span>
        </div>

        {/* Visibility & Rain */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="h-4 w-4 text-blue-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase">Visibility</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {weather.visibilityKm.toFixed(1)} km
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {weather.precipitationMm} mm rain
          </span>
        </div>

        {/* Barometric Pressure */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gauge className="h-4 w-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase">Surface Pressure</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {weather.pressureHpa} hPa
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            Stable
          </span>
        </div>

      </div>

    </div>
  );
};
