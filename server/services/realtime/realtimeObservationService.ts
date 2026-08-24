import { RealtimeObservationMetadata } from '../../../src/types.ts';
import { fetchOpenMeteoCurrent } from './openMeteoProvider.ts';

export interface RealtimeMarineObservation {
  weather: Awaited<ReturnType<typeof fetchOpenMeteoCurrent>>['weather'];
  ocean: Awaited<ReturnType<typeof fetchOpenMeteoCurrent>>['ocean'];
  metadata: RealtimeObservationMetadata;
  degraded: boolean;
}

export async function fetchRealtimeMarineObservation(lat: number, lon: number): Promise<RealtimeMarineObservation> {
  const result = await fetchOpenMeteoCurrent(lat, lon);
  return {
    weather: result.weather,
    ocean: result.ocean,
    metadata: {
      retrievedAt: result.retrievedAt,
      providers: ['Open-Meteo Weather API', 'Open-Meteo Marine API'],
      dataQuality: 'LIVE',
      warnings: [
        'Open-Meteo marine currents and tides are model-derived and have limited coastal accuracy; they are advisory data, not a navigation substitute.',
      ],
    },
    degraded: false,
  };
}
