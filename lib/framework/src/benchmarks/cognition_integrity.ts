/**
 * CognitionIntegrityVerifier.
 *
 * Per-archetype behavioural rules that go beyond the declarative
 * expectation list. These are the "epistemic guarantees" of the
 * framework — break one of these and the cognition is broken.
 */

import type {
  BenchmarkArchetype,
  CognitionIntegrityCheck,
  ScenarioOutputs,
} from "./types.js";

interface Rule {
  rule: string;
  check: (o: ScenarioOutputs) => { ok: boolean; detail: string };
}

const RULES_BY_ARCHETYPE: Record<BenchmarkArchetype, Rule[]> = {
  inflated_senior: [
    {
      rule: "contradiction-pressure-propagated",
      check: (o) => {
        const hasPenalty = o.cognition.influences.some(
          (i) =>
            i.kind === "contradiction-pressure" ||
            i.kind === "confidence-penalty",
        );
        return {
          ok: hasPenalty,
          detail: hasPenalty
            ? "contradiction pressure propagated into Bayesian confidence"
            : "no contradiction-pressure / confidence-penalty influence found",
        };
      },
    },
    {
      rule: "bayesian-confidence-reduced",
      check: (o) => {
        const ok = o.cognition.confidence.globalConfidence < o.preCognitionBayesianConfidence;
        return {
          ok,
          detail: `pre=${o.preCognitionBayesianConfidence.toFixed(3)} after=${o.cognition.confidence.globalConfidence.toFixed(3)}`,
        };
      },
    },
    {
      rule: "recommendation-not-strong-fit",
      check: (o) => ({
        ok: o.fit.fitRecommendation !== "strong_fit",
        detail: `fitRecommendation=${o.fit.fitRecommendation}`,
      }),
    },
  ],
  founder_builder: [
    {
      rule: "trajectory-positive",
      check: (o) => ({
        ok: o.trajectory.result.trajectoryScore > 0.3,
        detail: `trajectoryScore=${o.trajectory.result.trajectoryScore.toFixed(3)}`,
      }),
    },
    {
      rule: "chaos-fit-positive",
      check: (o) => ({
        ok: o.orgReport.chaosFit.result.chaosFitScore > 0.55,
        detail: `chaosFitScore=${o.orgReport.chaosFit.result.chaosFitScore.toFixed(3)}`,
      }),
    },
    {
      rule: "not-declined",
      check: (o) => ({
        ok:
          o.fit.fitRecommendation !== "poor_context_fit" &&
          o.cognition.reconciliation.recommendationCategory !== "decline",
        detail: `fit=${o.fit.fitRecommendation} reco=${o.cognition.reconciliation.recommendationCategory}`,
      }),
    },
  ],
  plateaued_staff: [
    {
      rule: "flat-trajectory-recognised",
      check: (o) => ({
        ok: o.trajectory.result.trajectoryScore < 0.55,
        detail: `trajectoryScore=${o.trajectory.result.trajectoryScore.toFixed(3)}`,
      }),
    },
    {
      rule: "not-strong-fit",
      check: (o) => ({
        ok: o.fit.fitRecommendation !== "strong_fit",
        detail: `fitRecommendation=${o.fit.fitRecommendation}`,
      }),
    },
  ],
  elite_ic: [
    {
      rule: "low-contradiction",
      check: (o) => ({
        ok: o.contradiction.result.contradictionScore < 0.5,
        detail: `contradictionScore=${o.contradiction.result.contradictionScore.toFixed(3)}`,
      }),
    },
    {
      rule: "not-declined",
      check: (o) => ({
        ok: o.cognition.reconciliation.recommendationCategory !== "decline",
        detail: `reco=${o.cognition.reconciliation.recommendationCategory}`,
      }),
    },
  ],
  high_variance_candidate: [
    {
      rule: "contradiction-registered",
      check: (o) => ({
        ok: o.contradiction.result.contradictionScore > 0.5,
        detail: `contradictionScore=${o.contradiction.result.contradictionScore.toFixed(3)}`,
      }),
    },
    {
      rule: "not-strong-fit",
      check: (o) => ({
        ok: o.fit.fitRecommendation !== "strong_fit",
        detail: `fitRecommendation=${o.fit.fitRecommendation}`,
      }),
    },
  ],
  ambiguous_generalist: [
    {
      rule: "no-false-certainty",
      check: (o) => {
        const cat = o.cognition.uncertainty.certaintyCategory;
        const ok = cat !== "high-confidence-positive" && cat !== "high-confidence-negative";
        return { ok, detail: `certaintyCategory=${cat}` };
      },
    },
    {
      rule: "unresolved-questions-non-empty",
      check: (o) => ({
        ok: o.cognition.disagreement.unresolvedQuestions.length > 0,
        detail: `unresolvedQuestions=${o.cognition.disagreement.unresolvedQuestions.length}`,
      }),
    },
  ],
  fake_oss_signal: [
    {
      rule: "unsupported-claim-flagged",
      check: (o) => ({
        ok: o.contradiction.result.unsupportedClaims.length > 0,
        detail: `unsupportedClaims=${o.contradiction.result.unsupportedClaims.length}`,
      }),
    },
    {
      rule: "evidence-request-signal-positive",
      check: (o) => ({
        ok: o.digest.evidenceRequestSignal > 0,
        detail: `evidenceRequestSignal=${o.digest.evidenceRequestSignal}`,
      }),
    },
  ],
  chaos_thriver: [
    {
      rule: "chaos-fit-positive",
      check: (o) => ({
        ok: o.orgReport.chaosFit.result.chaosFitScore > 0.6,
        detail: `chaosFitScore=${o.orgReport.chaosFit.result.chaosFitScore.toFixed(3)}`,
      }),
    },
  ],
  process_dependent_operator: [
    {
      rule: "contradiction-registered",
      check: (o) => ({
        ok: o.contradiction.result.contradictionScore > 0.4,
        detail: `contradictionScore=${o.contradiction.result.contradictionScore.toFixed(3)}`,
      }),
    },
    {
      rule: "not-strong-fit",
      check: (o) => ({
        ok: o.fit.fitRecommendation !== "strong_fit",
        detail: `fitRecommendation=${o.fit.fitRecommendation}`,
      }),
    },
  ],
  underestimated_junior: [
    {
      rule: "trajectory-positive",
      check: (o) => ({
        ok: o.trajectory.result.trajectoryScore > 0.3,
        detail: `trajectoryScore=${o.trajectory.result.trajectoryScore.toFixed(3)}`,
      }),
    },
    {
      rule: "confidence-cautious",
      check: (o) => ({
        ok: o.bayesian.confidence < 0.85,
        detail: `bayesian.confidence=${o.bayesian.confidence.toFixed(3)}`,
      }),
    },
    {
      rule: "upside-preserved",
      check: (o) => {
        const cat = o.cognition.reconciliation.recommendationCategory;
        return {
          ok: cat !== "decline",
          detail: `recommendationCategory=${cat}`,
        };
      },
    },
  ],
};

export function verifyCognitionIntegrity(
  archetype: BenchmarkArchetype,
  outputs: ScenarioOutputs,
): CognitionIntegrityCheck {
  const rules = RULES_BY_ARCHETYPE[archetype] ?? [];
  const findings = rules.map((r) => {
    const res = r.check(outputs);
    return { ok: res.ok, rule: r.rule, detail: res.detail };
  });
  return {
    scenarioId: outputs.scenarioId,
    passed: findings.every((f) => f.ok),
    findings,
  };
}
