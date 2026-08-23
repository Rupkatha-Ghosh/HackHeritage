import { COASTAL_LOCATIONS, MARINE_EVIDENCE_CORPUS } from '../../src/data/coastalData.ts';
import { EvidenceItem, LocationInfo } from '../../src/types.ts';

export function retrieveEvidence(query: string, location: LocationInfo, riskLevel: string): EvidenceItem[] {
  void query;
  void location;
  return MARINE_EVIDENCE_CORPUS.map(item => {
    let score = item.relevanceScore;
    if (riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
      if (item.id.includes('IMD') || item.id.includes('INCOIS')) score = Math.min(0.99, score + 0.05);
    }
    return { ...item, relevanceScore: Number(score.toFixed(2)) };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function getLocationByKey(key: string): LocationInfo {
  return COASTAL_LOCATIONS[key] || COASTAL_LOCATIONS.digha;
}
