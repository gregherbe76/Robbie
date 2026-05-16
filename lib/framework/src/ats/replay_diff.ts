/**
 * ReplayDiffEngine.
 *
 * Compute a structured diff between two HiringDecisionReplays.
 * The output is deterministic, append-free, and audit-friendly — it
 * describes how two reasoning traces differ in shape, not in tone.
 *
 * The diff is intentionally descriptive: it does not say "this hire
 * was better." It says "this hire produced more disagreement,"
 * "the calibration delta is +0.4 in the advance direction," etc.
 *
 * Used by `GET /ats/compare` and by the public `/ats-compare` page
 * to drive the side-by-side narrative.
 */

import type { HiringDecisionReplay } from "./types.js";

export type DiffTone = "neutral" | "left-heavy" | "right-heavy" | "even";

export interface CountDelta {
  label: string;
  left: number;
  right: number;
  delta: number;
  tone: DiffTone;
}

export interface TrajectoryDelta {
  /** Final claimed estimate, replay A. */
  leftFinal: number;
  /** Final claimed estimate, replay B. */
  rightFinal: number;
  /** Peak-to-trough swing on replay A. */
  leftVolatility: number;
  /** Peak-to-trough swing on replay B. */
  rightVolatility: number;
}

export interface ReplayDiff {
  left: { id: string; signature: string; outcome: string };
  right: { id: string; signature: string; outcome: string };
  /** Reviewer ids present on both replays. */
  commonReviewers: string[];
  /** Reviewer ids only on the left replay. */
  leftOnlyReviewers: string[];
  /** Reviewer ids only on the right replay. */
  rightOnlyReviewers: string[];
  /** Outcome alignment — same / different / one-open. */
  outcomeAlignment: "same" | "different" | "one-open";
  counts: CountDelta[];
  trajectory: TrajectoryDelta;
  /**
   * Short, plain-language summary of the shape difference. Always
   * descriptive — never normative. Safe to render verbatim in the UI.
   */
  headline: string;
  /** When the diff was computed. */
  computedAt: string;
}

function tone(left: number, right: number): DiffTone {
  if (left === right) return "even";
  if (left > right) return "left-heavy";
  return "right-heavy";
}

function volatility(replay: HiringDecisionReplay): number {
  const traj = replay.confidenceTrajectory;
  if (traj.length === 0) return 0;
  let min = traj[0]!.estimate;
  let max = traj[0]!.estimate;
  for (const p of traj) {
    if (p.estimate < min) min = p.estimate;
    if (p.estimate > max) max = p.estimate;
  }
  return Number((max - min).toFixed(3));
}

function final(replay: HiringDecisionReplay): number {
  const traj = replay.confidenceTrajectory;
  if (traj.length === 0) return 0;
  return Number(traj[traj.length - 1]!.estimate.toFixed(3));
}

function deltaCount(
  label: string,
  left: number,
  right: number,
): CountDelta {
  return {
    label,
    left,
    right,
    delta: left - right,
    tone: tone(left, right),
  };
}

function makeHeadline(
  a: HiringDecisionReplay,
  b: HiringDecisionReplay,
  alignment: ReplayDiff["outcomeAlignment"],
): string {
  const dDis = a.disagreements.length - b.disagreements.length;
  const dEsc = a.escalations.length - b.escalations.length;
  const dOvr = a.overrides.length - b.overrides.length;
  const parts: string[] = [];
  if (alignment === "different") {
    parts.push(
      `Outcomes diverge (${a.outcome} vs ${b.outcome}); the reasoning shapes do too.`,
    );
  } else if (alignment === "same") {
    parts.push(`Both replays end in ${a.outcome}.`);
  } else {
    parts.push("One replay is still open.");
  }
  if (dOvr !== 0) {
    parts.push(
      `${dOvr > 0 ? a.candidateName : b.candidateName} carries ${Math.abs(dOvr)} more override${Math.abs(dOvr) === 1 ? "" : "s"}.`,
    );
  }
  if (dDis !== 0) {
    parts.push(
      `${dDis > 0 ? a.candidateName : b.candidateName} carries ${Math.abs(dDis)} more reviewer disagreement${Math.abs(dDis) === 1 ? "" : "s"}.`,
    );
  }
  if (dEsc !== 0) {
    parts.push(
      `${dEsc > 0 ? a.candidateName : b.candidateName} required ${Math.abs(dEsc)} more escalation${Math.abs(dEsc) === 1 ? "" : "s"}.`,
    );
  }
  return parts.join(" ");
}

export function buildReplayDiff(
  a: HiringDecisionReplay,
  b: HiringDecisionReplay,
): ReplayDiff {
  const aRev = new Set(a.reviewers.map((r) => r.id));
  const bRev = new Set(b.reviewers.map((r) => r.id));
  const common = [...aRev].filter((id) => bRev.has(id)).sort();
  const leftOnly = [...aRev].filter((id) => !bRev.has(id)).sort();
  const rightOnly = [...bRev].filter((id) => !aRev.has(id)).sort();

  const alignment: ReplayDiff["outcomeAlignment"] =
    a.outcome === "open" || b.outcome === "open"
      ? "one-open"
      : a.outcome === b.outcome
        ? "same"
        : "different";

  return {
    left: { id: a.id, signature: a.signature, outcome: a.outcome },
    right: { id: b.id, signature: b.signature, outcome: b.outcome },
    commonReviewers: common,
    leftOnlyReviewers: leftOnly,
    rightOnlyReviewers: rightOnly,
    outcomeAlignment: alignment,
    counts: [
      deltaCount("evidence", a.evidence.length, b.evidence.length),
      deltaCount(
        "disagreements",
        a.disagreements.length,
        b.disagreements.length,
      ),
      deltaCount("escalations", a.escalations.length, b.escalations.length),
      deltaCount("overrides", a.overrides.length, b.overrides.length),
      deltaCount(
        "unresolvedTensions",
        a.unresolvedTensions.length,
        b.unresolvedTensions.length,
      ),
    ],
    trajectory: {
      leftFinal: final(a),
      rightFinal: final(b),
      leftVolatility: volatility(a),
      rightVolatility: volatility(b),
    },
    headline: makeHeadline(a, b, alignment),
    computedAt: new Date(0).toISOString(),
  };
}
