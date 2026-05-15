/**
 * ReviewerReasoningLayer.
 *
 * Reviewer actions are the atomic units of reasoning in the collaboration
 * layer. Every action MUST carry rationale, confidence, derived evidence, and
 * a timestamp. No silent annotations: actions that are missing fields are
 * rejected by the engine.
 */

import { makeId } from "./hash.js";
import type { ReviewerAction, ReviewerActionKind } from "./types.js";

export interface RecordReviewerActionInput {
  caseId: string;
  reviewerId: string;
  kind: ReviewerActionKind;
  target: { kind: string; id: string };
  rationale: string;
  confidence: number;
  derivedFrom: readonly string[];
  ambiguityMarkers?: readonly string[];
  now: string;
}

export class ReviewerReasoningLayer {
  private actions: ReviewerAction[] = [];

  record(input: RecordReviewerActionInput): ReviewerAction {
    if (!input.rationale.trim()) {
      throw new Error("reviewer_action_missing_rationale");
    }
    if (!Number.isFinite(input.confidence)) {
      throw new Error("reviewer_action_invalid_confidence");
    }
    if (input.derivedFrom.length === 0 && input.kind !== "request_evidence") {
      // request_evidence is the one action where it's legitimate to have no
      // prior derivation; every other action must point at evidence/IDs.
      throw new Error(`reviewer_action_missing_derivation: ${input.kind}`);
    }
    const actionId = makeId(
      "ract",
      input.caseId,
      input.reviewerId,
      input.kind,
      input.target.kind,
      input.target.id,
      input.now,
    );
    const action: ReviewerAction = {
      actionId,
      caseId: input.caseId,
      reviewerId: input.reviewerId,
      kind: input.kind,
      target: { ...input.target },
      rationale: input.rationale,
      confidence: clamp01(input.confidence),
      derivedFrom: [...input.derivedFrom],
      ambiguityMarkers: [...(input.ambiguityMarkers ?? [])],
      timestamp: input.now,
    };
    this.actions.push(action);
    return action;
  }

  listByCase(caseId: string): readonly ReviewerAction[] {
    return this.actions
      .filter((a) => a.caseId === caseId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  listByReviewer(reviewerId: string): readonly ReviewerAction[] {
    return this.actions
      .filter((a) => a.reviewerId === reviewerId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  all(): readonly ReviewerAction[] {
    return this.actions.slice();
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
