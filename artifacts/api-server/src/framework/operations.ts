/**
 * Bridge: builds CaseInputs from the seeded analyses, cognition,
 * organization-intelligence, and evaluation outputs, then runs the
 * Intelligence Operations Layer with a fixed clock.
 *
 * The output is cached at boot — every operations artefact is a deterministic
 * function of the seeded corpus.
 */

import {
  runIntelligenceOperationsLayer,
  type CaseInputs,
  type OperationsReport,
} from "@workspace/framework/intelligence-operations";
import type { CognitiveSynthesis } from "@workspace/framework/cognition";
import type {
  CandidateOrganizationFitResult,
  OrganizationIntelligenceReport,
} from "@workspace/framework/organization-intelligence";
import type { EvaluationReport } from "@workspace/framework/evaluation";
import type { CandidateAnalysis } from "./bootstrap";

export interface OperationsContext {
  report: OperationsReport;
}

export function buildOperationsContext(args: {
  analyses: CandidateAnalysis[];
  cognitions: Map<string, CognitiveSynthesis>;
  orgFits: Map<string, CandidateOrganizationFitResult>;
  orgReports: Map<string, OrganizationIntelligenceReport>;
  organizationId: string;
  generatedAt: string;
  evaluationReport: EvaluationReport | null;
}): OperationsContext {
  const calibrationWarnings = buildGlobalCalibrationWarnings(
    args.evaluationReport,
  );
  const longitudinalUpdates = buildGlobalLongitudinalUpdates(
    args.evaluationReport,
  );
  const overconfidenceRisk =
    args.evaluationReport?.reliability.overconfidenceRisk ?? "low";

  const cases: CaseInputs[] = [];
  for (const a of args.analyses) {
    const cognition = args.cognitions.get(a.candidateId);
    const key = `${args.organizationId}::${a.candidateId}`;
    const fit = args.orgFits.get(key);
    const orgReport = args.orgReports.get(key);
    if (!cognition || !fit || !orgReport) continue;

    const caseId = key;
    const candidateName = a.candidateName;
    const targetRole = a.targetRole;
    const generatedAt = args.generatedAt;

    const contradictions = a.contradiction.result.contradictions.map((c) => ({
      id: c.id,
      summary: c.summary,
      severity: c.severity,
      derivedFrom: c.derivedFrom.slice(),
    }));
    const unsupportedClaims = a.contradiction.result.unsupportedClaims.map(
      (c) => c.summary,
    );
    const highSeverity = contradictions.filter(
      (c) => c.severity === "high",
    ).length;

    const bayesianEvidence = a.bayesian.provenance.derivedFrom ?? [];
    const trajectoryEvidence = a.trajectory.provenance.derivedFrom ?? [];
    const contradictionEvidence =
      a.contradiction.provenance.derivedFrom ?? [];
    const evidenceCount = new Set([
      ...bayesianEvidence,
      ...trajectoryEvidence,
      ...contradictionEvidence,
    ]).size;

    const unknownContextFields =
      orgReport.contextConfidence.unknownFields.slice();
    const roleMismatches = orgReport.roleEnvironment.result.mismatchAreas.map(
      (m) => ({
        field: String(m.field),
        candidateSignal: m.candidateSignal,
        roleRequirement: m.roleRequirement,
        severity: m.severity,
      }),
    );
    const missingTeamContext =
      orgReport.teamChemistry.result.missingTeamContext.slice();
    const chaosMissingEvidence =
      orgReport.chaosFit.result.missingEvidence.slice();
    const hiringRiskNextInvestigations =
      orgReport.hiringRisk.result.nextInvestigations.slice();
    const roleEnvironmentInvestigations =
      orgReport.roleEnvironment.result.investigationAreas.slice();
    const collisionRisks = orgReport.teamChemistry.result.collisionRisks.map(
      (r) => ({ id: r.id, severity: r.severity, summary: r.summary }),
    );
    const hiringRiskDrivers =
      orgReport.hiringRisk.result.strongestRiskDrivers.map((d) => ({
        category: String(d.category),
        severity: d.severity,
        summary: d.summary,
        derivedFrom: d.derivedFrom.slice(),
      }));

    const caseInput: CaseInputs = {
      candidateId: a.candidateId,
      candidateName,
      organizationId: args.organizationId,
      targetRole,
      generatedAt,
      originatingAgents: [
        "bayesian-scorer",
        "contradiction-detector",
        "trajectory-modeler",
        "organization-intelligence",
      ],
      investigation: {
        caseId,
        candidateId: a.candidateId,
        organizationId: args.organizationId,
        generatedAt,
        disagreementScore: cognition.disagreement.disagreementScore,
        ambiguityLevel: cognition.disagreement.ambiguityLevel,
        globalConfidence: cognition.confidence.globalConfidence,
        unresolvedQuestionsFromCognition:
          cognition.disagreement.unresolvedQuestions.slice(),
        nextInvestigationsFromCognition:
          cognition.reconciliation.nextInvestigations.slice(),
        contradictions,
        unsupportedClaims,
        fitRecommendation: fit.fitRecommendation,
        hiringRiskNextInvestigations,
        roleEnvironmentInvestigations,
        evidenceCount,
      },
      adversarial: {
        caseId,
        candidateId: a.candidateId,
        organizationId: args.organizationId,
        bayesianFit: a.bayesian.result.fitScore,
        bayesianRationale: a.bayesian.provenance.rationale ?? "",
        bayesianEvidence: bayesianEvidence.slice(),
        trajectoryScore: a.trajectory.result.trajectoryScore,
        trajectoryRationale: a.trajectory.provenance.rationale ?? "",
        trajectoryEvidence: trajectoryEvidence.slice(),
        matchedArchetypes: cognition.memory.matchedArchetypes.map((m) => ({
          archetypeId: m.archetypeId,
          archetypeName: m.archetypeName,
          matchScore: m.matchScore,
          rationale: m.rationale,
        })),
        fitSuccessConditions: fit.successConditions.slice(),
        contradictions,
        hiringRiskDrivers,
        failureModes: fit.failureModes.slice(),
        collisionRisks,
      },
      evidence: {
        caseId,
        candidateId: a.candidateId,
        organizationId: args.organizationId,
        unsupportedClaims,
        contradictionSummaries: contradictions,
        unknownContextFields,
        roleEnvironmentMismatches: roleMismatches,
        missingTeamContext,
        chaosMissingEvidence,
        hiringRiskNextInvestigations,
      },
      hypotheses: {
        caseId,
        candidateId: a.candidateId,
        organizationId: args.organizationId,
        generatedAt,
        matchedArchetypes: cognition.memory.matchedArchetypes.map((m) => ({
          archetypeId: m.archetypeId,
          archetypeName: m.archetypeName,
          matchScore: m.matchScore,
          rationale: m.rationale,
          signals: m.signals.slice(),
        })),
        contradictions: contradictions.map((c) => ({
          id: c.id,
          summary: c.summary,
          severity: c.severity,
        })),
        trajectoryScore: a.trajectory.result.trajectoryScore,
        trajectoryNarrative: a.trajectory.provenance.rationale ?? "",
        trajectoryEvidence: trajectoryEvidence.slice(),
        chaosFitScore: orgReport.chaosFit.result.chaosFitScore,
        chaosLevel: String(orgReport.chaosFit.result.toleranceLevel),
        fitRecommendation: fit.fitRecommendation,
        bayesianFit: a.bayesian.result.fitScore,
        bayesianConfidence: a.bayesian.confidence,
      },
      escalation: {
        caseId,
        candidateId: a.candidateId,
        organizationId: args.organizationId,
        generatedAt,
        disagreementScore: cognition.disagreement.disagreementScore,
        globalConfidence: cognition.confidence.globalConfidence,
        highSeverityContradictionCount: highSeverity,
        evidenceRequestCount: 0, // filled by composer's evidence engine
        fitRecommendation: fit.fitRecommendation,
        overconfidenceRisk,
        hiringRiskOverall: orgReport.hiringRisk.result.overallHiringRisk,
      },
      human: {
        caseId,
        candidateId: a.candidateId,
        organizationId: args.organizationId,
        generatedAt,
        highContradictionCount: highSeverity,
        fitRecommendation: fit.fitRecommendation,
        overconfidenceRisk,
        disagreementScore: cognition.disagreement.disagreementScore,
        globalConfidence: cognition.confidence.globalConfidence,
      },
      consensus: {
        bayesianFit: a.bayesian.result.fitScore,
        bayesianConfidence: a.bayesian.confidence,
        bayesianRationale: a.bayesian.provenance.rationale ?? "",
        contradictionScore: a.contradiction.result.contradictionScore,
        contradictionConfidence: a.contradiction.confidence,
        contradictionRationale: a.contradiction.provenance.rationale ?? "",
        trajectoryScore: a.trajectory.result.trajectoryScore,
        trajectoryConfidence: a.trajectory.confidence,
        trajectoryRationale: a.trajectory.provenance.rationale ?? "",
        reconciliationCategory:
          cognition.reconciliation.recommendationCategory,
        reconciliationConfidence: cognition.confidence.globalConfidence,
        reconciliationRationale: cognition.reconciliation.recommendation,
        humanRecommendation:
          highSeverity >= 2
            ? "investigate"
            : fit.fitRecommendation === "high_upside_high_risk"
              ? "investigate"
              : fit.fitRecommendation === "strong_fit"
                ? "advance"
                : fit.fitRecommendation === "poor_context_fit"
                  ? "decline"
                  : "investigate",
        humanConfidence: 0.7,
        humanRationale:
          "Reviewer reasoned from raw evidence; preserves disagreement where the system surfaced it.",
      },
      calibrationWarnings: calibrationWarnings.slice(),
      longitudinalUpdates: longitudinalUpdates.slice(),
    };
    cases.push(caseInput);
  }

  // Refill escalation.evidenceRequestCount cheaply (a deterministic re-estimate
  // — the actual count is recomputed by the composer's evidence engine).
  for (const c of cases) {
    c.escalation.evidenceRequestCount =
      c.evidence.unsupportedClaims.length +
      c.evidence.contradictionSummaries.filter((x) => x.severity === "high")
        .length +
      c.evidence.unknownContextFields.length +
      c.evidence.roleEnvironmentMismatches.length +
      c.evidence.missingTeamContext.length +
      c.evidence.chaosMissingEvidence.length +
      c.evidence.hiringRiskNextInvestigations.length;
  }

  const report = runIntelligenceOperationsLayer({
    generatedAt: args.generatedAt,
    cases,
  });
  return { report };
}

function buildGlobalCalibrationWarnings(
  report: EvaluationReport | null,
): string[] {
  if (!report) return [];
  const w: string[] = [];
  if (report.reliability.overconfidenceRisk === "high") {
    w.push(
      `System-level over-confidence is HIGH (ECE ${report.systemCalibration.expectedCalibrationError.toFixed(2)}); apply confidence haircut before advancing any case.`,
    );
  }
  if (report.systemCalibration.systematicBias > 0.15) {
    w.push(
      `Systematic bias ${report.systemCalibration.systematicBias.toFixed(2)}: scores claim more than they have shown they can deliver.`,
    );
  }
  for (const d of report.drift.detectedDrifts) {
    if (d.severity === "high") {
      w.push(
        `Drift (${d.driftType}, high): ${d.detail}. ${d.recommendedRecalibration}`,
      );
    }
  }
  return w.sort((a, b) => a.localeCompare(b));
}

function buildGlobalLongitudinalUpdates(
  report: EvaluationReport | null,
): string[] {
  if (!report) return [];
  return report.longitudinalInsights.slice(0, 3);
}
