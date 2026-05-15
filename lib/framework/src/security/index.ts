/**
 * Security layer — public surface.
 *
 * Identity, multi-tenant isolation, organizational boundaries, intelligence
 * visibility, capability-based access, sensitive evidence redaction, audit
 * trails, session integrity, and a deterministic benchmark suite.
 *
 * Provenance-first, audit-first, deterministic. No silent cross-org access.
 */

export type {
  AccessAction,
  AccessDecision,
  AccessRequest,
  AccessRuleKind,
  BenchmarkOutcome,
  Capability,
  EvaluatedRule,
  EvidenceSensitivity,
  Organization,
  OrganizationScopedEntity,
  OrganizationTier,
  Provenance,
  ReviewerSession,
  ReviewerType,
  SecurityAuditEntry,
  SecurityAuditKind,
  SecurityBenchmarkResult,
  SecurityBenchmarkScenario,
  SecurityReviewerIdentity,
  SensitiveEvidenceRecord,
  SignedAction,
  VisibilityLevel,
  VisibilityRecord,
  VisibilityScope,
} from "./types.js";

export { ALL_CAPABILITIES, DEFAULT_CAPABILITIES_BY_TYPE } from "./types.js";

export { OrganizationBoundaryEngine } from "./organization.js";
export { ReviewerIdentityProvider } from "./identity.js";
export { MultiTenantIsolationLayer, type IsolationDomain } from "./isolation.js";
export { IntelligenceVisibilityEngine } from "./visibility.js";
export { RoleCapabilitySystem, CAPABILITY_FOR_ACTION } from "./capabilities.js";
export { SecureAuditTrail } from "./audit.js";
export { AccessDecisionEngine } from "./access.js";
export {
  SensitiveEvidenceGuard,
  type SensitiveView,
  type FullView,
  type RedactedView,
} from "./sensitive.js";
export { SessionAndActionIntegrityLayer } from "./session.js";
export {
  SecurityBenchmarkSuite,
  type BenchmarkContext,
} from "./benchmarks.js";

export {
  SecurityEngine,
  type SecuritySnapshot,
  type RegisterOrgRequest,
  type RegisterReviewerRequest,
  type RegisterResourceRequest,
  type ChangeVisibilityRequest,
  type RegisterSensitiveRequest,
  type ViewSensitiveRequest,
} from "./engine.js";

export {
  makeId as makeSecurityId,
  fnv1a as securityHash,
  signActionHash,
} from "./hash.js";
