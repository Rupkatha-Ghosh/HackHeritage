import type { OceanData, WeatherData } from '../../../src/types.ts';
import type { MarineObservation } from './marineObservation.ts';

export type MarineSourceId = 'INCOIS' | 'MOSDAC' | 'OPEN_METEO';
export type SourceAvailability = 'LIVE' | 'DEGRADED' | 'UNAVAILABLE';

export interface MarineObservationSource {
  id: MarineSourceId;
  displayName: string;
  priority: number;
  enabled: boolean;
  fetch(lat: number, lon: number): Promise<MarineSourceObservation>;
}

export interface MarineSourceObservation {
  source: MarineSourceId;
  weather?: WeatherData;
  ocean?: OceanData;
  observedAt: string;
  retrievedAt: string;
  availability: SourceAvailability;
  warnings: string[];
  qualityScore: number;
}

export interface FusedMarineObservation {
  weather: WeatherData;
  ocean: OceanData;
  normalizedSources: MarineObservation[];
  selectedSources: Record<string, MarineSourceId>;
  sourceScores: Record<MarineSourceId, number>;
  providers: MarineSourceId[];
  warnings: string[];
  dataQuality: 'LIVE' | 'DEGRADED' | 'UNAVAILABLE';
  retrievedAt: string;
}
