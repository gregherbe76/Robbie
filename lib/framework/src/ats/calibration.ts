/**
 * ATSCalibrationLayer.
 *
 * Joins reviewer scorecards (predictions) with hiring outcomes
 * (realised results) to produce reviewer-level reliability and an
 * organization-level calibration view.
 *
 * Scope rule: this is descriptive, not prescriptive. We do not
 * judge a reviewer based on a single hire. The output is meant to
 * be inspected over many decisions; the demo runs on one synthetic
 * candidate, so the report is shown with explicit caveat.
 */

import type {
  ATSCalibrationReport,
  CalibrationBucket,
  HiringDecisionReplay,
  ReviewerReliability,
} from "./types.js";

export interface OutcomeRecord {
  candidateAtsId: string;
  /**
   * Binary realised label. "hired" + later "regretted" = label 0
   * (the org-level expected positive was the hire being a good
   * decision, which did not hold). "declined" = label 0 by
   * definition for the predict-hire task.
   */
  outcome: "hired" | "declined" | "withdrawn" | "regretted" | "succeeded";
  observedAt: string;
}

interface ReviewerAccumulator {
  predictions: number;
  sumClaimed: number;
  sumRealised: number;
  sumBrier: number;
  bucketsClaimed: number[]; // 5 buckets, [0..0.2), [0.2..0.4), ...
  bucketsRealised: number[];
  bucketsCount: number[];
  topics: Set<string>;
}

function realisedLabel(outcome: OutcomeRecord["outcome"]): number {
  // The org's claim is "this person will be a good hire."
  return outcome === "hired" || outcome === "succeeded" ? 1 : 0;
}

function bucketIndex(claimed: number): number {
  if (claimed >= 1) return 4;
  return Math.max(0, Math.min(4, Math.floor(claimed * 5)));
}

function emptyAcc(): ReviewerAccumulator {
  return {
    predictions: 0,
    sumClaimed: 0,
    sumRealised: 0,
    sumBrier: 0,
    bucketsClaimed: [0, 0, 0, 0, 0],
    bucketsRealised: [0, 0, 0, 0, 0],
    bucketsCount: [0, 0, 0, 0, 0],
    topics: new Set(),
  };
}

export function buildCalibrationReport(
  replays: HiringDecisionReplay[],
  outcomes: OutcomeRecord[],
  orgId = "demo",
): ATSCalibrationReport {
  const outcomeIndex = new Map<string, OutcomeRecord>();
  for (const o of outcomes) outcomeIndex.set(o.candidateAtsId, o);

  const accByReviewer = new Map<string, ReviewerAccumulator>();
  const acc = (id: string) => {
    let a = accByReviewer.get(id);
    if (!a) {
      a = emptyAcc();
      accByReviewer.set(id, a);
    }
    return a;
  };

  const orgBucketsClaimed = [0, 0, 0, 0, 0];
  const orgBucketsRealised = [0, 0, 0, 0, 0];
  const orgBucketsCount = [0, 0, 0, 0, 0];
  let orgTotal = 0;
  let orgSumBrier = 0;
  let orgSumClaimed = 0;
  let orgSumRealised = 0;

  for (const replay of replays) {
    const outcome = outcomeIndex.get(replay.candidateAtsId);
    if (!outcome) continue;
    const realised = realisedLabel(outcome.outcome);
    for (const e of replay.evidence) {
      if (e.kind !== "reviewer_assessment" || !e.reviewer) continue;
      if (e.topic !== "overall") continue;
      if (typeof e.assessmentScore !== "number") continue;
      const claimed = e.assessmentScore;
      const a = acc(e.reviewer.id);
      a.predictions += 1;
      a.sumClaimed += claimed;
      a.sumRealised += realised;
      a.sumBrier += (claimed - realised) ** 2;
      const bi = bucketIndex(claimed);
      a.bucketsClaimed[bi]! += claimed;
      a.bucketsRealised[bi]! += realised;
      a.bucketsCount[bi]! += 1;
      a.topics.add(e.topic);

      orgTotal += 1;
      orgSumClaimed += claimed;
      orgSumRealised += realised;
      orgSumBrier += (claimed - realised) ** 2;
      orgBucketsClaimed[bi]! += claimed;
      orgBucketsRealised[bi]! += realised;
      orgBucketsCount[bi]! += 1;
    }
  }

  const reviewerNames = new Map<string, string>();
  for (const r of replays) {
    for (const rev of r.reviewers) reviewerNames.set(rev.id, rev.displayName);
  }

  const reviewerReports: ReviewerReliability[] = Array.from(
    accByReviewer.entries(),
  )
    .map(([id, a]) => {
      const meanClaimed = a.predictions > 0 ? a.sumClaimed / a.predictions : 0;
      const meanRealized =
        a.predictions > 0 ? a.sumRealised / a.predictions : 0;
      let weightedEce = 0;
      for (let b = 0; b < 5; b += 1) {
        const n = a.bucketsCount[b]!;
        if (n === 0) continue;
        const claimed = a.bucketsClaimed[b]! / n;
        const realised = a.bucketsRealised[b]! / n;
        weightedEce += (n / a.predictions) * Math.abs(claimed - realised);
      }
      const brier = a.predictions > 0 ? a.sumBrier / a.predictions : 0;
      return {
        reviewerId: id,
        displayName: reviewerNames.get(id) ?? id,
        predictions: a.predictions,
        meanClaimed: Number(meanClaimed.toFixed(3)),
        meanRealized: Number(meanRealized.toFixed(3)),
        expectedCalibrationError: Number(weightedEce.toFixed(3)),
        brierScore: Number(brier.toFixed(3)),
        drift: Number((meanClaimed - meanRealized).toFixed(3)),
        topics: Array.from(a.topics).sort(),
      };
    })
    .sort((a, b) => a.reviewerId.localeCompare(b.reviewerId));

  const buckets: CalibrationBucket[] = [];
  for (let b = 0; b < 5; b += 1) {
    const n = orgBucketsCount[b]!;
    if (n === 0) continue;
    const claimed = orgBucketsClaimed[b]! / n;
    const actual = orgBucketsRealised[b]! / n;
    const lower = b * 0.2;
    const upper = (b + 1) * 0.2;
    buckets.push({
      range: `${lower.toFixed(2)}–${upper.toFixed(2)}`,
      lower,
      upper,
      claimed: Number(claimed.toFixed(3)),
      actual: Number(actual.toFixed(3)),
      count: n,
      overconfident: claimed - actual >= 0.15,
    });
  }

  let orgEce = 0;
  for (let b = 0; b < 5; b += 1) {
    const n = orgBucketsCount[b]!;
    if (n === 0) continue;
    const claimed = orgBucketsClaimed[b]! / n;
    const actual = orgBucketsRealised[b]! / n;
    orgEce += (n / orgTotal) * Math.abs(claimed - actual);
  }

  return {
    orgId,
    expectedCalibrationError: Number(orgEce.toFixed(3)),
    brierScore: Number((orgTotal > 0 ? orgSumBrier / orgTotal : 0).toFixed(3)),
    buckets,
    reviewers: reviewerReports,
    measuredAt: new Date(0).toISOString(),
    caveat:
      orgTotal < 30
        ? `Small sample (${orgTotal} prediction(s)). Calibration metrics are illustrative; ` +
          `meaningful reviewer reliability requires dozens of observations.`
        : "Calibration computed across all linked replays and outcomes.",
  };
}
