/**
 * UncertaintyFusionEngine.
 *
 * Fuses confidence, contradiction severity, signal density, evidence quality,
 * and disagreement into a single certainty category + uncertainty/ambiguity
 * scalars. The category is the one piece of operator-facing summarisation
 * we permit — but we always preserve the underlying ambiguity score so the
 * UI never pretends to a precision the system does not have.
 */

import type { CandidateAnalysisLike } from "./synthesize.js";
import type {
  CertaintyCategory,
  ConfidencePropagation,
  DisagreementAnalysis,
  UncertaintyFusion,
} from "./types.js";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function fuseUncertainty(
  analysis: CandidateAnalysisLike,
  confidence: ConfidencePropagation,
  disagreement: DisagreementAnalysis,
): UncertaintyFusion {
  const fit = analysis.bayesian.result.fitScore;
  const evidenceCount =
    analysis.bayesian.result.supportingEvidence.length +
    analysis.bayesian.result.refutingEvidence.length;
  const signalDensity = clamp01(evidenceCount / 8);

  // Evidence reliability: weighted blend of source strength + diversity proxy.
  const domains = new Set(
    analysis.bayesian.result.perDomain.map((d) => d.domain),
  );
  const diversity = Math.min(1, domains.size / 4);
  const evidenceReliability = clamp01(
    0.5 * analysis.bayesian.result.evidenceStrength + 0.5 * diversity,
  );

  // Categorisation thresholds — explicit so they can be audited.
  const adjustedConfidence = confidence.globalConfidence;
  let category: CertaintyCategory;
  if (disagreement.disagreementScore >= 0.4 && adjustedConfidence < 0.7) {
    category = "ambiguous";
  } else if (fit >= 0.65 && adjustedConfidence >= 0.55) {
    category = "high-confidence-positive";
  } else if (fit <= 0.35 && adjustedConfidence >= 0.55) {
    category = "high-confidence-negative";
  } else if (fit >= 0.5) {
    category = "uncertain-positive";
  } else if (fit < 0.5 && adjustedConfidence < 0.55) {
    category = "uncertain-negative";
  } else {
    category = "ambiguous";
  }

  // Ambiguity score: high when confidence is mid AND disagreement is non-trivial.
  const midnessOfConfidence = 1 - Math.abs(adjustedConfidence - 0.5) * 2;
  const ambiguityScore = clamp01(
    0.5 * disagreement.disagreementScore +
      0.3 * midnessOfConfidence +
      0.2 * (1 - signalDensity),
  );

  const uncertaintyLevel = clamp01(
    0.4 * (1 - adjustedConfidence) +
      0.3 * ambiguityScore +
      0.3 * (1 - evidenceReliability),
  );

  return {
    certaintyCategory: category,
    uncertaintyLevel: Number(uncertaintyLevel.toFixed(3)),
    ambiguityScore: Number(ambiguityScore.toFixed(3)),
    evidenceReliability: Number(evidenceReliability.toFixed(3)),
    confidenceDistribution: { ...confidence.localAdjustments },
  };
}
