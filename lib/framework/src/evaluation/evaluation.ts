import {
  type CalibrationBucket,
  type CalibrationCurve,
  type ConfidenceReliabilityReport,
  type OutcomeEvent,
  OUTCOME_POLARITY,
  type PredictionEvaluation,
  type PredictionEvaluationReport,
  type PredictionKind,
  type PredictionRecord,
  PREDICTION_POLARITY,
  clamp01,
} from "./types.js";

// =========================================================================
// 2. PredictionEvaluationEngine
// =========================================================================
//
// For each prediction, look up the resolved outcome (if any) for the same
// org × candidate. Map prediction-polarity vs outcome-polarity into a 2×2
// confusion matrix per kind.

function resolveForPrediction(
  prediction: PredictionRecord,
  outcomes: OutcomeEvent[],
): OutcomeEvent | null {
  const resolved = outcomes
    .filter(
      (o) =>
        o.organizationId === prediction.organizationId &&
        o.candidateId === prediction.candidateId &&
        OUTCOME_POLARITY[o.outcomeType] !== "process",
    )
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id.localeCompare(b.id)));
  return resolved.length === 0 ? null : resolved[resolved.length - 1];
}

/** Returns 1 (positive realised) or 0 (negative realised), aligned to the
 *  prediction kind's expected polarity. For risk/contradiction we invert. */
function alignedLabel(
  prediction: PredictionRecord,
  outcome: OutcomeEvent,
): 0 | 1 {
  const pol = OUTCOME_POLARITY[outcome.outcomeType]; // positive | negative
  const expected = PREDICTION_POLARITY[prediction.predictionKind];
  if (expected === "positive") return pol === "positive" ? 1 : 0;
  return pol === "negative" ? 1 : 0;
}

/** Convert a prediction-kind score into the polarity-aligned probability. */
function alignedScore(prediction: PredictionRecord): number {
  return clamp01(prediction.score);
}

/** Decision threshold for the score → predicted-label mapping. We use 0.5
 *  uniformly — this is part of the calibration story we want to reveal. */
const DECISION_THRESHOLD = 0.5;

export function evaluatePredictionsByKind(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): PredictionEvaluation[] {
  const groups = new Map<PredictionKind, PredictionRecord[]>();
  for (const p of predictions) {
    const arr = groups.get(p.predictionKind) ?? [];
    arr.push(p);
    groups.set(p.predictionKind, arr);
  }

  const reports: PredictionEvaluation[] = [];
  for (const [kind, preds] of groups) {
    let tp = 0,
      fp = 0,
      tn = 0,
      fn = 0;
    let evaluated = 0;
    let brierSum = 0;
    let confSum = 0;
    let correctSum = 0;

    for (const p of preds) {
      const outcome = resolveForPrediction(p, outcomes);
      if (!outcome) continue;
      evaluated += 1;
      const y = alignedLabel(p, outcome);
      const s = alignedScore(p);
      const predictedLabel = s >= DECISION_THRESHOLD ? 1 : 0;
      if (predictedLabel === 1 && y === 1) tp += 1;
      else if (predictedLabel === 1 && y === 0) fp += 1;
      else if (predictedLabel === 0 && y === 0) tn += 1;
      else fn += 1;
      brierSum += (s - y) ** 2;
      confSum += p.confidence;
      correctSum += predictedLabel === y ? 1 : 0;
    }

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const avgConf = evaluated === 0 ? 0 : confSum / evaluated;
    const acc = evaluated === 0 ? 0 : correctSum / evaluated;
    const gap = avgConf - acc;
    reports.push({
      predictionKind: kind,
      evaluated,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      precision: round(precision),
      recall: round(recall),
      f1: round(f1),
      brierScore: evaluated === 0 ? 0 : round(brierSum / evaluated),
      averageConfidence: round(avgConf),
      observedAccuracy: round(acc),
      calibrationGap: round(gap),
    });
  }
  // Stable ordering.
  reports.sort((a, b) => a.predictionKind.localeCompare(b.predictionKind));
  return reports;
}

export function buildPredictionEvaluationReport(
  kindReports: PredictionEvaluation[],
): PredictionEvaluationReport {
  const support = (r: PredictionEvaluation) => r.evaluated || 1;
  const totalSupport = kindReports.reduce((s, r) => s + support(r), 0) || 1;
  const predictionQuality = round(
    kindReports.reduce((s, r) => s + r.f1 * support(r), 0) / totalSupport,
  );
  const confidenceReliability = round(
    1 -
      kindReports.reduce(
        (s, r) => s + Math.abs(r.calibrationGap) * support(r),
        0,
      ) /
        totalSupport,
  );
  const calibrationQuality = confidenceReliability;

  const ranked = kindReports
    .slice()
    .sort(
      (a, b) =>
        b.f1 * (b.evaluated || 0) - a.f1 * (a.evaluated || 0) ||
        a.predictionKind.localeCompare(b.predictionKind),
    );
  const strongestSignals = ranked
    .slice(0, 3)
    .filter((r) => r.evaluated > 0 && r.f1 >= 0.6)
    .map(
      (r) =>
        `${r.predictionKind}: F1 ${r.f1.toFixed(2)} on ${r.evaluated} cases`,
    );
  const weakestSignals = ranked
    .slice()
    .reverse()
    .slice(0, 3)
    .filter((r) => r.evaluated > 0 && (r.f1 < 0.5 || Math.abs(r.calibrationGap) > 0.15))
    .map(
      (r) =>
        `${r.predictionKind}: F1 ${r.f1.toFixed(2)}, gap ${r.calibrationGap.toFixed(2)}`,
    );

  const recurringFailureModes: string[] = [];
  for (const r of kindReports) {
    if (r.evaluated === 0) continue;
    if (r.calibrationGap > 0.15) {
      recurringFailureModes.push(
        `${r.predictionKind}: over-confidence ${(r.calibrationGap * 100).toFixed(0)}pp on ${r.evaluated} cases`,
      );
    }
    if (r.calibrationGap < -0.15) {
      recurringFailureModes.push(
        `${r.predictionKind}: under-confidence ${(-r.calibrationGap * 100).toFixed(0)}pp on ${r.evaluated} cases`,
      );
    }
    if (r.falsePositives > r.truePositives && r.evaluated >= 3) {
      recurringFailureModes.push(
        `${r.predictionKind}: false-positive heavy (${r.falsePositives} FP vs ${r.truePositives} TP)`,
      );
    }
  }

  return {
    kindReports,
    predictionQuality,
    calibrationQuality,
    strongestSignals,
    weakestSignals,
    recurringFailureModes,
    confidenceReliability,
  };
}

// =========================================================================
// 3. CalibrationEngine — bucketed calibration curves + ECE.
// =========================================================================

const DEFAULT_BUCKETS: Array<[number, number]> = [
  [0.0, 0.2],
  [0.2, 0.4],
  [0.4, 0.6],
  [0.6, 0.75],
  [0.75, 0.85],
  [0.85, 1.01],
];

interface SamplePoint {
  confidence: number;
  realisedPositive: 0 | 1;
}

function buildBuckets(samples: SamplePoint[]): CalibrationBucket[] {
  const result: CalibrationBucket[] = [];
  for (const [lo, hi] of DEFAULT_BUCKETS) {
    const inBucket = samples.filter(
      (s) => s.confidence >= lo && s.confidence < hi,
    );
    const n = inBucket.length;
    const observed = n === 0 ? 0 : inBucket.reduce((s, x) => s + x.realisedPositive, 0) / n;
    const expected = (lo + Math.min(1, hi)) / 2;
    result.push({
      lower: lo,
      upper: Math.min(1, hi),
      midpoint: round(expected),
      predictions: n,
      observedPositiveRate: round(observed),
      expectedPositiveRate: round(expected),
      gap: round(observed - expected),
    });
  }
  return result;
}

function eceFromBuckets(buckets: CalibrationBucket[], total: number): number {
  if (total === 0) return 0;
  return round(
    buckets.reduce(
      (s, b) => s + (b.predictions / total) * Math.abs(b.gap),
      0,
    ),
  );
}

function buildCurve(
  scope: CalibrationCurve["scope"],
  scopeKey: string,
  samples: SamplePoint[],
): CalibrationCurve {
  const buckets = buildBuckets(samples);
  const ece = eceFromBuckets(buckets, samples.length);
  const observedOverall =
    samples.length === 0
      ? 0
      : samples.reduce((s, x) => s + x.realisedPositive, 0) / samples.length;
  const expectedOverall =
    samples.length === 0
      ? 0
      : samples.reduce((s, x) => s + x.confidence, 0) / samples.length;
  return {
    scope,
    scopeKey,
    buckets,
    expectedCalibrationError: ece,
    predictionsEvaluated: samples.length,
    systematicBias: round(expectedOverall - observedOverall),
  };
}

function predictionsToSamples(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): SamplePoint[] {
  const samples: SamplePoint[] = [];
  for (const p of predictions) {
    const outcome = resolveForPrediction(p, outcomes);
    if (!outcome) continue;
    samples.push({
      confidence: clamp01(p.confidence),
      realisedPositive: alignedLabel(p, outcome),
    });
  }
  return samples;
}

export function computeCalibration(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
): {
  global: CalibrationCurve;
  perAgent: CalibrationCurve[];
  perOrg: CalibrationCurve[];
  perArchetype: CalibrationCurve[];
} {
  const globalSamples = predictionsToSamples(predictions, outcomes);
  const global = buildCurve("global", "all", globalSamples);

  const byAgent = new Map<string, PredictionRecord[]>();
  const byOrg = new Map<string, PredictionRecord[]>();
  const byArchetype = new Map<string, PredictionRecord[]>();
  for (const p of predictions) {
    push(byAgent, p.producedBy, p);
    push(byOrg, p.organizationId, p);
    if (p.archetype) push(byArchetype, p.archetype, p);
  }
  const perAgent = Array.from(byAgent.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, ps]) =>
      buildCurve("per-agent", k, predictionsToSamples(ps, outcomes)),
    );
  const perOrg = Array.from(byOrg.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, ps]) =>
      buildCurve("per-organization", k, predictionsToSamples(ps, outcomes)),
    );
  const perArchetype = Array.from(byArchetype.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, ps]) =>
      buildCurve("per-archetype", k, predictionsToSamples(ps, outcomes)),
    );
  return { global, perAgent, perOrg, perArchetype };
}

// =========================================================================
// 4. ConfidenceReliabilityAnalyzer
// =========================================================================

export function analyzeReliability(
  global: CalibrationCurve,
  byKind: PredictionEvaluation[],
): ConfidenceReliabilityReport {
  const reliabilityScore = round(clamp01(1 - global.expectedCalibrationError));

  // Per-bucket classification.
  const bucketClassifications = global.buckets.map((b) => {
    if (b.predictions === 0) {
      return {
        bucket: `${b.lower.toFixed(2)}–${b.upper.toFixed(2)}`,
        classification: "unstable" as const,
        note: "No samples in bucket — reliability unknown.",
      };
    }
    const g = b.gap;
    if (Math.abs(g) <= 0.05) {
      return {
        bucket: `${b.lower.toFixed(2)}–${b.upper.toFixed(2)}`,
        classification: "justified" as const,
        note: `Observed ${(b.observedPositiveRate * 100).toFixed(0)}% vs expected ${(b.midpoint * 100).toFixed(0)}%.`,
      };
    }
    if (g <= -0.15) {
      return {
        bucket: `${b.lower.toFixed(2)}–${b.upper.toFixed(2)}`,
        classification: "overconfident" as const,
        note: `Confidence inflated by ${(-g * 100).toFixed(0)}pp.`,
      };
    }
    if (g >= 0.15) {
      return {
        bucket: `${b.lower.toFixed(2)}–${b.upper.toFixed(2)}`,
        classification: "underconfident" as const,
        note: `Confidence understated by ${(g * 100).toFixed(0)}pp.`,
      };
    }
    return {
      bucket: `${b.lower.toFixed(2)}–${b.upper.toFixed(2)}`,
      classification: "fragile" as const,
      note: `Within margin but small sample (${b.predictions}).`,
    };
  });

  const overconfidenceCount = bucketClassifications.filter(
    (b) => b.classification === "overconfident",
  ).length;
  const overconfidenceRisk: "low" | "medium" | "high" =
    overconfidenceCount >= 2
      ? "high"
      : overconfidenceCount === 1
        ? "medium"
        : "low";

  // Uncertainty accuracy: agreement between explicit-uncertainty predictions
  // (confidence < 0.6) and ambiguous outcomes. We approximate via per-kind
  // calibration gap on the high-confidence buckets.
  const highConfBuckets = global.buckets.filter((b) => b.lower >= 0.75);
  const uncertaintyAccuracy = round(
    clamp01(
      1 -
        (highConfBuckets.reduce(
          (s, b) => s + (b.predictions ? Math.abs(b.gap) : 0),
          0,
        ) /
          Math.max(1, highConfBuckets.length)),
    ),
  );

  // Disagreement predictiveness: when contradiction predictions matched (TP+TN)
  // on negative-class outcomes, disagreement carried signal.
  const contradictionReport = byKind.find(
    (k) => k.predictionKind === "contradiction",
  );
  const disagreementPredictiveness = contradictionReport
    ? round(contradictionReport.f1)
    : 0;

  const narrative = buildCalibrationNarrative(
    global,
    bucketClassifications,
    overconfidenceRisk,
  );

  return {
    reliabilityScore,
    overconfidenceRisk,
    uncertaintyAccuracy,
    disagreementPredictiveness,
    bucketClassifications,
    calibrationNarrative: narrative,
  };
}

function buildCalibrationNarrative(
  global: CalibrationCurve,
  classifications: ConfidenceReliabilityReport["bucketClassifications"],
  risk: "low" | "medium" | "high",
): string {
  const parts: string[] = [];
  parts.push(
    `Global expected calibration error ${global.expectedCalibrationError.toFixed(2)} across ${global.predictionsEvaluated} predictions.`,
  );
  if (global.systematicBias > 0.05) {
    parts.push(
      `System runs ${(global.systematicBias * 100).toFixed(0)}pp over-confident on average.`,
    );
  } else if (global.systematicBias < -0.05) {
    parts.push(
      `System runs ${(-global.systematicBias * 100).toFixed(0)}pp under-confident on average.`,
    );
  } else {
    parts.push("Average claimed confidence tracks observed accuracy.");
  }
  const over = classifications.filter((c) => c.classification === "overconfident");
  if (over.length > 0) {
    parts.push(
      `Overconfident buckets: ${over.map((c) => c.bucket).join(", ")}.`,
    );
  }
  parts.push(`Overall overconfidence risk: ${risk}.`);
  return parts.join(" ");
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k) ?? [];
  arr.push(v);
  m.set(k, arr);
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
