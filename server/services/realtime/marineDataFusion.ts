import { MarineObservationSource, MarineSourceObservation, FusedMarineObservation, MarineSourceId } from './marineDataSource.ts';
import { incoisProvider, mosdacProvider } from './configuredIndianProvider.ts';
import { fetchOpenMeteoCurrent } from './openMeteoProvider.ts';
import { compareSources } from './sourceComparison.ts';

const OPEN_METEO_PRIORITY = 50;
const MAX_STALENESS_HOURS = Number(process.env.REALTIME_MAX_STALENESS_HOURS || 3);

function ageHours(observedAt: string, nowMs: number): number {
  const value = Date.parse(observedAt);
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - value) / 3_600_000);
}

function score(source: MarineSourceObservation, nowMs: number, priority: number): number {
  if (source.availability === 'UNAVAILABLE') return 0;
  const age = ageHours(source.observedAt, nowMs);
  if (!Number.isFinite(age) || age > MAX_STALENESS_HOURS) return 0;
  const freshness = Math.max(0, 1 - age / MAX_STALENESS_HOURS);
  const completeness = Number(Boolean(source.weather)) * 0.5 + Number(Boolean(source.ocean)) * 0.5;
  const availability = source.availability === 'LIVE' ? 1 : 0.5;
  return Number((0.55 * freshness + 0.25 * completeness + 0.20 * availability + priority / 1000).toFixed(4));
}

function select<T>(sources: Array<{ source: MarineSourceObservation; score: number; value?: T }>): { value?: T; source?: MarineSourceId } {
  const selected = sources.filter((entry) => entry.value !== undefined && entry.score > 0).sort((a, b) => b.score - a.score)[0];
  return selected ? { value: selected.value, source: selected.source.source } : {};
}

async function openMeteoSource(lat: number, lon: number): Promise<MarineSourceObservation> {
  try {
    const result = await fetchOpenMeteoCurrent(lat, lon);
    return { source: 'OPEN_METEO', weather: result.weather, ocean: result.ocean, observedAt: result.weather.observedAt, retrievedAt: result.retrievedAt, availability: 'LIVE', warnings: [], qualityScore: 1 };
  } catch (error) {
    return { source: 'OPEN_METEO', observedAt: new Date(0).toISOString(), retrievedAt: new Date().toISOString(), availability: 'DEGRADED', warnings: [`Open-Meteo request failed: ${error instanceof Error ? error.message : String(error)}`], qualityScore: 0 };
  }
}

const configuredProviders = (): MarineObservationSource[] => [
  incoisProvider,
  mosdacProvider,
  { id: 'OPEN_METEO', displayName: 'Open-Meteo', priority: OPEN_METEO_PRIORITY, enabled: true, fetch: openMeteoSource },
];

export function getRealtimeSourceReadiness() {
  return configuredProviders().map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    enabled: provider.enabled,
    priority: provider.priority,
    configured: provider.id === 'OPEN_METEO'
      ? true
      : provider.id === 'INCOIS'
        ? Boolean(process.env.INCOIS_REALTIME_URL)
        : Boolean(process.env.MOSDAC_REALTIME_URL),
  }));
}

export async function fetchFusedRealtimeMarineObservation(lat: number, lon: number): Promise<FusedMarineObservation> {
  const providers = configuredProviders();
  const enabled = providers.filter((provider) => provider.enabled);
  const observations = await Promise.all(enabled.map((provider) => provider.fetch(lat, lon)));
  const nowMs = Date.now();
  const ranked = observations.map((source) => ({ source, score: score(source, nowMs, providers.find((p) => p.id === source.source)?.priority || 0) }));
  const weather = select(ranked.map((entry) => ({ ...entry, value: entry.source.weather })));
  const ocean = select(ranked.map((entry) => ({ ...entry, value: entry.source.ocean })));
  if (!weather.value || !ocean.value) throw new Error('No usable weather and ocean source is available for real-time inference.');
  const selectedSources = { weather: weather.source || 'OPEN_METEO', ocean: ocean.source || 'OPEN_METEO' } as Record<string, MarineSourceId>;
  const sourceScores = Object.fromEntries(ranked.map((entry) => [entry.source.source, entry.score])) as Record<MarineSourceId, number>;
  const comparison = compareSources(observations);
  const disagreementWarnings = comparison.filter((metric) => metric.disagreement).map((metric) => `Source disagreement detected for ${metric.variable}.`);
  const warnings = [...new Set([...ranked.flatMap((entry) => entry.source.warnings), ...disagreementWarnings])];
  const uniqueSources = [...new Set(ranked.filter((entry) => entry.score > 0).map((entry) => entry.source.source))];
  const dataQuality = uniqueSources.length >= 2 ? 'LIVE' : ranked.some((entry) => entry.source.availability === 'LIVE') ? 'LIVE' : 'DEGRADED';
  return { weather: { ...weather.value, source: weather.value.source || weather.source || 'OPEN_METEO' }, ocean: { ...ocean.value, source: ocean.value.source || ocean.source || 'OPEN_METEO' }, selectedSources, sourceScores, providers: uniqueSources, warnings, dataQuality, retrievedAt: new Date().toISOString() };
}
