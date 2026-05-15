/**
 * CollaborativeEvidenceReview.
 *
 * Evidence review history is APPEND-ONLY. Reliability adjustments accumulate
 * as deltas, never as silent overwrites of the underlying evidence reliability.
 * The original evidence is never mutated — review entries form a separate
 * layered ledger that callers can fold into a reliability view.
 */

import { makeId } from "./hash.js";
import type { EvidenceReviewEntry, EvidenceReviewKind } from "./types.js";

export interface RecordEvidenceReviewInput {
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

export interface EffectiveReliability {
  evidenceId: string;
  baselineReliability: number;
  effectiveReliability: number;
  deltas: ReadonlyArray<{
    reviewId: string;
    reviewerId: string;
    delta: number;
    rationale: string;
    timestamp: string;
  }>;
  ambiguityMarkers: readonly string[];
}

export class CollaborativeEvidenceReview {
  private entries: EvidenceReviewEntry[] = [];

  record(input: RecordEvidenceReviewInput): EvidenceReviewEntry {
    if (!input.rationale.trim()) {
      throw new Error("evidence_review_missing_rationale");
    }
    if (input.kind === "reliability_adjust") {
      if (
        input.reliabilityDelta === undefined ||
        !Number.isFinite(input.reliabilityDelta)
      ) {
        throw new Error("evidence_review_reliability_delta_required");
      }
    }
    if (input.kind === "counter_evidence") {
      if (!input.counterEvidenceIds || input.counterEvidenceIds.length === 0) {
        throw new Error("evidence_review_counter_evidence_required");
      }
    }
    const reviewId = makeId(
      "rev",
      input.caseId,
      input.evidenceId,
      input.reviewerId,
      input.kind,
      input.now,
    );
    const entry: EvidenceReviewEntry = {
      reviewId,
      caseId: input.caseId,
      evidenceId: input.evidenceId,
      reviewerId: input.reviewerId,
      kind: input.kind,
      rationale: input.rationale,
      reliabilityDelta:
        input.kind === "reliability_adjust"
          ? clampSigned(input.reliabilityDelta ?? 0)
          : null,
      counterEvidenceIds: [...(input.counterEvidenceIds ?? [])],
      ambiguityMarkers: [...(input.ambiguityMarkers ?? [])],
      timestamp: input.now,
    };
    this.entries.push(entry);
    return entry;
  }

  listByEvidence(evidenceId: string): readonly EvidenceReviewEntry[] {
    return this.entries
      .filter((e) => e.evidenceId === evidenceId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  listByCase(caseId: string): readonly EvidenceReviewEntry[] {
    return this.entries
      .filter((e) => e.caseId === caseId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  all(): readonly EvidenceReviewEntry[] {
    return this.entries.slice();
  }

  /**
   * Fold reliability deltas into an effective view. The baseline is supplied
   * by the caller (from the ingestion layer) — the engine never invents one.
   */
  effectiveReliabilityFor(
    evidenceId: string,
    baselineReliability: number,
  ): EffectiveReliability {
    const reviews = this.listByEvidence(evidenceId);
    let eff = baselineReliability;
    const deltas: EffectiveReliability["deltas"] = reviews
      .filter((r) => r.kind === "reliability_adjust" && r.reliabilityDelta !== null)
      .map((r) => ({
        reviewId: r.reviewId,
        reviewerId: r.reviewerId,
        delta: r.reliabilityDelta as number,
        rationale: r.rationale,
        timestamp: r.timestamp,
      }));
    for (const d of deltas) {
      eff = clamp01(eff + d.delta);
    }
    const ambiguityMarkers = Array.from(
      new Set(reviews.flatMap((r) => r.ambiguityMarkers)),
    ).sort();
    return {
      evidenceId,
      baselineReliability: clamp01(baselineReliability),
      effectiveReliability: eff,
      deltas,
      ambiguityMarkers,
    };
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampSigned(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}
