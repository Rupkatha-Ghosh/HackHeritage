import type { MarineSourceId } from './marineDataSource.ts';
import type { MarineObservation, MarineObservationVariable } from './marineObservation.ts';

export interface MarineSourceTelemetry {
  timestamp: string;
  latitude: number;
  longitude: number;
  sources: Array<{
    source: MarineSourceId;
    availability: MarineObservation['availability'];
    observedAt: string;
    ageHours: number;
    freshnessScore: number;
    completenessScore: number;
    qualityScore: number;
    missingVariables: MarineObservationVariable[];
    warningCount: number;
  }>;
  selectedSources: Partial<Record<'weather' | 'ocean', MarineSourceId>>;
  sourceScores: Partial<Record<MarineSourceId, number>>;
  disagreements: Array<{ variable: MarineObservationVariable; spread: number }>;
  warnings: string[];
}

const MAX_EVENTS = Number(process.env.REALTIME_TELEMETRY_MAX_EVENTS || 500);
const events: MarineSourceTelemetry[] = [];

export function recordMarineTelemetry(event: MarineSourceTelemetry): void {
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export function getMarineTelemetry(limit = 50): MarineSourceTelemetry[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), MAX_EVENTS);
  return events.slice(-safeLimit).reverse();
}

export function getMarineTelemetrySummary() {
  const latest = events.at(-1);
  const providerCounts: Record<string, number> = {};
  let degradedEvents = 0;
  let disagreementEvents = 0;
  for (const event of events) {
    for (const source of event.sources) providerCounts[source.source] = (providerCounts[source.source] || 0) + 1;
    if (event.sources.some((source) => source.availability !== 'LIVE')) degradedEvents += 1;
    if (event.disagreements.length > 0) disagreementEvents += 1;
  }
  return {
    bufferedEvents: events.length,
    maxEvents: MAX_EVENTS,
    degradedEvents,
    disagreementEvents,
    providerObservations: providerCounts,
    latestTimestamp: latest?.timestamp || null,
    latestSelectedSources: latest?.selectedSources || null,
  };
}
