import { SatelliteData, SatelliteObservation } from '../../types.ts';

type StacItem = {
  id?: string;
  type?: string;
  collection?: string;
  properties?: Record<string, unknown>;
  links?: Array<{ rel?: string; href?: string }>;
};

const COLLECTIONS = {
  s3OlciWater: ['sentinel-3-olci-2-wfr-nrt', 'sentinel-3-olci-2-wfr-ntc', 'sentinel-3-olci-2-wrr-nrt', 'sentinel-3-olci-2-wrr-ntc'],
  s3WaterTemperature: ['sentinel-3-sl-2-wst-nrt', 'sentinel-3-sl-2-wst-ntc'],
  s1Grd: ['sentinel-1-grd'],
  s2L2a: ['sentinel-2-l2a'],
};

function getStacConfig() {
  const baseUrl = (process.env.COPERNICUS_STAC_URL || 'https://stac.dataspace.copernicus.eu/v1').replace(/\/$/, '');
  return { baseUrl, searchUrl: `${baseUrl}/search`, browserUrl: 'https://browser.stac.dataspace.copernicus.eu' };
}

function toIso(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date.toISOString();
}

function bboxAroundPoint(lat: number, lon: number, radiusDegrees = 0.15): [number, number, number, number] {
  return [lon - radiusDegrees, lat - radiusDegrees, lon + radiusDegrees, lat + radiusDegrees];
}

function findItemUrl(item: StacItem): string | undefined {
  const { browserUrl } = getStacConfig();
  const self = item.links?.find(link => link.rel === 'self')?.href;
  return self || (item.id ? `${browserUrl}/collection/${item.collection}/item/${encodeURIComponent(item.id)}` : undefined);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => v * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function observationPoint(item: StacItem): [number, number] | undefined {
  const geometry = (item as any).geometry;
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) return [Number(geometry.coordinates[1]), Number(geometry.coordinates[0])];
  const bbox = (item as any).bbox;
  if (Array.isArray(bbox) && bbox.length >= 4) return [Number((bbox[1] + bbox[3]) / 2), Number((bbox[0] + bbox[2]) / 2)];
  return undefined;
}

async function searchCollection(collectionId: string, lat: number, lon: number, start: string, end: string, limit = 5): Promise<StacItem[]> {
  const { searchUrl } = getStacConfig();
  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/geo+json, application/json' },
    body: JSON.stringify({ collections: [collectionId], bbox: bboxAroundPoint(lat, lon), datetime: `${start}/${end}`, limit, sortby: [{ field: 'datetime', direction: 'desc' }] }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Copernicus STAC ${response.status}: ${(await response.text().catch(() => '')).slice(0, 180)}`);
  const json = await response.json() as { features?: StacItem[] };
  return Array.isArray(json.features) ? json.features : [];
}

async function searchFirstAvailable(collectionIds: string[], lat: number, lon: number, start: string, end: string): Promise<StacItem | undefined> {
  for (const collectionId of collectionIds) {
    try {
      const items = await searchCollection(collectionId, lat, lon, start, end, 3);
      if (items.length) return items[0];
    } catch (error) {
      console.warn(`[Satellite] ${collectionId} search failed:`, error instanceof Error ? error.message : error);
    }
  }
  return undefined;
}

function toObservation(item: StacItem, lat: number, lon: number): SatelliteObservation {
  const properties = item.properties || {};
  const point = observationPoint(item);
  return {
    collectionId: item.collection || 'unknown',
    collectionTitle: String(properties.title || item.collection || 'Copernicus product'),
    productId: item.id || 'unknown',
    productUrl: findItemUrl(item),
    platform: String(properties.platform || properties.constellation || '') || undefined,
    instrument: String(properties.instruments || '') || undefined,
    acquisitionTime: String(properties.datetime || properties.start_datetime || '') || undefined,
    cloudCoverPct: typeof properties['eo:cloud_cover'] === 'number' ? properties['eo:cloud_cover'] : undefined,
    distanceKm: point ? distanceKm(lat, lon, point[0], point[1]) : undefined,
  };
}

function ageHours(iso?: string): number | undefined {
  if (!iso) return undefined;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? undefined : Math.max(0, (Date.now() - time) / 3600000);
}

function buildNoObservation(lat: number, lon: number, warnings: string[]): SatelliteData {
  const { baseUrl } = getStacConfig();
  return {
    status: 'UNAVAILABLE',
    satelliteName: 'Copernicus Sentinel observation search',
    processingTime: new Date().toISOString(),
    latitude: lat,
    longitude: lon,
    source: 'Copernicus Data Space Ecosystem STAC Catalogue',
    sourceUrl: baseUrl,
    observationType: 'NO_OBSERVATION',
    warnings,
    observations: [],
  };
}

export async function fetchSatelliteData(lat: number, lon: number, resolvedStartTime: string, resolvedEndTime: string): Promise<SatelliteData> {
  const { baseUrl } = getStacConfig();
  const now = new Date();
  const requestedStart = new Date(toIso(resolvedStartTime));
  const requestedEnd = new Date(toIso(resolvedEndTime));
  const searchEnd = new Date(Math.min(requestedEnd.getTime(), now.getTime()));
  if (requestedStart > requestedEnd) return buildNoObservation(lat, lon, ['Invalid satellite observation window: start time is after end time.']);

  const searchStart = new Date(searchEnd.getTime() - 7 * 24 * 3600000);
  if (searchEnd <= searchStart) return buildNoObservation(lat, lon, ['No valid satellite observation window could be constructed.']);

  const start = searchStart.toISOString();
  const end = searchEnd.toISOString();
  const warnings: string[] = [];
  const observations: SatelliteObservation[] = [];

  const [olci, wst, s1, s2] = await Promise.all([
    searchFirstAvailable(COLLECTIONS.s3OlciWater, lat, lon, start, end),
    searchFirstAvailable(COLLECTIONS.s3WaterTemperature, lat, lon, start, end),
    searchFirstAvailable(COLLECTIONS.s1Grd, lat, lon, start, end),
    searchFirstAvailable(COLLECTIONS.s2L2a, lat, lon, start, end),
  ]);
  for (const item of [olci, wst, s1, s2]) if (item) observations.push(toObservation(item, lat, lon));

  if (!observations.length) return buildNoObservation(lat, lon, [
    'No matching Copernicus Sentinel observation was found for the last 7 days around the requested location.',
    'Satellite-derived ocean indicators are therefore not available for this analysis.',
  ]);

  const primary = observations[0];
  const optical = observations.find(o => o.collectionId.includes('olci'));
  const s1Observation = observations.find(o => o.collectionId === 'sentinel-1-grd');
  const cloudValues = observations.map(o => o.cloudCoverPct).filter((v): v is number => typeof v === 'number');
  const cloudCoverPct = cloudValues.length ? Math.min(...cloudValues) : undefined;

  if (!optical) warnings.push('No Sentinel-3 OLCI water observation was found; chlorophyll/turbidity metrics are unavailable.');
  if (!s1Observation) warnings.push('No Sentinel-1 GRD observation was found; SAR roughness/slick metrics are unavailable.');
  if (!wst) warnings.push('No Sentinel-3 water-surface-temperature product was found; SST metrics are unavailable.');
  if (!s2) warnings.push('No Sentinel-2 L2A observation was found in the search window.');
  if (typeof cloudCoverPct === 'number' && cloudCoverPct > 60) warnings.push(`Best matching optical observation has high cloud cover (${cloudCoverPct.toFixed(0)}%).`);

  return {
    status: warnings.length ? 'DEGRADED' : 'LIVE',
    satelliteName: 'Copernicus Sentinel observation catalogue',
    platform: primary.platform,
    productId: primary.productId,
    productUrl: primary.productUrl,
    acquisitionTime: primary.acquisitionTime,
    processingTime: new Date().toISOString(),
    latitude: lat,
    longitude: lon,
    cloudCoverPct,
    confidenceScore: undefined,
    source: 'Copernicus Data Space Ecosystem STAC Catalogue',
    sourceUrl: baseUrl,
    observationType: 'OBSERVATION',
    observationAgeHours: ageHours(primary.acquisitionTime),
    warnings,
    observations,
  };
}
