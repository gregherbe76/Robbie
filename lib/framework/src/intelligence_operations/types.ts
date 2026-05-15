// =========================================================================
// Intelligence Operations Layer — types.
//
// This layer is NOT another scoring engine. It is the operational machinery
// that lets the framework *act on uncertainty* instead of hiding it:
// investigations, adversarial reviews, evidence requests, hypotheses,
// decision-review workflows, escalations, human oversight, multi-reviewer
// consensus, persistent intelligence cases, and a full operations audit.
//
// Everything here is deterministic, provenance-carrying, and reviewable.
// No silent mutations. No flattened disagreement. No hidden state.
// =========================================================================

// -------------------------------------------------------------------------
// 1. InvestigationEngine
// -------------------------------------------------------------------------

export type InvestigationTriggerKind =
  | "high-disagreement"
  | "low-confidence"
  | "unresolved-ambiguity"
  | "contradiction-severity"
  | "weak-evidence-density"
  | "high-upside-high-risk";

export interface InvestigationTrigger {
  kind: InvestigationTriggerKind;
  detail: string;
  metric: number;
  threshold: number;
}

export type InvestigationState =
  | "open"
  | "evidence_requested"
  | "under_review"
  | "escalated"
  | "resolved"
  | "unresolved"
  | "archived";

export interface Investigation {
  id: string;
  caseId: string;
  candidateId: string;
  organizationId: string;
  title: string;
  rationale: string;
  state: InvestigationState;
  createdAt: string;
  triggers: InvestigationTrigger[];
  originatingAgents: string[];
  evidenceGaps: string[];
  unresolvedQuestions: string[];
  confidenceState: {
    initial: number;
    current: number;
    delta: number;
  };
  recommendedNextActions: string[];
}

// -------------------------------------------------------------------------
// 2. AdversarialReviewEngine
// -------------------------------------------------------------------------

export type AdversarialSide = "supporting" | "refuting";

export interface AdversarialArgument {
  id: string;
  side: AdversarialSide;
  claim: string;
  sourceAgent: string;
  evidence: string[];
  weight: number; // 0..1
}

export interface ChallengeRebuttalChain {
  id: string;
  challenge: AdversarialArgument;
  rebuttal: AdversarialArgument | null;
  unresolved: boolean;
  /** Signed delta we would apply to confidence if this chain were accepted
   *  as a refutation. Always inspectable, never silently applied. */
  confidenceImpact: number;
}

export interface AdversarialReview {
  id: string;
  caseId: string;
  topic: string;
  arguments: AdversarialArgument[];
  chains: ChallengeRebuttalChain[];
  unresolvedTensions: string[];
  /** Net signed delta if every unresolved refutation were honoured. */
  netConfidenceImpact: number;
}

// -------------------------------------------------------------------------
// 3. EvidenceRequestEngine
// -------------------------------------------------------------------------

export type ValidationMethod =
  | "interview-question"
  | "reference-check"
  | "practical-validation"
  | "code-sample"
  | "context-deep-dive";

export type EvidenceRequestPriority = "low" | "medium" | "high" | "critical";

export type EvidenceRequestState =
  | "open"
  | "in_progress"
  | "satisfied"
  | "abandoned";

export interface EvidenceRequest {
  id: string;
  caseId: string;
  candidateId: string;
  organizationId: string;
  requestedEvidence: string;
  rationale: string;
  /** Signed delta to confidence if the evidence is *missing*. */
  confidenceImpact: number;
  priority: EvidenceRequestPriority;
  recommendedValidationMethod: ValidationMethod;
  recommendedQuestions: string[];
  state: EvidenceRequestState;
  originatingAgents: string[];
}

// -------------------------------------------------------------------------
// 4. HypothesisTrackingSystem
// -------------------------------------------------------------------------

export type HypothesisStatus =
  | "open"
  | "supported"
  | "refuted"
  | "competing"
  | "unresolved"
  | "abandoned";

export type HypothesisUpdateKind =
  | "supporting-evidence"
  | "refuting-evidence"
  | "confidence-shift"
  | "status-change";

export interface HypothesisUpdate {
  id: string;
  at: string;
  kind: HypothesisUpdateKind;
  detail: string;
  confidenceAfter: number;
  sourceAgent: string;
}

export interface Hypothesis {
  id: string;
  caseId: string;
  candidateId: string;
  organizationId: string;
  statement: string;
  status: HypothesisStatus;
  uncertaintyLevel: number; // 0..1
  confidence: number; // 0..1 — current
  supportingEvidence: string[];
  refutingEvidence: string[];
  competingWith: string[]; // ids of other hypotheses
  history: HypothesisUpdate[];
}

// -------------------------------------------------------------------------
// 5. DecisionReviewWorkflow
// -------------------------------------------------------------------------

export type DecisionState =
  | "initial_assessment"
  | "investigation_required"
  | "adversarial_review"
  | "human_review"
  | "evidence_pending"
  | "calibration_warning"
  | "decision_ready"
  | "unresolved";

export interface DecisionWorkflowTransition {
  id: string;
  at: string;
  from: DecisionState;
  to: DecisionState;
  reviewer: string;
  rationale: string;
  confidenceBefore: number;
  confidenceAfter: number;
}

export interface DecisionReviewWorkflowState {
  caseId: string;
  state: DecisionState;
  stateRationale: string;
  blockingFactors: string[];
  uncertaintyPreserved: boolean;
  transitions: DecisionWorkflowTransition[];
  prematureCertaintyGuard: {
    triggered: boolean;
    reason: string;
  };
}

// -------------------------------------------------------------------------
// 6. EscalationEngine
// -------------------------------------------------------------------------

export type EscalationSeverity = "low" | "medium" | "high" | "critical";

export type EscalationReviewType =
  | "senior-reviewer"
  | "founder-review"
  | "technical-deep-dive"
  | "reference-validation"
  | "adversarial-panel"
  | "extended-investigation";

export interface Escalation {
  id: string;
  caseId: string;
  candidateId: string;
  organizationId: string;
  escalationReason: string;
  severity: EscalationSeverity;
  recommendedReviewType: EscalationReviewType;
  unresolvedRisks: string[];
  blockingQuestions: string[];
  triggeringSignals: string[];
  createdAt: string;
}

// -------------------------------------------------------------------------
// 7. HumanOversightLayer
// -------------------------------------------------------------------------

export type HumanAnnotationKind =
  | "review-note"
  | "disagreement"
  | "rationale-override"
  | "uncertainty-acknowledgement"
  | "evidence-weighting-adjustment"
  | "explicit-override";

export interface HumanAnnotation {
  id: string;
  caseId: string;
  reviewer: string;
  kind: HumanAnnotationKind;
  rationale: string;
  at: string;
  confidenceImpact: number;
  targetAgent?: string;
  targetField?: string;
  /** Inspectable before/after for weighting adjustments. Never silent. */
  beforeValue?: number;
  afterValue?: number;
  evidence: string[];
}

// -------------------------------------------------------------------------
// 8. Multi-ReviewerConsensusEngine
// -------------------------------------------------------------------------

export type ReviewerKind = "agent" | "human" | "panel";

export type ReviewerRecommendation =
  | "advance"
  | "investigate"
  | "decline"
  | "abstain";

export interface Reviewer {
  id: string;
  kind: ReviewerKind;
  name: string;
  confidence: number;
  recommendation: ReviewerRecommendation;
  rationale: string;
}

export interface ReasoningCluster {
  id: string;
  label: string;
  reviewers: string[];
  sharedClaim: string;
  weight: number;
}

export interface ConsensusReport {
  caseId: string;
  reviewers: Reviewer[];
  consensusAreas: string[];
  disagreementAreas: string[];
  unresolvedQuestions: string[];
  reviewerConfidenceDistribution: Array<{
    reviewerId: string;
    confidence: number;
    recommendation: ReviewerRecommendation;
  }>;
  reasoningClusters: ReasoningCluster[];
  finalDecisionState: DecisionState;
}

// -------------------------------------------------------------------------
// 10. OperationsAuditEngine
// -------------------------------------------------------------------------

export type AuditEventKind =
  | "case-opened"
  | "investigation-opened"
  | "investigation-state-changed"
  | "evidence-requested"
  | "hypothesis-added"
  | "hypothesis-updated"
  | "adversarial-review-added"
  | "escalation-raised"
  | "human-annotation"
  | "decision-state-changed"
  | "calibration-warning"
  | "longitudinal-update";

export interface AuditEvent {
  id: string;
  caseId: string;
  at: string;
  actor: string;
  kind: AuditEventKind;
  summary: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
  relatedRefIds: string[];
}

// -------------------------------------------------------------------------
// 9. IntelligenceCase — aggregate
// -------------------------------------------------------------------------

export interface IntelligenceCase {
  id: string; // `${organizationId}::${candidateId}`
  candidateId: string;
  candidateName: string;
  organizationId: string;
  targetRole: string;
  createdAt: string;
  decisionState: DecisionState;
  decisionStateRationale: string;
  workflow: DecisionReviewWorkflowState;
  investigations: Investigation[];
  evidenceRequests: EvidenceRequest[];
  hypotheses: Hypothesis[];
  adversarialReviews: AdversarialReview[];
  escalations: Escalation[];
  humanAnnotations: HumanAnnotation[];
  consensus: ConsensusReport;
  calibrationWarnings: string[];
  longitudinalUpdates: string[];
  // Aggregated dashboard signals
  unresolvedQuestionCount: number;
  openEvidenceRequestCount: number;
  openInvestigationCount: number;
  competingHypothesisCount: number;
  escalationSeverityMax: EscalationSeverity | null;
  effectiveConfidence: number;
}

// -------------------------------------------------------------------------
// OperationsReport — what the API serves
// -------------------------------------------------------------------------

export interface OperationsMetrics {
  totalCases: number;
  casesByDecisionState: Record<DecisionState, number>;
  openInvestigations: number;
  pendingEvidenceRequests: number;
  activeEscalations: number;
  unresolvedHypotheses: number;
  competingHypothesisPairs: number;
  averageEffectiveConfidence: number;
  humanInterventions: number;
  prematureCertaintyGuardsTriggered: number;
}

export interface OperationsReport {
  generatedAt: string;
  generatedBy: string;
  cases: IntelligenceCase[];
  audit: AuditEvent[];
  metrics: OperationsMetrics;
}

// -------------------------------------------------------------------------
// Determinism shared
// -------------------------------------------------------------------------

export interface OpsClock {
  now(): Date;
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function round(x: number, digits = 3): number {
  const f = Math.pow(10, digits);
  return Math.round(x * f) / f;
}

export const SEVERITY_RANK: Record<EscalationSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
