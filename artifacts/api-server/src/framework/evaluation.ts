/**
 * Builds the deterministic PredictionRecord stream from the seeded analyses,
 * cognition, and organization-intelligence outputs, ingests seeded outcomes,
 * and runs the evaluation layer with a fixed clock.
 *
 * The output is cached at boot — like every other introspection surface, the
 * evaluation report is a deterministic function of the seeded corpus.
 */

import {
  OutcomeTrackingEngine,
  buildSeedOutcomes,
  runEvaluationLayer,
  type EvaluationReport,
  type OutcomeEvent,
  type PredictionRecord,
} from "@workspace/framework/evaluation";
import type { CognitiveSynthesis, ArchetypeMatch } from "@workspace/framework/cognition";
import type { CandidateOrganizationFitResult } from "@workspace/framework/organization-intelligence";
import type { OrganizationIntelligenceReport } from "@workspace/framework/organization-intelligence";
import type { CandidateAnalysis } from "./bootstrap";

/** Map fit recommendation enum to a [0,1] positive-class score. */
function recommendationToScore(
  rec: CandidateOrganizationFitResult["fitRecommendation"],
): number {
  switch (rec) {
    case "strong_fit":
      return 0.85;
    case "conditional_fit":
      return 0.65;
    case "high_upside_high_risk":
      return 0.55;
    case "poor_context_fit":
      return 0.2;
    case "insufficient_context":
      return 0.5;
  }
}

function dominantArchetype(synthesis: CognitiveSynthesis | undefined): string | undefined {
  if (!synthesis) return undefined;
  const matched = synthesis.memory.matchedArchetypes;
  if (matched.length === 0) return undefined;
  // Pick the highest-scoring archetype; tie-break deterministically by id.
  const sorted = matched
    .slice()
    .sort((a: ArchetypeMatch, b: ArchetypeMatch) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.archetypeId.localeCompare(b.archetypeId);
    });
  return sorted[0].archetypeId;
}

export function buildPredictionStream(args: {
  analyses: CandidateAnalysis[];
  cognitions: Map<string, CognitiveSynthesis>;
  orgFits: Map<string, CandidateOrganizationFitResult>;
  orgReports: Map<string, OrganizationIntelligenceReport>;
  organizationId: string;
  generatedAt: string;
}): PredictionRecord[] {
  const out: PredictionRecord[] = [];
  for (const a of args.analyses) {
    const archetype = dominantArchetype(args.cognitions.get(a.candidateId));
    // candidate-fit (positive polarity)
    out.push({
      id: `pred:${a.candidateId}:candidate-fit`,
      predictionKind: "candidate-fit",
      organizationId: args.organizationId,
      candidateId: a.candidateId,
      score: a.bayesian.result.fitScore,
      confidence: a.bayesian.confidence,
      archetype,
      producedBy: "bayesian-scorer",
      predictedAt: args.generatedAt,
      rationale: a.bayesian.provenance.rationale ?? "",
    });
    // contradiction (negative polarity)
    out.push({
      id: `pred:${a.candidateId}:contradiction`,
      predictionKind: "contradiction",
      organizationId: args.organizationId,
      candidateId: a.candidateId,
      score: a.contradiction.result.contradictionScore,
      confidence: a.contradiction.confidence,
      archetype,
      producedBy: "contradiction-detector",
      predictedAt: args.generatedAt,
      rationale: a.contradiction.provenance.rationale ?? "",
    });
    // trajectory (positive polarity)
    out.push({
      id: `pred:${a.candidateId}:trajectory`,
      predictionKind: "trajectory",
      organizationId: args.organizationId,
      candidateId: a.candidateId,
      score: a.trajectory.result.trajectoryScore,
      confidence: a.trajectory.confidence,
      archetype,
      producedBy: "trajectory-modeler",
      predictedAt: args.generatedAt,
      rationale: a.trajectory.provenance.rationale ?? "",
    });
    // Organization-intelligence-derived predictions.
    const key = `${args.organizationId}::${a.candidateId}`;
    const fit = args.orgFits.get(key);
    const report = args.orgReports.get(key);
    if (fit && report) {
      out.push({
        id: `pred:${a.candidateId}:org-fit`,
        predictionKind: "org-fit",
        organizationId: args.organizationId,
        candidateId: a.candidateId,
        score: recommendationToScore(fit.fitRecommendation),
        confidence: fit.fitConfidence,
        archetype,
        producedBy: "organization-intelligence",
        predictedAt: args.generatedAt,
        rationale: fit.finalRationale,
      });
      // chaos-fit
      out.push({
        id: `pred:${a.candidateId}:chaos-fit`,
        predictionKind: "chaos-fit",
        organizationId: args.organizationId,
        candidateId: a.candidateId,
        score: report.chaosFit.result.chaosFitScore,
        confidence: report.chaosFit.confidence,
        archetype,
        producedBy: "chaos-tolerance-agent",
        predictedAt: args.generatedAt,
        rationale: report.chaosFit.provenance.rationale ?? "",
      });
      // hiring-risk (negative polarity)
      out.push({
        id: `pred:${a.candidateId}:hiring-risk`,
        predictionKind: "hiring-risk",
        organizationId: args.organizationId,
        candidateId: a.candidateId,
        score: report.hiringRisk.result.overallHiringRisk,
        confidence: report.hiringRisk.confidence,
        archetype,
        producedBy: "hiring-risk-agent",
        predictedAt: args.generatedAt,
        rationale: report.hiringRisk.provenance.rationale ?? "",
      });
    }
  }
  // Stable, deterministic order.
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export interface EvaluationContext {
  outcomes: OutcomeEvent[];
  predictions: PredictionRecord[];
  report: EvaluationReport;
}

export function buildEvaluationContext(args: {
  analyses: CandidateAnalysis[];
  cognitions: Map<string, CognitiveSynthesis>;
  orgFits: Map<string, CandidateOrganizationFitResult>;
  orgReports: Map<string, OrganizationIntelligenceReport>;
  organizationId: string;
  generatedAt: string;
}): EvaluationContext {
  const generatedAtDate = new Date(args.generatedAt);
  const tracker = new OutcomeTrackingEngine();
  tracker.ingestMany(buildSeedOutcomes(generatedAtDate));
  const outcomes = tracker.all();
  const predictions = buildPredictionStream(args);
  const report = runEvaluationLayer(predictions, outcomes, {
    now: () => generatedAtDate,
  });
  return { outcomes, predictions, report };
}
