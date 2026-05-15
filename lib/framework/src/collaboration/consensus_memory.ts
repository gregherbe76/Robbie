/**
 * OrganizationalConsensusMemory.
 *
 * Persists how *this* organization tends to reason: which disagreements
 * recur, where biases lurk, which reviewer clusters move together, which
 * consensus patterns predict success vs failure.
 *
 * Everything in here is a derived view — it is rebuilt deterministically
 * from the underlying engines. The memory is provenance-anchored: every
 * pattern references the case ids that exemplify it.
 */

import { makeId } from "./hash.js";
import type {
  CollaborativeCase,
  ConsensusPattern,
  Disagreement,
  DisagreementCluster,
  OrganizationalReasoningMemory,
  OverrideRecord,
  ReviewerAction,
  ReviewerIdentity,
} from "./types.js";

export interface BuildMemoryInput {
  reviewers: readonly ReviewerIdentity[];
  cases: readonly CollaborativeCase[];
  actions: readonly ReviewerAction[];
  disagreements: readonly Disagreement[];
  disagreementClusters: readonly DisagreementCluster[];
  overrides: readonly OverrideRecord[];
  now: string;
}

export class OrganizationalConsensusMemoryEngine {
  build(input: BuildMemoryInput): OrganizationalReasoningMemory {
    const recurringDisagreements = input.disagreementClusters
      .filter((c) => c.recurringPatternId !== null)
      .map((c) => ({ ...c, disagreementIds: [...c.disagreementIds] }));

    // Biases: cases where the same reviewer type repeatedly held the dissenting
    // position. Provenance-anchored.
    const biasMap = new Map<string, { count: number; caseIds: Set<string> }>();
    for (const d of input.disagreements) {
      const types = d.positions
        .filter((p) => p.holderKind === "reviewer")
        .map((p) => p.holderId);
      for (const t of types) {
        const entry = biasMap.get(t) ?? { count: 0, caseIds: new Set<string>() };
        entry.count += 1;
        entry.caseIds.add(d.caseId);
        biasMap.set(t, entry);
      }
    }
    const organizationalBiases = Array.from(biasMap.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([reviewerId, v]) => ({
        biasId: makeId("bias", reviewerId),
        label: `repeated_dissent:${reviewerId}`,
        description: `reviewer ${reviewerId} held positions in ${v.count} disagreements across ${v.caseIds.size} cases`,
        confidence: Math.min(1, v.count / 5),
        derivedFrom: Array.from(v.caseIds).sort(),
      }));

    // Reviewer clusters: reviewers who agree across cases.
    const reviewerClusters = clusterReviewersByAgreement(input);

    // Success/failure consensus patterns by case state.
    const successCases = input.cases.filter((c) => c.state === "consensus_reached");
    const failureCases = input.cases.filter(
      (c) => c.state === "unresolved" || c.state === "escalation_required",
    );

    const successPatterns: ConsensusPattern[] = successCases.length
      ? [
          {
            patternId: makeId("pattern", "consensus_reached"),
            label: "consensus_via_evidence_review",
            description:
              "cases that closed with consensus_reached after substantive evidence review",
            exampleCaseIds: successCases.map((c) => c.caseId),
            agreementRate: 1,
            predictiveValue: 0.6,
            observedAt: input.now,
          },
        ]
      : [];

    const failurePatterns: ConsensusPattern[] = failureCases.length
      ? [
          {
            patternId: makeId("pattern", "failed_consensus"),
            label: "unresolved_disagreement_persists",
            description:
              "cases that remained unresolved or required escalation; review reasons before reusing the same agent/skill combo",
            exampleCaseIds: failureCases.map((c) => c.caseId),
            agreementRate: 0,
            predictiveValue: -0.4,
            observedAt: input.now,
          },
        ]
      : [];

    // Escalation archetypes — group by escalation reason fingerprint.
    const escByReason = new Map<string, string[]>();
    for (const c of input.cases) {
      for (const e of c.escalations) {
        const key = normalize(e.reason);
        const arr = escByReason.get(key) ?? [];
        arr.push(e.escalationId);
        escByReason.set(key, arr);
      }
    }
    const escalationArchetypes = Array.from(escByReason.entries())
      .filter(([, ids]) => ids.length >= 1)
      .map(([key, ids]) => ({
        archetypeId: makeId("escarch", key),
        label: key,
        description: `escalations matching the "${key}" archetype`,
        exampleEscalationIds: ids.sort(),
      }));

    const ovByDirection = new Map<string, string[]>();
    for (const o of input.overrides) {
      const key = `${o.direction}`;
      const arr = ovByDirection.get(key) ?? [];
      arr.push(o.overrideId);
      ovByDirection.set(key, arr);
    }
    const overrideArchetypes = Array.from(ovByDirection.entries()).map(([key, ids]) => ({
      archetypeId: makeId("ovrarch", key),
      label: key,
      description: `overrides with direction ${key}`,
      exampleOverrideIds: ids.sort(),
    }));

    return {
      recurringDisagreements,
      organizationalBiases,
      reviewerClusters,
      successPatterns,
      failurePatterns,
      escalationArchetypes,
      overrideArchetypes,
      computedAt: input.now,
    };
  }
}

function clusterReviewersByAgreement(
  input: BuildMemoryInput,
): OrganizationalReasoningMemory["reviewerClusters"] {
  // Two reviewers are clustered if they share at least two cases and never
  // appear on opposing sides of a disagreement in those cases.
  const reviewerCases = new Map<string, Set<string>>();
  for (const a of input.actions) {
    const s = reviewerCases.get(a.reviewerId) ?? new Set<string>();
    s.add(a.caseId);
    reviewerCases.set(a.reviewerId, s);
  }
  const opposed = new Set<string>();
  for (const d of input.disagreements) {
    const reviewers = d.positions
      .filter((p) => p.holderKind === "reviewer")
      .map((p) => p.holderId);
    for (let i = 0; i < reviewers.length; i++) {
      for (let j = i + 1; j < reviewers.length; j++) {
        opposed.add(pairKey(reviewers[i]!, reviewers[j]!));
      }
    }
  }
  const reviewerIds = Array.from(reviewerCases.keys()).sort();
  const clusters: Array<OrganizationalReasoningMemory["reviewerClusters"][number]> = [];
  const consumed = new Set<string>();
  for (let i = 0; i < reviewerIds.length; i++) {
    if (consumed.has(reviewerIds[i]!)) continue;
    const group = [reviewerIds[i]!];
    for (let j = i + 1; j < reviewerIds.length; j++) {
      if (consumed.has(reviewerIds[j]!)) continue;
      const overlap = intersect(
        reviewerCases.get(reviewerIds[i]!)!,
        reviewerCases.get(reviewerIds[j]!)!,
      );
      if (overlap.size >= 2 && !opposed.has(pairKey(reviewerIds[i]!, reviewerIds[j]!))) {
        group.push(reviewerIds[j]!);
        consumed.add(reviewerIds[j]!);
      }
    }
    if (group.length >= 2) {
      consumed.add(reviewerIds[i]!);
      clusters.push({
        clusterId: makeId("rcluster", ...group),
        label: `aligned_${group.length}`,
        reviewerIds: group,
        rationale: `share ≥2 cases and have never held opposing positions in any disagreement`,
      });
    }
  }
  return clusters;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
}
