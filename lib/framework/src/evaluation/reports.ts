import {
  type Clock,
  type EvaluationReport,
  type OutcomeEvent,
  type PredictionRecord,
} from "./types.js";
import {
  analyzeReliability,
  buildPredictionEvaluationReport,
  computeCalibration,
  evaluatePredictionsByKind,
} from "./evaluation.js";
import {
  buildOrganizationalLearning,
  detectDrift,
  trackArchetypePerformance,
  trackTrajectories,
} from "./learning.js";
import { runBenchmarks } from "./benchmarks.js";

// =========================================================================
// 10. EvaluationReportEngine + runEvaluationLayer orchestrator
// =========================================================================

const SYSTEM_CLOCK: Clock = { now: () => new Date() };

export function runEvaluationLayer(
  predictions: PredictionRecord[],
  outcomes: OutcomeEvent[],
  clock: Clock = SYSTEM_CLOCK,
): EvaluationReport {
  const kindReports = evaluatePredictionsByKind(predictions, outcomes);
  const predictionEvaluation = buildPredictionEvaluationReport(kindReports);
  const cal = computeCalibration(predictions, outcomes);
  const reliability = analyzeReliability(cal.global, kindReports);
  const archetypePerformance = trackArchetypePerformance(predictions, outcomes);
  const organizationalLearning = buildOrganizationalLearning(
    predictions,
    outcomes,
  );
  const drift = detectDrift(predictions, outcomes);
  const trajectory = trackTrajectories(predictions, outcomes);

  const report: EvaluationReport = {
    generatedAt: clock.now().toISOString(),
    generatedBy: "evaluation-report-engine",
    predictionsEvaluated: predictions.length,
    outcomesObserved: outcomes.length,
    systemCalibration: cal.global,
    perAgentCalibration: cal.perAgent,
    perOrgCalibration: cal.perOrg,
    perArchetypeCalibration: cal.perArchetype,
    reliability,
    predictionEvaluation,
    archetypePerformance,
    organizationalLearning,
    drift,
    trajectory,
    benchmarks: [],
    longitudinalInsights: [],
    recommendations: [],
  };

  report.benchmarks = runBenchmarks(report);
  report.longitudinalInsights = buildInsights(report);
  report.recommendations = buildRecommendations(report);
  return report;
}

function buildInsights(report: EvaluationReport): string[] {
  const out: string[] = [];
  out.push(
    `Across ${report.predictionsEvaluated} predictions and ${report.outcomesObserved} outcome events, expected calibration error is ${report.systemCalibration.expectedCalibrationError.toFixed(2)}.`,
  );
  const inflatedKinds = report.predictionEvaluation.kindReports.filter(
    (k) => k.calibrationGap > 0.15,
  );
  if (inflatedKinds.length > 0) {
    out.push(
      `Over-confidence concentrated in: ${inflatedKinds.map((k) => k.predictionKind).join(", ")}.`,
    );
  }
  for (const t of report.trajectory) {
    out.push(
      `${t.candidateId} @ ${t.organizationId}: predicted trajectory ${t.predictedTrajectory.toFixed(2)} vs realised ${t.realisedVelocity.toFixed(2)} (${t.roleEvolution}).`,
    );
  }
  for (const a of report.archetypePerformance) {
    if (a.sampleSize > 0) {
      out.push(
        `Archetype ${a.archetype}: ${a.sampleSize} samples, success ${(a.successRate * 100).toFixed(0)}%, retention ${(a.retentionRate * 100).toFixed(0)}%.`,
      );
    }
  }
  for (const d of report.drift.detectedDrifts) {
    out.push(`Drift (${d.driftType}/${d.severity}): ${d.detail}`);
  }
  return out;
}

function buildRecommendations(report: EvaluationReport): string[] {
  const out: string[] = [];
  if (report.systemCalibration.systematicBias > 0.05) {
    out.push(
      `Reduce blanket confidence by ${(report.systemCalibration.systematicBias * 100).toFixed(0)}pp until calibration converges.`,
    );
  }
  if (report.reliability.overconfidenceRisk !== "low") {
    out.push(
      `Penalise overconfident buckets: ${report.reliability.bucketClassifications
        .filter((b) => b.classification === "overconfident")
        .map((b) => b.bucket)
        .join(", ")}.`,
    );
  }
  for (const sig of report.organizationalLearning) {
    for (const adj of sig.recommendedWeightAdjustments) {
      out.push(
        `org=${sig.organizationId}: adjust ${adj.agent} by ${adj.adjustment >= 0 ? "+" : ""}${adj.adjustment.toFixed(2)} — ${adj.rationale}`,
      );
    }
  }
  for (const b of report.benchmarks.filter((b) => !b.passed)) {
    out.push(
      `Benchmark ${b.scenarioId} FAILED: ${b.assertionResults
        .filter((r) => !r.passed)
        .map((r) => `${r.path} ${r.comparator} ${r.expected} (got ${r.actual})`)
        .join("; ")}`,
    );
  }
  if (out.length === 0) out.push("System within tolerance. No recalibration required.");
  return out;
}
