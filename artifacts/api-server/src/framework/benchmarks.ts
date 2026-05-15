import type {
  BenchmarkReport as FrameworkBenchmarkReport,
  ScenarioResult,
} from "@workspace/framework/benchmarks";
import { BENCHMARK_SCENARIOS } from "@workspace/framework/benchmarks";

export interface BenchmarkApiExpectationFailure {
  type: string;
  path?: string;
  passed: boolean;
  detail: string;
  rationale?: string;
}

export interface BenchmarkApiScenarioResult {
  scenarioId: string;
  archetype: string;
  description: string;
  passed: boolean;
  determinismHash: string;
  digest: ScenarioResult["outputs"]["digest"];
  failures: BenchmarkApiExpectationFailure[];
  warnings: string[];
  determinism: {
    scenarioId: string;
    passed: boolean;
    firstHash: string;
    secondHash: string;
    drift: string[];
  };
  cognitionIntegrity: {
    scenarioId: string;
    passed: boolean;
    findings: { ok: boolean; rule: string; detail: string }[];
  };
  provenance: {
    ok: boolean;
    findings: { ok: boolean; path: string; detail: string }[];
  };
}

export interface BenchmarkApiReport {
  generatedAt: string;
  generatedBy: string;
  summary: FrameworkBenchmarkReport["summary"];
  scenarios: BenchmarkApiScenarioResult[];
  calibration: FrameworkBenchmarkReport["calibration"];
  snapshot: FrameworkBenchmarkReport["snapshot"];
  mutationGuards: FrameworkBenchmarkReport["mutationGuards"];
  recommendations: string[];
}

export function toBenchmarkApiReport(
  r: FrameworkBenchmarkReport,
): BenchmarkApiReport {
  const descriptions = new Map(
    BENCHMARK_SCENARIOS.map((s) => [s.scenarioId, s.description]),
  );
  return {
    generatedAt: r.generatedAt,
    generatedBy: r.generatedBy,
    summary: r.summary,
    scenarios: r.scenarios.map((s) => ({
      scenarioId: s.scenarioId,
      archetype: s.archetype,
      description: descriptions.get(s.scenarioId) ?? "",
      passed: s.passed,
      determinismHash: s.outputs.determinismHash,
      digest: s.outputs.digest,
      failures: s.failures.map((f) => ({
        type: f.expectation.type,
        path: f.expectation.path,
        passed: f.passed,
        detail: f.detail,
        rationale: f.expectation.rationale,
      })),
      warnings: s.warnings,
      determinism: {
        scenarioId: s.determinism.scenarioId,
        passed: s.determinism.passed,
        firstHash: s.determinism.firstHash,
        secondHash: s.determinism.secondHash,
        drift: s.determinism.drift,
      },
      cognitionIntegrity: {
        scenarioId: s.cognitionIntegrity.scenarioId,
        passed: s.cognitionIntegrity.passed,
        findings: s.cognitionIntegrity.findings,
      },
      provenance: {
        ok: s.provenance.ok,
        findings: s.provenance.findings,
      },
    })),
    calibration: r.calibration,
    snapshot: r.snapshot,
    mutationGuards: r.mutationGuards,
    recommendations: r.recommendations,
  };
}
