import { RealtimeObservationMetadata, WeatherData, OceanData } from '../../../src/types.ts';
import { fetchFusedRealtimeMarineObservation } from './marineDataFusion.ts';
import type { MarineSourceId } from './marineDataSource.ts';

export interface RealtimeMarineObservation {
  weather: WeatherData;
  ocean: OceanData;
  metadata: RealtimeObservationMetadata & {
    selectedSources: Record<string, MarineSourceId>;
    sourceScores: Record<MarineSourceId, number>;
  };
  degraded: boolean;
}

export async function fetchRealtimeMarineObservation(lat: number, lon: number): Promise<RealtimeMarineObservation> {
  const result = await fetchFusedRealtimeMarineObservation(lat, lon);
  return {
    weather: result.weather,
    ocean: result.ocean,
    metadata: {
      retrievedAt: result.retrievedAt,
      providers: result.providers,
      dataQuality: result.dataQuality,
      warnings: result.warnings.length > 0 ? result.warnings : [
        'Marine observations are advisory decision-support data and not a navigation substitute.',
      ],
      selectedSources: result.selectedSources,
      sourceScores: result.sourceScores,
    },
    degraded: result.dataQuality !== 'LIVE',
  };
}
