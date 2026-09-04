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
  ArrowUpRight,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { WeatherData, OceanData, SatelliteData, LanguageCode } from '../types';
import { MULTILINGUAL_DICTIONARY } from '../data/coastalData';
import { localizeSeaState } from '../utils/presentationLocalization';

interface MarineTelemetryProps {
  weather: WeatherData;
  ocean: OceanData;
  satellite: SatelliteData;
  language: LanguageCode;
}

export const MarineTelemetry: React.FC<MarineTelemetryProps> = ({
  weather,
  ocean,
  satellite,
  language
}) => {
  const dict = MULTILINGUAL_DICTIONARY[language] || MULTILINGUAL_DICTIONARY.en;

  // Angle difference between wind and swell direction (Wind-against-tide steepening check)
  const angleDiff = Math.abs((weather.windDirectionDeg - ocean.swellDirectionDeg + 360) % 360);
  const isWindAgainstSwell = angleDiff >= 135 && angleDiff <= 225 && weather.windSpeedKts > 12;

  // Percentage calculations for gauges (clamped to 0-100)
  const wavePct = Math.min(100, Math.max(0, (ocean.waveHeightMeters / 4.0) * 100));
  const windPct = Math.min(100, Math.max(0, (weather.windSpeedKts / 35.0) * 100));
  const swellPct = Math.min(100, Math.max(0, (ocean.swellPeriodSec / 20.0) * 100));
  const currentPct = Math.min(100, Math.max(0, (ocean.currentSpeedKts / 3.0) * 100));

  return (
    <div className="space-y-4">

      {/* Section Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <Activity className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
            {dict.telemetryTitle || 'Live Telemetry & Vector Compass'}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
          Open-Meteo & Copernicus Feeds
        </span>
      </div>

      {/* Grid of Key Telemetry Cards + Compass Dial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">

        {/* 4 Primary Metric Cards (Col Span 8) */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-2 gap-3">

          {/* 1. Significant Wave Height */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md space-y-2 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Waves className="h-4 w-4 text-cyan-400" />
                <span className="font-semibold text-slate-200">{dict.significantWave || 'Wave Height (Hs)'}</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">{dict.max || 'Max'} {ocean.maxWaveHeightMeters}m</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">
                  {ocean.waveHeightMeters}
                </span>
                <span className="text-xs font-semibold text-slate-400">{dict.meters || 'meters'}</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                ocean.waveHeightMeters > 2.0
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : ocean.waveHeightMeters > 1.25
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {ocean.waveHeightMeters > 2.0 ? 'ROUGH' : ocean.waveHeightMeters > 1.25 ? 'MODERATE' : 'SLIGHT'}
              </span>
            </div>

            {/* Visual Gauge Bar */}
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-700 ${
                  ocean.waveHeightMeters > 2.0 ? 'bg-rose-500' : ocean.waveHeightMeters > 1.25 ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${wavePct}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span>{dict.period || 'Period'}: <strong className="text-slate-200">{ocean.wavePeriodSec}s</strong></span>
              <span>{dict.direction || 'Heading'}: <strong className="text-slate-200">{ocean.waveDirectionDeg}°</strong></span>
            </div>
          </div>

          {/* 2. Swell Wave Surge */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md space-y-2 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                <span className="font-semibold text-slate-200">{dict.swellPeriod || 'Swell Period'}</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-400 font-bold">{ocean.swellHeightMeters}m {dict.swell || 'Swell'}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">
                  {ocean.swellPeriodSec}
                </span>
                <span className="text-xs font-semibold text-slate-400">{dict.seconds || 'seconds'}</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                ocean.swellPeriodSec > 13 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {ocean.swellPeriodSec > 13 ? (dict.highSurge || 'SURGE HAZARD') : (dict.stable || 'STABLE')}
              </span>
            </div>

            {/* Visual Gauge Bar */}
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-700 ${ocean.swellPeriodSec > 13 ? 'bg-rose-500' : 'bg-indigo-400'}`}
                style={{ width: `${swellPct}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span>{dict.direction || 'Heading'}: <strong className="text-slate-200">{ocean.swellDirectionDeg}°</strong></span>
              <span className={ocean.swellPeriodSec > 13 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                {ocean.swellPeriodSec > 13 ? (dict.breakerSurge || 'Long Swell Surge') : (dict.shortChop || 'Short Swell')}
              </span>
            </div>
          </div>

          {/* 3. Wind Speed & Gusts */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md space-y-2 relative overflow-hidden group hover:border-sky-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Wind className="h-4 w-4 text-sky-400" />
                <span className="font-semibold text-slate-200">{dict.windSpeed || 'Wind Velocity'}</span>
              </span>
              <span className="text-[10px] font-mono text-sky-400 font-bold">{weather.windDirectionCompass} ({weather.windDirectionDeg}°)</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">
                  {weather.windSpeedKts}
                </span>
                <span className="text-xs font-semibold text-slate-400">{dict.knots || 'knots'}</span>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                {dict.gusts || 'Gust'} {weather.windGustKts} kts
              </span>
            </div>

            {/* Visual Gauge Bar */}
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-700 ${weather.windSpeedKts > 20 ? 'bg-rose-500' : weather.windSpeedKts > 12 ? 'bg-amber-400' : 'bg-sky-400'}`}
                style={{ width: `${windPct}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span>Gust Factor: <strong className="text-amber-400">{(weather.windGustKts / (weather.windSpeedKts || 1)).toFixed(1)}x</strong></span>
              <span>Beaufort Scale</span>
            </div>
          </div>

          {/* 4. Ocean Currents */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-md space-y-2 relative overflow-hidden group hover:border-teal-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Navigation2 className="h-4 w-4 text-teal-400" />
                <span className="font-semibold text-slate-200">{dict.currentVelocity || 'Current Speed'}</span>
              </span>
              <span className="text-[10px] font-mono text-teal-400 font-bold">{ocean.currentDirectionDeg}° {dict.set || 'Set'}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline space-x-1.5">
                <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">
                  {ocean.currentSpeedKts}
                </span>
                <span className="text-xs font-semibold text-slate-400">{dict.knots || 'knots'}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded">
                {dict.tide || 'Tide'} {ocean.tideHeightMeters}m
              </span>
            </div>

            {/* Visual Gauge Bar */}
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-teal-400 transition-all duration-700"
                style={{ width: `${currentPct}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span>Phase: <strong className="text-slate-200">{localizeSeaState(ocean.tidePhase, language)}</strong></span>
              <span>Drift Vector</span>
            </div>
          </div>

        </div>

        {/* High-Tech Vector Compass Dial (Col Span 4) */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between items-center relative overflow-hidden shadow-lg">
          <div className="w-full flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5 font-bold">
              <Compass className="h-4 w-4 text-cyan-400" />
              <span>Vector Dial</span>
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              isWindAgainstSwell
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-bold'
                : 'bg-slate-950 text-cyan-400 border-slate-800'
            }`}>
              {isWindAgainstSwell ? 'WIND-VS-SWELL' : 'CO-ALIGNED'}
            </span>
          </div>

          {/* Compass Visual Instrument */}
          <div className="relative w-36 h-36 my-2 flex items-center justify-center">

            {/* Outer Compass Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-slate-800 bg-slate-950/80 shadow-inner flex items-center justify-center">
              <div className="absolute top-1 text-[10px] font-mono font-bold text-slate-400">N</div>
              <div className="absolute right-1.5 text-[10px] font-mono font-bold text-slate-500">E</div>
              <div className="absolute bottom-1 text-[10px] font-mono font-bold text-slate-500">S</div>
              <div className="absolute left-1.5 text-[10px] font-mono font-bold text-slate-500">W</div>
            </div>

            {/* Inner Degree Tick Marks */}
            <svg className="w-full h-full transform -rotate-90 text-slate-800/80" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
            </svg>

            {/* Wind Vector Pointer (Sky/Cyan Needle) */}
            <div
              className="absolute w-full h-full flex items-center justify-center transition-transform duration-1000 ease-out"
              style={{ transform: `rotate(${weather.windDirectionDeg}deg)` }}
            >
              <div className="h-14 w-1 bg-gradient-to-t from-transparent via-sky-400 to-sky-300 rounded-t shadow-sm shadow-sky-400/50 -translate-y-4 relative">
                <div className="absolute -top-1 -left-1 text-sky-400">▲</div>
              </div>
            </div>

            {/* Swell Vector Pointer (Indigo/Rose Needle) */}
            <div
              className="absolute w-full h-full flex items-center justify-center transition-transform duration-1000 ease-out"
              style={{ transform: `rotate(${ocean.swellDirectionDeg}deg)` }}
            >
              <div className="h-10 w-0.5 bg-gradient-to-t from-transparent via-indigo-400 to-indigo-300 rounded-t -translate-y-2 relative opacity-80">
                <div className="absolute -top-1 -left-0.5 text-indigo-400 text-[8px]">●</div>
              </div>
            </div>

            {/* Central Hub Display */}
            <div className="absolute w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex flex-col items-center justify-center shadow-lg">
              <span className="text-[10px] font-black text-slate-100 font-mono">{weather.windDirectionCompass}</span>
              <span className="text-[8px] font-mono text-cyan-400">{weather.windDirectionDeg}°</span>
            </div>

          </div>

          {/* Compass Legend & Hazard Warning */}
          <div className="w-full space-y-1">
            <div className="flex items-center justify-around text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                <span>Wind ({weather.windDirectionDeg}°)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
                <span>Swell ({ocean.swellDirectionDeg}°)</span>
              </span>
            </div>
            {isWindAgainstSwell && (
              <p className="text-[10px] text-rose-300 bg-rose-500/10 p-1.5 rounded border border-rose-500/30 text-center font-mono leading-tight">
                ⚠️ Wind opposing swell heading! Risk of steep breaking waves.
              </p>
            )}
          </div>

        </div>

      </div>

      {/* Secondary Environmental Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        
        {/* 1. Sea Surface Temp */}
        <div className="bg-slate-950/95 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between space-y-2 hover:border-rose-500/40 transition-all min-w-0 shadow-sm">
          <div className="flex items-center space-x-1.5 min-w-0">
            <div className="p-1.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
              <Thermometer className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-extrabold text-slate-200 font-mono uppercase tracking-wider truncate">
              {dict.seaSurfaceTemp || 'Sea Surface Temp'}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-0.5 border-t border-slate-800/60">
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-white font-mono tracking-tight">
                {ocean.seaSurfaceTemperatureC.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-slate-400">°C</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50 shrink-0">
              {typeof satellite.sstAnomalyC === 'number' ? `+${satellite.sstAnomalyC.toFixed(1)}°C` : (dict.sstAnomaly || 'SST Live')}
            </span>
          </div>
        </div>

        {/* 2. Douglas Sea State */}
        <div className="bg-slate-950/95 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between space-y-2 hover:border-cyan-500/40 transition-all min-w-0 shadow-sm">
          <div className="flex items-center space-x-1.5 min-w-0">
            <div className="p-1.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
              <Compass className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-extrabold text-slate-200 font-mono uppercase tracking-wider truncate">
              {dict.douglasSeaState || 'Douglas Sea State'}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-0.5 border-t border-slate-800/60">
            <div className="flex items-baseline space-x-1">
              <span className="text-xs text-slate-400 font-mono font-bold uppercase">{dict.scale || 'Scale'}</span>
              <span className="text-xl font-black text-white font-mono tracking-tight">
                {ocean.seaStateIndex}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-200 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700 shrink-0">
              {localizeSeaState(ocean.seaStateDescription.split(' ')[0], language)}
            </span>
          </div>
        </div>

        {/* 3. Visibility & Rain */}
        <div className="bg-slate-950/95 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between space-y-2 hover:border-blue-500/40 transition-all min-w-0 shadow-sm">
          <div className="flex items-center space-x-1.5 min-w-0">
            <div className="p-1.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 shrink-0">
              <Eye className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-extrabold text-slate-200 font-mono uppercase tracking-wider truncate">
              {dict.visibility || 'Visibility'}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-0.5 border-t border-slate-800/60">
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-white font-mono tracking-tight">
                {weather.visibilityKm.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-slate-400">km</span>
            </div>
            <span className="text-[10px] font-mono text-slate-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700 shrink-0">
              {weather.precipitationMm}mm {dict.rain || 'rain'}
            </span>
          </div>
        </div>

        {/* 4. Barometric Pressure */}
        <div className="bg-slate-950/95 border border-slate-800/90 rounded-xl p-3 flex flex-col justify-between space-y-2 hover:border-purple-500/40 transition-all min-w-0 shadow-sm">
          <div className="flex items-center space-x-1.5 min-w-0">
            <div className="p-1.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 shrink-0">
              <Gauge className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-extrabold text-slate-200 font-mono uppercase tracking-wider truncate">
              {dict.surfacePressure || 'Surface Pressure'}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-0.5 border-t border-slate-800/60">
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-white font-mono tracking-tight">
                {weather.pressureHpa}
              </span>
              <span className="text-xs font-bold text-slate-400">hPa</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50 shrink-0">
              {dict.stable || 'Stable'}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
