/**
 * CollaborationEngine — top-level orchestrator over the ten collaboration
 * primitives. The engine wires the engines together so callers (API server,
 * console, tests) can drive cases end-to-end without re-implementing the
 * cross-engine bookkeeping (audit append on every meaningful action,
 * lineage/memory projection, etc.).
 *
 * Hard rules preserved:
 *   - every mutation lands in the audit ledger
 *   - disagreements are never collapsed to votes
 *   - overrides require acknowledged risks
 *   - case state transitions are explicit and validated
 *   - everything is replayable: same inputs → same outputs
 */

import { ReviewerIdentitySystem } from "./reviewers.js";
import { CollaborativeCaseEngine } from "./cases.js";
import { ReviewerReasoningLayer } from "./reasoning.js";
import { StructuredDisagreementEngine } from "./disagreement.js";
import { CollaborativeEvidenceReview } from "./evidence_review.js";
import { OverrideAndExceptionSystem } from "./overrides.js";
import { ReviewerCalibrationEngine } from "./calibration.js";
import { DecisionLineageTracker } from "./lineage.js";
import { OrganizationalConsensusMemoryEngine } from "./consensus_memory.js";
import { CollaborationAuditEngine } from "./audit.js";

import type {
  CaseState,
  CollaborativeCase,
  CollaborationAuditEntry,
  DecisionTimeline,
  Disagreement,
  DisagreementCluster,
  DisagreementPosition,
  EvidenceReviewEntry,
  EvidenceReviewKind,
  OrganizationalReasoningMemory,
  OverrideOutcomeStatus,
  OverrideRecord,
  ReviewerAction,
  ReviewerActionKind,
  ReviewerCalibrationReport,
  ReviewerIdentity,
} from "./types.js";

export interface CollaborationSnapshot {
  reviewers: readonly ReviewerIdentity[];
  cases: readonly CollaborativeCase[];
  actions: readonly ReviewerAction[];
  evidenceReviews: readonly EvidenceReviewEntry[];
  disagreements: readonly Disagreement[];
  disagreementClusters: readonly DisagreementCluster[];
  overrides: readonly OverrideRecord[];
  audit: readonly CollaborationAuditEntry[];
  organizationalMemory: OrganizationalReasoningMemory;
}

export interface OpenCaseRequest {
  title: string;
  subjectKind: "candidate" | "role" | "organization" | "pattern";
  subjectId: string;
  subjectDisplayName: string;
  framing: string;
  invitedReviewers: readonly string[];
  anchoringRecommendation?: {
    recommendationId: string;
    summary: string;
    confidence: number;
  };
  now: string;
}

export interface ReviewRequest {
  caseId: string;
  reviewerId: string;
  kind: ReviewerActionKind;
  target: { kind: string; id: string };
  rationale: string;
  confidence: number;
  derivedFrom: readonly string[];
  ambiguityMarkers?: readonly string[];
  /** Optionally raise a disagreement at the same time. */
  disagreement?: {
    topic: string;
    severityScore: number;
    positions: ReadonlyArray<Omit<DisagreementPosition, "positionId" | "recordedAt">>;
  };
  /** Optionally request a transition. Engine validates the transition. */
  transitionTo?: CaseState;
  now: string;
}

export interface OverrideRequest {
  caseId: string;
  reviewerId: string;
  affectedRecommendationId: string;
  reason: string;
  confidenceImpact: number;
  acknowledgedRisks: readonly string[];
  direction: OverrideRecord["direction"];
  now: string;
}

export interface EvidenceReviewRequest {
  caseId: string;
  evidenceId: string;
  reviewerId: string;
  kind: EvidenceReviewKind;
  rationale: string;
  reliabilityDelta?: number;
  counterEvidenceIds?: readonly string[];
  ambiguityMarkers?: readonly string[];
  now: string;
}

export class CollaborationEngine {
  // Sub-engines are private so the only path to a mutation is through one of
  // the engine's audited orchestration methods. Reads are exposed below via
  // explicit, read-only accessors.
  private readonly _reviewers = new ReviewerIdentitySystem();
  private readonly _cases = new CollaborativeCaseEngine();
  private readonly _reasoning = new ReviewerReasoningLayer();
  private readonly _disagreements = new StructuredDisagreementEngine();
  private readonly _evidenceReview = new CollaborativeEvidenceReview();
  private readonly _overrides = new OverrideAndExceptionSystem();
  private readonly _calibration = new ReviewerCalibrationEngine();
  private readonly _lineage = new DecisionLineageTracker();
  private readonly _memory = new OrganizationalConsensusMemoryEngine();
  private readonly _audit = new CollaborationAuditEngine();

  // ---- Reviewer registration (admin path, not case-scoped) ------------------
  registerReviewer(
    ...args: Parameters<ReviewerIdentitySystem["register"]>
  ): ReturnType<ReviewerIdentitySystem["register"]> {
    return this._reviewers.register(...args);
  }
  getReviewer(id: string): ReviewerIdentity | undefined {
    return this._reviewers.get(id);
  }
  listReviewers(): readonly ReviewerIdentity[] {
    return this._reviewers.list();
  }

  // ---- Read-only accessors over sub-engines ---------------------------------
  getCase(id: string): CollaborativeCase | undefined {
    return this._cases.get(id);
  }
  listCases(): readonly CollaborativeCase[] {
    return this._cases.list();
  }
  listActions(caseId: string): readonly ReviewerAction[] {
    return this._reasoning.listByCase(caseId);
  }
  listEvidenceReviews(caseId: string): readonly EvidenceReviewEntry[] {
    return this._evidenceReview.listByCase(caseId);
  }
  listDisagreements(caseId: string): readonly Disagreement[] {
    return this._disagreements.listByCase(caseId);
  }
  listOverrides(caseId: string): readonly OverrideRecord[] {
    return this._overrides.listByCase(caseId);
  }
  listAudit(caseId: string): readonly CollaborationAuditEntry[] {
    return this._audit.listByCase(caseId);
  }

  openCase(req: OpenCaseRequest): CollaborativeCase {
    const c = this._cases.open({
      title: req.title,
      subject: {
        subjectKind: req.subjectKind,
        subjectId: req.subjectId,
        subjectDisplayName: req.subjectDisplayName,
      },
      framing: req.framing,
      invitedReviewers: req.invitedReviewers,
      anchoringRecommendation: req.anchoringRecommendation,
      now: req.now,
    });
    this._audit.append({
      caseId: c.caseId,
      kind: "case_opened",
      actorId: "collaboration.engine",
      summary: `${c.title} (${c.subject.subjectKind}:${c.subject.subjectId})`,
      derivedFrom: req.anchoringRecommendation
        ? [req.anchoringRecommendation.recommendationId]
        : [],
      now: req.now,
    });
    return c;
  }

  review(req: ReviewRequest): {
    action: ReviewerAction;
    disagreement?: Disagreement;
    case: CollaborativeCase;
  } {
    // Validate prerequisites BEFORE any mutation so we never leave orphaned
    // action/audit records on failed reviews.
    const existingCase = this._cases.get(req.caseId);
    if (!existingCase) throw new Error(`case_not_found: ${req.caseId}`);
    if (!this._reviewers.get(req.reviewerId)) {
      throw new Error(`reviewer_not_found: ${req.reviewerId}`);
    }
    if (req.transitionTo && req.transitionTo !== existingCase.state) {
      // Probe the state machine without mutating; .transition will validate.
      // We re-check here so we fail fast before recording the action.
      const table: Record<CaseState, readonly CaseState[]> = {
        under_investigation: ["awaiting_review", "disagreement_active", "archived", "unresolved"],
        awaiting_review: [
          "under_investigation",
          "disagreement_active",
          "consensus_reached",
          "escalation_required",
          "unresolved",
          "archived",
        ],
        disagreement_active: [
          "consensus_reached",
          "escalation_required",
          "unresolved",
          "awaiting_review",
          "archived",
        ],
        escalation_required: [
          "consensus_reached",
          "disagreement_active",
          "unresolved",
          "archived",
        ],
        consensus_reached: ["unresolved", "archived"],
        unresolved: ["under_investigation", "archived"],
        archived: [],
      };
      if (!table[existingCase.state].includes(req.transitionTo)) {
        throw new Error(
          `invalid_case_transition: ${existingCase.state} → ${req.transitionTo} not permitted`,
        );
      }
    }

    // Pre-validate disagreement payload (if any) so that an invalid disagreement
    // cannot leave orphan action/audit records behind. This mirrors the runtime
    // checks inside StructuredDisagreementEngine.open() — keep them in sync.
    if (req.disagreement) {
      if (req.disagreement.positions.length < 2) {
        throw new Error("disagreement_requires_two_positions");
      }
      for (const p of req.disagreement.positions) {
        if (!p.rationale || p.rationale.trim().length === 0) {
          throw new Error("disagreement_position_requires_rationale");
        }
      }
    }

    const action = this._reasoning.record({
      caseId: req.caseId,
      reviewerId: req.reviewerId,
      kind: req.kind,
      target: req.target,
      rationale: req.rationale,
      confidence: req.confidence,
      derivedFrom: req.derivedFrom,
      ambiguityMarkers: req.ambiguityMarkers,
      now: req.now,
    });
    this._audit.append({
      caseId: req.caseId,
      kind: "reviewer_action",
      actorId: req.reviewerId,
      summary: `${req.kind} on ${req.target.kind}:${req.target.id}`,
      derivedFrom: req.derivedFrom,
      now: req.now,
    });

    let disagreement: Disagreement | undefined;
    if (req.disagreement) {
      disagreement = this._disagreements.open({
        caseId: req.caseId,
        topic: req.disagreement.topic,
        positions: req.disagreement.positions,
        severityScore: req.disagreement.severityScore,
        now: req.now,
      });
      this._audit.append({
        caseId: req.caseId,
        kind: "disagreement_opened",
        actorId: req.reviewerId,
        summary: `${disagreement.topic} (severity ${disagreement.severity})`,
        derivedFrom: [disagreement.disagreementId],
        now: req.now,
      });
    }

    let currentCase = existingCase;
    if (req.transitionTo && req.transitionTo !== currentCase.state) {
      const before = currentCase.state;
      currentCase = this._cases.transition(req.caseId, req.transitionTo, req.now);
      this._audit.append({
        caseId: req.caseId,
        kind: "case_state_changed",
        actorId: req.reviewerId,
        summary: `state ${before} → ${req.transitionTo}`,
        beforeAfter: { field: "state", before, after: req.transitionTo },
        now: req.now,
      });
    }

    return { action, disagreement, case: currentCase };
  }

  issueOverride(req: OverrideRequest): OverrideRecord {
    const rec = this._overrides.issue({
      caseId: req.caseId,
      reviewerId: req.reviewerId,
      affectedRecommendationId: req.affectedRecommendationId,
      reason: req.reason,
      confidenceImpact: req.confidenceImpact,
      acknowledgedRisks: req.acknowledgedRisks,
      direction: req.direction,
      now: req.now,
    });
    this._audit.append({
      caseId: req.caseId,
      kind: "override_issued",
      actorId: req.reviewerId,
      summary: `${rec.direction} on ${rec.affectedRecommendationId}: ${rec.reason}`,
      derivedFrom: rec.acknowledgedRisks.map((_, i) => `risk:${i}`),
      now: req.now,
    });
    return rec;
  }

  recordOverrideOutcome(input: {
    overrideId: string;
    outcome: OverrideOutcomeStatus;
    note: string | null;
    now: string;
  }): OverrideRecord {
    const rec = this._overrides.recordOutcome(input);
    this._audit.append({
      caseId: rec.caseId,
      kind: "override_outcome",
      actorId: "collaboration.engine",
      summary: `override ${rec.overrideId} → ${input.outcome}`,
      beforeAfter: { field: "outcome", before: "pending", after: input.outcome },
      derivedFrom: [rec.overrideId],
      now: input.now,
    });
    return rec;
  }

  reviewEvidence(req: EvidenceReviewRequest): EvidenceReviewEntry {
    const entry = this._evidenceReview.record({
      caseId: req.caseId,
      evidenceId: req.evidenceId,
      reviewerId: req.reviewerId,
      kind: req.kind,
      rationale: req.rationale,
      reliabilityDelta: req.reliabilityDelta,
      counterEvidenceIds: req.counterEvidenceIds,
      ambiguityMarkers: req.ambiguityMarkers,
      now: req.now,
    });
    this._audit.append({
      caseId: req.caseId,
      kind: "evidence_review",
      actorId: req.reviewerId,
      summary: `${req.kind} on evidence ${req.evidenceId}`,
      derivedFrom: [req.evidenceId, ...(req.counterEvidenceIds ?? [])],
      now: req.now,
    });
    return entry;
  }

  raiseEscalation(input: {
    caseId: string;
    fromReviewerId: string;
    toReviewerId: string;
    reason: string;
    now: string;
  }): CollaborativeCase {
    const esc = this._cases.raiseEscalation(
      input.caseId,
      {
        fromReviewerId: input.fromReviewerId,
        toReviewerId: input.toReviewerId,
        reason: input.reason,
      },
      input.now,
    );
    this._audit.append({
      caseId: input.caseId,
      kind: "escalation_raised",
      actorId: input.fromReviewerId,
      summary: `escalated to ${input.toReviewerId}: ${input.reason}`,
      derivedFrom: [esc.escalationId],
      now: input.now,
    });
    return this._cases.get(input.caseId)!;
  }

  resolveDisagreement(input: {
    disagreementId: string;
    summary: string;
    actorId: string;
    now: string;
  }): Disagreement {
    const d = this._disagreements.resolve(input.disagreementId, input.summary, input.now);
    this._audit.append({
      caseId: d.caseId,
      kind: "disagreement_resolved",
      actorId: input.actorId,
      summary: input.summary,
      derivedFrom: [d.disagreementId],
      now: input.now,
    });
    return d;
  }

  calibrationFor(reviewerId: string, now: string): ReviewerCalibrationReport {
    const reviewer = this._reviewers.get(reviewerId);
    if (!reviewer) throw new Error(`reviewer_not_found: ${reviewerId}`);
    const actions = this._reasoning.listByReviewer(reviewerId);
    const overrides = this._overrides.listByReviewer(reviewerId);
    return this._calibration.compute({ reviewer, actions, overrides, now });
  }

  timelineFor(caseId: string): DecisionTimeline {
    const c = this._cases.get(caseId);
    if (!c) throw new Error(`case_not_found: ${caseId}`);
    return this._lineage.buildTimeline({
      case: c,
      actions: this._reasoning.listByCase(caseId),
      evidenceReviews: this._evidenceReview.listByCase(caseId),
      disagreements: this._disagreements.listByCase(caseId),
      overrides: this._overrides.listByCase(caseId),
    });
  }

  snapshot(now: string): CollaborationSnapshot {
    const disagreements = this._disagreements.all();
    const clusters = this._disagreements.cluster();
    const reviewers = this._reviewers.list();
    const cases = this._cases.list();
    const actions = this._reasoning.all();
    const overrides = this._overrides.all();
    const organizationalMemory = this._memory.build({
      reviewers,
      cases,
      actions,
      disagreements,
      disagreementClusters: clusters,
      overrides,
      now,
    });
    return {
      reviewers,
      cases,
      actions,
      evidenceReviews: this._evidenceReview.all(),
      disagreements,
      disagreementClusters: clusters,
      overrides,
      audit: this._audit.all(),
      organizationalMemory,
    };
  }
}
