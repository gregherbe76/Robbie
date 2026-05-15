/**
 * ReviewerCalibrationEngine.
 *
 * Calibration here is CONTEXTUAL — it is computed per-domain and exposed
 * alongside the patterns that produced it. Reviewers are NOT reduced to a
 * single score. The composite `reliability` field is provided as a
 * convenience for sorting/UI, but the per-domain profile is the source of
 * truth.
 */

import type {
  CalibrationProfile,
  OverrideRecord,
  ReviewerAction,
  ReviewerCalibrationReport,
  ReviewerIdentity,
} from "./types.js";

export interface ComputeCalibrationInput {
  reviewer: ReviewerIdentity;
  actions: readonly ReviewerAction[];
  overrides: readonly OverrideRecord[];
  /** Optional disagreement signal: how often this reviewer's dissent matched a later outcome. */
  disagreementHits?: { matched: number; total: number };
  /** Prior calibration profile snapshot (for drift). */
  priorProfile?: readonly CalibrationProfile[];
  now: string;
}

export class ReviewerCalibrationEngine {
  compute(input: ComputeCalibrationInput): ReviewerCalibrationReport {
    const { reviewer, actions, overrides, priorProfile, disagreementHits } = input;

    // Composite reliability: mean Brier across calibrated domains, inverted
    // so higher is better. Null when no domain has a Brier yet.
    const briers = reviewer.calibrationProfile
      .map((p) => p.brier)
      .filter((b): b is number => b !== null);
    const meanBrier =
      briers.length > 0 ? briers.reduce((a, b) => a + b, 0) / briers.length : null;
    const reliability =
      meanBrier === null ? null : clamp01(1 - meanBrier);

    // Overconfidence: weighted average of per-domain overconfidence values.
    const overconfidenceValues = reviewer.calibrationProfile
      .map((p) => p.overconfidence)
      .filter((o): o is number => o !== null);
    const overconfidenceRisk =
      overconfidenceValues.length === 0
        ? null
        : clamp01(
            (overconfidenceValues.reduce((a, b) => a + Math.max(0, b), 0) /
              overconfidenceValues.length) *
              // boost the risk if the reviewer's variance is unusually low
              (reviewer.confidencePatterns.confidenceVariance < 0.05 ? 1.25 : 1.0),
          );

    const disagreementValue =
      disagreementHits && disagreementHits.total > 0
        ? clamp01(disagreementHits.matched / disagreementHits.total)
        : null;

    const drift =
      priorProfile === undefined
        ? null
        : computeDrift(reviewer.calibrationProfile, priorProfile);

    const historicalPatterns = derivePatterns(reviewer, actions, overrides);

    return {
      reviewerId: reviewer.reviewerId,
      reviewerCalibration: reviewer.calibrationProfile,
      reliability,
      overconfidenceRisk,
      disagreementValue,
      calibrationDrift: drift,
      historicalPatterns,
      computedAt: input.now,
    };
  }
}

function computeDrift(
  current: readonly CalibrationProfile[],
  prior: readonly CalibrationProfile[],
): number | null {
  const priorByDomain = new Map(prior.map((p) => [p.domain, p]));
  const deltas: number[] = [];
  for (const c of current) {
    const p = priorByDomain.get(c.domain);
    if (!p || c.brier === null || p.brier === null) continue;
    deltas.push(Math.abs(c.brier - p.brier));
  }
  if (deltas.length === 0) return null;
  return clamp01(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

function derivePatterns(
  reviewer: ReviewerIdentity,
  actions: readonly ReviewerAction[],
  overrides: readonly OverrideRecord[],
): ReviewerCalibrationReport["historicalPatterns"] {
  const patterns: Array<ReviewerCalibrationReport["historicalPatterns"][number]> = [];

  if (reviewer.confidencePatterns.confidenceVariance < 0.05 && actions.length >= 3) {
    patterns.push({
      pattern: "always_certain",
      occurrences: actions.length,
      note: "stated confidence varies <0.05 across all recorded actions",
    });
  }

  const challenged = actions.filter((a) => a.kind === "challenge_hypothesis").length;
  const supported = actions.filter((a) => a.kind === "support_hypothesis").length;
  if (challenged + supported >= 3 && challenged === 0) {
    patterns.push({
      pattern: "rarely_challenges",
      occurrences: supported,
      note: "no challenge_hypothesis actions despite repeated support actions",
    });
  }
  if (challenged + supported >= 3 && supported === 0) {
    patterns.push({
      pattern: "rarely_supports",
      occurrences: challenged,
      note: "no support_hypothesis actions despite repeated challenges",
    });
  }

  if (overrides.length >= 2) {
    const successful = overrides.filter(
      (o) => o.outcome === "validated_correct",
    ).length;
    const incorrect = overrides.filter(
      (o) => o.outcome === "validated_incorrect",
    ).length;
    patterns.push({
      pattern: "override_track_record",
      occurrences: overrides.length,
      note: `${successful} validated_correct, ${incorrect} validated_incorrect, ${overrides.length - successful - incorrect} pending/inconclusive`,
    });
  }

  if (reviewer.confidencePatterns.uncertaintyExpressionRate >= 0.5) {
    patterns.push({
      pattern: "uncertainty_aware",
      occurrences: actions.length,
      note: `attaches uncertainty markers on ${Math.round(reviewer.confidencePatterns.uncertaintyExpressionRate * 100)}% of actions`,
    });
  }

  return patterns;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
