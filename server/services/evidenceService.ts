import { COASTAL_LOCATIONS, MARINE_EVIDENCE_CORPUS } from '../../src/data/coastalData.ts';
import { EvidenceItem, LocationInfo } from '../../src/types.ts';

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3);
}

function lexicalRelevance(query: string, item: EvidenceItem): number {
  const queryTokens = new Set(normalize(query));
  if (queryTokens.size === 0) return 0;

  const haystack = normalize(`${item.title} ${item.summary} ${item.source} ${item.category}`);
  const itemTokens = new Set(haystack);
  let matches = 0;
  for (const token of queryTokens) if (itemTokens.has(token)) matches += 1;
  return matches / queryTokens.size;
}

export function retrieveEvidence(query: string, location: LocationInfo, riskLevel: string): EvidenceItem[] {
  const normalizedLocation = normalize(`${location.name} ${location.state || ''} ${location.country}`);

  return MARINE_EVIDENCE_CORPUS.map(item => {
    const lexicalScore = lexicalRelevance(query, item);
    const locationText = normalize(`${item.title} ${item.summary}`);
    const locationMatch = normalizedLocation.some(token => locationText.includes(token)) ? 0.04 : 0;
    const authorityBoost = (riskLevel === 'HIGH' || riskLevel === 'EXTREME') &&
      (item.id.includes('IMD') || item.id.includes('INCOIS')) ? 0.05 : 0;

    const blendedScore = Math.min(
      0.99,
      item.relevanceScore * 0.65 + lexicalScore * 0.26 + locationMatch + authorityBoost,
    );

    return { ...item, relevanceScore: Number(blendedScore.toFixed(2)) };
  })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);
}

export function getLocationByKey(key: string): LocationInfo {
  return COASTAL_LOCATIONS[key] || COASTAL_LOCATIONS.digha;
}
