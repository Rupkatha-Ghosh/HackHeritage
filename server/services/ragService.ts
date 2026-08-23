import { EvidenceItem, LocationInfo } from '../../src/types.ts';
import { retrieveEvidence } from './evidenceService.ts';

export interface RagRetrievalResult {
  evidence: EvidenceItem[];
  provider: 'bge-m3-qdrant' | 'lexical-fallback';
  model: string;
}

const EVIDENCE_DOCUMENT_TYPES = [
  'Fisheries Advisory',
  'Ocean State Forecast',
  'Cyclone Bulletin',
  'Maritime Regulation',
  'Scientific Protocol',
] as const;

type EvidenceDocumentType = typeof EVIDENCE_DOCUMENT_TYPES[number];

function normalizeDocumentType(value: unknown): EvidenceDocumentType {
  const documentType = String(value ?? '').trim();
  return EVIDENCE_DOCUMENT_TYPES.includes(documentType as EvidenceDocumentType)
    ? (documentType as EvidenceDocumentType)
    : 'Scientific Protocol';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('RAG request timeout')), timeoutMs)),
  ]);
}

export async function retrieveRagEvidence(
  query: string,
  location: LocationInfo,
  riskLevel: string,
): Promise<RagRetrievalResult> {
  const ragApiUrl = process.env.ORCA_RAG_API_URL || 'http://127.0.0.1:8001';
  const timeoutMs = Number(process.env.ORCA_RAG_API_TIMEOUT_MS || 2500);

  try {
    const response = await withTimeout(fetch(`${ragApiUrl}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, top_k: Number(process.env.RAG_TOP_K || 8) }),
    }), timeoutMs);

    if (!response.ok) throw new Error(`RAG API returned ${response.status}`);
    const payload = await response.json() as {
      results?: Array<Record<string, unknown>>;
      embedding_model?: string;
    };

    const evidence: EvidenceItem[] = (payload.results || []).map((item) => ({
      id: String(item.sourceId || item.id || 'QDRANT-EVIDENCE'),
      title: String(item.title || ''),
      sourceAuthority: String(item.sourceAuthority || ''),
      documentType: normalizeDocumentType(item.documentType),
      publicationDate: String(item.publicationDate || ''),
      excerpt: String(item.excerpt || ''),
      relevanceScore: Number(item.score || 0),
      officialUrl: String(item.officialUrl || ''),
      complianceRule: String(item.complianceRule || ''),
    }));

    if (!evidence.length) throw new Error('Qdrant returned no evidence');
    return { evidence, provider: 'bge-m3-qdrant', model: payload.embedding_model || 'BAAI/bge-m3' };
  } catch {
    return {
      evidence: retrieveEvidence(query, location, riskLevel),
      provider: 'lexical-fallback',
      model: 'none',
    };
  }
}
