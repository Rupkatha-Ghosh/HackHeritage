import { EvidenceItem, LocationInfo } from '../../src/types.ts';
import { retrieveEvidence } from './evidenceService.ts';

const RAG_API_URL = process.env.ORCA_RAG_API_URL || 'http://127.0.0.1:8001';
const RAG_TIMEOUT_MS = Number(process.env.ORCA_RAG_API_TIMEOUT_MS || 2500);

export interface RagRetrievalResult {
  evidence: EvidenceItem[];
  provider: 'bge-m3-qdrant' | 'lexical-fallback';
  model: string;
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
  try {
    const response = await withTimeout(fetch(`${RAG_API_URL}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, top_k: 8 }),
    }), RAG_TIMEOUT_MS);

    if (!response.ok) throw new Error(`RAG API returned ${response.status}`);
    const payload = await response.json() as {
      results?: Array<Record<string, unknown>>;
      embedding_model?: string;
    };

    const evidence: EvidenceItem[] = (payload.results || []).map((item) => ({
      id: String(item.sourceId || item.id || 'QDRANT-EVIDENCE'),
      title: String(item.title || ''),
      sourceAuthority: String(item.sourceAuthority || ''),
      documentType: String(item.documentType || ''),
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
