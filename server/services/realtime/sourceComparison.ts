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
  const weather = source.weather as Record<string, unknown> | undefined;
  const ocean = source.ocean as Record<string, unknown> | undefined;
  const group = ['windSpeedKts', 'windGustKts'].includes(variable) ? weather : ocean;
  const candidate = group?.[variable];
  return finite(candidate) ? candidate : undefined;
}

export function compareSources(observations: MarineSourceObservation[]): SourceComparisonMetric[] {
  const variables = ['windSpeedKts', 'windGustKts', 'waveHeightMeters', 'wavePeriodSec', 'swellHeightMeters', 'swellPeriodSec', 'seaSurfaceTemperatureC'];
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
