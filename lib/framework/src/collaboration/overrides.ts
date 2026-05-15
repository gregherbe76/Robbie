/**
 * OverrideAndExceptionSystem.
 *
 * Overrides are explicit. The engine refuses to record an override without:
 *   - a written reason,
 *   - at least one acknowledged risk,
 *   - a confidence impact,
 *   - a reviewer identity.
 *
 * Outcomes are tracked longitudinally so the calibration engine can score
 * override quality, not so the framework can "fix" recommendations behind
 * the operator's back.
 */

import { makeId } from "./hash.js";
import type { OverrideOutcomeStatus, OverrideRecord } from "./types.js";

export interface IssueOverrideInput {
  caseId: string;
  reviewerId: string;
  affectedRecommendationId: string;
  reason: string;
  confidenceImpact: number;
  acknowledgedRisks: readonly string[];
  direction: OverrideRecord["direction"];
  now: string;
}

export interface RecordOverrideOutcomeInput {
  overrideId: string;
  outcome: OverrideOutcomeStatus;
  note: string | null;
  now: string;
}

export class OverrideAndExceptionSystem {
  private overrides = new Map<string, OverrideRecord>();
  /** Append-only outcome trail, separate from the override record. */
  private outcomeHistory: ReadonlyArray<{
    overrideId: string;
    outcome: OverrideOutcomeStatus;
    note: string | null;
    timestamp: string;
  }> = [];

  issue(input: IssueOverrideInput): OverrideRecord {
    if (!input.reason.trim()) {
      throw new Error("override_missing_reason");
    }
    if (input.acknowledgedRisks.length === 0) {
      throw new Error("override_requires_acknowledged_risks");
    }
    if (!Number.isFinite(input.confidenceImpact)) {
      throw new Error("override_invalid_confidence_impact");
    }
    const overrideId = makeId(
      "ovr",
      input.caseId,
      input.reviewerId,
      input.affectedRecommendationId,
      input.now,
    );
    const rec: OverrideRecord = {
      overrideId,
      caseId: input.caseId,
      reviewerId: input.reviewerId,
      affectedRecommendationId: input.affectedRecommendationId,
      reason: input.reason,
      confidenceImpact: clampSigned(input.confidenceImpact),
      acknowledgedRisks: [...input.acknowledgedRisks],
      direction: input.direction,
      issuedAt: input.now,
      outcome: "pending",
      outcomeNote: null,
    };
    this.overrides.set(overrideId, rec);
    return rec;
  }

  recordOutcome(input: RecordOverrideOutcomeInput): OverrideRecord {
    const rec = this.overrides.get(input.overrideId);
    if (!rec) throw new Error(`override_not_found: ${input.overrideId}`);
    const updated: OverrideRecord = {
      ...rec,
      outcome: input.outcome,
      outcomeNote: input.note,
    };
    this.overrides.set(rec.overrideId, updated);
    this.outcomeHistory = [
      ...this.outcomeHistory,
      {
        overrideId: rec.overrideId,
        outcome: input.outcome,
        note: input.note,
        timestamp: input.now,
      },
    ];
    return updated;
  }

  listByCase(caseId: string): readonly OverrideRecord[] {
    return Array.from(this.overrides.values())
      .filter((o) => o.caseId === caseId)
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }

  listByReviewer(reviewerId: string): readonly OverrideRecord[] {
    return Array.from(this.overrides.values())
      .filter((o) => o.reviewerId === reviewerId)
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }

  all(): readonly OverrideRecord[] {
    return Array.from(this.overrides.values());
  }

  history(): typeof this.outcomeHistory {
    return this.outcomeHistory;
  }
}

function clampSigned(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}
