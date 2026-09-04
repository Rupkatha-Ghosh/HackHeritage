# ORCA-X — Ocean Reasoning & Collaborative AI

ORCA-X is a marine-intelligence decision-support platform for coastal safety, fishing and navigation. It combines live weather/marine observations, hourly tomorrow weather/marine forecasts, Copernicus Sentinel catalogue metadata, a deterministic marine-risk engine, an XGBoost risk model, GIS layers, BGE-M3 + Qdrant evidence retrieval and optional Gemini grounded synthesis.

## Architecture

```text
React + Vite
    │
    ▼
Express / TypeScript API (port 3000)
    ├── /api/orca/query
    ├── /api/marine/conditions       ← current/live observations
    ├── /api/marine/forecast         ← hourly tomorrow forecast + ML risk
    ├── /api/marine/risk             ← point-in-time ML risk
    ├── /api/satellite/analysis
    ├── /api/evidence/search
    └── /api/health
            │
            ├──────────────► Open-Meteo Weather + Marine APIs
            │
            ├──────────────► FastAPI + XGBoost ML API (port 8000)
            │
            └──────────────► FastAPI + BGE-M3 RAG API (port 8001)
                                      │
                                      ▼
                               Qdrant (port 6333)
                                      │
                                      ▼
                         orca_marine_evidence
```

The TypeScript backend owns orchestration and external connectors. The Python ML service owns XGBoost inference. The Python RAG service owns real BAAI/BGE-M3 dense embeddings and Qdrant vector retrieval. If the RAG service is unavailable, the backend explicitly falls back to the existing lexical evidence retriever and marks the response as degraded.

## Live observations vs forecast risk

ORCA-X now keeps the distinction between **what is happening now** and **what is forecast to happen tomorrow** explicit:

- `GET /api/marine/conditions?lat=...&lon=...` fetches current weather and marine conditions.
- `GET /api/marine/forecast?locationKey=digha` fetches tomorrow's hourly Open-Meteo weather + marine forecast and evaluates the configured XGBoost model at each forecast hour.
- A forecast response is marked `sourceType: "FORECAST"` and each hourly prediction is timestamped with its forecast hour.
- The forecast endpoint refuses to return a partial window when fewer than 12 hourly points are available.
- Forecast output is decision support, not a guarantee of safety. IMD/INCOIS/Coast Guard warnings take precedence.

Example:

```text
GET http://127.0.0.1:3000/api/marine/forecast?locationKey=digha
```

The response contains the local forecast date, timezone, model version, worst forecast risk, hourly risk predictions, and explicit safety warnings.

**Important model gate:** the repository's committed production artifact is still documented separately in `ml/PRODUCTION_MODEL_STATUS.md`. Until the validated forward 6-hour v2.6 artifact is promoted, the forecast path must be treated as a forecast-input integration using the currently committed artifact, not as proof that the final v2.6 model has been trained.

## Refinement 3 — Real BGE-M3 + Qdrant RAG

Refinement 3 replaces the previous in-memory lexical-only evidence ranking with an actual vector retrieval path:

- Embedding model: `BAAI/bge-m3` via FlagEmbedding.
- Vector size: 1024-dimensional dense embeddings.
- Vector database: Qdrant.
- Collection: `orca_marine_evidence`.
- Distance: cosine similarity.
- Canonical source corpus: `MARINE_EVIDENCE_CORPUS` from `src/data/coastalData.ts`.
- Stable UUID5 point IDs prevent duplicate documents on repeated ingestion.
- Query path: ORCA query → BGE-M3 query embedding → Qdrant top-K → grounded synthesis.
- Failure behavior: lexical fallback is retained, but the trace identifies that fallback explicitly.

BGE-M3 is designed for multilingual, multi-functionality retrieval and its authors recommend hybrid retrieval plus reranking for stronger RAG systems. The current Refinement 3 milestone intentionally establishes the real dense BGE-M3 + Qdrant foundation first; sparse/hybrid retrieval and reranking can be layered on afterward. citeturn0search4turn0search11

### Start Qdrant

Run Qdrant locally on port 6333 using your existing Docker setup, or point `QDRANT_URL` at a hosted Qdrant instance.

### Start the RAG API

```bash
npm run dev:rag
```

The RAG service runs on:

```text
http://127.0.0.1:8001
```

### Ingest the canonical evidence corpus

With Qdrant and the RAG API running:

```bash
npm run ingest:rag
```

This embeds the canonical marine evidence documents with BGE-M3 and upserts them into `orca_marine_evidence`.

### Check RAG health

```text
http://127.0.0.1:8001/health
```

The response reports the embedding model, 1024-dimensional vector configuration, collection name and Qdrant point count.

## Project structure

```text
HackHeritage/
├── src/                         # React frontend + shared domain types
│   ├── components/
│   ├── data/
│   ├── services/
│   │   ├── ml/
│   │   │   └── riskService.ts
│   │   └── satellite/
│   │       └── satelliteService.ts
│   ├── utils/
│   │   └── marineRiskEngine.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── types.ts
│
├── server/                     # Express application backend
│   ├── app.ts
│   ├── routes/
│   ├── services/
│   │   ├── evidenceService.ts  # lexical fallback
│   │   ├── marineService.ts
│   │   ├── realtime/
│   │   │   ├── openMeteoProvider.ts
│   │   │   ├── openMeteoForecastProvider.ts
│   │   │   ├── realtimeObservationService.ts
│   │   │   └── marineForecastService.ts
│   │   ├── orcaService.ts
│   │   └── ragService.ts       # BGE-M3 RAG bridge
│   ├── controllers/
│   └── middleware/
│
├── ml/                         # Python ML + RAG subsystem
│   ├── api.py                  # XGBoost API
│   ├── rag_api.py              # BGE-M3 + Qdrant API
│   ├── src/
│   ├── models/
│   ├── data/
│   └── requirements.txt
│
├── scripts/
```

## Validation

Build and type-check the TypeScript application before running the end-to-end smoke test:

```bash
npm run lint
npm run build
npm run smoke
```

The smoke test now covers live weather/marine data **and** the tomorrow forecast path, in addition to ML, RAG/Qdrant, evidence retrieval and the ORCA workflow.
