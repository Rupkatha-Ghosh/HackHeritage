"""ORCA-X Refinement 3: real BGE-M3 + Qdrant retrieval service."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

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
    return BGEM3FlagModel(
        EMBEDDING_MODEL,
        use_fp16=EMBEDDING_DEVICE != "cpu",
        devices=EMBEDDING_DEVICE,
    )


@lru_cache(maxsize=1)
def get_qdrant() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    top_k: int = Field(default=RAG_TOP_K, ge=1, le=20)


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        client = get_qdrant()
        collection = client.get_collection(QDRANT_COLLECTION)
        return {
            "status": "healthy",
            "embedding_model": EMBEDDING_MODEL,
            "embedding_dimension": 1024,
            "qdrant_collection": QDRANT_COLLECTION,
            "points_count": collection.points_count,
        }
    except Exception as exc:
        return {"status": "degraded", "error": str(exc), "embedding_model": EMBEDDING_MODEL}


def _ensure_collection(client: QdrantClient) -> None:
    names = {item.name for item in client.get_collections().collections}
    if QDRANT_COLLECTION not in names:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE),
        )


@app.post("/search")
def search(request: SearchRequest) -> dict[str, Any]:
    try:
        client = get_qdrant()
        _ensure_collection(client)
        output = get_embedder().encode([request.query], batch_size=1, max_length=8192, return_dense=True)
        vector = output["dense_vecs"][0].tolist()
        hits = client.search(collection_name=QDRANT_COLLECTION, query_vector=vector, limit=request.top_k, with_payload=True)
        results = []
        for hit in hits:
            payload = hit.payload or {}
            results.append({
                "id": str(hit.id),
                "score": round(float(hit.score), 6),
                "title": payload.get("title", ""),
                "excerpt": payload.get("excerpt", ""),
                "sourceAuthority": payload.get("sourceAuthority", ""),
                "documentType": payload.get("documentType", ""),
                "publicationDate": payload.get("publicationDate", ""),
                "officialUrl": payload.get("officialUrl", ""),
                "complianceRule": payload.get("complianceRule", ""),
            })
        return {
            "success": True,
            "query": request.query,
            "embedding_model": EMBEDDING_MODEL,
            "retrieval": "qdrant_dense_cosine",
            "results": results,
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"RAG retrieval unavailable: {exc}") from exc
