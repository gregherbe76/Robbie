/**
 * CandidateOrganizationFitEngine + OrganizationIntelligenceReportEngine.
 *
 * Synthesises the five organisation-intelligence agents plus the candidate's
 * existing analysis + cognition into:
 *   - a `CandidateOrganizationFitResult` (the recommendation)
 *   - a full `OrganizationIntelligenceReport` (the founder-readable doc)
 *
 * Rules:
 *   - If context completeness is below a threshold → insufficient_context
 *     (we never invent a recommendation from thin air).
 *   - High risk + high upside (strong trajectory) → high_upside_high_risk
 *   - High risk + low upside → poor_context_fit (i.e. don't hire here)
 *   - Low risk + high fit → strong_fit
 *   - Otherwise conditional_fit, with explicit conditions
 */

import type { CandidateAnalysisLike } from "../cognition/synthesize.js";
import type { CognitiveSynthesis } from "../cognition/types.js";
import {
  analyzeChaosTolerance,
  analyzeFounderStyle,
  analyzeHiringRisk,
  analyzeRoleEnvironment,
  analyzeTeamChemistry,
} from "./agents.js";
import { summariseContextCompleteness } from "./context.js";
import type {
  AgentReasoning,
  CandidateOrganizationFitResult,
  ChaosToleranceResult,
  FitRecommendation,
  FounderStyleResult,
  HiringRiskResult,
  OrganizationContext,
  OrganizationIntelligenceReport,
  RoleEnvironmentResult,
  TeamChemistryResult,
} from "./types.js";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

interface Now {
  now: () => Date;
}
const DEFAULT_NOW: Now = { now: () => new Date() };

const CONTEXT_COMPLETENESS_THRESHOLD = 0.45;

export interface FitInputs {
  analysis: CandidateAnalysisLike;
  cognition: CognitiveSynthesis;
  org: OrganizationContext;
  founder: AgentReasoning<FounderStyleResult>;
  team: AgentReasoning<TeamChemistryResult>;
  chaos: AgentReasoning<ChaosToleranceResult>;
  role: AgentReasoning<RoleEnvironmentResult>;
  risk: AgentReasoning<HiringRiskResult>;
}

export function computeCandidateOrgFit(
  inputs: FitInputs,
): CandidateOrganizationFitResult {
  const { analysis, cognition, org, team, chaos, role, risk } = inputs;
  const completeness = summariseContextCompleteness(org);

  // Insufficient-context gate.
  if (completeness.averageFieldConfidence < CONTEXT_COMPLETENESS_THRESHOLD) {
    return {
      candidateId: analysis.candidateId,
      organizationId: org.id,
      fitRecommendation: "insufficient_context",
      fitConfidence: completeness.averageFieldConfidence,
      contextCompleteness: completeness.averageFieldConfidence,
      successConditions: [],
      failureModes: [
        `Organization context is below the ${CONTEXT_COMPLETENESS_THRESHOLD.toFixed(2)} confidence threshold (${completeness.averageFieldConfidence.toFixed(2)}).`,
      ],
      onboardingRisks: [],
      managementImplications: [],
      interviewFocusAreas: completeness.unknownFields.map(
        (f) => `Resolve unknown organization field: ${f}.`,
      ),
      finalRationale:
        "Insufficient organization context to commit to a recommendation. Strengthen context before scoring fit.",
    };
  }

  const fit = analysis.bayesian.result.fitScore;
  const r = risk.result.overallHiringRisk;
  const upside = analysis.trajectory.result.trajectoryScore;
  const cleanNarrative =
    1 - analysis.contradiction.result.contradictionScore;
  const chaosFit = chaos.result.chaosFitScore;
  const roleEnvFit = role.result.candidateFitAgainstRoleEnvironment;

  // Org × Candidate fit blends all six signals. Each signal can independently
  // disqualify a strong_fit, and chaos/role-env mismatches escalate risk.
  const envMismatch = chaosFit < 0.5 || roleEnvFit < 0.5;
  const envStrong = chaosFit >= 0.65 && roleEnvFit >= 0.6;

  let category: FitRecommendation;
  if (
    fit >= 0.7 &&
    r < 0.4 &&
    cleanNarrative > 0.7 &&
    envStrong
  ) {
    category = "strong_fit";
  } else if (
    (r > 0.65 && upside < 0.45) ||
    (envMismatch && r > 0.55) ||
    (chaosFit < 0.35 && fit < 0.5)
  ) {
    category = "poor_context_fit";
  } else if (
    (r > 0.55 && upside >= 0.55) ||
    (envMismatch && upside >= 0.6)
  ) {
    category = "high_upside_high_risk";
  } else {
    category = "conditional_fit";
  }

  const successConditions: string[] = [];
  const failureModes: string[] = [];
  const onboardingRisks: string[] = [];
  const managementImplications: string[] = [];
  const interviewFocusAreas: string[] = [];

  // Success conditions — what would need to be true.
  if (chaos.result.riskLevel !== "low") {
    successConditions.push(
      `Pair onboarding with a senior peer who can absorb ambiguity during ramp (chaos risk ${chaos.result.riskLevel}).`,
    );
  }
  if (
    org.fields.managementDensity.value === "flat" &&
    org.fields.founderInvolvement.value === "omnipresent"
  ) {
    successConditions.push(
      "Candidate must align directly with the founder weekly — there is no manager buffer.",
    );
  }
  if (team.result.complementaritySignals.length > 0) {
    successConditions.push(
      "Position the candidate against the complementarity signals identified by team chemistry.",
    );
  }

  // Failure modes.
  for (const d of risk.result.strongestRiskDrivers) {
    failureModes.push(`[${d.category}/${d.severity}] ${d.summary}`);
  }
  if (cognition.uncertainty.certaintyCategory === "ambiguous") {
    failureModes.push(
      "Cross-agent cognition flagged the candidate as ambiguous; an org × candidate fit cannot exceed cognition certainty.",
    );
  }

  // Onboarding risks.
  for (const m of role.result.mismatchAreas) {
    onboardingRisks.push(
      `${m.field}: ${m.candidateSignal} vs ${m.roleRequirement} (${m.severity}).`,
    );
  }
  if (team.result.collisionRisks.some((c) => c.severity === "high")) {
    onboardingRisks.push(
      "High-severity team collision risks — first 90 days are load-bearing.",
    );
  }

  // Management implications.
  if (org.fields.managementDensity.value === "flat") {
    managementImplications.push(
      "Founder + senior peer share all 1-on-1 coverage; no EM exists to absorb performance issues.",
    );
  }
  if (chaos.result.toleranceLevel === "low") {
    managementImplications.push(
      "Manager must over-invest in goal-setting structure for the first 60 days.",
    );
  }

  // Interview focus areas.
  for (const inv of risk.result.nextInvestigations) {
    interviewFocusAreas.push(inv);
  }
  for (const inv of role.result.investigationAreas) {
    interviewFocusAreas.push(inv);
  }
  for (const q of cognition.disagreement.unresolvedQuestions) {
    interviewFocusAreas.push(q);
  }

  const fitConfidence = clamp01(
    0.3 * cognition.confidence.globalConfidence +
      0.25 * risk.confidence +
      0.15 * chaos.confidence +
      0.15 * team.confidence +
      0.15 * role.confidence,
  );

  const finalRationale =
    `Recommendation: ${category}. ` +
    `Posterior fit ${fit.toFixed(2)}; hiring risk ${r.toFixed(2)}; trajectory ${upside.toFixed(2)}; ` +
    `cleanness ${cleanNarrative.toFixed(2)}; chaos fit ${chaos.result.chaosFitScore.toFixed(2)}; ` +
    `role-env fit ${role.result.candidateFitAgainstRoleEnvironment.toFixed(2)}; ` +
    `context completeness ${completeness.averageFieldConfidence.toFixed(2)}.`;

  return {
    candidateId: analysis.candidateId,
    organizationId: org.id,
    fitRecommendation: category,
    fitConfidence: Number(fitConfidence.toFixed(3)),
    contextCompleteness: completeness.averageFieldConfidence,
    successConditions,
    failureModes,
    onboardingRisks,
    managementImplications,
    interviewFocusAreas,
    finalRationale,
  };
}

const HEADLINES: Record<FitRecommendation, string> = {
  strong_fit:
    "Strong fit — multi-agent synthesis converges on hire; risk is well-contained.",
  conditional_fit:
    "Conditional fit — hire only if the explicit success conditions below are met.",
  high_upside_high_risk:
    "High upside, high risk — trajectory justifies the bet but a specific risk plan is required.",
  poor_context_fit:
    "Poor context fit — even if competent, the candidate is unlikely to succeed in this organisation.",
  insufficient_context:
    "Insufficient context — resolve missing organisation fields before scoring.",
};

export interface ReportInputs extends FitInputs {
  fit: CandidateOrganizationFitResult;
}

export function generateOrganizationIntelligenceReport(
  inputs: ReportInputs,
  deps: Now = DEFAULT_NOW,
): OrganizationIntelligenceReport {
  const { analysis, org, founder, team, chaos, role, risk, fit } = inputs;
  const completeness = summariseContextCompleteness(org);

  return {
    candidateId: analysis.candidateId,
    organizationId: org.id,
    generatedAt: deps.now().toISOString(),
    fitSummary: {
      recommendation: fit.fitRecommendation,
      confidence: fit.fitConfidence,
      headline: HEADLINES[fit.fitRecommendation],
    },
    contextConfidence: {
      averageFieldConfidence: completeness.averageFieldConfidence,
      knownFields: completeness.knownFields,
      unknownFields: completeness.unknownFields,
    },
    founderFit: founder,
    teamChemistry: team,
    chaosFit: chaos,
    roleEnvironment: role,
    hiringRisk: risk,
    successConditions: fit.successConditions,
    failureModes: fit.failureModes,
    interviewFocusAreas: fit.interviewFocusAreas,
    finalRecommendation: {
      category: fit.fitRecommendation,
      narrative: fit.finalRationale,
      confidence: fit.fitConfidence,
    },
  };
}

/**
 * Orchestrator. Runs all five organisation-intelligence agents in the
 * deterministic order chaos → founder → team → role → risk, then computes
 * the fit recommendation and renders the report.
 */
export function runOrganizationIntelligence(
  analysis: CandidateAnalysisLike,
  cognition: CognitiveSynthesis,
  org: OrganizationContext,
  deps: Now = DEFAULT_NOW,
): {
  founder: AgentReasoning<FounderStyleResult>;
  team: AgentReasoning<TeamChemistryResult>;
  chaos: AgentReasoning<ChaosToleranceResult>;
  role: AgentReasoning<RoleEnvironmentResult>;
  risk: AgentReasoning<HiringRiskResult>;
  fit: CandidateOrganizationFitResult;
  report: OrganizationIntelligenceReport;
} {
  const founder = analyzeFounderStyle(analysis.candidateId, org, deps);
  const team = analyzeTeamChemistry(analysis, org, deps);
  const chaos = analyzeChaosTolerance(analysis, org, deps);
  const role = analyzeRoleEnvironment(analysis, org, deps);
  const risk = analyzeHiringRisk(analysis, org, chaos, team, role, deps);

  const fit = computeCandidateOrgFit({
    analysis,
    cognition,
    org,
    founder,
    team,
    chaos,
    role,
    risk,
  });

  const report = generateOrganizationIntelligenceReport(
    { analysis, cognition, org, founder, team, chaos, role, risk, fit },
    deps,
  );

  return { founder, team, chaos, role, risk, fit, report };
}
