import { GeofenceAlert, GeofenceBreachSeverity, GeofenceSpatialAnalysis, LocationInfo } from '../../src/types.ts';
import { AUTHENTIC_IMBL_BOUNDARIES, AUTHENTIC_MPAS, MaritimeBoundaryDataset, MarineProtectedAreaDataset } from '../../src/data/maritimeBoundaries.ts';

const EARTH_RADIUS_KM = 6371.0;
const KM_PER_NAUTICAL_MILE = 1.852;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculates exact Haversine distance between two coordinates in kilometers.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates initial compass bearing from point 1 to point 2 (0 - 360 degrees).
 */
export function calculateBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Calculates shortest distance from a point to a line segment in kilometers.
 * Uses local equirectangular projection to find orthogonal projection point,
 * then evaluates spherical Haversine distance to that clamped point.
 */
function distancePointToSegmentKm(
  lat: number, lon: number,
  lat1: number, lon1: number,
  lat2: number, lon2: number
): { distanceKm: number; nearestLat: number; nearestLon: number } {
  const midLatRad = toRadians((lat1 + lat2 + lat) / 3);
  const cosMidLat = Math.cos(midLatRad);

  // Project to flat local plane in degrees
  const px = (lon - lon1) * cosMidLat;
  const py = lat - lat1;
  const dx = (lon2 - lon1) * cosMidLat;
  const dy = lat2 - lat1;

  const segmentLengthSq = dx * dx + dy * dy;
  let t = 0;
  if (segmentLengthSq > 1e-12) {
    t = (px * dx + py * dy) / segmentLengthSq;
    t = Math.max(0, Math.min(1, t));
  }

  const nearestLat = lat1 + t * (lat2 - lat1);
  const nearestLon = lon1 + t * (lon2 - lon1);
  const distanceKm = haversineDistanceKm(lat, lon, nearestLat, nearestLon);

  return { distanceKm, nearestLat, nearestLon };
}

/**
 * Ray-casting algorithm to test whether a coordinate is inside a closed polygon.
 * Polygon coordinates are [lon, lat].
 */
export function isPointInPolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Evaluates shortest distance from a coordinate to an IMBL polyline.
 */
function evaluateImblProximity(
  lat: number, lon: number,
  imbl: MaritimeBoundaryDataset
): GeofenceAlert {
  let minDistanceKm = Infinity;
  let nearestLat = 0;
  let nearestLon = 0;

  for (let i = 0; i < imbl.coordinates.length - 1; i++) {
    const [lon1, lat1] = imbl.coordinates[i];
    const [lon2, lat2] = imbl.coordinates[i + 1];
    const { distanceKm, nearestLat: nLat, nearestLon: nLon } = distancePointToSegmentKm(
      lat, lon, lat1, lon1, lat2, lon2
    );
    if (distanceKm < minDistanceKm) {
      minDistanceKm = distanceKm;
      nearestLat = nLat;
      nearestLon = nLon;
    }
  }

  const distanceNm = Number((minDistanceKm / KM_PER_NAUTICAL_MILE).toFixed(2));
  const bearingDeg = Math.round(calculateBearingDeg(lat, lon, nearestLat, nearestLon));

  let severity: GeofenceBreachSeverity = 'SAFE';
  let warningMessage = `Vessel is ${distanceNm} NM from the ${imbl.name} (Clear of border).`;

  if (distanceNm <= 3.0) {
    severity = 'CRITICAL_BREACH';
    warningMessage = `CRITICAL ALERT: Vessel is ${distanceNm} NM from ${imbl.countryPair} IMBL (bearing ${bearingDeg}°). Immediate course reversal required to avoid international apprehension by foreign navy/coast guard.`;
  } else if (distanceNm <= 7.0) {
    severity = 'PROXIMITY_WARNING';
    warningMessage = `WARNING: Approaching ${imbl.countryPair} IMBL (${distanceNm} NM, bearing ${bearingDeg}°). Maintain high navigational vigilance; do not drift across border.`;
  } else if (distanceNm <= 15.0) {
    severity = 'ADVISORY';
    warningMessage = `Advisory: ${imbl.countryPair} IMBL is ${distanceNm} NM offshore (bearing ${bearingDeg}°). Monitor position and GPS drift.`;
  }

  return {
    boundaryId: imbl.id,
    boundaryName: imbl.name,
    type: 'IMBL',
    distanceNm,
    distanceKm: Number(minDistanceKm.toFixed(2)),
    bearingDeg,
    severity,
    warningMessage,
    treatyOrAuthority: imbl.legalAuthority,
    enforcementNotice: imbl.enforcementNotice
  };
}

/**
 * Evaluates incursion and proximity to a Marine Protected Area (MPA).
 */
function evaluateMpaProximity(
  lat: number, lon: number,
  mpa: MarineProtectedAreaDataset
): GeofenceAlert {
  const isInside = isPointInPolygon(lat, lon, mpa.polygon);

  let minDistanceKm = Infinity;
  let nearestLat = 0;
  let nearestLon = 0;

  for (let i = 0; i < mpa.polygon.length - 1; i++) {
    const [lon1, lat1] = mpa.polygon[i];
    const [lon2, lat2] = mpa.polygon[i + 1];
    const { distanceKm, nearestLat: nLat, nearestLon: nLon } = distancePointToSegmentKm(
      lat, lon, lat1, lon1, lat2, lon2
    );
    if (distanceKm < minDistanceKm) {
      minDistanceKm = distanceKm;
      nearestLat = nLat;
      nearestLon = nLon;
    }
  }

  const distanceNm = isInside ? 0 : Number((minDistanceKm / KM_PER_NAUTICAL_MILE).toFixed(2));
  const bearingDeg = isInside ? undefined : Math.round(calculateBearingDeg(lat, lon, nearestLat, nearestLon));

  let severity: GeofenceBreachSeverity = 'SAFE';
  let warningMessage = `Vessel is ${distanceNm} NM from ${mpa.name}.`;

  if (isInside) {
    severity = 'CRITICAL_BREACH';
    warningMessage = `REGULATORY BREACH: Operating INSIDE ${mpa.name} (${mpa.state}). Commercial fishing/trawling prohibited under ${mpa.legalAuthority}. Prohibited: ${mpa.prohibitedActivities[0]}.`;
  } else if (distanceNm <= 2.5) {
    severity = 'PROXIMITY_WARNING';
    warningMessage = `WARNING: Within ${distanceNm} NM of ${mpa.name} perimeter (bearing ${bearingDeg}°). Trawling gear must be secured and Turtle Excluder Devices active.`;
  } else if (distanceNm <= 7.0) {
    severity = 'ADVISORY';
    warningMessage = `Advisory: Approaching ${mpa.name} (${distanceNm} NM, bearing ${bearingDeg}°). Protected zone for ${mpa.conservationTarget}.`;
  }

  return {
    boundaryId: mpa.id,
    boundaryName: mpa.name,
    type: 'MPA',
    distanceNm,
    distanceKm: isInside ? 0 : Number(minDistanceKm.toFixed(2)),
    bearingDeg,
    severity,
    warningMessage,
    treatyOrAuthority: mpa.legalAuthority,
    regulations: mpa.prohibitedActivities.join('; ')
  };
}

/**
 * Performs comprehensive spatial geofencing analysis for a given coastal location.
 * Evaluates all authentic IMBLs and MPAs, ranks by proximity, and identifies active alerts.
 */
export function analyzeMaritimeGeofencing(lat: number, lon: number): GeofenceSpatialAnalysis {
  const imblAlerts = AUTHENTIC_IMBL_BOUNDARIES.map(imbl => evaluateImblProximity(lat, lon, imbl))
    .sort((a, b) => a.distanceNm - b.distanceNm);

  const mpaAlerts = AUTHENTIC_MPAS.map(mpa => evaluateMpaProximity(lat, lon, mpa))
    .sort((a, b) => a.distanceNm - b.distanceNm);

  const nearestImbl = imblAlerts[0];
  const nearestMpa = mpaAlerts[0];

  const allAlerts = [...imblAlerts, ...mpaAlerts];
  const activeAlerts = allAlerts.filter(a => a.severity !== 'SAFE');

  const inRestrictedWaters = allAlerts.some(a => a.severity === 'CRITICAL_BREACH' && a.distanceNm === 0);
  const hasCritical = allAlerts.some(a => a.severity === 'CRITICAL_BREACH');
  const hasWarning = allAlerts.some(a => a.severity === 'PROXIMITY_WARNING');

  const status = hasCritical ? 'RESTRICTED_BREACH' : hasWarning ? 'CAUTION' : 'CLEAR';

  return {
    operatingCoordinates: { latitude: lat, longitude: lon },
    nearestImbl,
    nearestMpa,
    activeAlerts,
    inRestrictedWaters,
    status,
    timestamp: new Date().toISOString()
  };
}
