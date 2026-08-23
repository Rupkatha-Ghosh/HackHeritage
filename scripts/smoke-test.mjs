const baseUrl = process.env.ORCA_BASE_URL || 'http://127.0.0.1:3000';
const mlUrl = process.env.ORCA_ML_API_URL || 'http://127.0.0.1:8000';

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${text}`);
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mlHealth = await request(`${mlUrl}/health`);
assert(mlHealth.status === 'healthy', 'ML health check failed');
assert(mlHealth.model_loaded === true, 'ML model is not loaded');

const appHealth = await request(`${baseUrl}/api/health`);
assert(appHealth.status === 'healthy', 'ORCA API health check failed');
assert(appHealth.services.mlRiskApi, 'ML service metadata is missing');

const risk = await request(`${baseUrl}/api/marine/risk`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    weather: {
      windSpeedKts: 14,
      windGustKts: 20,
      windDirectionDeg: 90,
      pressureHpa: 1010,
      airTemperatureC: 28,
      observedAt: new Date().toISOString(),
    },
    ocean: {
      waveHeightMeters: 0.9,
      wavePeriodSec: 5,
      waveDirectionDeg: 90,
      swellHeightMeters: 0.5,
      swellPeriodSec: 7,
      maxWaveHeightMeters: 1.4,
      currentSpeedKts: 0.6,
      seaSurfaceTemperatureC: 28,
      seaStateIndex: 3,
      seaStateDescription: 'Slight',
    },
    location: {
      key: 'digha',
      name: 'Digha',
      state: 'West Bengal',
      country: 'India',
      latitude: 21.6266,
      longitude: 87.5074,
    },
  }),
});
assert(['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(risk.riskLevel), 'Risk endpoint returned an invalid risk level');
assert(Number.isFinite(risk.riskScore), 'Risk endpoint returned an invalid risk score');

const evidence = await request(`${baseUrl}/api/evidence/search`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'fishing small boats wind waves', riskLevel: risk.riskLevel, locationKey: 'digha' }),
});
assert(Array.isArray(evidence.results) && evidence.results.length > 0, 'Evidence endpoint returned no evidence');

console.log('ORCA-X smoke test passed:', JSON.stringify({
  ml: mlHealth.model_version,
  riskLevel: risk.riskLevel,
  riskScore: risk.riskScore,
  evidenceCount: evidence.count,
}));
