/**
 * CrossAgentMemoryLayer.
 *
 * Persistent memory for recurring multi-agent patterns. Per candidate we
 * match against a fixed library of archetypes (Inflated Narrative,
 * Accelerating Builder, Elite Fit, Plateaued Senior, Uncalibrated
 * Self-Assessment). Each archetype scores deterministically from the
 * three agent outputs and explains *why* it fired.
 *
 * `summarizeArchetypeFrequency` runs across many candidates and produces
 * organisation-level patterns that can be persisted into framework memory
 * for longitudinal hiring cognition.
 */

import type { CandidateAnalysisLike } from "./synthesize.js";
import type { ArchetypeMatch, CrossAgentMemoryView } from "./types.js";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

interface Archetype {
  id: string;
  name: string;
  match(a: CandidateAnalysisLike): {
    score: number;
    rationale: string;
    signals: string[];
  } | null;
}

const ARCHETYPES: Archetype[] = [
  {
    id: "inflated-narrative",
    name: "Inflated Narrative",
    match(a) {
      const c = a.contradiction.result;
      const inflationary = c.contradictions.filter(
        (x) =>
          x.kind === "fake-seniority" || x.kind === "vocabulary-without-depth",
      ).length;
      const score = clamp01(
        0.5 * c.contradictionScore +
          0.3 * Math.min(1, c.unsupportedClaims.length / 3) +
          0.2 * Math.min(1, inflationary / 2),
      );
      if (score < 0.35) return null;
      return {
        score,
        rationale: `${c.contradictions.length} contradiction(s), ${c.unsupportedClaims.length} unsupported claim(s), ${inflationary} narrative-inflation signal(s).`,
        signals: c.contradictions.map((x) => x.id),
      };
    },
  },
  {
    id: "accelerating-builder",
    name: "Accelerating Builder",
    match(a) {
      const t = a.trajectory.result;
      const hasAccel = t.trajectorySignals.some(
        (s) => s.id === "accelerating-builder",
      );
      const score = clamp01(
        0.4 * t.trajectoryScore +
          0.4 * Math.min(1, t.momentum / 0.4) +
          (hasAccel ? 0.2 : 0),
      );
      if (score < 0.55) return null;
      return {
        score,
        rationale: `Trajectory ${t.trajectoryScore.toFixed(2)}, momentum ${t.momentum.toFixed(2)}, acceleration ${t.acceleration.toFixed(3)}.`,
        signals: t.trajectorySignals.map((s) => s.id),
      };
    },
  },
  {
    id: "elite-fit-low-friction",
    name: "Elite Fit, Low Friction",
    match(a) {
      const fit = a.bayesian.result.fitScore;
      const contra = a.contradiction.result.contradictionScore;
      if (fit < 0.7 || contra > 0.2) return null;
      const score = clamp01(
        0.6 * fit +
          0.2 * a.trajectory.result.trajectoryScore +
          0.2 * (1 - contra),
      );
      return {
        score,
        rationale: `Posterior fit ${fit.toFixed(2)} with contradiction ${contra.toFixed(2)} and trajectory ${a.trajectory.result.trajectoryScore.toFixed(2)}.`,
        signals: a.bayesian.result.supportingEvidence
          .slice(0, 3)
          .map((e) => e.id),
      };
    },
  },
  {
    id: "plateaued-senior",
    name: "Plateaued Senior",
    match(a) {
      const has = a.trajectory.result.trajectorySignals.some(
        (s) => s.id === "plateau-detected",
      );
      if (!has) return null;
      const score = clamp01(
        0.5 +
          0.3 * (1 - Math.min(1, a.trajectory.result.momentum / 0.4)) +
          0.2 * (a.bayesian.result.fitScore >= 0.5 ? 1 : 0),
      );
      return {
        score,
        rationale: `Plateau signal present; momentum ${a.trajectory.result.momentum.toFixed(2)}.`,
        signals: a.trajectory.result.trajectorySignals
          .filter((s) => s.id === "plateau-detected")
          .flatMap((s) => s.derivedFrom),
      };
    },
  },
  {
    id: "uncalibrated-self-assessment",
    name: "Uncalibrated Self-Assessment",
    match(a) {
      const n = a.contradiction.result.unsupportedClaims.length;
      if (n === 0) return null;
      const score = clamp01(
        0.5 * Math.min(1, n / 3) + 0.5 * a.bayesian.result.uncertaintyLevel,
      );
      return {
        score,
        rationale: `${n} unsupported self-stated claim(s) against uncertainty ${a.bayesian.result.uncertaintyLevel.toFixed(2)}.`,
        signals: a.contradiction.result.unsupportedClaims.map((u) => u.claimId),
      };
    },
  },
];

export function matchArchetypes(
  a: CandidateAnalysisLike,
): CrossAgentMemoryView {
  const matched: ArchetypeMatch[] = [];
  for (const arch of ARCHETYPES) {
    const m = arch.match(a);
    if (!m) continue;
    matched.push({
      archetypeId: arch.id,
      archetypeName: arch.name,
      matchScore: Number(m.score.toFixed(3)),
      rationale: m.rationale,
      signals: m.signals,
    });
  }
  matched.sort((x, y) => y.matchScore - x.matchScore);

  const recurringPatterns: string[] = [];
  if (matched.find((m) => m.archetypeId === "inflated-narrative")) {
    recurringPatterns.push(
      "Inflated-narrative archetypes historically correlate with poor on-the-job outcomes; weight contradictions heavily.",
    );
  }
  if (matched.find((m) => m.archetypeId === "accelerating-builder")) {
    recurringPatterns.push(
      "Accelerating-builder archetypes historically outperform their static pedigree.",
    );
  }
  if (matched.find((m) => m.archetypeId === "elite-fit-low-friction")) {
    recurringPatterns.push(
      "Elite-fit-low-friction matches have the highest historical loop-completion rate.",
    );
  }

  return { matchedArchetypes: matched, recurringPatterns };
}

/**
 * Cross-corpus pattern: given a set of analyses, summarise the frequency of
 * each archetype. Used by the bootstrap to persist organisation-level
 * memory entries.
 */
export function summarizeArchetypeFrequency(
  analyses: CandidateAnalysisLike[],
): Array<{ archetypeId: string; archetypeName: string; matches: number; total: number }> {
  const counts = new Map<string, { name: string; n: number }>();
  for (const a of analyses) {
    const v = matchArchetypes(a);
    for (const m of v.matchedArchetypes) {
      const cur = counts.get(m.archetypeId);
      if (cur) cur.n += 1;
      else counts.set(m.archetypeId, { name: m.archetypeName, n: 1 });
    }
  }
  return Array.from(counts.entries()).map(([archetypeId, v]) => ({
    archetypeId,
    archetypeName: v.name,
    matches: v.n,
    total: analyses.length,
  }));
}
