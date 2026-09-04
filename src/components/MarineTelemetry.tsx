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
  return (
    <div className="space-y-3">
      
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
            {dict.telemetryTitle}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          {dict.source}: Open-Meteo & Copernicus Marine
        </span>
      </div>

      {/* Grid of Key Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* 1. Significant Wave Height */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Waves className="h-3.5 w-3.5 text-cyan-400" />
              <span>{dict.significantWave}</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400">{dict.max} {ocean.maxWaveHeightMeters}m</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {ocean.waveHeightMeters}
            </span>
            <span className="text-xs font-semibold text-slate-400">{dict.meters}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>{dict.period}: <strong className="text-slate-200">{ocean.wavePeriodSec}s</strong></span>
            <span>{dict.direction}: <strong className="text-slate-200">{ocean.waveDirectionDeg}°</strong></span>
          </div>
        </div>

        {/* 2. Swell Wave Surge */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />
              <span>{dict.swellPeriod}</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400">{ocean.swellHeightMeters}m Swell</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {ocean.swellPeriodSec}
            </span>
            <span className="text-xs font-semibold text-slate-400">{dict.seconds}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>{dict.direction}: <strong className="text-slate-200">{ocean.swellDirectionDeg}°</strong></span>
            <span className={ocean.swellPeriodSec > 13 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
              {ocean.swellPeriodSec > 13 ? dict.highSurge : dict.stable}
            </span>
          </div>
        </div>

        {/* 3. Wind Speed & Gusts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Wind className="h-3.5 w-3.5 text-sky-400" />
              <span>{dict.windSpeed}</span>
            </span>
            <span className="text-[10px] font-mono text-sky-400">{weather.windDirectionCompass} ({weather.windDirectionDeg}°)</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {weather.windSpeedKts}
            </span>
            <span className="text-xs font-semibold text-slate-400">{dict.knots}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>{dict.gusts}: <strong className="text-amber-400">{weather.windGustKts} kts</strong></span>
            <span>{language === 'bn' ? 'বিউফোর্ট ৪' : language === 'hi' ? 'ब्यूफोर्ट ४' : language === 'ta' ? 'பியூஃபோர்ட் 4' : language === 'or' ? 'ବିଉଫୋର୍ଟ ୪' : language === 'te' ? 'బ్యూఫోర్ట్ 4' : 'Beaufort 4'}</span>
          </div>
        </div>

        {/* 4. Ocean Currents */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Navigation2 className="h-3.5 w-3.5 text-teal-400" />
              <span>{dict.currentVelocity}</span>
            </span>
            <span className="text-[10px] font-mono text-teal-400">{ocean.currentDirectionDeg}° {dict.set}</span>
          </div>
          <div className="flex items-baseline space-x-1.5 pt-1">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {ocean.currentSpeedKts}
            </span>
            <span className="text-xs font-semibold text-slate-400">{dict.knots}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>{dict.tide}: <strong className="text-slate-200">{localizeSeaState(ocean.tidePhase, language)}</strong></span>
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
              <div className="text-[10px] text-slate-400 font-mono uppercase">{dict.seaSurfaceTemp}</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {ocean.seaSurfaceTemperatureC.toFixed(1)}°C
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-cyan-400">
            {typeof satellite.sstAnomalyC === 'number' ? `+${satellite.sstAnomalyC.toFixed(2)}°C` : dict.sstAnomaly}
          </span>
        </div>

        {/* Douglas Sea State */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Compass className="h-4 w-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase">{dict.douglasSeaState}</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {dict.scale} {ocean.seaStateIndex}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
            {localizeSeaState(ocean.seaStateDescription.split(' ')[0], language)}
          </span>
        </div>

        {/* Visibility & Rain */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="h-4 w-4 text-blue-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase">{dict.visibility}</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {weather.visibilityKm.toFixed(1)} km
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {weather.precipitationMm} mm {dict.rain}
          </span>
        </div>

        {/* Barometric Pressure */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gauge className="h-4 w-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase">{dict.surfacePressure}</div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {weather.pressureHpa} hPa
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            {dict.stable}
          </span>
        </div>

      </div>

    </div>
  );
};
