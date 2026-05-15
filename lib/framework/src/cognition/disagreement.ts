/**
 * DisagreementAnalyzer.
 *
 * Computes explicit pairwise disagreement between agents on a shared
 * 0..1 "positive signal" axis. By design we never collapse disagreement
 * — we surface it as a first-class output.
 *
 * Axis convention (higher = more positive about the candidate):
 *   bayesian-scorer        → fitScore
 *   contradiction-detector → 1 - contradictionScore   (cleanness of narrative)
 *   trajectory-modeler     → trajectoryScore
 */

import type { CandidateAnalysisLike } from "./synthesize.js";
import { COGNITION_AGENT_IDS as A } from "./influence_engine.js";
import type {
  Disagreement,
  DisagreementAnalysis,
  ConfidencePropagation,
} from "./types.js";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function analyzeDisagreement(
  analysis: CandidateAnalysisLike,
  confidence: ConfidencePropagation,
): DisagreementAnalysis {
  const fit = analysis.bayesian.result.fitScore;
  const clean = 1 - analysis.contradiction.result.contradictionScore;
  const traj = analysis.trajectory.result.trajectoryScore;

  const pairs: Array<{
    id: string;
    a: string;
    b: string;
    va: number;
    vb: number;
    na: string;
    nb: string;
  }> = [
    {
      id: `${A.bayesian}↔${A.contradiction}`,
      a: A.bayesian,
      b: A.contradiction,
      va: fit,
      vb: clean,
      na: "fitScore",
      nb: "1-contradictionScore",
    },
    {
      id: `${A.bayesian}↔${A.trajectory}`,
      a: A.bayesian,
      b: A.trajectory,
      va: fit,
      vb: traj,
      na: "fitScore",
      nb: "trajectoryScore",
    },
    {
      id: `${A.contradiction}↔${A.trajectory}`,
      a: A.contradiction,
      b: A.trajectory,
      va: clean,
      vb: traj,
      na: "1-contradictionScore",
      nb: "trajectoryScore",
    },
  ];

  const disagreements: Disagreement[] = pairs.map((p) => {
    const score = Math.abs(p.va - p.vb);
    return {
      id: p.id,
      agentA: p.a,
      agentB: p.b,
      metricA: { name: p.na, value: Number(p.va.toFixed(3)) },
      metricB: { name: p.nb, value: Number(p.vb.toFixed(3)) },
      score: Number(score.toFixed(3)),
      rationale:
        score >= 0.3
          ? `${p.a} reports ${p.na}=${p.va.toFixed(2)} while ${p.b} reports ${p.nb}=${p.vb.toFixed(2)}.`
          : `Agents broadly aligned on this axis (|Δ|=${score.toFixed(2)}).`,
    };
  });

  const disagreementScore = Math.max(...disagreements.map((d) => d.score));
  const ambiguityLevel = clamp01(
    disagreements.reduce((s, d) => s + d.score, 0) / disagreements.length,
  );

  const confidences = Object.values(confidence.localAdjustments);
  const confidenceTension =
    confidences.length > 0
      ? Math.max(...confidences) - Math.min(...confidences)
      : 0;

  const unresolvedQuestions: string[] = [];
  for (const d of disagreements) {
    if (d.score < 0.3) continue;
    if (d.agentA === A.bayesian && d.agentB === A.contradiction) {
      unresolvedQuestions.push(
        "Does the candidate's narrative survive cross-source validation, given the posterior fit?",
      );
    } else if (d.agentA === A.bayesian && d.agentB === A.trajectory) {
      unresolvedQuestions.push(
        "Is the candidate's forward trajectory consistent with current measured fit?",
      );
    } else if (d.agentA === A.contradiction && d.agentB === A.trajectory) {
      unresolvedQuestions.push(
        "Can a strong trajectory compensate for unresolved narrative gaps?",
      );
    }
  }

  return {
    disagreementScore: Number(disagreementScore.toFixed(3)),
    disagreements,
    unresolvedQuestions,
    ambiguityLevel: Number(ambiguityLevel.toFixed(3)),
    confidenceTension: Number(confidenceTension.toFixed(3)),
  };
}
