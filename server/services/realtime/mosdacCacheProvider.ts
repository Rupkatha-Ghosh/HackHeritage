import { readFile } from 'node:fs/promises';
import type { MarineObservationSource, MarineSourceObservation } from './marineDataSource.ts';

const CACHE_FILE = process.env.MOSDAC_REALTIME_CACHE_FILE || 'data/realtime/mosdac_latest.json';

interface MosdacCachePayload {
  latitude?: number;
  longitude?: number;
  observedAt?: string;
  retrievedAt?: string;
  values?: Record<string, unknown>;
  warnings?: string[];
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function allowedValues(payload: MosdacCachePayload): NonNullable<MarineSourceObservation['values']> {
  const source = payload.values || {};
  const output: Record<string, number> = {};
  const supported = [
    'windSpeedKts', 'windGustKts', 'windDirectionDeg',
    'waveHeightMeters', 'wavePeriodSec', 'waveDirectionDeg',
    'swellHeightMeters', 'swellPeriodSec', 'swellDirectionDeg',
    'seaSurfaceTemperatureC', 'currentSpeedKts', 'currentDirectionDeg',
    'airTemperatureC', 'precipitationMm', 'pressureHpa', 'visibilityKm',
  ];
  for (const name of supported) if (finite(source[name])) output[name] = Number(source[name]);
  return output as NonNullable<MarineSourceObservation['values']>;
}

export const mosdacCacheProvider: MarineObservationSource = {
  id: 'MOSDAC',
  displayName: 'MOSDAC / ISRO normalized satellite cache',
  priority: 90,
  enabled: Boolean(process.env.MOSDAC_REALTIME_URL || process.env.MOSDAC_REALTIME_CACHE_FILE),
  async fetch(lat, lon): Promise<MarineSourceObservation> {
    const retrievedAt = new Date().toISOString();
    try {
      if (process.env.MOSDAC_REALTIME_URL) {
        const url = new URL(process.env.MOSDAC_REALTIME_URL);
        url.searchParams.set('latitude', String(lat));
        url.searchParams.set('longitude', String(lon));
        const response = await fetch(url, {
          signal: AbortSignal.timeout(Number(process.env.REALTIME_DATA_TIMEOUT_MS || 8000)),
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`MOSDAC normalized gateway HTTP ${response.status}`);
        const payload = await response.json() as MosdacCachePayload;
        const values = allowedValues(payload);
        if (!Object.keys(values).length) throw new Error('MOSDAC gateway returned no supported normalized values.');
        return {
          source: 'MOSDAC', observedAt: payload.observedAt || retrievedAt,
          retrievedAt: payload.retrievedAt || retrievedAt, availability: 'LIVE',
          values, qualityScore: 1, warnings: payload.warnings || [],
        };
      }

      const raw = await readFile(CACHE_FILE, 'utf-8');
      const payload = JSON.parse(raw) as MosdacCachePayload;
      const values = allowedValues(payload);
      if (!Object.keys(values).length) throw new Error('MOSDAC cache contains no supported normalized values.');
      const cacheLat = finite(payload.latitude) ? payload.latitude : lat;
      const cacheLon = finite(payload.longitude) ? payload.longitude : lon;
      const distance = Math.hypot(cacheLat - lat, cacheLon - lon);
      if (distance > Number(process.env.MOSDAC_MAX_CACHE_DISTANCE_DEG || 2)) {
        throw new Error(`MOSDAC cache point is too far from requested location (${distance.toFixed(2)}°).`);
      }
      return {
        source: 'MOSDAC', observedAt: payload.observedAt || retrievedAt,
        retrievedAt: payload.retrievedAt || retrievedAt, availability: 'LIVE',
        values, qualityScore: 1,
        warnings: [
          'MOSDAC values are supplied through the official MOSDAC download/API workflow and normalized locally before fusion.',
        ],
      };
    } catch (error) {
      return {
        source: 'MOSDAC', observedAt: new Date(0).toISOString(), retrievedAt,
        availability: 'DEGRADED', qualityScore: 0,
        warnings: [`MOSDAC source unavailable: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  },
};
