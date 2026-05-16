/**
 * ATS Intelligence Ingestion Layer — core types.
 *
 * The framework treats ATS systems (Ashby, Greenhouse, …) as the
 * organization's operational system of record. It does NOT replace
 * them, write back to them, or automate stage progression. It
 * reconstructs how the organization reasoned about hiring — the
 * disagreement, escalation, override, and calibration dynamics that
 * live as plain operational evidence inside an ATS.
 *
 * Every type in this module is deliberately closed (no `any`, no
 * `string` enums) so that adapters can fail loudly when an ATS adds
 * a shape we have not modelled. Silent flattening of disagreement
 * would defeat the purpose of an audit-grade replay layer.
 */

export type ATSProvider = "ashby" | "greenhouse" | "synthetic";

export type ATSObjectKind =
  | "candidate"
  | "application"
  | "interview_plan"
  | "interview"
  | "scorecard"
  | "interview_kit"
  | "feedback"
  | "note"
  | "activity"
  | "decision"
  | "approval"
  | "rejection_rationale"
  | "reviewer";

/**
 * A raw record fetched from an ATS adapter, before normalization.
 * The payload is opaque and provider-specific; the wrapper carries
 * enough context to project it deterministically into normalized
 * evidence and to preserve provenance.
 */
export interface ATSRawRecord {
  provider: ATSProvider;
  /** ATS-side primary identifier. Must be stable across syncs. */
  atsId: string;
  kind: ATSObjectKind;
  fetchedAt: string;
  /** Optional ATS-reported event time (interview-conducted-at, etc.). */
  occurredAt?: string;
  /** sha256-first-16 of the canonicalised raw payload. */
  payloadHash: string;
  /** Verbatim payload. Adapters MUST NOT pre-flatten this. */
  payload: unknown;
  /** Provider-specific upstream record ids that produced this one. */
  parentIds?: string[];
}

/**
 * Connection metadata. Credentials are NEVER stored in framework
 * memory — adapters resolve them lazily from process env when needed.
 */
export interface ATSConnection {
  id: string;
  provider: ATSProvider;
  label: string;
  status: "connected" | "unconfigured" | "error";
  connectedAt: string;
  /** Free-form ATS instance hint (workspace name etc.). */
  workspaceHint?: string;
  /** Human description of what's available without exposing keys. */
  statusDetail: string;
  /** Last completed full sync (UTC). */
  lastSyncedAt?: string;
  /** Counts after the most recent sync. */
  lastSyncCounts?: Record<ATSObjectKind, number>;
}

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

export interface AdapterHealth {
  provider: ATSProvider;
  ready: boolean;
  message: string;
  checkedAt: string;
}

/**
 * All ATS adapters expose the same shape. Pagination is opaque to
 * the gateway; adapters yield records in batches until exhaustion.
 */
export interface ATSAdapter {
  readonly provider: ATSProvider;
  readonly connection: ATSConnection;
  health(): Promise<AdapterHealth>;
  /**
   * Stream every record for a single hiring decision. Adapters MUST
   * surface the candidate row, every scorecard/feedback/note tied to
   * it, the decision/approval/rejection, and every reviewer mentioned.
   */
  fetchHiringProcess(candidateAtsId: string): Promise<ATSRawRecord[]>;
  /**
   * Discover the candidate ids visible to this connection. Bounded
   * by `limit` because real ATSes have millions of rows; the
   * gateway pages itself.
   */
  listCandidateIds(opts?: { limit?: number }): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Normalized evidence
// ---------------------------------------------------------------------------

export type NormalizedEvidenceKind =
  | "explicit_claim"
  | "reviewer_assessment"
  | "contradiction_signal"
  | "uncertainty_signal"
  | "escalation_signal"
  | "override_signal"
  | "calibration_signal";

/**
 * A reviewer record reconstructed from any role-bearing identity
 * the ATS exposed. We keep the surfaceable fields only — names,
 * roles — never emails or auth identifiers.
 */
export interface ATSReviewer {
  id: string;
  displayName: string;
  role?: string;
}

/**
 * One typed evidence unit derived from an ATS raw record. Multiple
 * normalized items can be produced from the same raw record (e.g.
 * a scorecard yields a reviewer_assessment + possibly a
 * contradiction_signal when another scorecard disagrees).
 */
export interface NormalizedEvidence {
  /** Stable id of the form `<provider>:<atsId>#<index>`. */
  id: string;
  kind: NormalizedEvidenceKind;
  provider: ATSProvider;
  sourceAtsId: string;
  sourceKind: ATSObjectKind;
  reviewer?: ATSReviewer;
  /** Short one-liner used in the timeline. */
  summary: string;
  /** Optional longer body, e.g. the reviewer's verbatim comment. */
  detail?: string;
  occurredAt: string;
  ingestedAt: string;
  /** sha256-first-16 of the raw payload that produced this. */
  payloadHash: string;
  /** Provenance chain back to root ATS records. */
  provenanceChain: string[];
  /** Self-reported confidence in [0,1], when extractable. */
  reviewerConfidence?: number;
  /** Numeric assessment when extractable, in [0,1]. */
  assessmentScore?: number;
  /** Topical tag, e.g. "system-design", "communication". */
  topic?: string;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export type HiringOutcome =
  | "hired"
  | "declined"
  | "withdrawn"
  | "open";

export interface ReviewerDisagreement {
  /** Stable id derived from the participating reviewer/topic tuple. */
  id: string;
  topic: string;
  reviewers: ATSReviewer[];
  /** The conflicting assessment summaries, in [0,1]. */
  spread: number;
  high: { reviewerId: string; score: number; summary: string };
  low: { reviewerId: string; score: number; summary: string };
  resolvedAt?: string;
  resolution?: "consensus" | "override" | "unresolved";
}

export interface EscalationMoment {
  id: string;
  occurredAt: string;
  trigger:
    | "additional-loop"
    | "loop-extension"
    | "hiring-manager-intervention"
    | "founder-intervention"
    | "bar-recalibration"
    | "compensation-exception";
  summary: string;
  evidenceIds: string[];
}

export interface OverrideMoment {
  id: string;
  occurredAt: string;
  byReviewerId: string;
  overrides: "decline" | "advance" | "hold";
  rationale: string;
  evidenceIds: string[];
}

export interface ConfidencePoint {
  occurredAt: string;
  /** Rolling estimate in [0,1] of P(hire) given evidence so far. */
  estimate: number;
  /** The evidence ids that produced this estimate. */
  evidenceIds: string[];
}

export interface HiringDecisionReplay {
  id: string;
  connectionId: string;
  provider: ATSProvider;
  candidateAtsId: string;
  candidateName: string;
  targetRole: string;
  organization: string;
  openedAt: string;
  closedAt?: string;
  outcome: HiringOutcome;
  reviewers: ATSReviewer[];
  evidence: NormalizedEvidence[];
  disagreements: ReviewerDisagreement[];
  escalations: EscalationMoment[];
  overrides: OverrideMoment[];
  confidenceTrajectory: ConfidencePoint[];
  unresolvedTensions: string[];
  /** sha256-first-16 of the canonical replay body. */
  signature: string;
}

// ---------------------------------------------------------------------------
// Reasoning reconstruction
// ---------------------------------------------------------------------------

export interface DisagreementClusterNode {
  reviewerId: string;
  displayName: string;
  meanScore: number;
  topics: string[];
}

export interface DisagreementClusterEdge {
  from: string;
  to: string;
  /** Maximum spread observed between these two on any shared topic. */
  weight: number;
  topics: string[];
}

export interface ReasoningReconstruction {
  replayId: string;
  disagreementGraph: {
    nodes: DisagreementClusterNode[];
    edges: DisagreementClusterEdge[];
  };
  escalationPatterns: Array<{
    pattern: string;
    occurredAt: string;
    evidenceIds: string[];
  }>;
  confidenceShifts: Array<{
    from: number;
    to: number;
    delta: number;
    triggerEvidenceId: string;
    summary: string;
  }>;
  overrideDynamics: Array<{
    overrideId: string;
    confidenceAtOverride: number;
    counterEvidenceCount: number;
    summary: string;
  }>;
  pressurePoints: string[];
  /** Reconstruction caveat surfaced in the UI — never claim hidden reasoning. */
  caveat: string;
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

export interface ReviewerReliability {
  reviewerId: string;
  displayName: string;
  predictions: number;
  meanClaimed: number;
  meanRealized: number;
  expectedCalibrationError: number;
  brierScore: number;
  /** Positive = overconfident, negative = underconfident. */
  drift: number;
  topics: string[];
}

export interface CalibrationBucket {
  range: string;
  lower: number;
  upper: number;
  claimed: number;
  actual: number;
  count: number;
  overconfident: boolean;
}

export interface ATSCalibrationReport {
  orgId: string;
  expectedCalibrationError: number;
  brierScore: number;
  buckets: CalibrationBucket[];
  reviewers: ReviewerReliability[];
  measuredAt: string;
  caveat: string;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface ReplaySignatureRecord {
  replayId: string;
  storedSignature: string;
  recomputedSignature: string;
  match: boolean;
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// Gateway contract
// ---------------------------------------------------------------------------

export interface SyncResult {
  connectionId: string;
  candidatesSeen: number;
  replaysBuilt: number;
  rawRecordsIngested: number;
  normalizedEvidence: number;
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface DisagreementSummary {
  replayId: string;
  candidateName: string;
  topic: string;
  spread: number;
  highReviewer: string;
  lowReviewer: string;
  resolution: ReviewerDisagreement["resolution"];
}
