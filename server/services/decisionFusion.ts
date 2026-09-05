import type { GeofenceSpatialAnalysis, RiskPrediction } from '../../src/types.ts';
import type { PfzAnalysis, PfzZone } from './pfzService.ts';

export type OperationalDecision = 'PROCEED' | 'CAUTION' | 'AVOID' | 'UNAVAILABLE';
export type DecisionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';

export interface DecisionFusionResult {
  decision: OperationalDecision;
  confidence: DecisionConfidence;
  score: number;
  rationale: string;
  factors: string[];
  warnings: string[];
  selectedZone?: string;
}

function confidenceFor(risk: RiskPrediction, pfz?: PfzAnalysis): DecisionConfidence {
  if (!pfz) return risk.confidenceScore >= 80 ? 'HIGH' : risk.confidenceScore >= 60 ? 'MEDIUM' : 'LOW';
  if (pfz.status === 'UNAVAILABLE') return 'LOW';
  const pfzConfidence = pfz.bestZone?.confidence;
  if (risk.confidenceScore >= 80 && pfzConfidence === 'HIGH') return 'HIGH';
  if (risk.confidenceScore >= 60 && (pfzConfidence === 'HIGH' || pfzConfidence === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

function bestAccessibleZone(pfz?: PfzAnalysis): PfzZone | undefined {
  if (!pfz) return undefined;
  return pfz.zones.find((zone) => zone.geofenceStatus !== 'RESTRICTED' && zone.suitability !== 'LOW');
}

export function fuseMarineDecision(
  risk: RiskPrediction,
  geofence?: GeofenceSpatialAnalysis,
  pfz?: PfzAnalysis,
): DecisionFusionResult {
  const warnings: string[] = [];
  const factors: string[] = [];
  const accessibleZone = bestAccessibleZone(pfz);
  const selectedZone = accessibleZone ?? pfz?.bestZone;
  let score = 100 - risk.riskScore;

  factors.push(`Marine safety risk: ${risk.riskLevel} (${risk.riskScore}/100).`);

  if (geofence?.inRestrictedWaters || geofence?.status === 'RESTRICTED_BREACH') {
    score = 0;
    factors.push('Authoritative geofence indicates restricted or breached waters.');
    warnings.push('Do not operate in restricted waters; authoritative maritime boundaries take precedence over environmental suitability.');
  } else if (geofence?.status === 'CAUTION') {
    score -= 20;
    factors.push('Authoritative geofence indicates proximity/caution around a protected or restricted feature.');
    warnings.push('Verify official nautical charts and protected-area rules before operating.');
  } else if (geofence) {
    factors.push('Authoritative geofence check is clear at the operating point.');
  }

  if (risk.riskLevel === 'EXTREME') {
    score = 0;
    warnings.push('Extreme marine risk overrides PFZ potential.');
  } else if (risk.riskLevel === 'HIGH') {
    score = Math.min(score, 35);
    warnings.push('High marine risk overrides an otherwise favorable fishing signal.');
  } else if (risk.riskLevel === 'MODERATE') {
    score = Math.min(score, 65);
    factors.push('Moderate risk limits the operational recommendation.');
  }

  if (pfz) {
    if (pfz.status === 'UNAVAILABLE') {
      warnings.push('PFZ observations are unavailable; no positive fishing recommendation is inferred.');
    } else {
      const zone = selectedZone;
      if (zone) {
        const suitabilityWeight = zone.suitability === 'HIGH' ? 20 : zone.suitability === 'MODERATE' ? 10 : 0;
        score = Math.min(100, Math.max(0, score * 0.8 + zone.score * 0.2 + suitabilityWeight - (zone.confidence === 'LOW' ? 10 : 0)));
        factors.push(`PFZ candidate ${zone.id}: ${zone.score}/100, ${zone.suitability} suitability, ${zone.confidence} confidence.`);
        if (zone.confidence === 'LOW' || pfz.status === 'DEGRADED') warnings.push('PFZ evidence is degraded; treat environmental suitability as decision support rather than a strong recommendation.');
        if (zone.geofenceStatus === 'RESTRICTED') warnings.push(`${zone.id} is restricted and cannot be selected as an accessible fishing zone.`);
      } else {
        warnings.push('No accessible PFZ candidate met the positive suitability criteria.');
      }
    }
  }

  score = Number(Math.min(100, Math.max(0, score)).toFixed(1));
  const decision: OperationalDecision = score >= 70 && risk.riskLevel === 'LOW' && !geofence?.inRestrictedWaters
    ? 'PROCEED'
    : score >= 40 && risk.riskLevel !== 'HIGH' && risk.riskLevel !== 'EXTREME' && !geofence?.inRestrictedWaters
      ? 'CAUTION'
      : 'AVOID';

  const confidence = confidenceFor(risk, pfz);
  const rationale = decision === 'PROCEED'
    ? 'Environmental potential is favorable enough for decision support and no overriding safety or geofence constraint was detected.'
    : decision === 'CAUTION'
      ? 'Some conditions are usable, but safety, evidence quality, PFZ uncertainty, or spatial constraints limit confidence.'
      : 'Safety or spatial constraints outweigh the environmental fishing potential.';

  return { decision, confidence, score, rationale, factors, warnings: [...new Set(warnings)], selectedZone: selectedZone?.id };
}
