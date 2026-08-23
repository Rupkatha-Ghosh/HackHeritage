# ORCA-X — Ocean Reasoning & Collaborative AI

ORCA-X is a marine-intelligence decision-support platform for coastal safety, fishing and navigation. It combines live weather/marine observations, Copernicus Sentinel catalogue metadata, a deterministic marine-risk engine, an XGBoost risk model, GIS layers, BGE-M3 + Qdrant evidence retrieval and optional Gemini grounded synthesis.

## Architecture

```text
React + Vite
    │
    ▼
Express / TypeScript API (port 3000)
    ├── /api/orca/query
    ├── /api/marine/conditions
    ├── /api/marine/risk
    ├── /api/satellite/analysis
    ├── /api/evidence/search
    └── /api/health
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
│   │   │   └── satellite/
│   │   │       └── satelliteService.ts
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
│   ├── ingest-rag.mjs          # Canonical evidence ingestion
│   └── smoke-test.mjs          # End-to-end service smoke test
│
├── .github/workflows/ci.yml
├── .env.example
├── package.json
├── package-lock.json
├── bun.lock
└── README.md
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- npm or Bun
- Qdrant reachable at `QDRANT_URL` (default `http://127.0.0.1:6333`)
- A Gemini API key is optional; without it, deterministic grounded summaries are used.

## Local setup

### 1. Install frontend/backend dependencies

```bash
npm ci
```

or:

```bash
bun install
```

### 2. Create environment file

```bash
copy .env.example .env
```

On Linux/macOS:

```bash
cp .env.example .env
```

Keep `.env` private.

### 3. Install ML/RAG dependencies

From the repository root:

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Then:

```bash
pip install -r ml/requirements.txt
```

### 4. Start the XGBoost ML API

```bash
npm run dev:ml
```

### 5. Start the BGE-M3 RAG API

In another terminal:

```bash
npm run dev:rag
```

The RAG service downloads `BAAI/bge-m3` on first model use unless the model is already cached locally.

### 6. Ingest evidence into Qdrant

```bash
npm run ingest:rag
```

### 7. Start ORCA-X

In another terminal:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

### 8. Run the integration smoke test

With the Express and ML services running:

```bash
npm run smoke
```

The smoke test continues to validate the core application path. For the full Refinement 3 path, also verify the RAG health endpoint and run `npm run ingest:rag` before issuing an ORCA query.

## Production build

Build the frontend and bundled Express server:

```bash
npm run lint
npm run build
```

Start the services separately:

```bash
npm start
npm run start:ml
npm run start:rag
```

Production therefore consists of three processes plus Qdrant:

1. ORCA-X web/API server on port 3000.
2. XGBoost inference API on port 8000.
3. BGE-M3 RAG API on port 8001.
4. Qdrant vector database on port 6333 or a hosted equivalent.

Set `ORCA_ML_API_URL`, `ORCA_RAG_API_URL` and `QDRANT_URL` to the reachable service endpoints when deployed on different hosts.

## ML workflow

Training and dataset preparation remain under `ml/src/`:

```bash
python ml/src/download_ndbc.py
python ml/src/prepare_dataset.py
python ml/src/train.py
```

Raw and generated processed datasets are intentionally excluded from the repository. The checked-in dataset manifest and production model provide the reproducibility anchor; see `ml/data/README.md` for the workflow.

## Current capability boundaries

- **ML inference:** XGBoost with deterministic rule-based fallback.
- **Evidence retrieval:** real BGE-M3 dense embeddings stored and searched in Qdrant, with an explicit lexical fallback when the RAG service is unavailable.
- **Satellite:** Copernicus STAC catalogue metadata/search; this build does not perform satellite-image-derived feature extraction.
- **ML deployment domain:** the committed model is explicitly flagged as not independently validated for the Indian coastal deployment domain.

These boundaries are exposed through the workflow traces so the UI and operators do not mistake unavailable capabilities for completed services.

## Continuous integration

GitHub Actions runs:

1. Node and Python dependency installation.
2. TypeScript validation.
3. Production build.
4. ML API readiness check.
5. Express server readiness check.
6. End-to-end smoke test.

## Safety note

ORCA-X is a decision-support system. It does **not** supersede statutory warnings, advisories or instructions issued by INCOIS, IMD, Maritime Rescue Coordination Centres or other competent authorities.
