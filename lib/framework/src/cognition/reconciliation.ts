/**
 * ReasoningReconciliationEngine.
 *
 * Generates the final recruiting-intelligence synthesis from the *interaction*
 * of the three agents. The synthesis explicitly preserves disagreement,
 * surfaces unresolved questions, and never collapses uncertainty into a
 * single fake verdict. The recommendation category is one of:
 *
 *   advance      → high-confidence-positive
 *   decline      → high-confidence-negative
 *   investigate  → uncertain-positive | uncertain-negative
 *   ambiguous    → ambiguous (or material disagreement)
 */

import type { CandidateAnalysisLike } from "./synthesize.js";
import type {
  ConfidencePropagation,
  DisagreementAnalysis,
  ReconciliationSynthesis,
  UncertaintyFusion,
} from "./types.js";

const CATEGORY_TO_RECOMMENDATION: Record<
  string,
  { category: ReconciliationSynthesis["recommendationCategory"]; text: string }
> = {
  "high-confidence-positive": {
    category: "advance",
    text:
      "Advance to the next loop. Multi-source evidence converges on a positive fit and the trajectory model corroborates forward potential.",
  },
  "high-confidence-negative": {
    category: "decline",
    text:
      "Lean decline. Multiple agents agree the candidate does not meet the bar and disagreement is low.",
  },
  "uncertain-positive": {
    category: "investigate",
    text:
      "Investigate before deciding. The posterior is positive but evidence density or trajectory signal is thinner than required for high confidence.",
  },
  "uncertain-negative": {
    category: "investigate",
    text:
      "Investigate before deciding. The posterior is weak but the agents lack sufficient evidence to commit.",
  },
  ambiguous: {
    category: "ambiguous",
    text:
      "Hold. Agents disagree materially — resolve the specific tensions below before scheduling further loops.",
  },
};

export function reconcile(
  analysis: CandidateAnalysisLike,
  confidence: ConfidencePropagation,
  disagreement: DisagreementAnalysis,
  uncertainty: UncertaintyFusion,
): ReconciliationSynthesis {
  const reco = CATEGORY_TO_RECOMMENDATION[uncertainty.certaintyCategory]!;

  const majorTensions: string[] = disagreement.disagreements
    .filter((d) => d.score >= 0.3)
    .map(
      (d) =>
        `${d.agentA} (${d.metricA.name}=${d.metricA.value}) vs ${d.agentB} (${d.metricB.name}=${d.metricB.value}) — Δ=${d.score}.`,
    );

  const strongestEvidence = [...analysis.bayesian.result.supportingEvidence]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      summary: e.summary,
      weight: Number(e.weight.toFixed(3)),
    }));

  const unresolvedConcerns: string[] = [];
  if (analysis.bayesian.result.missingEvidence.length > 0) {
    unresolvedConcerns.push(
      `Critical domains without supporting evidence: ${analysis.bayesian.result.missingEvidence.join(", ")}.`,
    );
  }
  for (const c of analysis.contradiction.result.contradictions) {
    if (c.severity !== "low") {
      unresolvedConcerns.push(`[${c.severity}] ${c.summary}`);
    }
  }
  for (const q of disagreement.unresolvedQuestions) {
    unresolvedConcerns.push(q);
  }

  const t = analysis.trajectory.result;
  const trajectoryOutlook =
    t.trajectorySignals.length === 0
      ? `No discrete trajectory signals fired; momentum ${t.momentum.toFixed(2)}, acceleration ${t.acceleration.toFixed(3)}.`
      : `Signals: ${t.trajectorySignals.map((s) => s.id).join(", ")}. Momentum ${t.momentum.toFixed(2)}, founderPotential ${t.founderPotential.toFixed(2)}.`;

  const confidenceNarrative =
    `Global confidence after propagation: ${confidence.globalConfidence.toFixed(2)}` +
    ` (uncertainty ${uncertainty.uncertaintyLevel.toFixed(2)}, ambiguity ${uncertainty.ambiguityScore.toFixed(2)}).` +
    ` Per-agent: ${Object.entries(confidence.localAdjustments)
      .map(([k, v]) => `${k}=${v.toFixed(2)}`)
      .join(", ")}.`;

  const nextInvestigations: string[] = [];
  for (const m of analysis.bayesian.result.missingEvidence) {
    nextInvestigations.push(`Source corroborating evidence for "${m}".`);
  }
  for (const u of analysis.contradiction.result.unsupportedClaims) {
    nextInvestigations.push(
      `Probe the basis for unsupported claim: "${u.summary}".`,
    );
  }
  if (
    analysis.trajectory.result.trajectorySignals.some(
      (s) => s.id === "plateau-detected",
    )
  ) {
    nextInvestigations.push(
      "Confirm whether plateau reflects company context or candidate ceiling.",
    );
  }

  return {
    recommendationCategory: reco.category,
    recommendation: reco.text,
    majorTensions,
    strongestEvidence,
    unresolvedConcerns,
    trajectoryOutlook,
    confidenceNarrative,
    nextInvestigations,
  };
}
