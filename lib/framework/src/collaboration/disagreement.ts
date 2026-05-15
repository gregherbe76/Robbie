/**
 * StructuredDisagreementEngine.
 *
 * The most important rule here: disagreements are POSITIONS, not VOTES. The
 * engine never reduces a disagreement to majority/minority or a winner. It
 * preserves every position and exposes severity, clustering, and resolution
 * as separate, optional layers.
 */

import { makeId } from "./hash.js";
import type {
  Disagreement,
  DisagreementCluster,
  DisagreementPosition,
  DisagreementSeverity,
} from "./types.js";

export interface OpenDisagreementInput {
  caseId: string;
  topic: string;
  positions: ReadonlyArray<Omit<DisagreementPosition, "positionId" | "recordedAt">>;
  /** Caller-provided severity score in [0,1]. Categorical label is derived. */
  severityScore: number;
  now: string;
}

export interface AddPositionInput {
  disagreementId: string;
  position: Omit<DisagreementPosition, "positionId" | "recordedAt">;
  now: string;
}

export class StructuredDisagreementEngine {
  private disagreements = new Map<string, Disagreement>();

  open(input: OpenDisagreementInput): Disagreement {
    if (input.positions.length < 2) {
      throw new Error("disagreement_requires_two_positions");
    }
    for (const p of input.positions) {
      if (!p.rationale || p.rationale.trim().length === 0) {
        throw new Error("disagreement_position_requires_rationale");
      }
    }
    const disagreementId = makeId("dis", input.caseId, input.topic);
    if (this.disagreements.has(disagreementId)) {
      return this.disagreements.get(disagreementId)!;
    }
    const severity = severityLabelFor(input.severityScore);
    const dis: Disagreement = {
      disagreementId,
      caseId: input.caseId,
      topic: input.topic,
      positions: input.positions.map((p) => ({
        ...p,
        confidence: clamp01(p.confidence),
        derivedFrom: [...p.derivedFrom],
        positionId: makeId(
          "pos",
          disagreementId,
          p.holderKind,
          p.holderId,
          p.stance,
        ),
        recordedAt: input.now,
      })),
      severity,
      severityScore: clamp01(input.severityScore),
      resolvedAt: null,
      resolutionSummary: null,
    };
    this.disagreements.set(disagreementId, dis);
    return dis;
  }

  addPosition(input: AddPositionInput): Disagreement {
    const dis = this.require(input.disagreementId);
    if (dis.resolvedAt) {
      throw new Error(`disagreement_already_resolved: ${dis.disagreementId}`);
    }
    if (!input.position.rationale || input.position.rationale.trim().length === 0) {
      throw new Error("disagreement_position_requires_rationale");
    }
    const positionId = makeId(
      "pos",
      dis.disagreementId,
      input.position.holderKind,
      input.position.holderId,
      input.position.stance,
    );
    if (dis.positions.some((p) => p.positionId === positionId)) {
      return dis;
    }
    const updated: Disagreement = {
      ...dis,
      positions: [
        ...dis.positions,
        {
          ...input.position,
          confidence: clamp01(input.position.confidence),
          derivedFrom: [...input.position.derivedFrom],
          positionId,
          recordedAt: input.now,
        },
      ],
    };
    this.disagreements.set(dis.disagreementId, updated);
    return updated;
  }

  resolve(disagreementId: string, summary: string, now: string): Disagreement {
    const dis = this.require(disagreementId);
    if (dis.resolvedAt) return dis;
    const updated: Disagreement = {
      ...dis,
      resolvedAt: now,
      resolutionSummary: summary,
    };
    this.disagreements.set(disagreementId, updated);
    return updated;
  }

  listByCase(caseId: string): readonly Disagreement[] {
    return Array.from(this.disagreements.values())
      .filter((d) => d.caseId === caseId)
      .sort((a, b) => a.disagreementId.localeCompare(b.disagreementId));
  }

  all(): readonly Disagreement[] {
    return Array.from(this.disagreements.values());
  }

  /**
   * Cluster disagreements by topic similarity (exact-token-prefix). Pure and
   * deterministic — the goal is to surface recurring themes, not to "solve"
   * them. Clusters are read-only views over the underlying disagreements.
   */
  cluster(): readonly DisagreementCluster[] {
    const byKey = new Map<string, string[]>();
    for (const d of this.all()) {
      const key = normalizeTopic(d.topic);
      const existing = byKey.get(key) ?? [];
      existing.push(d.disagreementId);
      byKey.set(key, existing);
    }
    return Array.from(byKey.entries())
      .filter(([, ids]) => ids.length >= 1)
      .map(([key, ids]) => ({
        clusterId: makeId("cluster", key),
        label: key,
        disagreementIds: ids.sort(),
        recurringPatternId: ids.length >= 2 ? makeId("pattern", key) : null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Active, unresolved tensions across all cases — useful for the operator
   * "what's hot right now" view.
   */
  activeTensions(): readonly Disagreement[] {
    return this.all()
      .filter((d) => d.resolvedAt === null)
      .sort((a, b) => b.severityScore - a.severityScore);
  }

  private require(id: string): Disagreement {
    const d = this.disagreements.get(id);
    if (!d) throw new Error(`disagreement_not_found: ${id}`);
    return d;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function severityLabelFor(score: number): DisagreementSeverity {
  const s = clamp01(score);
  if (s >= 0.85) return "blocking";
  if (s >= 0.6) return "major";
  if (s >= 0.3) return "moderate";
  return "minor";
}

function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
}
