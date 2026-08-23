"""ORCA-X Refinement 3: real BGE-M3 + Qdrant retrieval service."""
from __future__ import annotations

import os
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient
from qdrant_client.http import models
from FlagEmbedding import BGEM3FlagModel

QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY") or None
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "orca_marine_evidence")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
EMBEDDING_DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "8"))

app = FastAPI(title="ORCA-X BGE-M3 Qdrant RAG", version="3.0.0")

@lru_cache(maxsize=1)
def get_embedder() -> BGEM3FlagModel:
    return BGEM3FlagModel(EMBEDDING_MODEL, use_fp16=EMBEDDING_DEVICE != "cpu", devices=EMBEDDING_DEVICE)

@lru_cache(maxsize=1)
def get_qdrant() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    top_k: int = Field(default=RAG_TOP_K, ge=1, le=20)

class EvidenceDocument(BaseModel):
    id: str
    title: str
    sourceAuthority: str
    documentType: str
    publicationDate: str
    excerpt: str
    relevanceScore: float = 0
    officialUrl: str = ""
    complianceRule: str = ""

class IngestRequest(BaseModel):
    documents: list[EvidenceDocument] = Field(min_length=1, max_length=1000)

@app.get("/health")
def health() -> dict[str, Any]:
    try:
        client = get_qdrant()
        collection = client.get_collection(QDRANT_COLLECTION)
        return {"status": "healthy", "embedding_model": EMBEDDING_MODEL, "embedding_dimension": 1024, "qdrant_collection": QDRANT_COLLECTION, "points_count": collection.points_count}
    except Exception as exc:
        return {"status": "degraded", "error": str(exc), "embedding_model": EMBEDDING_MODEL}

def _ensure_collection(client: QdrantClient) -> None:
    names = {item.name for item in client.get_collections().collections}
    if QDRANT_COLLECTION not in names:
        client.create_collection(collection_name=QDRANT_COLLECTION, vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE))

def _query_points(client: QdrantClient, vector: list[float], limit: int):
    """Use the current Qdrant client API (query_points), compatible with Qdrant 1.19+."""
    return client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=vector,
        limit=limit,
        with_payload=True,
    ).points

@app.post("/ingest")
def ingest(request: IngestRequest) -> dict[str, Any]:
    try:
        client = get_qdrant()
        _ensure_collection(client)
        texts = [f"{d.title}\n{d.excerpt}\n{d.complianceRule}" for d in request.documents]
        encoded = get_embedder().encode(texts, batch_size=8, max_length=8192, return_dense=True)
        points = []
        for doc, vector in zip(request.documents, encoded["dense_vecs"]):
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"orca-x:{doc.id}"))
            points.append(models.PointStruct(id=point_id, vector=vector.tolist(), payload=doc.model_dump()))
        client.upsert(collection_name=QDRANT_COLLECTION, points=points, wait=True)
        info = client.get_collection(QDRANT_COLLECTION)
        return {"success": True, "indexed": len(points), "points_count": info.points_count, "collection": QDRANT_COLLECTION, "embedding_model": EMBEDDING_MODEL}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"RAG ingestion unavailable: {exc}") from exc

@app.post("/search")
def search(request: SearchRequest) -> dict[str, Any]:
    try:
        client = get_qdrant()
        _ensure_collection(client)
        output = get_embedder().encode([request.query], batch_size=1, max_length=8192, return_dense=True)
        vector = output["dense_vecs"][0].tolist()
        hits = _query_points(client, vector, request.top_k)
        results = []
        for hit in hits:
            payload = hit.payload or {}
            results.append({"id": str(hit.id), "score": round(float(hit.score), 6), "title": payload.get("title", ""), "excerpt": payload.get("excerpt", ""), "sourceAuthority": payload.get("sourceAuthority", ""), "documentType": payload.get("documentType", ""), "publicationDate": payload.get("publicationDate", ""), "officialUrl": payload.get("officialUrl", ""), "complianceRule": payload.get("complianceRule", "")})
        return {"success": True, "query": request.query, "embedding_model": EMBEDDING_MODEL, "retrieval": "qdrant_dense_cosine", "results": results}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"RAG retrieval unavailable: {exc}") from exc
