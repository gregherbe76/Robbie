import {
  type BenchmarkAssertion,
  type BenchmarkResult,
  type BenchmarkScenario,
  type EvaluationReport,
} from "./types.js";

// =========================================================================
// 9. RecruitingIntelligenceBenchmarkEngine
// =========================================================================
//
// Replayable, deterministic scenarios. Each scenario asserts properties of
// the EvaluationReport. The runner walks the report by dotted path so new
// scenarios can be added without changing the engine.

export const DEFAULT_BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "bench:global-calibration-baseline",
    description:
      "Global expected calibration error must stay below 0.20 on the demo corpus; system should not silently lose calibration in CI.",
    kinds: ["candidate-fit", "hiring-risk", "trajectory"],
    assertions: [
      {
        path: "systemCalibration.expectedCalibrationError",
        comparator: "lte",
        expected: 0.2,
      },
    ],
  },
  {
    id: "bench:overconfidence-detection",
    description:
      "When confident strong-fit predictions are disconfirmed, the reliability analyzer must classify at least one bucket as overconfident.",
    kinds: ["candidate-fit"],
    assertions: [
      {
        path: "reliability.overconfidenceRisk.exists",
        comparator: "gte",
        expected: 1,
      },
    ],
  },
  {
    id: "bench:risk-precision-floor",
    description:
      "Hiring-risk predictions must achieve at least 0.5 precision once two outcomes are observed.",
    kinds: ["hiring-risk"],
    assertions: [
      {
        path: "predictionEvaluation.hiring-risk.precision",
        comparator: "gte",
        expected: 0.5,
      },
    ],
  },
  {
    id: "bench:archetype-coverage",
    description:
      "At least one archetype with a resolved sample must report a realised accuracy ≥ 0.5.",
    kinds: ["candidate-fit"],
    assertions: [
      {
        path: "archetypePerformance.maxRealisedAccuracy",
        comparator: "gte",
        expected: 0.5,
      },
    ],
  },
];

export function runBenchmarks(
  report: EvaluationReport,
  scenarios: BenchmarkScenario[] = DEFAULT_BENCHMARK_SCENARIOS,
): BenchmarkResult[] {
  return scenarios.map((scenario) => {
    const assertionResults = scenario.assertions.map((a) =>
      runAssertion(report, a),
    );
    return {
      scenarioId: scenario.id,
      passed: assertionResults.every((r) => r.passed),
      assertionResults,
    };
  });
}

function runAssertion(
  report: EvaluationReport,
  assertion: BenchmarkAssertion,
): BenchmarkResult["assertionResults"][number] {
  const actual = resolvePath(report, assertion.path);
  const passed = compare(actual, assertion);
  return {
    path: assertion.path,
    comparator: assertion.comparator,
    expected: assertion.expected,
    actual,
    passed,
  };
}

function compare(actual: number, a: BenchmarkAssertion): boolean {
  switch (a.comparator) {
    case "lte":
      return actual <= a.expected;
    case "gte":
      return actual >= a.expected;
    case "eq":
      return actual === a.expected;
    case "approx":
      return Math.abs(actual - a.expected) <= (a.tolerance ?? 0.05);
  }
}

/** Dotted-path resolver with two synthetic accessors:
 *    - "...exists": converts truthy enum ("medium"/"high") into 1
 *    - "predictionEvaluation.<kind>.<field>": picks the per-kind report
 *    - "archetypePerformance.maxRealisedAccuracy": max over archetypes
 */
function resolvePath(report: EvaluationReport, path: string): number {
  if (path === "archetypePerformance.maxRealisedAccuracy") {
    return Math.max(
      0,
      ...report.archetypePerformance.map((a) =>
        a.sampleSize > 0 ? a.realisedAccuracy : 0,
      ),
    );
  }
  if (path === "reliability.overconfidenceRisk.exists") {
    return report.reliability.overconfidenceRisk === "low" ? 0 : 1;
  }
  if (path.startsWith("predictionEvaluation.")) {
    // "predictionEvaluation.<kind>.<field>"
    const [, kind, field] = path.split(".");
    const r = report.predictionEvaluation.kindReports.find(
      (k) => k.predictionKind === (kind as string),
    );
    if (!r) return 0;
    const value = (r as unknown as Record<string, number>)[field];
    return typeof value === "number" ? value : 0;
  }
  // Generic dotted path.
  const parts = path.split(".");
  let cur: unknown = report;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return 0;
    }
  }
  return typeof cur === "number" ? cur : 0;
}
