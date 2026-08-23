"""Ingest the canonical ORCA marine evidence corpus into Qdrant using BGE-M3."""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.http import models
from FlagEmbedding import BGEM3FlagModel

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.data.coastalData import MARINE_EVIDENCE_CORPUS  # type: ignore

QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY") or None
COLLECTION = os.getenv("QDRANT_COLLECTION", "orca_marine_evidence")
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")


def main() -> None:
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE),
        )

    model = BGEM3FlagModel(MODEL_NAME, use_fp16=DEVICE != "cpu", devices=DEVICE)
    texts = [f"{item.title}\n{item.excerpt}\n{item.complianceRule}" for item in MARINE_EVIDENCE_CORPUS]
    encoded = model.encode(texts, batch_size=8, max_length=8192, return_dense=True)
    points = []
    for item, vector in zip(MARINE_EVIDENCE_CORPUS, encoded["dense_vecs"]):
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"orca-x:{item.id}"))
        points.append(models.PointStruct(
            id=point_id,
            vector=vector.tolist(),
            payload={
                "sourceId": item.id,
                "title": item.title,
                "sourceAuthority": item.sourceAuthority,
                "documentType": item.documentType,
                "publicationDate": item.publicationDate,
                "excerpt": item.excerpt,
                "officialUrl": item.officialUrl,
                "complianceRule": item.complianceRule,
            },
        ))
    client.upsert(collection_name=COLLECTION, points=points, wait=True)
    info = client.get_collection(COLLECTION)
    print(f"Indexed {len(points)} evidence documents into {COLLECTION}; points={info.points_count}")


if __name__ == "__main__":
    main()
