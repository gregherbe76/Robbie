/**
 * ATSReasoningReconstructionEngine.
 *
 * Builds a deterministic structural reconstruction of the reasoning
 * dynamics that played out inside a hiring decision. It does NOT
 * invent hidden reasoning — it surfaces explicit, observable
 * structure: who disagreed with whom, where confidence shifted,
 * what overrides cost.
 *
 * The output is intentionally accompanied by a caveat that the UI
 * surfaces verbatim, so consumers never confuse reconstruction with
 * mind-reading.
 */

import type {
  DisagreementClusterEdge,
  DisagreementClusterNode,
  HiringDecisionReplay,
  ReasoningReconstruction,
} from "./types.js";

const CAVEAT =
  "Reconstructed from explicit ATS operational evidence only. No hidden " +
  "reasoning is inferred. Where the evidence is silent, the reconstruction " +
  "is silent.";

export function reconstructReasoning(
  replay: HiringDecisionReplay,
): ReasoningReconstruction {
  // Disagreement graph
  const nodeMap = new Map<string, DisagreementClusterNode>();
  for (const r of replay.reviewers) {
    nodeMap.set(r.id, {
      reviewerId: r.id,
      displayName: r.displayName,
      meanScore: 0,
      topics: [],
    });
  }
  const scoresByReviewer = new Map<string, number[]>();
  const topicsByReviewer = new Map<string, Set<string>>();
  for (const e of replay.evidence) {
    if (
      e.kind !== "reviewer_assessment" ||
      !e.reviewer ||
      typeof e.assessmentScore !== "number"
    )
      continue;
    const arr = scoresByReviewer.get(e.reviewer.id) ?? [];
    arr.push(e.assessmentScore);
    scoresByReviewer.set(e.reviewer.id, arr);
    const t = topicsByReviewer.get(e.reviewer.id) ?? new Set<string>();
    if (e.topic) t.add(e.topic);
    topicsByReviewer.set(e.reviewer.id, t);
  }
  for (const [id, scores] of scoresByReviewer) {
    const node = nodeMap.get(id);
    if (!node) continue;
    node.meanScore = Number(
      (scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(3),
    );
    node.topics = Array.from(topicsByReviewer.get(id) ?? []).sort();
  }
  const nodes = Array.from(nodeMap.values()).sort((a, b) =>
    a.reviewerId.localeCompare(b.reviewerId),
  );

  const edgeMap = new Map<string, DisagreementClusterEdge>();
  for (const d of replay.disagreements) {
    const a = d.high.reviewerId < d.low.reviewerId ? d.high.reviewerId : d.low.reviewerId;
    const b = d.high.reviewerId < d.low.reviewerId ? d.low.reviewerId : d.high.reviewerId;
    const key = `${a}__${b}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.weight = Math.max(existing.weight, d.spread);
      if (!existing.topics.includes(d.topic)) existing.topics.push(d.topic);
    } else {
      edgeMap.set(key, {
        from: a,
        to: b,
        weight: d.spread,
        topics: [d.topic],
      });
    }
  }
  const edges = Array.from(edgeMap.values()).sort((a, b) =>
    `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`),
  );

  // Escalation patterns
  const escalationPatterns = replay.escalations.map((e) => ({
    pattern: e.trigger,
    occurredAt: e.occurredAt,
    evidenceIds: e.evidenceIds,
  }));

  // Confidence shifts — diff successive trajectory points and surface
  // the biggest jumps (|delta| ≥ 0.05).
  const confidenceShifts: ReasoningReconstruction["confidenceShifts"] = [];
  for (let i = 1; i < replay.confidenceTrajectory.length; i += 1) {
    const prev = replay.confidenceTrajectory[i - 1]!;
    const curr = replay.confidenceTrajectory[i]!;
    const delta = curr.estimate - prev.estimate;
    if (Math.abs(delta) < 0.05) continue;
    confidenceShifts.push({
      from: prev.estimate,
      to: curr.estimate,
      delta: Number(delta.toFixed(3)),
      triggerEvidenceId: curr.evidenceIds[0] ?? "",
      summary:
        delta > 0
          ? `Confidence climbed from ${prev.estimate.toFixed(2)} to ${curr.estimate.toFixed(2)}`
          : `Confidence fell from ${prev.estimate.toFixed(2)} to ${curr.estimate.toFixed(2)}`,
    });
  }

  // Override dynamics — for each override, count opposing evidence
  // before it and surface the confidence estimate at that moment.
  const overrideDynamics: ReasoningReconstruction["overrideDynamics"] =
    replay.overrides.map((ovr) => {
      const counterCount = replay.evidence.filter(
        (e) =>
          e.kind === "reviewer_assessment" &&
          typeof e.assessmentScore === "number" &&
          e.assessmentScore < 0.5 &&
          e.occurredAt <= ovr.occurredAt,
      ).length;
      const cp = replay.confidenceTrajectory.find(
        (c) => c.occurredAt >= ovr.occurredAt,
      );
      return {
        overrideId: ovr.id,
        confidenceAtOverride: cp?.estimate ?? 0,
        counterEvidenceCount: counterCount,
        summary:
          `Override applied against ${counterCount} low-confidence assessment(s); ` +
          `rolling P(hire) estimate ${(cp?.estimate ?? 0).toFixed(2)} at time of decision.`,
      };
    });

  // Pressure points: anything where unresolved disagreement, an
  // override, and an outcome line up.
  const pressurePoints: string[] = [];
  if (replay.outcome === "hired" && replay.overrides.length > 0) {
    pressurePoints.push(
      "Hire decision settled an unresolved disagreement by override rather than consensus.",
    );
  }
  if (
    replay.disagreements.length >= 2 &&
    replay.escalations.length === 0
  ) {
    pressurePoints.push(
      "Multiple reviewer disagreements without an escalation event — bar pressure absorbed silently.",
    );
  }
  if (replay.disagreements.some((d) => d.resolution === "unresolved")) {
    pressurePoints.push(
      "At least one reviewer disagreement remained explicitly unresolved at close.",
    );
  }

  return {
    replayId: replay.id,
    disagreementGraph: { nodes, edges },
    escalationPatterns,
    confidenceShifts,
    overrideDynamics,
    pressurePoints,
    caveat: CAVEAT,
  };
}
