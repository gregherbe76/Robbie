// =========================================================================
// 2. AdversarialReviewEngine
//
// Explicit adversarial reasoning. Every meaningful claim is paired against
// its strongest counterclaim. We NEVER flatten disagreement: unresolved
// tensions are preserved as a first-class output, not averaged away.
// =========================================================================

import type {
  AdversarialArgument,
  AdversarialReview,
  ChallengeRebuttalChain,
} from "./types.js";
import { clamp01, round } from "./types.js";

export interface AdversarialInputs {
  caseId: string;
  candidateId: string;
  organizationId: string;

  // Positive signals
  bayesianFit: number;
  bayesianRationale: string;
  bayesianEvidence: string[];
  trajectoryScore: number;
  trajectoryRationale: string;
  trajectoryEvidence: string[];
  matchedArchetypes: Array<{
    archetypeId: string;
    archetypeName: string;
    matchScore: number;
    rationale: string;
  }>;
  fitSuccessConditions: string[];

  // Negative signals
  contradictions: Array<{
    id: string;
    summary: string;
    severity: "low" | "medium" | "high";
    derivedFrom: string[];
  }>;
  hiringRiskDrivers: Array<{
    category: string;
    severity: "low" | "medium" | "high";
    summary: string;
    derivedFrom: string[];
  }>;
  failureModes: string[];
  collisionRisks: Array<{ id: string; severity: string; summary: string }>;
}

function severityWeight(s: "low" | "medium" | "high"): number {
  return s === "high" ? 0.85 : s === "medium" ? 0.55 : 0.3;
}

function buildSupportingArguments(
  inp: AdversarialInputs,
): AdversarialArgument[] {
  const args: AdversarialArgument[] = [];
  if (inp.bayesianFit > 0) {
    args.push({
      id: `arg:sup:bayesian:${inp.candidateId}`,
      side: "supporting",
      claim: `Bayesian fit score ${round(inp.bayesianFit)}: ${inp.bayesianRationale}`,
      sourceAgent: "bayesian-scorer",
      evidence: inp.bayesianEvidence.slice(),
      weight: round(clamp01(inp.bayesianFit)),
    });
  }
  if (inp.trajectoryScore > 0) {
    args.push({
      id: `arg:sup:trajectory:${inp.candidateId}`,
      side: "supporting",
      claim: `Trajectory model rates ownership growth at ${round(inp.trajectoryScore)}: ${inp.trajectoryRationale}`,
      sourceAgent: "trajectory-modeler",
      evidence: inp.trajectoryEvidence.slice(),
      weight: round(clamp01(inp.trajectoryScore)),
    });
  }
  for (const a of inp.matchedArchetypes) {
    if (a.matchScore < 0.5) continue;
    args.push({
      id: `arg:sup:archetype:${a.archetypeId}`,
      side: "supporting",
      claim: `Archetype match "${a.archetypeName}" (${round(a.matchScore)}): ${a.rationale}`,
      sourceAgent: "cross-agent-memory",
      evidence: [a.archetypeId],
      weight: round(clamp01(a.matchScore)),
    });
  }
  for (const s of inp.fitSuccessConditions.slice(0, 3)) {
    args.push({
      id: `arg:sup:success:${hash(s)}`,
      side: "supporting",
      claim: `Success condition identified: ${s}`,
      sourceAgent: "organization-intelligence",
      evidence: [],
      weight: 0.5,
    });
  }
  return args;
}

function buildRefutingArguments(
  inp: AdversarialInputs,
): AdversarialArgument[] {
  const args: AdversarialArgument[] = [];
  for (const c of inp.contradictions) {
    args.push({
      id: `arg:ref:contradiction:${c.id}`,
      side: "refuting",
      claim: `Contradiction (${c.severity}): ${c.summary}`,
      sourceAgent: "contradiction-detector",
      evidence: c.derivedFrom.slice(),
      weight: severityWeight(c.severity),
    });
  }
  for (const d of inp.hiringRiskDrivers) {
    args.push({
      id: `arg:ref:risk:${d.category}`,
      side: "refuting",
      claim: `Hiring-risk driver ${d.category} (${d.severity}): ${d.summary}`,
      sourceAgent: "hiring-risk-agent",
      evidence: d.derivedFrom.slice(),
      weight: severityWeight(d.severity),
    });
  }
  for (const r of inp.collisionRisks) {
    args.push({
      id: `arg:ref:collision:${r.id}`,
      side: "refuting",
      claim: `Team-chemistry collision (${r.severity}): ${r.summary}`,
      sourceAgent: "team-chemistry-agent",
      evidence: [],
      weight:
        r.severity === "high" ? 0.75 : r.severity === "medium" ? 0.5 : 0.3,
    });
  }
  for (const f of inp.failureModes.slice(0, 3)) {
    args.push({
      id: `arg:ref:failure:${hash(f)}`,
      side: "refuting",
      claim: `Anticipated failure mode: ${f}`,
      sourceAgent: "organization-intelligence",
      evidence: [],
      weight: 0.4,
    });
  }
  return args;
}

/** Pair each refuting argument with the strongest supporting argument as a
 *  rebuttal candidate. Tag unresolved if no supporting argument outweighs it.
 *  We DO NOT silently collapse — unresolved chains are kept and surfaced. */
function pairChains(
  supporting: AdversarialArgument[],
  refuting: AdversarialArgument[],
): ChallengeRebuttalChain[] {
  const sortedSup = supporting
    .slice()
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const chains: ChallengeRebuttalChain[] = [];
  for (const ref of refuting) {
    const rebut = sortedSup.find((s) => s.weight >= ref.weight) ?? null;
    const unresolved = rebut === null;
    // If unresolved, every refuting unit subtracts its weighted impact
    // (scaled by a system-wide factor) from confidence — but only if a
    // human or workflow chooses to accept the chain. We surface, never apply.
    const impact = unresolved
      ? round(-ref.weight * 0.15)
      : round(-Math.max(0, ref.weight - rebut!.weight) * 0.15);
    chains.push({
      id: `chain:${ref.id}`,
      challenge: ref,
      rebuttal: rebut,
      unresolved,
      confidenceImpact: impact,
    });
  }
  chains.sort((a, b) => a.id.localeCompare(b.id));
  return chains;
}

export class AdversarialReviewEngine {
  build(inp: AdversarialInputs): AdversarialReview {
    const supporting = buildSupportingArguments(inp);
    const refuting = buildRefutingArguments(inp);
    const allArgs = [...supporting, ...refuting].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const chains = pairChains(supporting, refuting);
    const unresolvedTensions = chains
      .filter((c) => c.unresolved)
      .map((c) => c.challenge.claim)
      .sort((a, b) => a.localeCompare(b));
    const netConfidenceImpact = round(
      chains.reduce((s, c) => s + c.confidenceImpact, 0),
    );
    return {
      id: `adv:${inp.organizationId}:${inp.candidateId}`,
      caseId: inp.caseId,
      topic: `Adversarial review · ${inp.candidateId} @ ${inp.organizationId}`,
      arguments: allArgs,
      chains,
      unresolvedTensions,
      netConfidenceImpact,
    };
  }
}

/** Deterministic stable short id from a string. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  // Convert to unsigned and base36 for compactness.
  return (h >>> 0).toString(36);
}
