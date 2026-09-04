import { OceanData, WeatherData } from '../../../src/types.ts';
import { MarineObservationSource, MarineSourceObservation } from './marineDataSource.ts';

const REQUEST_TIMEOUT_MS = Number(process.env.REALTIME_DATA_TIMEOUT_MS || 8000);

interface NormalizedProviderPayload {
  weather?: WeatherData;
  ocean?: OceanData;
  observedAt?: string;
  retrievedAt?: string;
  warnings?: string[];
}

function endpointFor(source: 'INCOIS' | 'MOSDAC'): string | undefined {
  return source === 'INCOIS' ? process.env.INCOIS_REALTIME_URL : process.env.MOSDAC_REALTIME_URL;
}

async function fetchConfigured(source: 'INCOIS' | 'MOSDAC', lat: number, lon: number): Promise<MarineSourceObservation> {
  const endpoint = endpointFor(source);
  if (!endpoint) {
    return {
      source,
      observedAt: new Date(0).toISOString(),
      retrievedAt: new Date().toISOString(),
      availability: 'UNAVAILABLE',
      warnings: [`${source} provider is not configured. No endpoint was assumed or invented.`],
      qualityScore: 0,
    };
  }

  const url = new URL(endpoint);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as NormalizedProviderPayload;
    const retrievedAt = payload.retrievedAt || new Date().toISOString();
    if (!payload.weather && !payload.ocean) throw new Error('Provider returned neither weather nor ocean data.');

    return {
      source,
      weather: payload.weather,
      ocean: payload.ocean,
      observedAt: payload.observedAt || payload.weather?.observedAt || payload.ocean?.observedAt || retrievedAt,
      retrievedAt,
      availability: 'LIVE',
      warnings: payload.warnings || [],
      qualityScore: 1,
    };
  } catch (error) {
    return {
      source,
      observedAt: new Date(0).toISOString(),
      retrievedAt: new Date().toISOString(),
      availability: 'DEGRADED',
      warnings: [`${source} request failed: ${error instanceof Error ? error.message : String(error)}`],
      qualityScore: 0,
    };
  }
}

export const incoisProvider: MarineObservationSource = {
  id: 'INCOIS',
  displayName: 'INCOIS',
  priority: 100,
  enabled: Boolean(process.env.INCOIS_REALTIME_URL),
  fetch: (lat, lon) => fetchConfigured('INCOIS', lat, lon),
};

export const mosdacProvider: MarineObservationSource = {
  id: 'MOSDAC',
  displayName: 'MOSDAC / ISRO',
  priority: 90,
  enabled: Boolean(process.env.MOSDAC_REALTIME_URL),
  fetch: (lat, lon) => fetchConfigured('MOSDAC', lat, lon),
};
