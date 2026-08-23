# ORCA-X — Ocean Reasoning & Collaborative AI

ORCA-X is a marine-intelligence decision-support platform for coastal safety, fishing and navigation. It combines live weather/marine observations, Copernicus Sentinel catalogue metadata, a deterministic marine-risk engine, an XGBoost risk model, GIS layers, evidence retrieval and optional Gemini grounded synthesis.

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
            ▼
FastAPI + XGBoost ML API (port 8000)
            │
            ▼
ml/models/orca_xgb_risk.json
```

The TypeScript backend owns orchestration and external connectors. The Python service owns model inference. If the ML service is unavailable, the TypeScript backend falls back to the deterministic marine-risk engine.

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
│   ├── controllers/
│   └── middleware/
│
├── ml/                         # Python ML subsystem
│   ├── api.py
│   ├── src/
│   ├── models/
│   ├── data/
│   └── requirements.txt
│
├── .env.example
├── .gitignore
├── package.json
├── bun.lock
├── tsconfig.json
├── vite.config.ts
├── index.html
└── README.md
```

## Prerequisites

- Node.js 20+ recommended
- Python 3.11+
- npm or Bun
- A Gemini API key is optional; without it, deterministic grounded summaries are used.

## Local setup

### 1. Install frontend/backend dependencies

```bash
npm install
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

Set `GEMINI_API_KEY` if Gemini synthesis is desired. Keep `.env` private.

### 3. Install ML dependencies

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

### 4. Start the ML API

```bash
npm run dev:ml
```

Or directly:

```bash
uvicorn ml.api:app --reload --host 0.0.0.0 --port 8000
```

Check:

```text
http://127.0.0.1:8000/health
```

### 5. Start ORCA-X

In a second terminal:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

The API health endpoint is:

```text
http://localhost:3000/api/health
```

## Production build

Build the frontend and bundled Express server:

```bash
npm run build
```

Start the TypeScript application:

```bash
npm start
```

Start the ML service separately:

```bash
npm run start:ml
```

The production deployment therefore consists of two processes:

1. ORCA-X web/API server on port 3000.
2. XGBoost inference API on port 8000.

Set `ORCA_ML_API_URL` to the reachable ML service URL when the two processes run on different hosts.

## ML workflow

Training and dataset preparation remain under `ml/src/`:

```bash
python ml/src/download_ndbc.py
python ml/src/prepare_dataset.py
python ml/src/train.py
```

The checked-in production model is loaded from `ml/models/`. Generated raw/processed datasets are ignored for future commits; see `ml/data/README.md` for the reproducibility workflow.

## Safety note

ORCA-X is a decision-support system. It does **not** supersede statutory warnings, advisories or instructions issued by INCOIS, IMD, Maritime Rescue Coordination Centres or other competent authorities.
