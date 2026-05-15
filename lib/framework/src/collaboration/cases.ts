/**
 * CollaborativeCaseEngine.
 *
 * Cases are durable, replayable epistemic investigations. The engine owns the
 * case state machine and the unresolved-tension / escalation ledgers. State
 * transitions are explicit — no auto-magic mutation — and every transition
 * lands in the audit stream.
 */

import { makeId } from "./hash.js";
import type {
  CaseState,
  CaseSubject,
  CollaborativeCase,
  Escalation,
  UnresolvedTension,
} from "./types.js";

export interface OpenCaseInput {
  title: string;
  subject: CaseSubject;
  framing: string;
  invitedReviewers: readonly string[];
  anchoringRecommendation?: {
    recommendationId: string;
    summary: string;
    confidence: number;
  };
  now: string;
}

const STATE_TRANSITIONS: Readonly<Record<CaseState, readonly CaseState[]>> = {
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

export class CollaborativeCaseEngine {
  private cases = new Map<string, CollaborativeCase>();

  open(input: OpenCaseInput): CollaborativeCase {
    const caseId = makeId(
      "case",
      input.subject.subjectKind,
      input.subject.subjectId,
      input.title,
    );
    const existing = this.cases.get(caseId);
    if (existing) return existing;
    const c: CollaborativeCase = {
      caseId,
      title: input.title,
      subject: input.subject,
      state: "under_investigation",
      openedAt: input.now,
      lastUpdatedAt: input.now,
      invitedReviewers: [...input.invitedReviewers],
      framing: input.framing,
      anchoringRecommendation: input.anchoringRecommendation,
      unresolvedTensions: [],
      escalations: [],
    };
    this.cases.set(caseId, c);
    return c;
  }

  /** Replace case wholesale with a non-destructive copy. */
  private replace(c: CollaborativeCase): CollaborativeCase {
    this.cases.set(c.caseId, c);
    return c;
  }

  transition(caseId: string, to: CaseState, now: string): CollaborativeCase {
    const c = this.requireCase(caseId);
    const allowed = STATE_TRANSITIONS[c.state];
    if (!allowed.includes(to)) {
      throw new Error(
        `invalid_case_transition: ${c.state} → ${to} not permitted (caseId=${caseId})`,
      );
    }
    return this.replace({ ...c, state: to, lastUpdatedAt: now });
  }

  inviteReviewer(caseId: string, reviewerId: string, now: string): CollaborativeCase {
    const c = this.requireCase(caseId);
    if (c.invitedReviewers.includes(reviewerId)) return c;
    return this.replace({
      ...c,
      invitedReviewers: [...c.invitedReviewers, reviewerId],
      lastUpdatedAt: now,
    });
  }

  noteUnresolvedTension(
    caseId: string,
    input: { description: string; reviewerIds: readonly string[]; severity: number },
    now: string,
  ): UnresolvedTension {
    const c = this.requireCase(caseId);
    const tensionId = makeId("tension", caseId, input.description);
    const tension: UnresolvedTension = {
      tensionId,
      description: input.description,
      reviewerIds: [...input.reviewerIds],
      severity: clamp01(input.severity),
      noteAt: now,
    };
    this.replace({
      ...c,
      unresolvedTensions: [...c.unresolvedTensions, tension],
      lastUpdatedAt: now,
    });
    return tension;
  }

  raiseEscalation(
    caseId: string,
    input: { fromReviewerId: string; toReviewerId: string; reason: string },
    now: string,
  ): Escalation {
    const c = this.requireCase(caseId);
    const escalationId = makeId(
      "esc",
      caseId,
      input.fromReviewerId,
      input.toReviewerId,
      input.reason,
    );
    const esc: Escalation = {
      escalationId,
      fromReviewerId: input.fromReviewerId,
      toReviewerId: input.toReviewerId,
      reason: input.reason,
      raisedAt: now,
      resolvedAt: null,
    };
    this.replace({
      ...c,
      escalations: [...c.escalations, esc],
      lastUpdatedAt: now,
    });
    return esc;
  }

  resolveEscalation(caseId: string, escalationId: string, now: string): Escalation {
    const c = this.requireCase(caseId);
    let updated: Escalation | null = null;
    const escalations = c.escalations.map((e) => {
      if (e.escalationId !== escalationId || e.resolvedAt !== null) return e;
      updated = { ...e, resolvedAt: now };
      return updated;
    });
    if (!updated) {
      throw new Error(`escalation_not_found_or_already_resolved: ${escalationId}`);
    }
    this.replace({ ...c, escalations, lastUpdatedAt: now });
    return updated;
  }

  get(caseId: string): CollaborativeCase | undefined {
    return this.cases.get(caseId);
  }

  list(): readonly CollaborativeCase[] {
    return Array.from(this.cases.values()).sort((a, b) =>
      a.openedAt.localeCompare(b.openedAt),
    );
  }

  private requireCase(caseId: string): CollaborativeCase {
    const c = this.cases.get(caseId);
    if (!c) throw new Error(`case_not_found: ${caseId}`);
    return c;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
