/**
 * DeterminismVerifier — runs each scenario twice with the same fixed
 * clock and verifies the structural digest hashes match exactly. Any
 * drift signals a non-determinism leak (clock, Math.random, ordering).
 */

import type { BenchmarkScenario, DeterminismCheck, ScenarioOutputs } from "./types.js";
import { runScenario } from "./runner.js";

export function verifyDeterminism(
  scenario: BenchmarkScenario,
  firstRun: ScenarioOutputs,
): DeterminismCheck {
  const second = runScenario(scenario);
  const drift: string[] = [];
  if (firstRun.determinismHash !== second.determinismHash) {
    drift.push(
      `determinismHash drift: first=${firstRun.determinismHash} second=${second.determinismHash}`,
    );
  }
  const a = firstRun.digest;
  const b = second.digest;
  (Object.keys(a) as Array<keyof typeof a>).forEach((k) => {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      drift.push(`digest.${String(k)} drift: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`);
    }
  });
  if (firstRun.cognition.influences.length !== second.cognition.influences.length) {
    drift.push(
      `influence count drift: ${firstRun.cognition.influences.length} -> ${second.cognition.influences.length}`,
    );
  }
  if (
    firstRun.cognition.reconciliation.recommendationCategory !==
    second.cognition.reconciliation.recommendationCategory
  ) {
    drift.push("reconciliation.recommendationCategory drift");
  }
  return {
    scenarioId: scenario.scenarioId,
    passed: drift.length === 0,
    firstHash: firstRun.determinismHash,
    secondHash: second.determinismHash,
    drift,
  };
}
