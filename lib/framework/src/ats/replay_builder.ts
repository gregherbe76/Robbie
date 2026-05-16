/**
 * HiringDecisionReplayBuilder.
 *
 * Takes the raw record stream from an adapter, runs normalization,
 * derives disagreement / escalation / override structure, computes
 * a rolling confidence trajectory, and emits a signed
 * `HiringDecisionReplay`.
 *
 * Determinism is critical: the same input MUST produce a byte-stable
 * replay (and therefore signature) across runtimes. All sorts use
 * stable keys; all timestamps are pass-through from the source.
 */

import type {
  ATSRawRecord,
  HiringDecisionReplay,
  HiringOutcome,
  NormalizedEvidence,
  ReviewerDisagreement,
  EscalationMoment,
  OverrideMoment,
  ConfidencePoint,
} from "./types.js";
import { listReviewers, normalizeATSRecords, NORMALIZATION_VERSION } from "./normalization.js";
import { shortSignature } from "./signature.js";

/**
 * Schema version of the canonical body that is hashed into the
 * replay signature. Bump ONLY when fields are added, removed, or
 * reordered inside `canonicalBody`. This is the forensic anchor
 * that lets future readers distinguish "the inputs evolved" from
 * "the contract evolved" when signatures move.
 */
export const CANONICAL_BODY_VERSION = 1 as const;

/**
 * Semantic version of `buildHiringDecisionReplay`. Bumped when the
 * derivation logic (disagreement clustering, escalation/override
 * detection, trajectory math, resolution semantics) changes in a way
 * that alters the canonical body for the same inputs.
 */
export const REPLAY_BUILDER_VERSION = 1 as const;

export interface ReplayBuildOptions {
  connectionId: string;
  candidateAtsId: string;
  /** Override ingestion timestamp for determinism in tests. */
  ingestedAt?: string;
}

interface CandidateMeta {
  candidateName: string;
  targetRole: string;
  organization: string;
  openedAt: string;
}

function extractCandidateMeta(records: ATSRawRecord[]): CandidateMeta {
  const candidate = records.find((r) => r.kind === "candidate");
  const application = records.find((r) => r.kind === "application");
  const cp = candidate?.payload as { name?: string } | undefined;
  const ap = application?.payload as
    | { role?: string; organization?: string; stage?: string }
    | undefined;
  return {
    candidateName: cp?.name ?? "Unknown candidate",
    targetRole: ap?.role ?? "Unknown role",
    organization: ap?.organization ?? "Unknown organization",
    openedAt: application?.occurredAt ?? candidate?.occurredAt ?? new Date(0).toISOString(),
  };
}

function extractOutcome(records: ATSRawRecord[]): {
  outcome: HiringOutcome;
  closedAt?: string;
} {
  const decision = records.find((r) => r.kind === "decision");
  const p = decision?.payload as { outcome?: string } | undefined;
  const occurredAt = decision?.occurredAt;
  if (!p?.outcome) return { outcome: "open" };
  const o = p.outcome.toLowerCase();
  if (o === "hired") return { outcome: "hired", closedAt: occurredAt };
  if (o === "declined" || o === "rejected")
    return { outcome: "declined", closedAt: occurredAt };
  if (o === "withdrawn") return { outcome: "withdrawn", closedAt: occurredAt };
  return { outcome: "open" };
}

/**
 * Pair up reviewer assessments on the same topic with significantly
 * divergent scores. Threshold 0.25 on the [0,1] normalized scale
 * means roughly a full point of disagreement on a 1–5 scale.
 */
function buildDisagreements(
  evidence: NormalizedEvidence[],
): ReviewerDisagreement[] {
  const byTopic = new Map<string, NormalizedEvidence[]>();
  for (const e of evidence) {
    if (
      e.kind !== "reviewer_assessment" ||
      !e.topic ||
      typeof e.assessmentScore !== "number"
    ) {
      continue;
    }
    const list = byTopic.get(e.topic) ?? [];
    list.push(e);
    byTopic.set(e.topic, list);
  }

  const out: ReviewerDisagreement[] = [];
  for (const [topic, items] of byTopic) {
    if (items.length < 2) continue;
    const sorted = [...items].sort(
      (a, b) => (b.assessmentScore ?? 0) - (a.assessmentScore ?? 0),
    );
    const high = sorted[0]!;
    const low = sorted[sorted.length - 1]!;
    if (!high.reviewer || !low.reviewer) continue;
    if (high.reviewer.id === low.reviewer.id) continue;
    const spread = (high.assessmentScore ?? 0) - (low.assessmentScore ?? 0);
    // Use a small epsilon so spreads that are exactly 0.2 in
    // intent but 0.1999… after float arithmetic still register.
    if (spread < 0.19) continue;
    const reviewers = Array.from(
      new Map(
        items
          .filter((i) => i.reviewer)
          .map((i) => [i.reviewer!.id, i.reviewer!] as const),
      ).values(),
    ).sort((a, b) => a.id.localeCompare(b.id));
    out.push({
      id: `dis_${topic}_${high.reviewer.id}_vs_${low.reviewer.id}`,
      topic,
      reviewers,
      spread: Number(spread.toFixed(3)),
      high: {
        reviewerId: high.reviewer.id,
        score: high.assessmentScore ?? 0,
        summary: high.summary,
      },
      low: {
        reviewerId: low.reviewer.id,
        score: low.assessmentScore ?? 0,
        summary: low.summary,
      },
      resolution: "unresolved",
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function buildEscalations(evidence: NormalizedEvidence[]): EscalationMoment[] {
  const classify = (e: NormalizedEvidence): EscalationMoment["trigger"] => {
    if (e.sourceKind === "interview_kit") return "additional-loop";
    const s = e.summary.toLowerCase();
    if (s.includes("founder")) return "founder-intervention";
    if (s.includes("bar")) return "bar-recalibration";
    return "hiring-manager-intervention";
  };
  return evidence
    .filter((e) => e.kind === "escalation_signal")
    .map<EscalationMoment>((e) => ({
      id: `esc_${e.sourceAtsId}`,
      occurredAt: e.occurredAt,
      trigger: classify(e),
      summary: e.summary,
      evidenceIds: [e.id],
    }))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

function buildOverrides(evidence: NormalizedEvidence[]): OverrideMoment[] {
  return evidence
    .filter((e) => e.kind === "override_signal")
    .map((e) => ({
      id: `ovr_${e.sourceAtsId}`,
      occurredAt: e.occurredAt,
      byReviewerId: e.reviewer?.id ?? "unknown",
      overrides: e.summary.toLowerCase().includes("decline")
        ? ("decline" as const)
        : ("advance" as const),
      rationale: e.detail ?? e.summary,
      evidenceIds: [e.id],
    }));
}

/**
 * Naive but deterministic rolling estimate: at each reviewer
 * assessment, update a Beta-style mean against a uniform prior. Any
 * reviewer_assessment with a numeric assessmentScore contributes.
 */
function buildConfidenceTrajectory(
  evidence: NormalizedEvidence[],
): ConfidencePoint[] {
  let alpha = 1;
  let beta = 1;
  const points: ConfidencePoint[] = [];
  for (const e of evidence) {
    if (e.kind !== "reviewer_assessment" || typeof e.assessmentScore !== "number")
      continue;
    if (e.topic !== "overall") continue;
    const s = e.assessmentScore;
    alpha += s;
    beta += 1 - s;
    points.push({
      occurredAt: e.occurredAt,
      estimate: Number((alpha / (alpha + beta)).toFixed(3)),
      evidenceIds: [e.id],
    });
  }
  return points;
}

function buildUnresolvedTensions(
  disagreements: ReviewerDisagreement[],
  outcome: HiringOutcome,
): string[] {
  return disagreements
    .filter((d) => d.resolution === "unresolved")
    .map(
      (d) =>
        `${d.topic}: spread ${d.spread.toFixed(2)} between ${d.high.reviewerId} and ${d.low.reviewerId}` +
        (outcome === "hired" ? " — resolved by hire, not by consensus" : ""),
    );
}

export function buildHiringDecisionReplay(
  records: ATSRawRecord[],
  opts: ReplayBuildOptions,
): HiringDecisionReplay {
  const provider = records[0]?.provider ?? "synthetic";
  const ingestedAt = opts.ingestedAt ?? new Date().toISOString();
  const evidence = normalizeATSRecords(records, ingestedAt);
  const meta = extractCandidateMeta(records);
  const outcome = extractOutcome(records);
  const disagreements = buildDisagreements(evidence);
  const escalations = buildEscalations(evidence);
  const overrides = buildOverrides(evidence);

  // When an override exists and the candidate was hired, mark every
  // disagreement as resolved-by-override (rather than by consensus)
  // and anchor the resolution timestamp to the hire moment. This is
  // the observable behaviour we want today; per-disagreement temporal
  // pairing against specific overrides is intentionally deferred
  // until override records carry a topic affinity field. When that
  // arrives, bump REPLAY_BUILDER_VERSION.
  if (overrides.length > 0 && outcome.outcome === "hired") {
    for (const d of disagreements) {
      d.resolution = "override";
      d.resolvedAt = outcome.closedAt;
    }
  }

  const trajectory = buildConfidenceTrajectory(evidence);
  const unresolved = buildUnresolvedTensions(disagreements, outcome.outcome);
  const reviewers = listReviewers(records);

  const replayId = `replay_${provider}_${opts.candidateAtsId}`;

  // Canonical body for signing: everything that materially defines
  // the replay. We omit `signature` itself. The three `*Version`
  // fields are INSIDE the signed body on purpose — a signature is
  // therefore an audit-grade commitment to a specific schema +
  // builder + normalization contract.
  const canonicalBody = {
    canonicalBodyVersion: CANONICAL_BODY_VERSION as number,
    replayBuilderVersion: REPLAY_BUILDER_VERSION as number,
    normalizationVersion: NORMALIZATION_VERSION as number,
    id: replayId,
    connectionId: opts.connectionId,
    provider,
    candidateAtsId: opts.candidateAtsId,
    candidateName: meta.candidateName,
    targetRole: meta.targetRole,
    organization: meta.organization,
    openedAt: meta.openedAt,
    closedAt: outcome.closedAt,
    outcome: outcome.outcome,
    reviewers,
    evidence,
    disagreements,
    escalations,
    overrides,
    confidenceTrajectory: trajectory,
    unresolvedTensions: unresolved,
  };

  const signature = shortSignature(canonicalBody);

  return {
    ...canonicalBody,
    signature,
  };
}
