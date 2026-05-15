/**
 * CognitiveScenarioRunner — deterministic, fixed-clock executor that runs
 * the full candidate-intelligence + cross-agent cognition + organization
 * intelligence stack for a single benchmark scenario.
 *
 * Determinism rules enforced here:
 *   - fixed clock injected into every agent and synthesiser
 *   - no Math.random / no Date.now
 *   - inputs traversed in declared order (no in-place sort of corpus arrays)
 */

import {
  BayesianScoringAgent,
  ContradictionAgent,
  TrajectoryAgent,
} from "../agents/flagship/index.js";
import { synthesizeCognition } from "../cognition/index.js";
import { runOrganizationIntelligence } from "../organization_intelligence/index.js";
import type { BenchmarkScenario, ScenarioDigest, ScenarioOutputs } from "./types.js";
import { structuralHash } from "./hash.js";

/** Fixed clock used for every benchmark run, ever. Drift = test failure. */
export const BENCHMARK_CLOCK_ISO = "2026-05-15T00:00:00.000Z";

function fixedNow(): () => Date {
  const d = new Date(BENCHMARK_CLOCK_ISO);
  return () => d;
}

function digest(args: {
  scenario: BenchmarkScenario;
  outputs: Omit<ScenarioOutputs, "digest" | "determinismHash">;
}): ScenarioDigest {
  const { scenario, outputs } = args;
  const { bayesian, contradiction, trajectory, cognition, fit, orgReport } =
    outputs;

  // Estimate of the operations-layer evidence-request signal without running
  // the full operations layer: combine unsupported claims, high-severity
  // contradictions, unknown org fields, and missing team context.
  const evidenceRequestSignal =
    contradiction.result.unsupportedClaims.length +
    contradiction.result.contradictions.filter((c) => c.severity === "high")
      .length +
    orgReport.contextConfidence.unknownFields.length +
    orgReport.teamChemistry.result.missingTeamContext.length +
    orgReport.chaosFit.result.missingEvidence.length;

  return {
    scenarioId: scenario.scenarioId,
    candidateId: scenario.dossier.candidateId,
    organizationId: scenario.organization.id,
    bayesianFit: bayesian.result.fitScore,
    bayesianConfidence: bayesian.confidence,
    contradictionScore: contradiction.result.contradictionScore,
    contradictionCount: contradiction.result.contradictions.length,
    unsupportedClaimCount: contradiction.result.unsupportedClaims.length,
    trajectoryScore: trajectory.result.trajectoryScore,
    trajectoryConfidence: trajectory.confidence,
    globalConfidence: cognition.confidence.globalConfidence,
    disagreementScore: cognition.disagreement.disagreementScore,
    ambiguityLevel: cognition.disagreement.ambiguityLevel,
    certaintyCategory: cognition.uncertainty.certaintyCategory,
    recommendationCategory: cognition.reconciliation.recommendationCategory,
    unresolvedQuestionCount: cognition.disagreement.unresolvedQuestions.length,
    influenceCount: cognition.influences.length,
    evidenceChainCount:
      (bayesian.evidenceChain?.length ?? 0) +
      (contradiction.evidenceChain?.length ?? 0) +
      (trajectory.evidenceChain?.length ?? 0),
    reasoningStepCount:
      (bayesian.reasoning?.length ?? 0) +
      (contradiction.reasoning?.length ?? 0) +
      (trajectory.reasoning?.length ?? 0),
    archetypeMatchCount: cognition.memory.matchedArchetypes.length,
    fitRecommendation: fit.fitRecommendation,
    fitConfidence: fit.fitConfidence,
    overallHiringRisk: orgReport.hiringRisk.result.overallHiringRisk,
    chaosFitScore: orgReport.chaosFit.result.chaosFitScore,
    evidenceRequestSignal,
  };
}

export function runScenario(scenario: BenchmarkScenario): ScenarioOutputs {
  const now = fixedNow();
  const bayesianAgent = new BayesianScoringAgent({ now });
  const contradictionAgent = new ContradictionAgent({ now });
  const trajectoryAgent = new TrajectoryAgent({ now });

  const bayesian = bayesianAgent.run(scenario.dossier);
  const contradiction = contradictionAgent.run(scenario.dossier);
  const trajectory = trajectoryAgent.run(scenario.dossier);

  const preCognitionBayesianConfidence = bayesian.confidence;

  const analysis = {
    candidateId: scenario.dossier.candidateId,
    bayesian,
    contradiction,
    trajectory,
  };
  const cognition = synthesizeCognition(analysis, { now });
  const orgRun = runOrganizationIntelligence(
    analysis,
    cognition,
    scenario.organization,
    { now },
  );

  const partial: Omit<ScenarioOutputs, "digest" | "determinismHash"> = {
    scenarioId: scenario.scenarioId,
    candidateId: scenario.dossier.candidateId,
    organizationId: scenario.organization.id,
    generatedAt: BENCHMARK_CLOCK_ISO,
    bayesian,
    contradiction,
    trajectory,
    cognition,
    fit: orgRun.fit,
    orgReport: orgRun.report,
    preCognitionBayesianConfidence,
  };
  const d = digest({ scenario, outputs: partial });
  return {
    ...partial,
    digest: d,
    determinismHash: structuralHash(d),
  };
}

export function runAllScenarios(
  scenarios: BenchmarkScenario[],
): ScenarioOutputs[] {
  return scenarios.map(runScenario);
}
