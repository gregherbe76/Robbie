/**
 * MutationGuardScenarios.
 *
 * The point of the benchmark suite is to catch real cognition regressions.
 * Mutation guards prove that — they take a passing scenario, deliberately
 * mutate the output to simulate a broken framework, and re-evaluate the
 * expectations. If the guard's expected failure does NOT appear, the
 * benchmark layer itself is broken.
 *
 * No actual framework code is mutated. Each guard simulates the *effect*
 * of a regression on the outputs.
 */

import type {
  BenchmarkScenario,
  ExpectationResult,
  MutationGuardCheck,
  ScenarioOutputs,
} from "./types.js";
import { evaluateExpectations } from "./expectations.js";

interface Guard {
  id: string;
  description: string;
  scenarioId: BenchmarkScenario["scenarioId"];
  /** Mutates a *clone* of outputs to simulate a regression. */
  mutate: (o: ScenarioOutputs) => ScenarioOutputs;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const GUARDS: Guard[] = [
  {
    id: "remove-contradiction-penalty",
    description:
      "Simulates removal of contradiction-pressure influence — inflated_senior must fail.",
    scenarioId: "inflated_senior",
    mutate: (o) => {
      const m = deepClone(o);
      m.cognition.influences = m.cognition.influences.filter(
        (i) =>
          i.kind !== "contradiction-pressure" && i.kind !== "confidence-penalty",
      );
      m.cognition.confidence.globalConfidence = Math.max(
        m.preCognitionBayesianConfidence,
        m.cognition.confidence.globalConfidence,
      );
      m.fit.fitRecommendation = "strong_fit";
      m.digest.fitRecommendation = "strong_fit";
      m.cognition.reconciliation.recommendationCategory = "advance";
      m.digest.recommendationCategory = "advance";
      return m;
    },
  },
  {
    id: "invert-uncertainty-boost",
    description:
      "Simulates collapsing uncertainty into false certainty — ambiguous_generalist must fail.",
    scenarioId: "ambiguous_generalist",
    mutate: (o) => {
      const m = deepClone(o);
      m.cognition.uncertainty.certaintyCategory = "high-confidence-positive";
      m.cognition.disagreement.unresolvedQuestions = [];
      m.cognition.uncertainty.uncertaintyLevel = 0.05;
      m.cognition.reconciliation.recommendationCategory = "advance";
      m.digest.recommendationCategory = "advance";
      m.digest.unresolvedQuestionCount = 0;
      return m;
    },
  },
  {
    id: "drop-unsupported-claim-flag",
    description:
      "Simulates ignoring unsupported claims — fake_oss_signal must fail.",
    scenarioId: "fake_oss_signal",
    mutate: (o) => {
      const m = deepClone(o);
      m.contradiction.result.unsupportedClaims = [];
      m.contradiction.result.contradictionScore = 0.1;
      m.digest.contradictionScore = 0.1;
      m.digest.evidenceRequestSignal = 0;
      m.digest.unsupportedClaimCount = 0;
      return m;
    },
  },
  {
    id: "drop-provenance",
    description:
      "Simulates losing provenance on a flagship agent — elite_ic must fail provenance_complete.",
    scenarioId: "elite_ic",
    mutate: (o) => {
      const m = deepClone(o);
      // Wipe rationale + derivedFrom on bayesian envelope.
      m.bayesian.provenance.rationale = "";
      m.bayesian.provenance.derivedFrom = [];
      m.bayesian.reasoning = [];
      return m;
    },
  },
  {
    id: "ignore-chaos-org",
    description:
      "Simulates ignoring chaos-org signals — process_dependent_operator must fail risk-elevated.",
    scenarioId: "process_dependent_operator",
    mutate: (o) => {
      const m = deepClone(o);
      m.orgReport.hiringRisk.result.overallHiringRisk = 0.1;
      m.digest.overallHiringRisk = 0.1;
      m.orgReport.chaosFit.result.chaosFitScore = 0.8;
      m.digest.chaosFitScore = 0.8;
      m.fit.fitRecommendation = "strong_fit";
      m.digest.fitRecommendation = "strong_fit";
      return m;
    },
  },
];

export function runMutationGuards(
  scenarios: BenchmarkScenario[],
  outputsByScenario: Map<BenchmarkScenario["scenarioId"], ScenarioOutputs>,
): MutationGuardCheck[] {
  const checks: MutationGuardCheck[] = [];
  for (const guard of GUARDS) {
    const scenario = scenarios.find((s) => s.scenarioId === guard.scenarioId);
    const outputs = outputsByScenario.get(guard.scenarioId);
    if (!scenario || !outputs) {
      checks.push({
        guardId: guard.id,
        description: guard.description,
        scenarioId: guard.scenarioId,
        passed: false,
        detail: `target scenario ${guard.scenarioId} missing from corpus`,
      });
      continue;
    }
    const mutated = guard.mutate(outputs);
    const results: ExpectationResult[] = evaluateExpectations(
      scenario.expectations,
      mutated,
    );
    const failed = results.filter((r) => !r.passed);
    checks.push({
      guardId: guard.id,
      description: guard.description,
      scenarioId: guard.scenarioId,
      passed: failed.length > 0,
      detail:
        failed.length > 0
          ? `guard caught regression — ${failed.length}/${results.length} expectation(s) failed after mutation`
          : "guard FAILED to catch regression — all expectations still passed after mutation; benchmark layer is too lenient",
    });
  }
  return checks;
}
