/**
 * Collaboration layer — type system.
 *
 * This layer turns single-agent cognition into collaborative epistemic
 * operations: multiple reviewers, structured disagreement, explicit overrides,
 * decision lineage, and organizational memory of how the team reasons.
 *
 * Hard rules encoded in the types:
 *   - every reviewer action carries provenance, rationale, confidence
 *   - disagreements are preserved as positions, never collapsed into a vote
 *   - overrides require acknowledged risks
 *   - calibration is contextual (per-domain), not a single score
 *   - audit history is append-only
 */

// =============================================================================
// Reviewer identity
// =============================================================================

export type ReviewerType =
  | "recruiter"
  | "founder"
  | "hiring_manager"
  | "technical_reviewer"
  | "executive"
  | "external_advisor";

/** Per-domain calibration. Reviewers are not reduced to a single score. */
export interface CalibrationProfile {
  /** Free-form domain label, e.g. "systems-depth", "trajectory", "culture-fit". */
  domain: string;
  /** Brier-style score in [0,1]; lower is better. Null when not enough data. */
  brier: number | null;
  /** Observed overconfidence — average of (stated - realized) confidence. */
  overconfidence: number | null;
  /** Number of past decisions contributing to this calibration record. */
  sampleSize: number;
}

/** Behavioural patterns observed in reviewer confidence over time. */
export interface ConfidencePatterns {
  /** Mean stated confidence across all actions. */
  meanConfidence: number;
  /** Stddev of stated confidence; <0.05 = "always certain" pattern. */
  confidenceVariance: number;
  /** Fraction of actions that explicitly attached an uncertainty marker. */
  uncertaintyExpressionRate: number;
  /** Fraction of actions that requested more evidence rather than concluded. */
  evidenceSeekingRate: number;
}

export interface HistoricalDecisionStats {
  totalCases: number;
  agreementsWithConsensus: number;
  disagreementsWithConsensus: number;
  overridesIssued: number;
  overrideSuccessRate: number | null;
}

export interface ReviewerIdentity {
  reviewerId: string;
  reviewerType: ReviewerType;
  displayName: string;
  expertiseAreas: readonly string[];
  calibrationProfile: readonly CalibrationProfile[];
  confidencePatterns: ConfidencePatterns;
  historicalDecisionStats: HistoricalDecisionStats;
  registeredAt: string;
}

// =============================================================================
// Collaborative cases
// =============================================================================

export type CaseState =
  | "under_investigation"
  | "awaiting_review"
  | "disagreement_active"
  | "escalation_required"
  | "consensus_reached"
  | "unresolved"
  | "archived";

export interface CaseSubject {
  /** What kind of thing this case is about — candidate, role, org-pattern, etc. */
  subjectKind: "candidate" | "role" | "organization" | "pattern";
  subjectId: string;
  subjectDisplayName: string;
}

export interface CollaborativeCase {
  caseId: string;
  title: string;
  subject: CaseSubject;
  state: CaseState;
  openedAt: string;
  lastUpdatedAt: string;
  invitedReviewers: readonly string[];
  /** Free-form prompt/question that opens the case. */
  framing: string;
  /** Initial cognition output anchoring the case, if any. */
  anchoringRecommendation?: {
    recommendationId: string;
    summary: string;
    confidence: number;
  };
  /** Open epistemic tensions surfaced during the investigation. */
  unresolvedTensions: readonly UnresolvedTension[];
  escalations: readonly Escalation[];
}

export interface UnresolvedTension {
  tensionId: string;
  description: string;
  reviewerIds: readonly string[];
  /** Severity in [0,1]; preserved, never collapsed. */
  severity: number;
  noteAt: string;
}

export interface Escalation {
  escalationId: string;
  fromReviewerId: string;
  toReviewerId: string;
  reason: string;
  raisedAt: string;
  resolvedAt: string | null;
}

// =============================================================================
// Reviewer reasoning
// =============================================================================

export type ReviewerActionKind =
  | "annotate_evidence"
  | "support_hypothesis"
  | "challenge_hypothesis"
  | "attach_uncertainty"
  | "request_evidence"
  | "mark_unresolved"
  | "disagree_with_agent"
  | "disagree_with_reviewer";

export interface ReviewerAction {
  actionId: string;
  caseId: string;
  reviewerId: string;
  kind: ReviewerActionKind;
  /** Target entity — evidence id, hypothesis id, agent id, reviewer id. */
  target: { kind: string; id: string };
  rationale: string;
  /** Stated confidence in [0,1]. Reviewers are forced to attach this. */
  confidence: number;
  /** Evidence ids the reviewer derived this action from. */
  derivedFrom: readonly string[];
  /** Optional ambiguity markers the reviewer wants preserved. */
  ambiguityMarkers: readonly string[];
  timestamp: string;
}

// =============================================================================
// Structured disagreement
// =============================================================================

export type DisagreementSeverity = "minor" | "moderate" | "major" | "blocking";

export interface DisagreementPosition {
  positionId: string;
  holderKind: "reviewer" | "agent";
  holderId: string;
  stance: string;
  /**
   * Non-empty rationale explaining *why* this holder takes this stance. Required
   * by the provenance-first invariant: no position may exist without rationale.
   */
  rationale: string;
  confidence: number;
  derivedFrom: readonly string[];
  recordedAt: string;
}

export interface Disagreement {
  disagreementId: string;
  caseId: string;
  topic: string;
  positions: readonly DisagreementPosition[];
  severity: DisagreementSeverity;
  /** Numeric severity in [0,1], preserved alongside the categorical label. */
  severityScore: number;
  /** When/whether this disagreement was resolved; null if still active. */
  resolvedAt: string | null;
  resolutionSummary: string | null;
}

export interface DisagreementCluster {
  clusterId: string;
  label: string;
  disagreementIds: readonly string[];
  /** Recurring frame this cluster represents, if any. */
  recurringPatternId: string | null;
}

// =============================================================================
// Collaborative evidence review
// =============================================================================

export type EvidenceReviewKind =
  | "annotation"
  | "challenge_quality"
  | "reliability_adjust"
  | "request_validation"
  | "counter_evidence"
  | "ambiguity_flag"
  | "provenance_flag";

export interface EvidenceReviewEntry {
  reviewId: string;
  caseId: string;
  evidenceId: string;
  reviewerId: string;
  kind: EvidenceReviewKind;
  rationale: string;
  /** For reliability_adjust: signed delta in [-1,1]. Null otherwise. */
  reliabilityDelta: number | null;
  /** For counter_evidence: id(s) of evidence offered in opposition. */
  counterEvidenceIds: readonly string[];
  ambiguityMarkers: readonly string[];
  timestamp: string;
}

// =============================================================================
// Overrides
// =============================================================================

export type OverrideOutcomeStatus =
  | "pending"
  | "validated_correct"
  | "validated_incorrect"
  | "inconclusive";

export interface OverrideRecord {
  overrideId: string;
  caseId: string;
  reviewerId: string;
  affectedRecommendationId: string;
  reason: string;
  /** How much the override moves the recommendation confidence. */
  confidenceImpact: number;
  /** Risks the reviewer explicitly acknowledges. Required and non-empty. */
  acknowledgedRisks: readonly string[];
  /** Direction of the override against the prior recommendation. */
  direction: "accept_against_recommendation" | "reject_against_recommendation" | "modify";
  issuedAt: string;
  outcome: OverrideOutcomeStatus;
  outcomeNote: string | null;
}

// =============================================================================
// Reviewer calibration output
// =============================================================================

export interface ReviewerCalibrationReport {
  reviewerId: string;
  reviewerCalibration: readonly CalibrationProfile[];
  /** Composite reliability in [0,1]; null if no signal yet. */
  reliability: number | null;
  /** Risk that the reviewer is systemically overconfident. */
  overconfidenceRisk: number | null;
  /** Predictive value of their disagreements (do they catch real issues?). */
  disagreementValue: number | null;
  /** Drift from prior calibration window; null if first window. */
  calibrationDrift: number | null;
  historicalPatterns: readonly {
    pattern: string;
    occurrences: number;
    note: string;
  }[];
  computedAt: string;
}

// =============================================================================
// Decision lineage
// =============================================================================

export type LineageEventKind =
  | "cognition_output"
  | "reviewer_action"
  | "evidence_review"
  | "disagreement_opened"
  | "disagreement_resolved"
  | "escalation"
  | "override"
  | "recommendation_change"
  | "consensus_reached";

export interface DecisionLineageNode {
  nodeId: string;
  caseId: string;
  kind: LineageEventKind;
  actorId: string;
  summary: string;
  /** Numeric confidence/uncertainty after this event, when applicable. */
  confidenceAfter: number | null;
  /** Numeric severity of active disagreement after this event. */
  disagreementSeverityAfter: number | null;
  derivedFrom: readonly string[];
  timestamp: string;
}

export interface DecisionLineageEdge {
  fromNodeId: string;
  toNodeId: string;
  relation: "caused" | "informed" | "contradicted" | "resolved";
}

export interface DecisionTimeline {
  caseId: string;
  nodes: readonly DecisionLineageNode[];
  edges: readonly DecisionLineageEdge[];
  /** Confidence trajectory over time; useful for the UI. */
  confidenceSeries: readonly { timestamp: string; value: number }[];
  /** Disagreement severity trajectory over time. */
  disagreementSeries: readonly { timestamp: string; value: number }[];
}

// =============================================================================
// Organizational consensus memory
// =============================================================================

export interface ConsensusPattern {
  patternId: string;
  label: string;
  /** Free-form description of how the org tends to reason here. */
  description: string;
  /** Cases that exemplify this pattern. */
  exampleCaseIds: readonly string[];
  /** Observed agreement rate when this pattern is active, in [0,1]. */
  agreementRate: number;
  /** Predictive value of consensus under this pattern, in [-1,1]. */
  predictiveValue: number;
  observedAt: string;
}

export interface OrganizationalReasoningMemory {
  recurringDisagreements: readonly DisagreementCluster[];
  organizationalBiases: readonly {
    biasId: string;
    label: string;
    description: string;
    confidence: number;
    derivedFrom: readonly string[];
  }[];
  reviewerClusters: readonly {
    clusterId: string;
    label: string;
    reviewerIds: readonly string[];
    rationale: string;
  }[];
  successPatterns: readonly ConsensusPattern[];
  failurePatterns: readonly ConsensusPattern[];
  escalationArchetypes: readonly {
    archetypeId: string;
    label: string;
    description: string;
    exampleEscalationIds: readonly string[];
  }[];
  overrideArchetypes: readonly {
    archetypeId: string;
    label: string;
    description: string;
    exampleOverrideIds: readonly string[];
  }[];
  computedAt: string;
}

// =============================================================================
// Collaboration audit
// =============================================================================

export type CollaborationAuditKind =
  | "case_opened"
  | "case_state_changed"
  | "reviewer_action"
  | "evidence_review"
  | "disagreement_opened"
  | "disagreement_resolved"
  | "escalation_raised"
  | "escalation_resolved"
  | "override_issued"
  | "override_outcome"
  | "consensus_reached"
  | "case_archived";

export interface CollaborationAuditEntry {
  entryId: string;
  caseId: string;
  kind: CollaborationAuditKind;
  actorId: string;
  summary: string;
  /** Free-form structured before/after deltas; never mutated after write. */
  beforeAfter: {
    field: string;
    before: string | number | null;
    after: string | number | null;
  } | null;
  derivedFrom: readonly string[];
  timestamp: string;
}
