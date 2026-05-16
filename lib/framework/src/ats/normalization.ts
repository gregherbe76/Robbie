/**
 * ATS normalization engine.
 *
 * Maps provider-specific raw records into the closed
 * `NormalizedEvidence` union. The mapper is deterministic — same
 * input always produces the same output, with stable ids and
 * provenance chains.
 *
 * IMPORTANT: this engine MUST NOT flatten reviewer disagreement.
 * Two scorecards on the same topic produce two separate
 * `reviewer_assessment` items, then a downstream pass in
 * `replay_builder.ts` emits a `contradiction_signal` derived from
 * the two — never a single averaged score.
 */

import type {
  ATSRawRecord,
  NormalizedEvidence,
  ATSReviewer,
  ATSProvider,
} from "./types.js";

/**
 * Semantic version of the normalization layer. Bump only when the
 * mapping from raw records to `NormalizedEvidence` changes in a way
 * that materially alters the canonical replay body (new evidence
 * kinds, changed topic strings, changed sort order, changed id
 * scheme, changed signal classification). Fixture/payload
 * refinements that do not change the mapping do NOT bump this.
 */
export const NORMALIZATION_VERSION = 1 as const;

interface ScorecardAttribute {
  topic?: string;
  score?: number;
  scale?: number;
  comment?: string;
}

interface ScorecardPayload {
  id?: string;
  interviewId?: string;
  submitter?: string;
  submittedBy?: string | { id?: string; firstName?: string; lastName?: string };
  overall?: { value?: string; score?: number; scale?: number } | string;
  attributes?: ScorecardAttribute[];
  ratings?: ScorecardAttribute[];
  confidence?: number;
}

interface DecisionPayload {
  outcome?: string;
  decidedBy?: string;
  overrideRationale?: string;
  dissentingReviewers?: string[];
}

interface NotePayload {
  author?: string;
  body?: string;
}

interface InterviewKitPayload {
  addedBy?: string;
  reason?: string;
  addedInterview?: string;
}

function reviewerFromPayload(
  ref: unknown,
  reviewerMap: Map<string, ATSReviewer>,
): ATSReviewer | undefined {
  if (!ref) return undefined;
  if (typeof ref === "string") return reviewerMap.get(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : undefined;
    if (id && reviewerMap.has(id)) return reviewerMap.get(id);
    if (id) {
      const fn = typeof obj.firstName === "string" ? obj.firstName : "";
      const ln = typeof obj.lastName === "string" ? obj.lastName : "";
      return {
        id,
        displayName: `${fn} ${ln}`.trim() || id,
      };
    }
  }
  return undefined;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normaliseScore(score?: number, scale?: number): number | undefined {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;
  const s = typeof scale === "number" && scale > 0 ? scale : 5;
  return clamp01(score / s);
}

function classifyOverall(overall: ScorecardPayload["overall"]): {
  score?: number;
  label: string;
} {
  if (!overall) return { label: "no-overall" };
  if (typeof overall === "string") return { label: overall };
  const score = normaliseScore(overall.score, overall.scale);
  return { score, label: overall.value ?? "scored" };
}

/**
 * Build a lookup of reviewer records from any "reviewer" rows.
 */
function buildReviewerMap(records: ATSRawRecord[]): Map<string, ATSReviewer> {
  const out = new Map<string, ATSReviewer>();
  for (const r of records) {
    if (r.kind !== "reviewer") continue;
    const p = r.payload as { id?: string; name?: string; role?: string };
    if (typeof p?.id === "string") {
      out.set(p.id, {
        id: p.id,
        displayName: p.name ?? p.id,
        role: p.role,
      });
    }
  }
  return out;
}

interface NormalizationContext {
  provider: ATSProvider;
  reviewerMap: Map<string, ATSReviewer>;
  ingestedAt: string;
}

function evidenceId(ctx: NormalizationContext, record: ATSRawRecord, idx = 0): string {
  return `${ctx.provider}:${record.atsId}#${idx}`;
}

function normalizeScorecard(
  ctx: NormalizationContext,
  record: ATSRawRecord,
): NormalizedEvidence[] {
  const payload = record.payload as ScorecardPayload;
  const reviewer = reviewerFromPayload(
    payload.submitter ?? payload.submittedBy,
    ctx.reviewerMap,
  );
  const attributes = payload.attributes ?? payload.ratings ?? [];
  const occurredAt = record.occurredAt ?? record.fetchedAt;
  const provenance = [record.atsId, ...(record.parentIds ?? [])];
  const out: NormalizedEvidence[] = [];

  const overall = classifyOverall(payload.overall);
  out.push({
    id: evidenceId(ctx, record, 0),
    kind: "reviewer_assessment",
    provider: ctx.provider,
    sourceAtsId: record.atsId,
    sourceKind: "scorecard",
    reviewer,
    summary: reviewer
      ? `${reviewer.displayName} → ${overall.label}`
      : `Scorecard → ${overall.label}`,
    detail:
      typeof payload.overall === "object"
        ? `Overall ${payload.overall.score}/${payload.overall.scale} (${overall.label})`
        : overall.label,
    occurredAt,
    ingestedAt: ctx.ingestedAt,
    payloadHash: record.payloadHash,
    provenanceChain: provenance,
    reviewerConfidence:
      typeof payload.confidence === "number"
        ? clamp01(payload.confidence)
        : undefined,
    assessmentScore: overall.score,
    topic: "overall",
  });

  attributes.forEach((attr, i) => {
    if (!attr.topic) return;
    out.push({
      id: evidenceId(ctx, record, i + 1),
      kind: "reviewer_assessment",
      provider: ctx.provider,
      sourceAtsId: record.atsId,
      sourceKind: "scorecard",
      reviewer,
      summary: reviewer
        ? `${reviewer.displayName} on ${attr.topic}: ${attr.score ?? "?"}/${attr.scale ?? 5}`
        : `${attr.topic}: ${attr.score ?? "?"}/${attr.scale ?? 5}`,
      detail: attr.comment,
      occurredAt,
      ingestedAt: ctx.ingestedAt,
      payloadHash: record.payloadHash,
      provenanceChain: provenance,
      assessmentScore: normaliseScore(attr.score, attr.scale),
      topic: attr.topic,
    });
  });
  return out;
}

function normalizeDecision(
  ctx: NormalizationContext,
  record: ATSRawRecord,
): NormalizedEvidence[] {
  const payload = record.payload as DecisionPayload;
  const reviewer = payload.decidedBy
    ? reviewerFromPayload(payload.decidedBy, ctx.reviewerMap)
    : undefined;
  const occurredAt = record.occurredAt ?? record.fetchedAt;
  const provenance = [record.atsId, ...(record.parentIds ?? [])];
  const out: NormalizedEvidence[] = [];

  out.push({
    id: evidenceId(ctx, record, 0),
    kind: "explicit_claim",
    provider: ctx.provider,
    sourceAtsId: record.atsId,
    sourceKind: "decision",
    reviewer,
    summary: `Decision: ${payload.outcome ?? "unknown"}`,
    detail: payload.overrideRationale,
    occurredAt,
    ingestedAt: ctx.ingestedAt,
    payloadHash: record.payloadHash,
    provenanceChain: provenance,
    topic: "decision",
  });

  if (
    payload.overrideRationale &&
    payload.dissentingReviewers &&
    payload.dissentingReviewers.length > 0
  ) {
    out.push({
      id: evidenceId(ctx, record, 1),
      kind: "override_signal",
      provider: ctx.provider,
      sourceAtsId: record.atsId,
      sourceKind: "decision",
      reviewer,
      summary: `Override over dissent from ${payload.dissentingReviewers.length} reviewer(s)`,
      detail: payload.overrideRationale,
      occurredAt,
      ingestedAt: ctx.ingestedAt,
      payloadHash: record.payloadHash,
      provenanceChain: provenance,
      topic: "override",
    });
  }
  return out;
}

function normalizeKit(
  ctx: NormalizationContext,
  record: ATSRawRecord,
): NormalizedEvidence[] {
  const payload = record.payload as InterviewKitPayload;
  const reviewer = reviewerFromPayload(payload.addedBy, ctx.reviewerMap);
  return [
    {
      id: evidenceId(ctx, record, 0),
      kind: "escalation_signal",
      provider: ctx.provider,
      sourceAtsId: record.atsId,
      sourceKind: "interview_kit",
      reviewer,
      summary: "Loop extended — additional interview added",
      detail: payload.reason,
      occurredAt: record.occurredAt ?? record.fetchedAt,
      ingestedAt: ctx.ingestedAt,
      payloadHash: record.payloadHash,
      provenanceChain: [record.atsId, ...(record.parentIds ?? [])],
      topic: "escalation",
    },
  ];
}

function normalizeNote(
  ctx: NormalizationContext,
  record: ATSRawRecord,
): NormalizedEvidence[] {
  const payload = record.payload as NotePayload;
  const reviewer = reviewerFromPayload(payload.author, ctx.reviewerMap);
  const body = payload.body ?? "";
  const looksLikeUncertainty = /uncertain|unsure|not sure|hesitant|on the fence/i.test(
    body,
  );
  const looksLikeOverride = /lower (the )?bar|founder energy|exception|despite|override/i.test(
    body,
  );
  const kind: NormalizedEvidence["kind"] = looksLikeOverride
    ? "escalation_signal"
    : looksLikeUncertainty
      ? "uncertainty_signal"
      : "explicit_claim";
  return [
    {
      id: evidenceId(ctx, record, 0),
      kind,
      provider: ctx.provider,
      sourceAtsId: record.atsId,
      sourceKind: "note",
      reviewer,
      summary: body.slice(0, 140),
      detail: body,
      occurredAt: record.occurredAt ?? record.fetchedAt,
      ingestedAt: ctx.ingestedAt,
      payloadHash: record.payloadHash,
      provenanceChain: [record.atsId, ...(record.parentIds ?? [])],
      topic: "note",
    },
  ];
}

/**
 * Map a batch of raw records into normalized evidence. Records that
 * have no normalization rule (candidate, application, interview,
 * activity, approval) are skipped — they are still preserved in the
 * event store as raw `evidence.ingested` events by the gateway.
 */
export function normalizeATSRecords(
  records: ATSRawRecord[],
  ingestedAt: string = new Date().toISOString(),
): NormalizedEvidence[] {
  const provider = records[0]?.provider ?? "synthetic";
  const ctx: NormalizationContext = {
    provider,
    reviewerMap: buildReviewerMap(records),
    ingestedAt,
  };
  const out: NormalizedEvidence[] = [];
  for (const r of records) {
    switch (r.kind) {
      case "scorecard":
      case "feedback":
        out.push(...normalizeScorecard(ctx, r));
        break;
      case "decision":
        out.push(...normalizeDecision(ctx, r));
        break;
      case "interview_kit":
        out.push(...normalizeKit(ctx, r));
        break;
      case "note":
        out.push(...normalizeNote(ctx, r));
        break;
      default:
        // raw passthrough — preserved upstream as evidence.ingested
        break;
    }
  }
  out.sort((a, b) =>
    a.occurredAt === b.occurredAt
      ? a.id.localeCompare(b.id)
      : a.occurredAt.localeCompare(b.occurredAt),
  );
  return out;
}

export function listReviewers(records: ATSRawRecord[]): ATSReviewer[] {
  return Array.from(buildReviewerMap(records).values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}
