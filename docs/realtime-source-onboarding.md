# ORCA-X Real-Time Source Onboarding

## Purpose

ORCA-X uses heterogeneous marine observations for live decision support. Every provider must first be normalized into the ORCA-X marine observation contract, scored for freshness/completeness, and persisted in telemetry before it can influence model retraining decisions.

## Source policy

### Open-Meteo

Open-Meteo remains the currently operational fallback/source for live weather and marine conditions.

### INCOIS

INCOIS publishes real-time in-situ holdings including drifting and moored buoy observations, with wind, wave, SST and other parameters. The public INCOIS ERDDAP installation is machine-readable, but its currently exposed `Indian_ARGO_Floats` table is profile data and must not be treated as a live surface wind/wave replacement.

The repository therefore does **not** invent an INCOIS realtime endpoint. Configure `INCOIS_REALTIME_URL` only when an approved machine-readable service is available and returns the normalized ORCA-X provider contract.

### MOSDAC / ISRO

MOSDAC documents an API-based download workflow supporting archived and near-real-time satellite data. The documented client uses a MOSDAC account, a `datasetId`, and a configuration-driven download process. Credentials must remain outside source control.

The repository therefore does **not** invent a MOSDAC live JSON endpoint. Configure `MOSDAC_REALTIME_URL` only when an approved normalized gateway is available.

## Normalized provider contract

An INCOIS/MOSDAC gateway must accept `latitude` and `longitude` query parameters and return JSON with this shape:

```json
{
  "weather": { "...": "ORCA-X WeatherData fields" },
  "ocean": { "...": "ORCA-X OceanData fields" },
  "observedAt": "2026-09-04T16:00:00Z",
  "retrievedAt": "2026-09-04T16:01:00Z",
  "warnings": []
}
```

At least one of `weather` or `ocean` must be present. The fusion layer normalizes every provider and independently selects the best weather and ocean payload based on freshness and quality.

## Telemetry gate

Start the collector with:

```powershell
$env:REALTIME_COLLECTION_ENABLED="true"
$env:REALTIME_COLLECTION_INTERVAL_MS="900000"
npm run dev
```

The collector writes `data/realtime/marine_telemetry.jsonl` by default.

Run:

```powershell
npm run analyze:realtime
```

The analysis requires, by default:

- at least 100 telemetry events;
- at least 2 live sources with >=80% live coverage;
- at least 50 pairwise samples for a source pair;
- mean source quality >=0.60;
- explicit engineering review of distribution shift.

The script remains conservative and **never authorizes retraining by itself**. Distribution-shift review remains an explicit gate before XGBoost v2.7.

## Production rule

Do not place MOSDAC passwords, API credentials, cookies, or tokens in Git. Use the local `.env`, deployment secret manager, or the official MOSDAC client configuration outside the repository.

Do not promote XGBoost v2.7 merely because multiple providers are reachable. First collect parallel observations, inspect source disagreement/missingness, document distribution shift, and then train/evaluate a candidate against the locked v2.6 production baseline.
