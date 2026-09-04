import 'dotenv/config';

const TIMEOUT_MS = Math.max(1000, Number(process.env.REALTIME_DATA_TIMEOUT_MS || 8000));
const LAT = Number(process.env.REALTIME_VERIFY_LAT || 15.0);
const LON = Number(process.env.REALTIME_VERIFY_LON || 73.0);

const OFFICIAL_INCOIS_ERDDAP = 'https://erddap.incois.gov.in/erddap/tabledap/Indian_ARGO_Floats.json';
const OFFICIAL_MOSDAC_CATALOG = 'https://mosdac.gov.in/catalog-app/satellite.php';
const OPEN_METEO_WEATHER = process.env.OPEN_METEO_WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_MARINE = process.env.OPEN_METEO_MARINE_API_URL || 'https://marine-api.open-meteo.com/v1/marine';

async function probe(name, url, options = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: { Accept: options.accept || 'application/json', ...(options.headers || {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    return {
      name,
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - started,
      contentType: response.headers.get('content-type'),
      bytes: Buffer.byteLength(text),
      note: response.ok ? 'reachable' : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      contentType: null,
      bytes: 0,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const configuredIncois = process.env.INCOIS_REALTIME_URL;
  const configuredMosdac = process.env.MOSDAC_REALTIME_URL;

  const results = await Promise.all([
    probe('INCOIS ERDDAP official endpoint', `${OFFICIAL_INCOIS_ERDDAP}?time,latitude,longitude&time>=2025-01-01T00:00:00Z&latitude>=${LAT}&latitude<=${LAT + 10}&longitude>=${LON - 10}&longitude<=${LON + 10}`),
    probe('MOSDAC official catalog', OFFICIAL_MOSDAC_CATALOG, { accept: 'text/html' }),
    probe('Open-Meteo weather', `${OPEN_METEO_WEATHER}?latitude=${LAT}&longitude=${LON}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation,surface_pressure`),
    probe('Open-Meteo marine', `${OPEN_METEO_MARINE}?latitude=${LAT}&longitude=${LON}&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature`),
    ...(configuredIncois ? [probe('Configured INCOIS normalized adapter', configuredIncois)] : []),
    ...(configuredMosdac ? [probe('Configured MOSDAC normalized adapter', configuredMosdac)] : []),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    verificationPoint: { latitude: LAT, longitude: LON },
    configuredAdapters: {
      INCOIS: Boolean(configuredIncois),
      MOSDAC: Boolean(configuredMosdac),
    },
    results,
    interpretation: {
      incois: 'The public INCOIS ERDDAP probe verifies machine-readable access, but Indian_ARGO_Floats is profile data and is not treated as a full wind/wave replacement for the ORCA-X live feature vector.',
      mosdac: 'The MOSDAC catalog is publicly reachable; programmatic NRT downloads require the documented MOSDAC API workflow and account authentication. No credentials are read or stored by this script.',
      adapters: 'Configured INCOIS/MOSDAC URLs must return the ORCA-X normalized provider contract before they can participate in live source selection.',
      retraining: 'This verification does not authorize XGBoost v2.7 retraining. Parallel telemetry and source-distribution analysis remain required first.',
    },
  };

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = results.some((result) => result.name.startsWith('Open-Meteo') && !result.ok) ? 1 : 0;
}

main();
