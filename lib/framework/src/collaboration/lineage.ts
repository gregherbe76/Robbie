/**
 * DecisionLineageTracker.
 *
 * Builds the full evolution of a collaborative decision as a replayable
 * timeline. The tracker is a pure projection over the underlying engines —
 * it does not invent events. Given the same inputs, it always produces the
 * same timeline.
 */

import { makeId } from "./hash.js";
import type {
  CollaborativeCase,
  DecisionLineageEdge,
  DecisionLineageNode,
  DecisionTimeline,
  Disagreement,
  EvidenceReviewEntry,
  LineageEventKind,
  OverrideRecord,
  ReviewerAction,
} from "./types.js";

export interface BuildTimelineInput {
  case: CollaborativeCase;
  actions: readonly ReviewerAction[];
  evidenceReviews: readonly EvidenceReviewEntry[];
  disagreements: readonly Disagreement[];
  overrides: readonly OverrideRecord[];
}

export class DecisionLineageTracker {
  buildTimeline(input: BuildTimelineInput): DecisionTimeline {
    const nodes: DecisionLineageNode[] = [];

    const push = (
      kind: LineageEventKind,
      actorId: string,
      summary: string,
      timestamp: string,
      derivedFrom: readonly string[],
      confidenceAfter: number | null,
      disagreementSeverityAfter: number | null,
    ) => {
      nodes.push({
        nodeId: makeId("ln", input.case.caseId, kind, actorId, summary, timestamp),
        caseId: input.case.caseId,
        kind,
        actorId,
        summary,
        confidenceAfter,
        disagreementSeverityAfter,
        derivedFrom: [...derivedFrom],
        timestamp,
      });
    };

    // Anchoring cognition output, if any.
    const anchor = input.case.anchoringRecommendation;
    if (anchor) {
      push(
        "cognition_output",
        "framework.cognition",
        `recommendation ${anchor.recommendationId}: ${anchor.summary}`,
        input.case.openedAt,
        [anchor.recommendationId],
        anchor.confidence,
        null,
      );
    }

    for (const a of input.actions) {
      push(
        "reviewer_action",
        a.reviewerId,
        `${a.kind} on ${a.target.kind}:${a.target.id} — ${a.rationale}`,
        a.timestamp,
        a.derivedFrom,
        a.confidence,
        null,
      );
    }

    for (const e of input.evidenceReviews) {
      push(
        "evidence_review",
        e.reviewerId,
        `${e.kind} on ${e.evidenceId} — ${e.rationale}`,
        e.timestamp,
        [e.evidenceId],
        null,
        null,
      );
    }

    for (const d of input.disagreements) {
      // open
      const openedAt = d.positions.reduce<string>((min, p) => {
        return min === "" || p.recordedAt < min ? p.recordedAt : min;
      }, "");
      push(
        "disagreement_opened",
        "collaboration.disagreement",
        `${d.topic} — ${d.positions.length} positions`,
        openedAt,
        d.positions.map((p) => p.positionId),
        null,
        d.severityScore,
      );
      if (d.resolvedAt) {
        push(
          "disagreement_resolved",
          "collaboration.disagreement",
          d.resolutionSummary ?? "resolved",
          d.resolvedAt,
          [d.disagreementId],
          null,
          0,
        );
      }
    }

    for (const o of input.overrides) {
      push(
        "override",
        o.reviewerId,
        `${o.direction} on ${o.affectedRecommendationId} — ${o.reason}`,
        o.issuedAt,
        [o.affectedRecommendationId],
        o.confidenceImpact,
        null,
      );
    }

    for (const esc of input.case.escalations) {
      push(
        "escalation",
        esc.fromReviewerId,
        `escalated to ${esc.toReviewerId} — ${esc.reason}`,
        esc.raisedAt,
        [esc.escalationId],
        null,
        null,
      );
    }

    if (input.case.state === "consensus_reached") {
      push(
        "consensus_reached",
        "collaboration.case",
        `case ${input.case.caseId} reached consensus`,
        input.case.lastUpdatedAt,
        [input.case.caseId],
        null,
        0,
      );
    }

    nodes.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Edges: chain in temporal order, plus typed relations between disagreement
    // pairs and their resolution.
    const edges: DecisionLineageEdge[] = [];
    for (let i = 1; i < nodes.length; i++) {
      edges.push({
        fromNodeId: nodes[i - 1]!.nodeId,
        toNodeId: nodes[i]!.nodeId,
        relation: "informed",
      });
    }
    // Pair open → resolved disagreement nodes.
    const openMap = new Map<string, string>();
    for (const n of nodes) {
      if (n.kind === "disagreement_opened") openMap.set(n.summary, n.nodeId);
      if (n.kind === "disagreement_resolved") {
        for (const [, openedId] of openMap) {
          edges.push({ fromNodeId: openedId, toNodeId: n.nodeId, relation: "resolved" });
        }
      }
    }
    // Override → cognition output edges (override contradicted cognition).
    const cognitionNodes = nodes.filter((n) => n.kind === "cognition_output");
    const overrideNodes = nodes.filter((n) => n.kind === "override");
    for (const c of cognitionNodes) {
      for (const o of overrideNodes) {
        edges.push({ fromNodeId: c.nodeId, toNodeId: o.nodeId, relation: "contradicted" });
      }
    }

    const confidenceSeries = nodes
      .filter((n) => n.confidenceAfter !== null)
      .map((n) => ({ timestamp: n.timestamp, value: n.confidenceAfter as number }));
    const disagreementSeries = nodes
      .filter((n) => n.disagreementSeverityAfter !== null)
      .map((n) => ({ timestamp: n.timestamp, value: n.disagreementSeverityAfter as number }));

    return {
      caseId: input.case.caseId,
      nodes,
      edges,
      confidenceSeries,
      disagreementSeries,
    };
  }
}
