/**
 * Collaboration layer — public surface.
 *
 * Collaborative epistemic operations on top of the cognition framework:
 * multiple reviewers, structured disagreement, explicit overrides, decision
 * lineage, and organizational memory. Provenance-first, append-only,
 * disagreement-preserving.
 */

export type {
  CalibrationProfile,
  CaseState,
  CaseSubject,
  CollaborationAuditEntry,
  CollaborationAuditKind,
  CollaborativeCase,
  ConfidencePatterns,
  ConsensusPattern,
  DecisionLineageEdge,
  DecisionLineageNode,
  DecisionTimeline,
  Disagreement,
  DisagreementCluster,
  DisagreementPosition,
  DisagreementSeverity,
  Escalation,
  EvidenceReviewEntry,
  EvidenceReviewKind,
  HistoricalDecisionStats,
  LineageEventKind,
  OrganizationalReasoningMemory,
  OverrideOutcomeStatus,
  OverrideRecord,
  ReviewerAction,
  ReviewerActionKind,
  ReviewerCalibrationReport,
  ReviewerIdentity,
  ReviewerType,
  UnresolvedTension,
} from "./types.js";

export { ReviewerIdentitySystem } from "./reviewers.js";
export { CollaborativeCaseEngine } from "./cases.js";
export { ReviewerReasoningLayer } from "./reasoning.js";
export {
  StructuredDisagreementEngine,
} from "./disagreement.js";
export {
  CollaborativeEvidenceReview,
  type EffectiveReliability,
} from "./evidence_review.js";
export { OverrideAndExceptionSystem } from "./overrides.js";
export { ReviewerCalibrationEngine } from "./calibration.js";
export { DecisionLineageTracker } from "./lineage.js";
export { OrganizationalConsensusMemoryEngine } from "./consensus_memory.js";
export { CollaborationAuditEngine } from "./audit.js";

export {
  CollaborationEngine,
  type CollaborationSnapshot,
  type OpenCaseRequest,
  type ReviewRequest,
  type OverrideRequest,
  type EvidenceReviewRequest,
} from "./engine.js";

export { makeId as makeCollaborationId, fnv1a as collaborationHash } from "./hash.js";
