import { MarineSourceId, MarineSourceObservation } from './marineDataSource.ts';

export interface SourceComparisonMetric {
  variable: string;
  values: Partial<Record<MarineSourceId, number>>;
  spread?: number;
  disagreement: boolean;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function read(source: MarineSourceObservation, variable: string): number | undefined {
  switch (variable) {
    case 'windSpeedKts':
      return finite(source.weather?.windSpeedKts) ? source.weather.windSpeedKts : undefined;
    case 'windGustKts':
      return finite(source.weather?.windGustKts) ? source.weather.windGustKts : undefined;
    case 'waveHeightMeters':
      return finite(source.ocean?.waveHeightMeters) ? source.ocean.waveHeightMeters : undefined;
    case 'wavePeriodSec':
      return finite(source.ocean?.wavePeriodSec) ? source.ocean.wavePeriodSec : undefined;
    case 'swellHeightMeters':
      return finite(source.ocean?.swellHeightMeters) ? source.ocean.swellHeightMeters : undefined;
    case 'swellPeriodSec':
      return finite(source.ocean?.swellPeriodSec) ? source.ocean.swellPeriodSec : undefined;
    case 'seaSurfaceTemperatureC':
      return finite(source.ocean?.seaSurfaceTemperatureC) ? source.ocean.seaSurfaceTemperatureC : undefined;
    default:
      return undefined;
  }
}

export function compareSources(observations: MarineSourceObservation[]): SourceComparisonMetric[] {
  const variables = [
    'windSpeedKts',
    'windGustKts',
    'waveHeightMeters',
    'wavePeriodSec',
    'swellHeightMeters',
    'swellPeriodSec',
    'seaSurfaceTemperatureC',
  ];

  return variables.map((variable) => {
    const values: Partial<Record<MarineSourceId, number>> = {};
    for (const observation of observations) {
      const current = read(observation, variable);
      if (current !== undefined) values[observation.source] = current;
    }

    const numbers = Object.values(values).filter(finite);
    const spread = numbers.length >= 2 ? Math.max(...numbers) - Math.min(...numbers) : undefined;
    const mean = numbers.length >= 2 ? numbers.reduce((sum, item) => sum + item, 0) / numbers.length : 0;
    const relativeSpread = mean !== 0 ? Math.abs((spread || 0) / mean) : 0;

    return { variable, values, spread, disagreement: relativeSpread > 0.25 };
  });
}
