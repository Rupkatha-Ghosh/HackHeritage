import type { MarineObservationSource, MarineSourceObservation, FusedMarineObservation, MarineSourceId } from './marineDataSource.ts';
import { incoisProvider, mosdacProvider } from './configuredIndianProvider.ts';
import { fetchOpenMeteoCurrent } from './openMeteoProvider.ts';
import { compareSources } from './sourceComparison.ts';
import { normalizeMarineObservation } from './marineObservation.ts';
import { recordMarineTelemetry } from './marineTelemetry.ts';

const OPEN_METEO_PRIORITY = 50;
const MAX_STALENESS_HOURS = Number(process.env.REALTIME_MAX_STALENESS_HOURS || 3);

function select<T>(sources: Array<{ source: import('./marineObservation.ts').MarineObservation; score: number; value?: T }>): { value?: T; source?: MarineSourceId } {
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
  const rawObservations = await Promise.all(enabled.map((provider) => provider.fetch(lat, lon)));
  const retrievedAt = new Date().toISOString();
  const normalizedSources = rawObservations.map((source) => normalizeMarineObservation(
    source.source,
    source.availability,
    lat,
    lon,
    source.observedAt,
    source.retrievedAt || retrievedAt,
    source.weather,
    source.ocean,
    source.warnings,
  ));
  const ranked = normalizedSources.map((source) => ({
    source,
    score: Number.isFinite(source.ageHours) && source.ageHours <= MAX_STALENESS_HOURS
      ? Number((source.qualityScore + (providers.find((p) => p.id === source.source)?.priority || 0) / 1000).toFixed(4))
      : 0,
  }));
  const weather = select(ranked.map((entry) => ({ source: entry.source, score: entry.score, value: entry.source.weather })));
  const ocean = select(ranked.map((entry) => ({ source: entry.source, score: entry.score, value: entry.source.ocean })));
  if (!weather.value || !ocean.value) throw new Error('No usable weather and ocean source is available for real-time inference.');

  const selectedSources = { weather: weather.source || 'OPEN_METEO', ocean: ocean.source || 'OPEN_METEO' } as Record<string, MarineSourceId>;
  const sourceScores = Object.fromEntries(ranked.map((entry) => [entry.source.source, entry.score])) as Record<MarineSourceId, number>;
  const comparison = compareSources(normalizedSources);
  const disagreementWarnings = comparison.filter((metric) => metric.disagreement).map((metric) => `Source disagreement detected for ${metric.variable} (${((metric.relativeSpread || 0) * 100).toFixed(0)}% relative spread).`);
  const validationWarnings = normalizedSources.flatMap((source) => source.missingVariables.length > 0
    ? [`${source.source}: ${source.missingVariables.length} normalized variables are missing.`]
    : []);
  const warnings = [...new Set([...normalizedSources.flatMap((source) => source.warnings), ...validationWarnings, ...disagreementWarnings])];
  const uniqueSources = [...new Set(ranked.filter((entry) => entry.score > 0).map((entry) => entry.source.source))];
  const dataQuality = uniqueSources.length >= 2 ? 'LIVE' : ranked.some((entry) => entry.source.availability === 'LIVE' && entry.score > 0) ? 'LIVE' : 'DEGRADED';

  recordMarineTelemetry({
    timestamp: retrievedAt,
    latitude: lat,
    longitude: lon,
    sources: normalizedSources.map((source) => ({
      source: source.source,
      availability: source.availability,
      observedAt: source.observedAt,
      ageHours: Number.isFinite(source.ageHours) ? Number(source.ageHours.toFixed(3)) : source.ageHours,
      freshnessScore: source.freshnessScore,
      completenessScore: source.completenessScore,
      qualityScore: source.qualityScore,
      missingVariables: source.missingVariables,
      values: source.values,
      warningCount: source.warnings.length,
    })),
    selectedSources,
    sourceScores,
    disagreements: comparison.filter((metric) => metric.disagreement).map((metric) => ({ variable: metric.variable, spread: metric.spread || 0 })),
    warnings,
  });

  return {
    weather: { ...weather.value, source: weather.value.source || weather.source || 'OPEN_METEO', retrievedAt },
    ocean: { ...ocean.value, source: ocean.value.source || ocean.source || 'OPEN_METEO', retrievedAt },
    normalizedSources,
    selectedSources,
    sourceScores,
    providers: uniqueSources,
    warnings,
    dataQuality,
    retrievedAt,
  };
}
