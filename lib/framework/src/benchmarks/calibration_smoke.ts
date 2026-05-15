/**
 * CalibrationSmokeVerifier.
 *
 * Pure, deterministic Expected-Calibration-Error against the benchmark
 * corpus' own predicted Bayesian fit scores and synthetic "ground truth"
 * outcomes derived from each archetype's expected category.
 *
 * If ECE exceeds the threshold, the benchmark fails LOUDLY — overconfidence
 * is never silently absorbed.
 */

import type {
  BenchmarkArchetype,
  CalibrationSmokeCheck,
  ScenarioOutputs,
} from "./types.js";

/** Ground-truth "would hire" outcome by archetype, encoded as 0/1. */
const GROUND_TRUTH: Record<BenchmarkArchetype, 0 | 1> = {
  inflated_senior: 0,
  founder_builder: 1,
  plateaued_staff: 0,
  elite_ic: 1,
  high_variance_candidate: 0,
  ambiguous_generalist: 0,
  fake_oss_signal: 0,
  chaos_thriver: 1,
  process_dependent_operator: 0,
  underestimated_junior: 1,
};

const ECE_THRESHOLD = 0.4;

export function verifyCalibrationSmoke(
  outputs: ScenarioOutputs[],
): CalibrationSmokeCheck {
  const buckets = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const bucketed: Array<{ predSum: number; truthSum: number; count: number }> = [];
  for (let i = 0; i < buckets.length - 1; i++) {
    bucketed.push({ predSum: 0, truthSum: 0, count: 0 });
  }
  const reasons: string[] = [];

  outputs.forEach((o) => {
    const p = o.bayesian.result.fitScore;
    const truth = GROUND_TRUTH[o.scenarioId];
    const idx = Math.min(
      bucketed.length - 1,
      Math.max(0, Math.floor(p * (bucketed.length))),
    );
    bucketed[idx].predSum += p;
    bucketed[idx].truthSum += truth;
    bucketed[idx].count += 1;
    if (p > 0.7 && truth === 0)
      reasons.push(
        `overconfident-positive: ${o.scenarioId} predicted=${p.toFixed(2)} truth=0`,
      );
    if (p < 0.3 && truth === 1)
      reasons.push(
        `overconfident-negative: ${o.scenarioId} predicted=${p.toFixed(2)} truth=1`,
      );
  });

  let weighted = 0;
  let total = 0;
  bucketed.forEach((b) => {
    if (b.count === 0) return;
    const avgPred = b.predSum / b.count;
    const avgTruth = b.truthSum / b.count;
    weighted += b.count * Math.abs(avgPred - avgTruth);
    total += b.count;
  });
  const ece = total === 0 ? 0 : Number((weighted / total).toFixed(4));
  const overconfidenceRisk: "low" | "medium" | "high" =
    ece > 0.5 ? "high" : ece > 0.3 ? "medium" : "low";
  const passed = ece <= ECE_THRESHOLD;
  if (!passed)
    reasons.unshift(`ECE ${ece} exceeds threshold ${ECE_THRESHOLD}`);
  return {
    passed,
    ece,
    overconfidenceRisk,
    predictionsEvaluated: total,
    detail: passed
      ? `ECE=${ece} within threshold ${ECE_THRESHOLD}`
      : `ECE=${ece} exceeds threshold ${ECE_THRESHOLD} — overconfidence detected`,
    reasons,
  };
}
