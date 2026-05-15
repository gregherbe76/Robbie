/**
 * Benchmark / cognitive smoke test types.
 *
 * The benchmarks layer is **not** a unit-testing layer. It is system-level
 * regression protection for the framework's cognition: same input + same
 * organization + same fixed clock must produce the same structured output,
 * with the same reasoning behaviour.
 */

import type {
  AgentReasoning,
  BayesianFitResult,
  CandidateDossier,
  ContradictionResult,
  TrajectoryResult,
} from "../agents/flagship/index.js";
import type { CognitiveSynthesis } from "../cognition/index.js";
import type {
  CandidateOrganizationFitResult,
  OrganizationContext,
  OrganizationIntelligenceReport,
} from "../organization_intelligence/index.js";

/** Behavioural archetype the scenario was designed to probe. */
export type BenchmarkArchetype =
  | "inflated_senior"
  | "founder_builder"
  | "plateaued_staff"
  | "elite_ic"
  | "high_variance_candidate"
  | "ambiguous_generalist"
  | "fake_oss_signal"
  | "chaos_thriver"
  | "process_dependent_operator"
  | "underestimated_junior";

/** Declarative expectation operators. */
export type ExpectationType =
  | "equals"
  | "not_equals"
  | "range"
  | "greater_than"
  | "less_than"
  | "includes"
  | "excludes"
  | "non_empty"
  | "empty"
  | "stable_hash"
  | "provenance_complete"
  | "confidence_decreased"
  | "uncertainty_increased"
  | "recommendation_in";

export interface Expectation {
  type: ExpectationType;
  /** Dotted path into a `ScenarioOutputs` object. */
  path?: string;
  value?: unknown;
  min?: number;
  max?: number;
  /** For includes/excludes/recommendation_in. */
  values?: unknown[];
  /** Human-readable explanation of what the expectation protects. */
  rationale?: string;
}

export interface BenchmarkScenario {
  scenarioId: BenchmarkArchetype;
  description: string;
  archetype: BenchmarkArchetype;
  dossier: CandidateDossier;
  organization: OrganizationContext;
  expectations: Expectation[];
}

/** Stable structural digest of a single scenario run. */
export interface ScenarioDigest {
  scenarioId: BenchmarkArchetype;
  candidateId: string;
  organizationId: string;
  bayesianFit: number;
  bayesianConfidence: number;
  contradictionScore: number;
  contradictionCount: number;
  unsupportedClaimCount: number;
  trajectoryScore: number;
  trajectoryConfidence: number;
  globalConfidence: number;
  disagreementScore: number;
  ambiguityLevel: number;
  certaintyCategory: string;
  recommendationCategory: string;
  unresolvedQuestionCount: number;
  influenceCount: number;
  evidenceChainCount: number;
  reasoningStepCount: number;
  archetypeMatchCount: number;
  fitRecommendation: string;
  fitConfidence: number;
  overallHiringRisk: number;
  chaosFitScore: number;
  evidenceRequestSignal: number;
}

export interface ScenarioOutputs {
  scenarioId: BenchmarkArchetype;
  candidateId: string;
  organizationId: string;
  generatedAt: string;
  bayesian: AgentReasoning<BayesianFitResult>;
  contradiction: AgentReasoning<ContradictionResult>;
  trajectory: AgentReasoning<TrajectoryResult>;
  cognition: CognitiveSynthesis;
  fit: CandidateOrganizationFitResult;
  orgReport: OrganizationIntelligenceReport;
  digest: ScenarioDigest;
  /** Stable hash of the digest — used as the determinism fingerprint. */
  determinismHash: string;
  /** Pre-cognition Bayesian confidence (captured for confidence_decreased checks). */
  preCognitionBayesianConfidence: number;
}

export interface ExpectationResult {
  expectation: Expectation;
  passed: boolean;
  actual?: unknown;
  detail: string;
}

export interface ProvenanceFinding {
  ok: boolean;
  path: string;
  detail: string;
}

export interface DeterminismCheck {
  scenarioId: BenchmarkArchetype;
  passed: boolean;
  firstHash: string;
  secondHash: string;
  drift: string[];
}

export interface CognitionIntegrityCheck {
  scenarioId: BenchmarkArchetype;
  passed: boolean;
  findings: { ok: boolean; rule: string; detail: string }[];
}

export interface CalibrationSmokeCheck {
  passed: boolean;
  ece: number;
  overconfidenceRisk: "low" | "medium" | "high";
  predictionsEvaluated: number;
  detail: string;
  reasons: string[];
}

export interface SnapshotEntry {
  scenarioId: BenchmarkArchetype;
  determinismHash: string;
  digest: ScenarioDigest;
}

export interface SnapshotFile {
  version: 1;
  generatedAt: string;
  entries: SnapshotEntry[];
}

export interface SnapshotDriftResult {
  ok: boolean;
  drift: Array<{
    scenarioId: BenchmarkArchetype;
    kind: "missing" | "extra" | "hash-changed" | "field-changed";
    detail: string;
  }>;
}

export interface MutationGuardCheck {
  guardId: string;
  description: string;
  /** Whether the guard caught the regression (i.e. expectations now FAIL). */
  passed: boolean;
  scenarioId: BenchmarkArchetype;
  detail: string;
}

export interface ScenarioResult {
  scenarioId: BenchmarkArchetype;
  archetype: BenchmarkArchetype;
  passed: boolean;
  failures: ExpectationResult[];
  warnings: string[];
  outputs: ScenarioOutputs;
  determinism: DeterminismCheck;
  cognitionIntegrity: CognitionIntegrityCheck;
  provenance: { ok: boolean; findings: ProvenanceFinding[] };
}

export interface BenchmarkSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  determinismOk: boolean;
  provenanceOk: boolean;
  calibrationOk: boolean;
  snapshotOk: boolean;
  mutationGuardsOk: boolean;
}

export interface BenchmarkReport {
  generatedAt: string;
  generatedBy: string;
  summary: BenchmarkSummary;
  scenarios: ScenarioResult[];
  calibration: CalibrationSmokeCheck;
  snapshot: SnapshotDriftResult;
  mutationGuards: MutationGuardCheck[];
  recommendations: string[];
}
