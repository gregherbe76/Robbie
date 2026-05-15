/**
 * InfluenceEngine + ConfidencePropagationEngine.
 *
 * Declarative, deterministic rules that allow one agent's output to adjust
 * another agent's confidence. Every adjustment is:
 *   - applied in a fixed order (rule id sort)
 *   - clamped to [0, 1]
 *   - logged as a `PropagatedInfluence` with before/after, reason, and the
 *     evidence ids that fired the rule.
 *
 * Adding a new rule is a single push into INFLUENCE_RULES; no engine code
 * changes are required.
 */

import type { CandidateAnalysisLike } from "./synthesize.js";
import {
  type AgentNode,
  type ConfidencePropagation,
  type InfluenceEdge,
  type InfluenceKind,
  type PropagatedInfluence,
} from "./types.js";

const AGENT_IDS = {
  bayesian: "bayesian-scorer",
  contradiction: "contradiction-detector",
  trajectory: "trajectory-modeler",
} as const;

const SATURATION_THRESHOLD = 0.3;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

interface RuleOutput {
  weight: number;
  reason: string;
  adjustment: number;
  derivedFrom: string[];
}

interface InfluenceRule {
  id: string;
  kind: InfluenceKind;
  from: string;
  to: string; // agent id or "global"
  apply(a: CandidateAnalysisLike): RuleOutput | null;
}

/**
 * Fixed, deterministic rule set. Order is enforced by id sort at apply time.
 */
export const INFLUENCE_RULES: InfluenceRule[] = [
  {
    id: "01:contradiction→bayesian-confidence",
    kind: "confidence-penalty",
    from: AGENT_IDS.contradiction,
    to: AGENT_IDS.bayesian,
    apply(a) {
      const c = a.contradiction.result.contradictionScore;
      if (c < 0.1) return null;
      return {
        weight: c,
        reason: `Contradiction score ${c.toFixed(2)} pressures Bayesian confidence downward.`,
        adjustment: -0.5 * c,
        derivedFrom: a.contradiction.result.contradictions.flatMap(
          (x) => x.derivedFrom,
        ),
      };
    },
  },
  {
    id: "02:unsupported-claims→bayesian-confidence",
    kind: "evidence-reinforcement",
    from: AGENT_IDS.contradiction,
    to: AGENT_IDS.bayesian,
    apply(a) {
      // Avoid double-counting with rule 01: claims that already appear in a
      // detected contradiction's `derivedFrom` are already penalised via
      // contradictionScore. Only the novel residual fires this rule.
      const referenced = new Set(
        a.contradiction.result.contradictions.flatMap((c) => c.derivedFrom),
      );
      const novel = a.contradiction.result.unsupportedClaims.filter(
        (u) => !referenced.has(u.claimId),
      );
      if (novel.length === 0) return null;
      return {
        weight: Math.min(1, novel.length / 3),
        reason: `${novel.length} novel unsupported claim(s) (not already covered by contradictions) erode posterior reliability.`,
        adjustment: -0.08 * novel.length,
        derivedFrom: novel.map((u) => u.claimId),
      };
    },
  },
  {
    id: "03:fake-seniority→trajectory-confidence",
    kind: "contradiction-pressure",
    from: AGENT_IDS.contradiction,
    to: AGENT_IDS.trajectory,
    apply(a) {
      const matches = a.contradiction.result.contradictions.filter(
        (c) => c.kind === "fake-seniority",
      );
      if (matches.length === 0) return null;
      return {
        weight: 1,
        reason: `Fake-seniority pattern detected — trajectory ownership is suspect.`,
        adjustment: -0.25,
        derivedFrom: matches.flatMap((m) => m.derivedFrom),
      };
    },
  },
  {
    id: "04:trajectory-momentum→bayesian-confidence",
    kind: "confidence-amplification",
    from: AGENT_IDS.trajectory,
    to: AGENT_IDS.bayesian,
    apply(a) {
      const t = a.trajectory.result;
      const momentumNorm = Math.min(1, t.momentum / 0.4);
      if (momentumNorm < 0.4) return null;
      return {
        weight: momentumNorm,
        reason: `Strong trajectory momentum (${t.momentum.toFixed(2)}) reinforces fit signal.`,
        adjustment: 0.15 * momentumNorm,
        derivedFrom: t.trajectorySignals.flatMap((s) => s.derivedFrom),
      };
    },
  },
  {
    id: "05:missing-critical-evidence→global",
    kind: "uncertainty-boost",
    from: AGENT_IDS.bayesian,
    to: "global",
    apply(a) {
      const missing = a.bayesian.result.missingEvidence;
      if (missing.length === 0) return null;
      return {
        weight: Math.min(1, missing.length / 3),
        reason: `${missing.length} critical domain(s) lack supporting evidence: ${missing.join(", ")}.`,
        adjustment: -0.1 * missing.length,
        derivedFrom: [],
      };
    },
  },
  {
    id: "06:weak-domain-diversity→global",
    kind: "uncertainty-boost",
    from: AGENT_IDS.bayesian,
    to: "global",
    apply(a) {
      const domains = new Set(a.bayesian.result.perDomain.map((d) => d.domain));
      const ratio = Math.min(1, domains.size / 4);
      if (ratio >= 0.75) return null;
      return {
        weight: 1 - ratio,
        reason: `Only ${domains.size} distinct evidence domain(s) — diversity is thin.`,
        adjustment: -0.15 * (1 - ratio),
        derivedFrom: a.bayesian.evidenceChain,
      };
    },
  },
  {
    id: "07:plateau→trajectory-confidence",
    kind: "confidence-penalty",
    from: AGENT_IDS.trajectory,
    to: AGENT_IDS.trajectory,
    apply(a) {
      const hasPlateau = a.trajectory.result.trajectorySignals.some(
        (s) => s.id === "plateau-detected",
      );
      if (!hasPlateau) return null;
      const derived = a.trajectory.result.trajectorySignals
        .filter((s) => s.id === "plateau-detected")
        .flatMap((s) => s.derivedFrom);
      return {
        weight: 0.6,
        reason: `Plateau detected — trajectory forward-projection is less reliable.`,
        adjustment: -0.1,
        derivedFrom: derived,
      };
    },
  },
];

/**
 * Apply every rule in deterministic order, threading the adjustments through
 * a mutable per-agent confidence map and a "global" scalar.
 */
export function propagateInfluences(
  analysis: CandidateAnalysisLike,
): {
  graph: { nodes: AgentNode[]; edges: InfluenceEdge[] };
  influences: PropagatedInfluence[];
  confidence: ConfidencePropagation;
} {
  const local: Record<string, number> = {
    [AGENT_IDS.bayesian]: analysis.bayesian.confidence,
    [AGENT_IDS.contradiction]: analysis.contradiction.confidence,
    [AGENT_IDS.trajectory]: analysis.trajectory.confidence,
  };
  const initial = { ...local };
  // Defensive: clamp the initial global to [0,1] even though agent
  // confidences should already be in-range. Cheap, removes a class of bugs
  // if an upstream agent ever emits out-of-band values.
  let global = clamp01(
    (local[AGENT_IDS.bayesian]! +
      local[AGENT_IDS.contradiction]! +
      local[AGENT_IDS.trajectory]!) /
      3,
  );

  const influences: PropagatedInfluence[] = [];
  const edges: InfluenceEdge[] = [];
  let saturationApplied = false;

  const rules = [...INFLUENCE_RULES].sort((a, b) => a.id.localeCompare(b.id));
  for (const rule of rules) {
    const out = rule.apply(analysis);
    if (!out) continue;

    const target = rule.to;
    const before = target === "global" ? global : (local[target] ?? 0);
    const after = clamp01(before + out.adjustment);

    if (Math.abs(out.adjustment) >= SATURATION_THRESHOLD) {
      saturationApplied = true;
    }

    if (target === "global") global = after;
    else local[target] = after;

    influences.push({
      id: rule.id,
      sourceAgent: rule.from,
      targetAgent: rule.to,
      kind: rule.kind,
      reason: out.reason,
      adjustment: Number(out.adjustment.toFixed(3)),
      before: Number(before.toFixed(3)),
      after: Number(after.toFixed(3)),
      derivedFrom: Array.from(new Set(out.derivedFrom)),
    });
    edges.push({
      id: rule.id,
      from: rule.from,
      to: rule.to,
      kind: rule.kind,
      weight: Number(out.weight.toFixed(3)),
      reason: out.reason,
    });
  }

  const nodes: AgentNode[] = [
    {
      id: AGENT_IDS.bayesian,
      name: "Bayesian Scoring",
      initialConfidence: Number(initial[AGENT_IDS.bayesian]!.toFixed(3)),
      adjustedConfidence: Number(local[AGENT_IDS.bayesian]!.toFixed(3)),
      metric: { name: "fitScore", value: analysis.bayesian.result.fitScore },
    },
    {
      id: AGENT_IDS.contradiction,
      name: "Contradiction",
      initialConfidence: Number(initial[AGENT_IDS.contradiction]!.toFixed(3)),
      adjustedConfidence: Number(local[AGENT_IDS.contradiction]!.toFixed(3)),
      metric: {
        name: "contradictionScore",
        value: analysis.contradiction.result.contradictionScore,
      },
    },
    {
      id: AGENT_IDS.trajectory,
      name: "Trajectory",
      initialConfidence: Number(initial[AGENT_IDS.trajectory]!.toFixed(3)),
      adjustedConfidence: Number(local[AGENT_IDS.trajectory]!.toFixed(3)),
      metric: {
        name: "trajectoryScore",
        value: analysis.trajectory.result.trajectoryScore,
      },
    },
  ];

  const uncertaintyMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(local)) {
    uncertaintyMap[k] = Number((1 - v).toFixed(3));
  }

  return {
    graph: { nodes, edges },
    influences,
    confidence: {
      globalConfidence: Number(global.toFixed(3)),
      localAdjustments: Object.fromEntries(
        Object.entries(local).map(([k, v]) => [k, Number(v.toFixed(3))]),
      ),
      uncertaintyMap,
      saturationApplied,
    },
  };
}

export const COGNITION_AGENT_IDS = AGENT_IDS;
