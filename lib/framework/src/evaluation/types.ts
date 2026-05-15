// =========================================================================
// Evaluation, Calibration, and Longitudinal Learning Layer — types.
//
// Every public envelope carries provenance. Every probabilistic quantity
// carries a confidence. Outcomes are append-only. Learning is inspectable.
// =========================================================================

export type OutcomeType =
  | "hired"
  | "rejected"
  | "withdrew"
  | "failed_process"
  | "successful_hire"
  | "poor_performance"
  | "promotion"
  | "retention"
  | "rapid_exit"
  | "founder_success"
  | "org_mismatch"
  | "team_failure"
  | "exceptional_growth";

/** Polarity: did the outcome confirm a positive thesis (hire/promote/retain)
 *  or a negative one (mismatch/exit/poor)? `process` means the candidate
 *  never reached the realised-outcome stage. */
export type OutcomePolarity = "positive" | "negative" | "process";

export const OUTCOME_POLARITY: Record<OutcomeType, OutcomePolarity> = {
  hired: "process",
  rejected: "process",
  withdrew: "process",
  failed_process: "process",
  successful_hire: "positive",
  poor_performance: "negative",
  promotion: "positive",
  retention: "positive",
  rapid_exit: "negative",
  founder_success: "positive",
  org_mismatch: "negative",
  team_failure: "negative",
  exceptional_growth: "positive",
};

export interface OutcomeProvenance {
  observedBy: string;
  observedAt: string; // ISO
  rationale: string;
  evidence: string[];
}

export interface OutcomeEvent {
  id: string;
  timestamp: string; // ISO; deterministic ordering key
  organizationId: string;
  candidateId: string;
  outcomeType: OutcomeType;
  evidence: string[];
  confidence: number; // observer's confidence in the report
  provenance: OutcomeProvenance;
}

// -------------------------------------------------------------------------
// Prediction records — captured at scoring time and replayed against
// outcomes. Each prediction class is evaluated independently.
// -------------------------------------------------------------------------

export type PredictionKind =
  | "candidate-fit"
  | "hiring-risk"
  | "trajectory"
  | "contradiction"
  | "chaos-fit"
  | "org-fit"
  | "retention";

export interface PredictionRecord {
  id: string;
  predictionKind: PredictionKind;
  organizationId: string;
  candidateId: string;
  /** model score in [0,1]. For risk-type predictions this is the *risk* score
   *  (higher = more negative outcome expected); for fit/upside predictions it
   *  is the *positive* score. */
  score: number;
  /** model confidence in the prediction itself (calibration target). */
  confidence: number;
  /** model-derived archetype label for ArchetypePerformanceTracker. */
  archetype?: string;
  /** which agent produced the prediction. */
  producedBy: string;
  predictedAt: string; // ISO
  rationale: string;
}

/** Whether the prediction class expects the score to track a positive or
 *  negative outcome. fit/trajectory/chaos/org-fit/retention → positive;
 *  hiring-risk/contradiction → negative. */
export const PREDICTION_POLARITY: Record<PredictionKind, "positive" | "negative"> =
  {
    "candidate-fit": "positive",
    "hiring-risk": "negative",
    trajectory: "positive",
    contradiction: "negative",
    "chaos-fit": "positive",
    "org-fit": "positive",
    retention: "positive",
  };

// -------------------------------------------------------------------------
// Evaluation envelopes
// -------------------------------------------------------------------------

export interface PredictionEvaluation {
  predictionKind: PredictionKind;
  evaluated: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  /** mean absolute error between prediction score (mapped to expected polarity)
   *  and realised outcome label (0/1). */
  brierScore: number;
  /** average claimed confidence on evaluated cases. */
  averageConfidence: number;
  /** observed accuracy across evaluated cases. */
  observedAccuracy: number;
  /** averageConfidence − observedAccuracy (positive ⇒ over-confidence). */
  calibrationGap: number;
}

export interface PredictionEvaluationReport {
  kindReports: PredictionEvaluation[];
  predictionQuality: number; // weighted F1 across kinds
  calibrationQuality: number; // 1 − mean |calibrationGap|
  strongestSignals: string[];
  weakestSignals: string[];
  recurringFailureModes: string[];
  confidenceReliability: number; // 1 − mean |calibrationGap| weighted by support
}

export interface CalibrationBucket {
  lower: number;
  upper: number;
  midpoint: number;
  predictions: number;
  observedPositiveRate: number;
  expectedPositiveRate: number; // bucket midpoint
  gap: number; // observed − expected (negative ⇒ over-confident)
}

export interface CalibrationCurve {
  scope: "global" | "per-agent" | "per-organization" | "per-archetype";
  scopeKey: string; // e.g. "all", agent id, org id, archetype id
  buckets: CalibrationBucket[];
  expectedCalibrationError: number;
  predictionsEvaluated: number;
  /** > 0 ⇒ confidence is inflated overall (claims higher than reality). */
  systematicBias: number;
}

export interface ConfidenceReliabilityReport {
  reliabilityScore: number; // 1 − mean over-confidence
  overconfidenceRisk: "low" | "medium" | "high";
  uncertaintyAccuracy: number;
  disagreementPredictiveness: number;
  /** classification per claimed-confidence bucket. */
  bucketClassifications: Array<{
    bucket: string;
    classification:
      | "justified"
      | "fragile"
      | "overconfident"
      | "underconfident"
      | "unstable";
    note: string;
  }>;
  calibrationNarrative: string;
}

export interface ArchetypePerformance {
  archetype: string;
  sampleSize: number;
  successRate: number;
  failureRate: number;
  retentionRate: number;
  promotionRate: number;
  averagePredictedConfidence: number;
  realisedAccuracy: number;
  failurePatterns: string[];
  environmentSensitivity: number; // variance of success across orgs
  confidence: number;
}

export interface DriftSignal {
  driftType:
    | "calibration"
    | "hiring-bar"
    | "organization-context"
    | "founder-style"
    | "confidence-inflation"
    | "archetype";
  severity: "low" | "medium" | "high";
  detail: string;
  impactedAgents: string[];
  confidence: number;
  recommendedRecalibration: string;
}

export interface DriftReport {
  detectedDrifts: DriftSignal[];
  /** higher = more drift detected overall, normalised to [0,1]. */
  driftScore: number;
}

export interface TrajectoryObservation {
  candidateId: string;
  organizationId: string;
  predictedTrajectory: number;
  realisedVelocity: number;
  ownershipGrowth: number;
  roleEvolution: string;
  organizationalImpact: number;
  matchesPrediction: boolean;
  evidence: string[];
}

export interface OrganizationalLearningSignal {
  organizationId: string;
  /** which candidate profile attributes correlate with success / failure in
   *  THIS org. Values are weighted, inspectable, deterministic. */
  successCorrelates: Array<{
    attribute: string;
    weight: number;
    sampleSize: number;
    rationale: string;
  }>;
  failureCorrelates: Array<{
    attribute: string;
    weight: number;
    sampleSize: number;
    rationale: string;
  }>;
  hiringBarShift: number; // negative = bar dropped
  founderStyleStability: number; // 1 = stable
  recommendedWeightAdjustments: Array<{
    agent: string;
    adjustment: number; // additive delta applied at scoring time (capped ±0.15)
    rationale: string;
  }>;
  confidence: number;
}

// -------------------------------------------------------------------------
// Benchmarks — deterministic replayable scenarios
// -------------------------------------------------------------------------

export interface BenchmarkAssertion {
  /** dotted path into the EvaluationReport (e.g. "calibration.global.expectedCalibrationError"). */
  path: string;
  comparator: "lte" | "gte" | "eq" | "approx";
  expected: number;
  tolerance?: number;
}

export interface BenchmarkScenario {
  id: string;
  description: string;
  /** which prediction kinds are exercised. */
  kinds: PredictionKind[];
  assertions: BenchmarkAssertion[];
}

export interface BenchmarkResult {
  scenarioId: string;
  passed: boolean;
  assertionResults: Array<{
    path: string;
    comparator: BenchmarkAssertion["comparator"];
    expected: number;
    actual: number;
    passed: boolean;
  }>;
}

// -------------------------------------------------------------------------
// Final evaluation report
// -------------------------------------------------------------------------

export interface EvaluationReport {
  generatedAt: string;
  generatedBy: string;
  predictionsEvaluated: number;
  outcomesObserved: number;
  systemCalibration: CalibrationCurve; // global
  perAgentCalibration: CalibrationCurve[];
  perOrgCalibration: CalibrationCurve[];
  perArchetypeCalibration: CalibrationCurve[];
  reliability: ConfidenceReliabilityReport;
  predictionEvaluation: PredictionEvaluationReport;
  archetypePerformance: ArchetypePerformance[];
  organizationalLearning: OrganizationalLearningSignal[];
  drift: DriftReport;
  trajectory: TrajectoryObservation[];
  benchmarks: BenchmarkResult[];
  longitudinalInsights: string[];
  recommendations: string[];
}

// -------------------------------------------------------------------------
// Determinism dep
// -------------------------------------------------------------------------

export interface Clock {
  now(): Date;
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
