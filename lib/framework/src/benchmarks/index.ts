/**
 * Cognitive Benchmark + Smoke Test entry point.
 *
 * The benchmark suite is the framework's regression protection against
 * silent cognition drift. It composes the 10 deterministic scenarios,
 * runs the full cognition + organisation-intelligence stack with a
 * fixed clock, and emits a structured report. Same input + same
 * organisation + same clock = same output.
 */

import { BENCHMARK_SCENARIOS } from "./corpus.js";
import { runScenario, BENCHMARK_CLOCK_ISO } from "./runner.js";
import { evaluateExpectations } from "./expectations.js";
import { verifyDeterminism } from "./determinism.js";
import { verifyCognitionIntegrity } from "./cognition_integrity.js";
import { verifyProvenance } from "./provenance_integrity.js";
import { verifyCalibrationSmoke } from "./calibration_smoke.js";
import { buildSnapshot, compareSnapshots } from "./snapshot.js";
import { runMutationGuards } from "./mutation_guards.js";
import { deriveRecommendations } from "./report.js";
import type {
  BenchmarkArchetype,
  BenchmarkReport,
  ScenarioOutputs,
  ScenarioResult,
  SnapshotFile,
} from "./types.js";

export * from "./types.js";
export { BENCHMARK_SCENARIOS, CHAOS_ORG, STRUCTURED_ORG } from "./corpus.js";
export { runScenario, runAllScenarios, BENCHMARK_CLOCK_ISO } from "./runner.js";
export { evaluateExpectations, evaluateExpectation } from "./expectations.js";
export { verifyDeterminism } from "./determinism.js";
export { verifyCognitionIntegrity } from "./cognition_integrity.js";
export { verifyProvenance } from "./provenance_integrity.js";
export { verifyCalibrationSmoke } from "./calibration_smoke.js";
export {
  buildSnapshot,
  compareSnapshots,
  serializeSnapshot,
  parseSnapshot,
} from "./snapshot.js";
export { runMutationGuards } from "./mutation_guards.js";
export {
  renderMarkdownReport,
  renderConsoleSummary,
  deriveRecommendations,
} from "./report.js";
export { structuralHash, canonicalJSON } from "./hash.js";

export interface RunBenchmarkSuiteOptions {
  /** Baseline snapshot to compare against; null means "no baseline yet". */
  baselineSnapshot?: SnapshotFile | null;
}

export interface BenchmarkSuiteRun {
  report: BenchmarkReport;
  outputs: ScenarioOutputs[];
  snapshot: SnapshotFile;
}

export function runBenchmarkSuite(
  opts: RunBenchmarkSuiteOptions = {},
): BenchmarkSuiteRun {
  const scenarios = BENCHMARK_SCENARIOS;
  const outputs: ScenarioOutputs[] = scenarios.map(runScenario);

  const scenarioResults: ScenarioResult[] = scenarios.map((scenario, idx) => {
    const out = outputs[idx];
    const failures = evaluateExpectations(scenario.expectations, out).filter(
      (r) => !r.passed,
    );
    const determinism = verifyDeterminism(scenario, out);
    const cognitionIntegrity = verifyCognitionIntegrity(scenario.archetype, out);
    const provenance = verifyProvenance(out);
    const warnings: string[] = [];
    if (out.cognition.influences.length === 0)
      warnings.push("no cross-agent influences propagated");
    return {
      scenarioId: scenario.scenarioId,
      archetype: scenario.archetype,
      passed:
        failures.length === 0 &&
        determinism.passed &&
        cognitionIntegrity.passed &&
        provenance.ok,
      failures,
      warnings,
      outputs: out,
      determinism,
      cognitionIntegrity,
      provenance,
    };
  });

  const outputsByScenario = new Map<BenchmarkArchetype, ScenarioOutputs>(
    outputs.map((o) => [o.scenarioId, o]),
  );
  const mutationGuards = runMutationGuards(scenarios, outputsByScenario);
  const calibration = verifyCalibrationSmoke(outputs);
  const currentSnapshot = buildSnapshot(outputs);
  const snapshotDrift = compareSnapshots(
    opts.baselineSnapshot ?? null,
    currentSnapshot,
  );
  const recommendations = deriveRecommendations(scenarioResults);
  const passed = scenarioResults.filter((r) => r.passed).length;
  const summary = {
    totalScenarios: scenarioResults.length,
    passed,
    failed: scenarioResults.length - passed,
    determinismOk: scenarioResults.every((s) => s.determinism.passed),
    provenanceOk: scenarioResults.every((s) => s.provenance.ok),
    calibrationOk: calibration.passed,
    snapshotOk: snapshotDrift.ok,
    mutationGuardsOk: mutationGuards.every((g) => g.passed),
  };
  const report: BenchmarkReport = {
    generatedAt: BENCHMARK_CLOCK_ISO,
    generatedBy: "cognitive-benchmark-suite",
    summary,
    scenarios: scenarioResults,
    calibration,
    snapshot: snapshotDrift,
    mutationGuards,
    recommendations,
  };
  return { report, outputs, snapshot: currentSnapshot };
}
