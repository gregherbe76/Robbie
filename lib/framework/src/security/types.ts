/**
 * Public types for the Identity, Multi-Tenant Security, and Organizational
 * Boundary layer.
 *
 * Design rules (mirrored across the layer):
 *  - Every entity carries `organizationId`, `visibilityScope`, and provenance.
 *  - No implicit cross-org access — global visibility is opt-in via
 *    `visibilityScope`.
 *  - Visibility changes, sensitive evidence views, and access denials are
 *    themselves audit events.
 *  - Reviewer identity is required for every operational action; no anonymous
 *    overrides, escalations, or sensitive reads.
 */

// =============================================================================
// Organization
// =============================================================================

export type OrganizationTier = "founder" | "growth" | "enterprise" | "demo";

export interface Organization {
  organizationId: string;
  displayName: string;
  tier: OrganizationTier;
  createdAt: string;
  /** Distinct id that calibration/benchmarks salt with to avoid leakage. */
  calibrationNamespace: string;
}

/**
 * Where an entity is visible. `organization` is the default. `global_demo` and
 * `global_benchmark` are explicit, audited carve-outs for shared corpora.
 */
export type VisibilityScope = "organization" | "global_demo" | "global_benchmark";

export interface Provenance {
  sourceKind:
    | "ingestion"
    | "cognition"
    | "reviewer"
    | "agent"
    | "benchmark"
    | "system";
  sourceId: string;
  createdBy: string;
  createdAt: string;
}

/**
 * Every protected entity in the framework must conform to this shape. We
 * enforce it structurally (engines reject entities missing org scope) rather
 * than at type-only level so seeds and runtime callers can't silently drop it.
 */
export interface OrganizationScopedEntity {
  organizationId: string;
  visibilityScope: VisibilityScope;
  provenance: Provenance;
  createdBy: string;
  createdAt: string;
}

// =============================================================================
// Reviewer identity
// =============================================================================

export type ReviewerType =
  | "founder"
  | "recruiter"
  | "hiring_manager"
  | "technical_reviewer"
  | "executive"
  | "external_reviewer"
  | "system_agent";

export interface SecurityReviewerIdentity {
  reviewerId: string;
  organizationId: string;
  reviewerType: ReviewerType;
  displayName: string;
  /**
   * Deterministic fingerprint derived from (orgId, type, displayName). Used as
   * a stable opaque handle for cross-system correlation without exposing PII.
   */
  fingerprint: string;
  capabilities: readonly Capability[];
  /**
   * Stable key used by the calibration system to attribute confidence
   * patterns to a reviewer without leaking across orgs.
   */
  calibrationIdentityKey: string;
  createdAt: string;
  /** External reviewers are bound to a single investigation; engine enforces. */
  scopedToInvestigationId: string | null;
}

// =============================================================================
// Visibility
// =============================================================================

export type VisibilityLevel =
  | "organization_private"
  | "investigation_private"
  | "reviewer_private"
  | "escalation_only"
  | "benchmark_public"
  | "demo_public";

export interface VisibilityRecord {
  resourceId: string;
  resourceKind:
    | "case"
    | "evidence"
    | "audit"
    | "override"
    | "escalation"
    | "review"
    | "memory"
    | "benchmark";
  organizationId: string;
  level: VisibilityLevel;
  /** When level is investigation_private or reviewer_private these are required. */
  scopedInvestigationId: string | null;
  scopedReviewerId: string | null;
  changedBy: string;
  changedAt: string;
  reason: string;
  /** Previous level — null when first set. Append-only history below. */
  previousLevel: VisibilityLevel | null;
}

// =============================================================================
// Capabilities (capability-based, not generic RBAC)
// =============================================================================

export type Capability =
  | "review_evidence"
  | "escalate_case"
  | "override_recommendation"
  | "view_sensitive_evidence"
  | "run_benchmarks"
  | "manage_org_memory"
  | "view_calibration"
  | "create_public_benchmark";

export const ALL_CAPABILITIES: readonly Capability[] = [
  "review_evidence",
  "escalate_case",
  "override_recommendation",
  "view_sensitive_evidence",
  "run_benchmarks",
  "manage_org_memory",
  "view_calibration",
  "create_public_benchmark",
] as const;

/**
 * Default capability bundles per reviewer type. Engines look up here when
 * registering a reviewer, but the caller may pass an explicit set to override.
 */
export const DEFAULT_CAPABILITIES_BY_TYPE: Record<ReviewerType, readonly Capability[]> = {
  founder: ALL_CAPABILITIES,
  recruiter: ["review_evidence", "escalate_case", "view_calibration"],
  hiring_manager: ["review_evidence", "escalate_case", "override_recommendation", "view_calibration"],
  technical_reviewer: ["review_evidence", "escalate_case"],
  executive: [
    "review_evidence",
    "escalate_case",
    "override_recommendation",
    "view_sensitive_evidence",
    "view_calibration",
  ],
  external_reviewer: ["review_evidence"],
  system_agent: ["review_evidence", "run_benchmarks"],
};

// =============================================================================
// Access decisions
// =============================================================================

export type AccessRuleKind =
  | "organization_boundary"
  | "capability"
  | "visibility"
  | "escalation_restriction"
  | "reviewer_identity"
  | "session_integrity";

export interface EvaluatedRule {
  rule: AccessRuleKind;
  passed: boolean;
  detail: string;
}

export type AccessAction =
  | "read"
  | "write"
  | "override"
  | "escalate"
  | "view_sensitive"
  | "modify_visibility"
  | "modify_benchmark"
  | "manage_memory";

export interface AccessRequest {
  reviewerId: string;
  organizationId: string;
  targetResourceId: string;
  targetOrganizationId: string;
  targetVisibility: VisibilityLevel;
  targetInvestigationId?: string | null;
  action: AccessAction;
  requiredCapability: Capability;
  sessionId?: string | null;
  now: string;
}

export interface AccessDecision {
  decisionId: string;
  allowed: boolean;
  reason: string;
  evaluatedRules: readonly EvaluatedRule[];
  reviewerId: string;
  organizationId: string;
  targetResource: string;
  action: AccessAction;
  timestamp: string;
}

// =============================================================================
// Audit
// =============================================================================

export type SecurityAuditKind =
  | "access_attempt"
  | "access_denied"
  | "visibility_change"
  | "override_action"
  | "escalation_access"
  | "evidence_access"
  | "sensitive_evidence_view"
  | "calibration_access"
  | "benchmark_modification"
  | "session_opened"
  | "session_closed"
  | "action_signed"
  | "reviewer_registered";

export interface SecurityAuditEntry {
  entryId: string;
  /** Monotonic per-org sequence — `n`-th audit entry inside this org. */
  sequence: number;
  organizationId: string;
  reviewerId: string | null;
  kind: SecurityAuditKind;
  targetResource: string;
  /** Free-form structured detail; values are primitives only. */
  detail: Readonly<Record<string, string | number | boolean | null>>;
  timestamp: string;
}

// =============================================================================
// Sensitive evidence
// =============================================================================

export type EvidenceSensitivity =
  | "public"
  | "internal"
  | "founder_only"
  | "escalation_only"
  | "confidential_investigation";

export interface SensitiveEvidenceRecord {
  evidenceId: string;
  organizationId: string;
  sensitivity: EvidenceSensitivity;
  /** What non-privileged readers see in lieu of the body. */
  redactedSummary: string;
  fullSummary: string;
  /** Always preserved, even when redacted. */
  provenance: Provenance;
  /** Ids of audit entries that logged a privileged read. Append-only. */
  accessAuditIds: readonly string[];
}

// =============================================================================
// Session & action integrity
// =============================================================================

export interface ReviewerSession {
  sessionId: string;
  reviewerId: string;
  organizationId: string;
  openedAt: string;
  closedAt: string | null;
  /** FNV-1a chain over signed actions to detect tampering / replay gaps. */
  actionChainHead: string;
  signedActionCount: number;
}

export interface SignedAction {
  actionId: string;
  sessionId: string;
  reviewerId: string;
  organizationId: string;
  kind: string;
  payloadHash: string;
  signature: string;
  /** Idempotency key supplied by caller; duplicate keys collapse to the original. */
  idempotencyKey: string;
  timestamp: string;
}

// =============================================================================
// Security benchmarks
// =============================================================================

export type SecurityBenchmarkScenario =
  | "cross_org_access_attempt"
  | "unauthorized_escalation_access"
  | "override_without_capability"
  | "visibility_leakage"
  | "benchmark_contamination"
  | "reviewer_impersonation"
  | "sensitive_evidence_access"
  | "hidden_audit_mutation";

export type BenchmarkOutcome = "passed" | "failed";

export interface SecurityBenchmarkResult {
  scenarioId: SecurityBenchmarkScenario;
  displayName: string;
  description: string;
  expectedOutcome: "access_denied" | "access_allowed";
  actualOutcome: "access_denied" | "access_allowed";
  passed: boolean;
  /** Decision evidence for the scenario — the actual access decision evaluated. */
  decision: AccessDecision;
  auditEntryIds: readonly string[];
  ranAt: string;
}
