const baseUrl = process.env.ORCA_BASE_URL || 'http://127.0.0.1:3000';
const mlUrl = process.env.ORCA_ML_API_URL || 'http://127.0.0.1:8000';
const ragUrl = process.env.ORCA_RAG_API_URL || 'http://127.0.0.1:8001';

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${text}`);
  return body;
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const mlHealth = await request(`${mlUrl}/health`);
assert(mlHealth.status === 'healthy', 'ML health check failed');
assert(mlHealth.model_loaded === true, 'ML model is not loaded');

const ragHealth = await request(`${ragUrl}/health`);
assert(ragHealth.status === 'healthy', 'RAG health check failed');
assert(ragHealth.embedding_model === 'BAAI/bge-m3', 'RAG is not configured for BAAI/bge-m3');
assert(ragHealth.embedding_dimension === 1024, 'RAG embedding dimension is not 1024');
assert(Number(ragHealth.points_count) > 0, 'Qdrant evidence collection is empty');

const ragSearch = await request(`${ragUrl}/search`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'Is it safe for small fishing boats near Digha right now?', top_k: 5 }),
});
assert(ragSearch.retrieval === 'qdrant_dense_cosine', 'RAG search did not use Qdrant dense cosine retrieval');
assert(ragSearch.embedding_model === 'BAAI/bge-m3', 'RAG search did not use BGE-M3');
assert(Array.isArray(ragSearch.results) && ragSearch.results.length > 0, 'RAG search returned no results');

const appHealth = await request(`${baseUrl}/api/health`);
assert(appHealth.status === 'healthy', 'ORCA API health check failed');
assert(appHealth.services.mlRiskApi, 'ML service metadata is missing');

const live = await request(`${baseUrl}/api/marine/conditions?lat=21.6266&lon=87.5074`);
assert(live.degraded === false, 'Live marine/weather provider is degraded');
assert(live.weather?.dataQuality === 'LIVE', 'Weather data is not marked LIVE');
assert(live.ocean?.dataQuality === 'LIVE', 'Marine data is not marked LIVE');
assert(live.weather?.source === 'Open-Meteo Weather API', 'Unexpected weather provider');
assert(live.ocean?.source === 'Open-Meteo Marine API', 'Unexpected marine provider');

const risk = await request(`${baseUrl}/api/marine/risk`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    weather: { windSpeedKts: 14, windGustKts: 20, windDirectionDeg: 90, pressureHpa: 1010, airTemperatureC: 28, observedAt: new Date().toISOString() },
    ocean: { waveHeightMeters: 0.9, wavePeriodSec: 5, waveDirectionDeg: 90, swellHeightMeters: 0.5, swellPeriodSec: 7, maxWaveHeightMeters: 1.4, currentSpeedKts: 0.6, seaSurfaceTemperatureC: 28, seaStateIndex: 3, seaStateDescription: 'Slight' },
    location: { key: 'digha', name: 'Digha', state: 'West Bengal', country: 'India', latitude: 21.6266, longitude: 87.5074 },
  }),
});
assert(['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(risk.riskLevel), 'Risk endpoint returned an invalid risk level');
assert(Number.isFinite(risk.riskScore), 'Risk endpoint returned an invalid risk score');

const evidence = await request(`${baseUrl}/api/evidence/search`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'fishing small boats wind waves', riskLevel: risk.riskLevel, locationKey: 'digha' }),
});
assert(Array.isArray(evidence.results) && evidence.results.length > 0, 'Evidence endpoint returned no evidence');
assert(evidence.provider === 'bge-m3-qdrant', `Node RAG integration degraded: ${evidence.provider}`);
assert(evidence.model === 'BAAI/bge-m3', 'Node RAG integration did not report BGE-M3');
assert(evidence.degraded === false, 'Node RAG integration is degraded');

const orca = await request(`${baseUrl}/api/orca/query`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'Is it safe for small fishing boats near Digha right now?' }),
});
const ragTrace = orca.agentTraces?.find((trace) => trace.agentName === 'EvidenceRetrieval');
assert(ragTrace?.logs?.some((log) => log.includes('provider: bge-m3-qdrant')), 'End-to-end ORCA query did not use BGE-M3 + Qdrant');
assert(orca.isDataDegraded === false, 'End-to-end ORCA query reported degraded data');

console.log('ORCA-X Refinement 3 smoke test passed:', JSON.stringify({ ml: mlHealth.model_version, rag: ragSearch.retrieval, embedding: ragSearch.embedding_model, liveWeather: live.weather.source, liveMarine: live.ocean.source, riskLevel: orca.risk.riskLevel, evidenceCount: orca.evidence.length }));
