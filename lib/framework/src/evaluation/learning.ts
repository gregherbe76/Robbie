import {
  type ArchetypePerformance,
  type DriftReport,
  type DriftSignal,
  type OrganizationalLearningSignal,
  type OutcomeEvent,
  OUTCOME_POLARITY,
  type PredictionRecord,
  type TrajectoryObservation,
  clamp01,
} from "./types.js";

// =========================================================================
// 5. ArchetypePerformanceTracker
// =========================================================================

export function trackArchetypePerformance(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): ArchetypePerformance[] {
  const byArchetype = new Map<string, PredictionRecord[]>();
  for (const p of predictions) {
    if (!p.archetype) continue;
    const arr = byArchetype.get(p.archetype) ?? [];
    arr.push(p);
    byArchetype.set(p.archetype, arr);
  }

  const results: ArchetypePerformance[] = [];
  for (const [archetype, preds] of byArchetype) {
    // For each candidate covered by this archetype, the realised outcomes.
    const candidateKeys = new Set(
      preds.map((p) => `${p.organizationId}::${p.candidateId}`),
    );
    let positives = 0,
      negatives = 0,
      promotion = 0,
      retention = 0,
      sampleSize = 0;
    const failurePatterns = new Map<string, number>();
    const successByOrg = new Map<string, number[]>();

    for (const key of candidateKeys) {
      const [orgId, candId] = key.split("::");
      const candOutcomes = outcomes.filter(
        (o) =>
          o.organizationId === orgId &&
          o.candidateId === candId &&
          OUTCOME_POLARITY[o.outcomeType] !== "process",
      );
      if (candOutcomes.length === 0) continue;
      sampleSize += 1;
      const types = candOutcomes.map((o) => o.outcomeType);
      const positive = types.some((t) => OUTCOME_POLARITY[t] === "positive");
      const negative = types.some((t) => OUTCOME_POLARITY[t] === "negative");
      // Mixed: count the most recent.
      const last = candOutcomes[candOutcomes.length - 1];
      const finalPositive = OUTCOME_POLARITY[last.outcomeType] === "positive";
      if (finalPositive) positives += 1;
      else negatives += 1;
      if (types.includes("promotion")) promotion += 1;
      if (types.includes("retention") || types.includes("successful_hire"))
        retention += 1;
      if (negative && !finalPositive) {
        for (const t of types.filter(
          (t) => OUTCOME_POLARITY[t] === "negative",
        )) {
          failurePatterns.set(t, (failurePatterns.get(t) ?? 0) + 1);
        }
      }
      const orgArr = successByOrg.get(orgId) ?? [];
      orgArr.push(finalPositive ? 1 : 0);
      successByOrg.set(orgId, orgArr);
    }

    const successRate = sampleSize === 0 ? 0 : positives / sampleSize;
    const failureRate = sampleSize === 0 ? 0 : negatives / sampleSize;
    const promotionRate = sampleSize === 0 ? 0 : promotion / sampleSize;
    const retentionRate = sampleSize === 0 ? 0 : retention / sampleSize;
    const avgPredictedConf =
      preds.reduce((s, p) => s + p.confidence, 0) / Math.max(1, preds.length);
    const realisedAccuracy = successRate; // for positive-archetype predictions
    const orgSuccessRates = Array.from(successByOrg.values()).map(
      (xs) => xs.reduce((s, x) => s + x, 0) / xs.length,
    );
    const envSensitivity =
      orgSuccessRates.length < 2 ? 0 : variance(orgSuccessRates);

    // Confidence falls when sample is small or when realised vs claimed
    // disagree.
    const supportFactor = Math.min(1, sampleSize / 5);
    const calibConfidence = clamp01(
      1 - Math.abs(avgPredictedConf - realisedAccuracy),
    );
    const confidence = round(0.6 * calibConfidence + 0.4 * supportFactor);

    results.push({
      archetype,
      sampleSize,
      successRate: round(successRate),
      failureRate: round(failureRate),
      retentionRate: round(retentionRate),
      promotionRate: round(promotionRate),
      averagePredictedConfidence: round(avgPredictedConf),
      realisedAccuracy: round(realisedAccuracy),
      failurePatterns: Array.from(failurePatterns.entries())
        .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
        .map(([k, n]) => `${k} (${n})`),
      environmentSensitivity: round(envSensitivity),
      confidence,
    });
  }
  results.sort((a, b) => a.archetype.localeCompare(b.archetype));
  return results;
}

// =========================================================================
// 6. OrganizationalLearningEngine
// =========================================================================
//
// For each org, accumulate inspectable correlates between candidate-side
// signals and realised outcomes. Recommendations are bounded deltas, never
// hidden weights. No RL, no opaque mutation.

export function buildOrganizationalLearning(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): OrganizationalLearningSignal[] {
  const orgIds = Array.from(
    new Set(predictions.map((p) => p.organizationId)),
  ).sort();
  const signals: OrganizationalLearningSignal[] = [];

  for (const organizationId of orgIds) {
    const orgPreds = predictions.filter((p) => p.organizationId === organizationId);
    const candidateIds = Array.from(
      new Set(orgPreds.map((p) => p.candidateId)),
    );
    const successCorrelates: OrganizationalLearningSignal["successCorrelates"] =
      [];
    const failureCorrelates: OrganizationalLearningSignal["failureCorrelates"] =
      [];
    const adjustments: OrganizationalLearningSignal["recommendedWeightAdjustments"] =
      [];
    let resolvedCount = 0;
    let positive = 0;

    // Aggregate per-kind avg score among positive vs negative outcomes.
    const byKindPositive = new Map<string, number[]>();
    const byKindNegative = new Map<string, number[]>();

    for (const cid of candidateIds) {
      const realised = outcomes
        .filter(
          (o) =>
            o.organizationId === organizationId &&
            o.candidateId === cid &&
            OUTCOME_POLARITY[o.outcomeType] !== "process",
        )
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id.localeCompare(b.id)));
      if (realised.length === 0) continue;
      resolvedCount += 1;
      const finalPolarity = OUTCOME_POLARITY[realised[realised.length - 1].outcomeType];
      if (finalPolarity === "positive") positive += 1;
      const candPreds = orgPreds.filter((p) => p.candidateId === cid);
      for (const p of candPreds) {
        const bucket =
          finalPolarity === "positive" ? byKindPositive : byKindNegative;
        const arr = bucket.get(p.predictionKind) ?? [];
        arr.push(p.score);
        bucket.set(p.predictionKind, arr);
      }
    }

    for (const [kind, positiveScores] of byKindPositive) {
      const negativeScores = byKindNegative.get(kind) ?? [];
      if (positiveScores.length === 0) continue;
      const meanPos = avg(positiveScores);
      const meanNeg = negativeScores.length === 0 ? meanPos : avg(negativeScores);
      const delta = meanPos - meanNeg;
      if (delta > 0.1) {
        successCorrelates.push({
          attribute: `${kind} score`,
          weight: round(delta),
          sampleSize: positiveScores.length + negativeScores.length,
          rationale: `Successful hires scored ${meanPos.toFixed(2)} vs ${meanNeg.toFixed(2)} on ${kind}.`,
        });
      }
      if (delta < -0.1) {
        failureCorrelates.push({
          attribute: `${kind} score`,
          weight: round(-delta),
          sampleSize: positiveScores.length + negativeScores.length,
          rationale: `Failed hires scored higher on ${kind} (${meanNeg.toFixed(2)} vs ${meanPos.toFixed(2)}) — signal mis-weighted.`,
        });
      }
    }
    // Hiring-bar shift heuristic: change in average score for positive
    // outcomes between first and second halves of resolved cohort.
    const hiringBarShift = computeHiringBarShift(orgPreds, outcomes);
    if (Math.abs(hiringBarShift) > 0.05) {
      adjustments.push({
        agent: "all",
        adjustment: clamp(-hiringBarShift, -0.15, 0.15),
        rationale:
          hiringBarShift < 0
            ? `Hiring bar appears to have dropped ${(-hiringBarShift * 100).toFixed(0)}pp; recommend tightening.`
            : `Hiring bar appears to have risen ${(hiringBarShift * 100).toFixed(0)}pp; recommend loosening if intentional.`,
      });
    }
    for (const f of failureCorrelates) {
      adjustments.push({
        agent: f.attribute,
        adjustment: -clamp(f.weight, 0, 0.15),
        rationale: f.rationale,
      });
    }
    signals.push({
      organizationId,
      successCorrelates,
      failureCorrelates,
      hiringBarShift: round(hiringBarShift),
      founderStyleStability: 1, // demo: no founder change observed
      recommendedWeightAdjustments: adjustments,
      confidence: round(Math.min(1, resolvedCount / 5)),
    });
  }
  return signals;
}

function computeHiringBarShift(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): number {
  const fitPreds = predictions.filter((p) => p.predictionKind === "candidate-fit");
  if (fitPreds.length < 2) return 0;
  const withOutcome = fitPreds
    .map((p) => {
      const resolved = outcomes
        .filter(
          (o) =>
            o.organizationId === p.organizationId &&
            o.candidateId === p.candidateId &&
            OUTCOME_POLARITY[o.outcomeType] !== "process",
        )
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id.localeCompare(b.id)));
      const last = resolved[resolved.length - 1];
      return last ? { score: p.score, time: last.timestamp } : null;
    })
    .filter(<T,>(x: T | null): x is T => x !== null)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  if (withOutcome.length < 2) return 0;
  const mid = Math.floor(withOutcome.length / 2);
  const first = avg(withOutcome.slice(0, mid).map((x) => x.score));
  const second = avg(withOutcome.slice(mid).map((x) => x.score));
  return second - first;
}

// =========================================================================
// 7. DriftDetectionEngine
// =========================================================================
//
// Compare oldest-half vs newest-half of the resolved cohort across:
// calibration, hiring-bar, confidence-inflation, archetype mix.

export function detectDrift(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): DriftReport {
  const resolved = predictions
    .map((p) => {
      const r = outcomes
        .filter(
          (o) =>
            o.organizationId === p.organizationId &&
            o.candidateId === p.candidateId &&
            OUTCOME_POLARITY[o.outcomeType] !== "process",
        )
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id.localeCompare(b.id)));
      const last = r[r.length - 1];
      return last ? { pred: p, outcome: last } : null;
    })
    .filter(<T,>(x: T | null): x is T => x !== null)
    .sort((a, b) => {
      if (a.outcome.timestamp < b.outcome.timestamp) return -1;
      if (a.outcome.timestamp > b.outcome.timestamp) return 1;
      return a.outcome.id.localeCompare(b.outcome.id);
    });

  const drifts: DriftSignal[] = [];
  if (resolved.length < 4) {
    // Insufficient evidence — surface as a low-severity calibration drift
    // candidate rather than fabricate signal.
    return {
      detectedDrifts: [
        {
          driftType: "calibration",
          severity: "low",
          detail: `Only ${resolved.length} resolved predictions — insufficient longitudinal data for drift detection.`,
          impactedAgents: [],
          confidence: 0.4,
          recommendedRecalibration:
            "Accumulate more outcomes before recalibrating; current sample is too small.",
        },
      ],
      driftScore: 0,
    };
  }

  const mid = Math.floor(resolved.length / 2);
  const first = resolved.slice(0, mid);
  const second = resolved.slice(mid);
  const firstAcc =
    first.filter((r) => OUTCOME_POLARITY[r.outcome.outcomeType] === "positive")
      .length / first.length;
  const secondAcc =
    second.filter((r) => OUTCOME_POLARITY[r.outcome.outcomeType] === "positive")
      .length / second.length;
  const firstConf = avg(first.map((r) => r.pred.confidence));
  const secondConf = avg(second.map((r) => r.pred.confidence));

  if (Math.abs(firstConf - firstAcc - (secondConf - secondAcc)) > 0.1) {
    drifts.push({
      driftType: "calibration",
      severity: "medium",
      detail: `Calibration gap shifted from ${(firstConf - firstAcc).toFixed(2)} to ${(secondConf - secondAcc).toFixed(2)}.`,
      impactedAgents: ["all"],
      confidence: 0.7,
      recommendedRecalibration:
        "Re-fit confidence buckets on the most recent cohort.",
    });
  }
  if (secondConf - firstConf > 0.1) {
    drifts.push({
      driftType: "confidence-inflation",
      severity: "high",
      detail: `Average confidence rose ${((secondConf - firstConf) * 100).toFixed(0)}pp without accuracy gain.`,
      impactedAgents: ["bayesian-fit-agent", "hiring-risk-agent"],
      confidence: 0.7,
      recommendedRecalibration:
        "Penalise confidence on the agents whose claims grew faster than realised accuracy.",
    });
  }
  if (secondAcc - firstAcc < -0.15) {
    drifts.push({
      driftType: "hiring-bar",
      severity: "high",
      detail: `Realised success rate dropped from ${(firstAcc * 100).toFixed(0)}% to ${(secondAcc * 100).toFixed(0)}%.`,
      impactedAgents: ["bayesian-fit-agent"],
      confidence: 0.7,
      recommendedRecalibration:
        "Raise the strong-fit threshold and revisit the chaos-tolerance gate.",
    });
  }

  const driftScore = clamp01(drifts.length / 3);
  return { detectedDrifts: drifts, driftScore: round(driftScore) };
}

// =========================================================================
// 8. LongitudinalTrajectoryTracker
// =========================================================================

const TRAJECTORY_WEIGHTS: Record<string, number> = {
  promotion: 1,
  exceptional_growth: 1,
  successful_hire: 0.7,
  retention: 0.5,
  founder_success: 1,
  poor_performance: -0.7,
  rapid_exit: -1,
  org_mismatch: -0.8,
  team_failure: -0.8,
};

export function trackTrajectories(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): TrajectoryObservation[] {
  const trajectoryPreds = predictions.filter(
    (p) => p.predictionKind === "trajectory",
  );
  const obs: TrajectoryObservation[] = [];
  for (const p of trajectoryPreds) {
    const candOutcomes = outcomes
      .filter(
        (o) =>
          o.organizationId === p.organizationId &&
          o.candidateId === p.candidateId,
      )
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id.localeCompare(b.id)));
    if (candOutcomes.length === 0) continue;
    const realisedVelocity = clamp01(
      0.5 +
        candOutcomes.reduce(
          (s, o) => s + (TRAJECTORY_WEIGHTS[o.outcomeType] ?? 0),
          0,
        ) /
          Math.max(2, candOutcomes.length),
    );
    const ownershipGrowth =
      candOutcomes.some((o) => o.outcomeType === "promotion") ? 0.9 : 0.4;
    const roleEvolution = candOutcomes.some((o) => o.outcomeType === "promotion")
      ? "expanded"
      : candOutcomes.some((o) => o.outcomeType === "rapid_exit")
        ? "exited"
        : candOutcomes.some((o) => o.outcomeType === "poor_performance")
          ? "contracted"
          : "stable";
    const organizationalImpact = realisedVelocity;
    obs.push({
      candidateId: p.candidateId,
      organizationId: p.organizationId,
      predictedTrajectory: round(p.score),
      realisedVelocity: round(realisedVelocity),
      ownershipGrowth: round(ownershipGrowth),
      roleEvolution,
      organizationalImpact: round(organizationalImpact),
      matchesPrediction: Math.abs(realisedVelocity - p.score) < 0.2,
      evidence: candOutcomes.map(
        (o) => `${o.outcomeType}@${o.timestamp.slice(0, 10)}`,
      ),
    });
  }
  obs.sort((a, b) =>
    `${a.organizationId}:${a.candidateId}`.localeCompare(
      `${b.organizationId}:${b.candidateId}`,
    ),
  );
  return obs;
}

function avg(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = avg(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
