/**
 * Public replay trace types.
 *
 * The replay module composes existing framework engines (flagship agents,
 * cognition, organization-intelligence) into a single deterministic
 * trace suitable for cinematic replay in the public demo. It does NOT
 * introduce new cognition logic — every field is a projection of an
 * existing engine output, plus timestamps and ordering.
 */

import type {
  CognitiveSynthesis,
  Disagreement,
  PropagatedInfluence,
} from "../cognition/index.js";
import type {
  CandidateOrganizationFitResult,
  OrganizationIntelligenceReport,
} from "../organization_intelligence/index.js";

export type ReplayCaseId =
  | "founder-builder"
  | "inflated-senior"
  | "ambiguous-generalist"
  | "chaos-thriver"
  | "org-mismatch";

export type ReplayLayer =
  | "ingestion"
  | "agents"
  | "cognition"
  | "propagation"
  | "disagreement"
  | "org-fit"
  | "escalation"
  | "calibration"
  | "recommendation";

export interface ReplayCaseSummary {
  /**
   * Canonical ReplayCaseId for hero cases, or an arbitrary string for
   * lab runs synthesised from user-provided input.
   */
  caseId: ReplayCaseId | string;
  label: string;
  oneLiner: string;
  candidateName: string;
  targetRole: string;
  organizationName: string;
  expectedRecommendation: string;
}

export interface ReplayStep {
  id: string;
  ord: number;
  /** Deterministic ISO timestamp, monotonically increasing across the trace. */
  t: string;
  layer: ReplayLayer;
  /** Optional producer attribution. */
  agentId?: string;
  skillId?: string;
  title: string;
  summary: string;
  rationale: string;
  /** Upstream provenance: evidence / signal / step ids consumed. */
  inputs: string[];
  /** Downstream artefact ids produced by this step. */
  outputs: string[];
  /** Confidence reported at this step, when applicable. */
  confidence?: number;
}

export interface ReplayDisagreement extends Disagreement {
  /** Convenience copy of cognition's disagreement record, plus a kind tag. */
  kind: "agent" | "reviewer";
}

export interface ReplayPropagation extends PropagatedInfluence {
  /** True if this propagation is the one that flipped the recommendation. */
  pivotal: boolean;
}

export interface ProvenanceNode {
  id: string;
  kind:
    | "evidence"
    | "claim"
    | "role"
    | "agent-signal"
    | "cognition-influence"
    | "org-fit-signal"
    | "calibration-bucket"
    | "recommendation";
  label: string;
  detail: string;
  producedBy: string;
  producedAt: string;
  confidence?: number;
}

export interface ProvenanceEdge {
  from: string;
  to: string;
  relation: "supports" | "refutes" | "derives" | "influences" | "produces";
}

export interface ProvenanceGraph {
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
}

export interface OrgFitView {
  fitRecommendation: CandidateOrganizationFitResult["fitRecommendation"];
  fitConfidence: number;
  chaosFitScore: number;
  founderFitHeadline: string;
  roleEnvironmentMismatchCount: number;
  tensions: Array<{
    field: string;
    candidateSignal: string;
    orgSignal: string;
    severity: "low" | "medium" | "high";
  }>;
  successConditions: string[];
  failureModes: string[];
  interviewFocusAreas: string[];
}

export interface EscalationEvent {
  id: string;
  ord: number;
  trigger:
    | "uncertainty"
    | "contradiction"
    | "missing-evidence"
    | "adversarial-review"
    | "reviewer-override";
  summary: string;
  detail: string;
  requestedEvidence: string[];
  reviewerDisagreement?: {
    reviewerA: string;
    reviewerB: string;
    summary: string;
  };
}

export interface CalibrationBucket {
  /** e.g. "0.60–0.75" */
  range: string;
  lower: number;
  upper: number;
  /** Mean self-reported confidence of predictions in this bucket. */
  claimed: number;
  /** Empirical positive rate of outcomes in this bucket. */
  actual: number;
  /** Number of historical predictions that fall in this bucket. */
  count: number;
  /** True if this bucket is the calibration-failure case (overconfident). */
  overconfident: boolean;
  /** Human-readable critique of this bucket. */
  critique: string;
}

export interface CalibrationView {
  expectedCalibrationError: number;
  overconfidenceWarning: boolean;
  buckets: CalibrationBucket[];
  /** A single, plain-spoken self-critique of the system. */
  selfCritique: string;
}

export interface RecommendationView {
  category: "advance" | "investigate" | "decline" | "ambiguous";
  fitRecommendation: CandidateOrganizationFitResult["fitRecommendation"];
  uncertaintyCategory: string;
  globalConfidence: number;
  headline: string;
  strongestEvidence: Array<{ id: string; summary: string; weight: number }>;
  strongestRisks: Array<{ id: string; summary: string; severity: string }>;
  unresolvedQuestions: string[];
  reviewerDisagreementSummary: string;
  decisionSupportDisclaimer: string;
}

export interface ReplayTrace {
  /**
   * Canonical ReplayCaseId for hero cases, or an arbitrary string for
   * lab runs (where the case is synthesised from user input).
   */
  caseId: ReplayCaseId | string;
  summary: ReplayCaseSummary;
  /** Fixed clock used for the whole trace. */
  generatedAt: string;
  /** Hash of the trace body for client cache + determinism inspection. */
  signature: string;

  candidate: {
    id: string;
    name: string;
    targetRole: string;
    claimCount: number;
    evidenceCount: number;
    roleCount: number;
  };
  organization: {
    id: string;
    name: string;
    description: string;
  };

  steps: ReplayStep[];

  /** Mirror of CognitiveSynthesis — kept whole for the timeline tooling. */
  cognition: CognitiveSynthesis;

  disagreements: ReplayDisagreement[];
  propagations: ReplayPropagation[];
  provenance: ProvenanceGraph;
  orgFit: OrgFitView;
  organizationReport: OrganizationIntelligenceReport;
  escalations: EscalationEvent[];
  calibration: CalibrationView;
  recommendation: RecommendationView;
}
