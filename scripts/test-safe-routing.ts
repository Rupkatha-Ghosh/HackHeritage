import assert from 'node:assert/strict';
import { calculateSafeRoute } from '../server/services/safeRouting.ts';
import { analyzeMaritimeGeofencing } from '../server/services/geofenceService.ts';

console.log('--- Testing ORCA-X Safe Routing Engine ---');

const origin = { latitude: 21.6266, longitude: 87.5074 };
const destination = { latitude: 21.6266, longitude: 87.6574 };
const route = calculateSafeRoute({ origin, destination, riskLevel: 'LOW' });

assert.equal(route.status, 'ROUTE_FOUND', 'A nearby Digha coastal route should be found.');
assert.ok((route.distanceKm ?? 0) >= route.directDistanceKm, 'Route distance cannot be shorter than the direct geodesic distance.');
assert.ok(route.waypoints.length >= 2, 'Route must contain origin and destination waypoints.');
assert.deepEqual(route.waypoints[0] && { latitude: route.waypoints[0].latitude, longitude: route.waypoints[0].longitude }, origin);
assert.deepEqual(route.waypoints.at(-1) && { latitude: route.waypoints.at(-1)!.latitude, longitude: route.waypoints.at(-1)!.longitude }, destination);
assert.ok(route.waypoints.every(point => point.geofenceStatus !== 'RESTRICTED_BREACH'), 'Route must not traverse critical geofence status.');
console.log(`✓ Safe route found: ${route.distanceKm} km, ${route.waypoints.length} waypoints`);

const restrictedDestination = { latitude: 20.6, longitude: 86.95 };
const blocked = calculateSafeRoute({ origin, destination: restrictedDestination, riskLevel: 'LOW' });
const destinationFence = analyzeMaritimeGeofencing(restrictedDestination.latitude, restrictedDestination.longitude);
assert.equal(destinationFence.status, 'RESTRICTED_BREACH');
assert.equal(blocked.status, 'ROUTE_UNAVAILABLE');
assert.equal(blocked.waypoints.length, 0);
console.log('✓ Authoritative restricted destination is hard-blocked.');

const invalid = assert.throws(
  () => calculateSafeRoute({ origin: { latitude: 999, longitude: 0 }, destination, riskLevel: 'LOW' }),
  /valid bounds/,
);
assert.ok(invalid);
console.log('✓ Invalid coordinates are rejected.');

console.log('--- ALL SAFE ROUTING TESTS PASSED ---');
