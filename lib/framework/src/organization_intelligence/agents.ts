/**
 * Five organisation-intelligence agents. Each takes the candidate's
 * `CandidateAnalysisLike` plus the `OrganizationContext` and produces an
 * `AgentReasoning<T>` envelope with reasoning chain, evidence chain,
 * confidence, and provenance.
 *
 * Every agent obeys the same invariants as the flagship layer:
 *   - deterministic given the inputs
 *   - never invents unknown context
 *   - confidence reflects evidence quality + missingness
 */

import type { CandidateAnalysisLike } from "../cognition/synthesize.js";
import type {
  AgentReasoning,
  ChaosToleranceResult,
  ContextField,
  FounderStyleResult,
  HiringRiskBreakdown,
  HiringRiskDriver,
  HiringRiskResult,
  OrganizationContext,
  ReasoningStep,
  RoleEnvironmentMismatch,
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

function envelope<T>(
  agentId: string,
  candidateId: string,
  result: T,
  reasoning: ReasoningStep[],
  evidenceChain: string[],
  confidence: number,
  rationale: string,
  derivedFrom: string[],
  deps: Now = DEFAULT_NOW,
): AgentReasoning<T> {
  return {
    agentId,
    candidateId,
    result,
    reasoning,
    evidenceChain,
    confidence: Number(clamp01(confidence).toFixed(3)),
    provenance: {
      producedBy: agentId,
      producedAt: deps.now().toISOString(),
      rationale,
      derivedFrom,
    },
  };
}

function valueOf<T extends string>(f: ContextField<T>): T | "unknown" {
  return f.value;
}

// =========================================================================
// 1. FounderStyleAgent
// =========================================================================
export function analyzeFounderStyle(
  candidateId: string,
  ctx: OrganizationContext,
  deps: Now = DEFAULT_NOW,
): AgentReasoning<FounderStyleResult> {
  const reasoning: ReasoningStep[] = [];
  const evidenceChain = ctx.founderEvidence.map((e) => e.id);

  const involvement = valueOf(ctx.fields.founderInvolvement);
  const decision = valueOf(ctx.fields.decisionStyle);
  const communication = valueOf(ctx.fields.communicationStyle);
  const speed = valueOf(ctx.fields.executionSpeed);
  const process = valueOf(ctx.fields.processMaturity);

  reasoning.push({
    step: "context-snapshot",
    detail: `involvement=${involvement}, decision=${decision}, comms=${communication}, speed=${speed}, process=${process}.`,
  });

  let archetype: FounderStyleResult["founderStyle"] = "unknown";
  // Deterministic decision tree — explicit rules, no inference of unknowns.
  if (involvement === "unknown" || speed === "unknown") {
    archetype = "unknown";
  } else if (
    involvement === "omnipresent" &&
    speed === "breakneck" &&
    process === "ad-hoc"
  ) {
    archetype = "chaotic-visionary";
  } else if (involvement === "omnipresent" && decision === "command") {
    archetype = "high-control";
  } else if (
    involvement === "hands-on" &&
    (speed === "fast" || speed === "breakneck")
  ) {
    archetype = "high-speed-operator";
  } else if (involvement === "hands-on" && process === "structured") {
    archetype = "structured-operator";
  } else if (involvement === "hands-off" || involvement === "strategic") {
    archetype = "autonomous-builder-friendly";
  } else {
    archetype = "deep-technical";
  }

  reasoning.push({
    step: "founder-archetype",
    detail: `Selected archetype "${archetype}" from the deterministic rule tree.`,
  });

  const strengthsForCandidateTypes: string[] = [];
  const risksForCandidateTypes: string[] = [];
  const communicationImplications: string[] = [];

  if (archetype === "chaotic-visionary") {
    strengthsForCandidateTypes.push(
      "Founder-shaped, high-agency operators who can build under partial information.",
    );
    risksForCandidateTypes.push(
      "Process-dependent senior engineers will stall and disengage.",
    );
    risksForCandidateTypes.push(
      "Candidates who need explicit feedback rituals will read silence as rejection.",
    );
  } else if (archetype === "high-control") {
    strengthsForCandidateTypes.push(
      "Operators who execute crisply against tight specifications.",
    );
    risksForCandidateTypes.push(
      "High-autonomy senior ICs will collide with the founder's review cadence.",
    );
  } else if (archetype === "autonomous-builder-friendly") {
    strengthsForCandidateTypes.push(
      "High-ownership senior engineers who shape direction independently.",
    );
    risksForCandidateTypes.push(
      "Early-career engineers without management coverage may flounder.",
    );
  } else if (archetype === "structured-operator") {
    strengthsForCandidateTypes.push(
      "Candidates who value cadence, planning, and predictable feedback.",
    );
    risksForCandidateTypes.push(
      "Chaos-thriving improvisers may chafe against process.",
    );
  } else if (archetype === "high-speed-operator") {
    strengthsForCandidateTypes.push(
      "Builders who ship fast and tolerate ambiguity in scope.",
    );
    risksForCandidateTypes.push(
      "Engineers who require detailed PRDs before starting will under-deliver.",
    );
  }

  if (communication === "low-context") {
    communicationImplications.push(
      "Founder will deliver feedback directly and bluntly; candidate must not over-read tone.",
    );
  } else if (communication === "high-context") {
    communicationImplications.push(
      "Founder communicates indirectly; candidate must read between the lines.",
    );
  } else if (communication === "unknown") {
    communicationImplications.push(
      "Communication style is unknown — investigate before committing.",
    );
  }

  // Confidence is the average of the underlying context fields plus an
  // explicit penalty if any pivotal field is unknown.
  const pivots = [
    ctx.fields.founderInvolvement,
    ctx.fields.decisionStyle,
    ctx.fields.communicationStyle,
    ctx.fields.executionSpeed,
    ctx.fields.processMaturity,
  ];
  const knownConfidence =
    pivots.reduce((s, f) => s + f.confidence, 0) / pivots.length;
  const unknownPenalty =
    pivots.filter((f) => f.value === "unknown").length * 0.1;
  const confidence = clamp01(knownConfidence - unknownPenalty);

  reasoning.push({
    step: "confidence",
    detail: `Mean pivot confidence ${knownConfidence.toFixed(2)} − unknown penalty ${unknownPenalty.toFixed(2)} = ${confidence.toFixed(2)}.`,
    value: confidence,
  });

  return envelope(
    "founder-style-agent",
    candidateId,
    {
      founderStyle: archetype,
      communicationStyle: communication,
      strengthsForCandidateTypes,
      risksForCandidateTypes,
      communicationImplications,
    },
    reasoning,
    evidenceChain,
    confidence,
    `Founder archetype derived from ${pivots.length} context fields.`,
    evidenceChain,
    deps,
  );
}

// =========================================================================
// 2. TeamChemistryAgent
// =========================================================================
export function analyzeTeamChemistry(
  analysis: CandidateAnalysisLike,
  ctx: OrganizationContext,
  deps: Now = DEFAULT_NOW,
): AgentReasoning<TeamChemistryResult> {
  const reasoning: ReasoningStep[] = [];
  const evidenceChain: string[] = [];
  const complementarity: TeamChemistryResult["complementaritySignals"] = [];
  const collisions: TeamChemistryResult["collisionRisks"] = [];
  const missingTeamContext: string[] = [];

  const teamSize = valueOf(ctx.fields.teamSize);
  const density = valueOf(ctx.fields.managementDensity);
  const teamEv = ctx.teamEvidence;
  evidenceChain.push(...teamEv.map((e) => e.id));

  const trajectorySignals = analysis.trajectory.result.trajectorySignals.map(
    (s) => s.id,
  );

  // Complementarity: high-ownership candidate joining a flat team is +ve.
  if (density === "flat" || density === "light") {
    if (trajectorySignals.includes("high-ownership-momentum")) {
      complementarity.push({
        id: "comp-high-ownership-fills-flat-team",
        summary:
          "High-ownership trajectory complements the flat management structure (no PMs/EMs to absorb scope).",
        weight: 0.8,
      });
    }
    if (analysis.bayesian.result.fitScore > 0.7) {
      complementarity.push({
        id: "comp-senior-anchor-for-mid-level-team",
        summary:
          "Strong posterior fit anchors a mid-level-heavy team that lacks senior depth.",
        weight: 0.7,
      });
    }
  }

  // Collision risks
  if (
    analysis.contradiction.result.contradictions.some(
      (c) => c.kind === "fake-seniority",
    )
  ) {
    collisions.push({
      id: "coll-fake-seniority-in-flat-team",
      severity: "high",
      summary:
        "Fake-seniority pattern would be visible quickly to mid-level engineers who hold the line; trust will erode.",
      derivedFrom: analysis.contradiction.result.contradictions
        .filter((c) => c.kind === "fake-seniority")
        .flatMap((c) => c.derivedFrom),
    });
  }
  if (
    analysis.contradiction.result.contradictionScore > 0.6 &&
    density === "flat"
  ) {
    collisions.push({
      id: "coll-narrative-inflation-no-manager-coverage",
      severity: "medium",
      summary:
        "Narrative-inflation behaviours need a manager to correct; this team has no managers to absorb that.",
      derivedFrom: analysis.contradiction.evidenceChain,
    });
  }
  if (teamSize === "small" && analysis.bayesian.result.fitScore < 0.4) {
    collisions.push({
      id: "coll-low-fit-in-small-team",
      severity: "high",
      summary:
        "Low posterior fit in a small team has outsized blast radius — one weak link compounds.",
      derivedFrom: analysis.bayesian.evidenceChain,
    });
  }

  if (teamSize === "unknown") missingTeamContext.push("teamSize");
  if (density === "unknown") missingTeamContext.push("managementDensity");
  if (teamEv.length < 2)
    missingTeamContext.push("team-roster (only 1 or 0 evidence items)");

  reasoning.push({
    step: "team-snapshot",
    detail: `teamSize=${teamSize}, managementDensity=${density}, teamEvidence=${teamEv.length}.`,
  });

  // Chemistry score is bounded; high collision suppresses, high
  // complementarity amplifies, missing context decays.
  const compStrength =
    complementarity.reduce((s, c) => s + c.weight, 0) /
    Math.max(1, complementarity.length || 1);
  const collisionSeverity =
    collisions.reduce(
      (s, c) => s + (c.severity === "high" ? 1 : c.severity === "medium" ? 0.5 : 0.2),
      0,
    ) / 2;
  const chemistry = clamp01(0.5 + 0.4 * compStrength - 0.4 * collisionSeverity);

  reasoning.push({
    step: "chemistry-score",
    detail: `0.5 + 0.4·comp(${compStrength.toFixed(2)}) − 0.4·coll(${collisionSeverity.toFixed(2)}) = ${chemistry.toFixed(2)}.`,
    value: chemistry,
  });

  const confidence = clamp01(
    0.7 *
      ((ctx.fields.teamSize.confidence + ctx.fields.managementDensity.confidence) /
        2) +
      0.3 * Math.min(1, teamEv.length / 3) -
      missingTeamContext.length * 0.1,
  );

  return envelope(
    "team-chemistry-agent",
    analysis.candidateId,
    {
      chemistryScore: Number(chemistry.toFixed(3)),
      complementaritySignals: complementarity,
      collisionRisks: collisions,
      missingTeamContext,
    },
    reasoning,
    evidenceChain,
    confidence,
    `Chemistry score = ${chemistry.toFixed(2)} from ${complementarity.length} complementarity, ${collisions.length} collision signals.`,
    [...analysis.bayesian.evidenceChain, ...evidenceChain],
    deps,
  );
}

// =========================================================================
// 3. ChaosToleranceAgent
// =========================================================================
export function analyzeChaosTolerance(
  analysis: CandidateAnalysisLike,
  ctx: OrganizationContext,
  deps: Now = DEFAULT_NOW,
): AgentReasoning<ChaosToleranceResult> {
  const reasoning: ReasoningStep[] = [];
  const evidenceChain: string[] = [];
  const strongestEvidence: ChaosToleranceResult["strongestEvidence"] = [];
  const missingEvidence: string[] = [];

  const ambiguity = valueOf(ctx.fields.ambiguityLevel);
  const autonomy = valueOf(ctx.fields.autonomyExpectation);
  const process = valueOf(ctx.fields.processMaturity);

  reasoning.push({
    step: "org-pressure",
    detail: `ambiguity=${ambiguity}, autonomy=${autonomy}, process=${process}.`,
  });

  if (ambiguity === "unknown") missingEvidence.push("organization.ambiguityLevel");
  if (autonomy === "unknown")
    missingEvidence.push("organization.autonomyExpectation");

  // Score candidate's chaos capacity from trajectory + contradiction outputs.
  const t = analysis.trajectory.result;
  const ownership = Math.min(1, t.momentum / 0.4) * 0.4 + t.founderPotential * 0.4;
  const stability =
    1 - Math.min(1, analysis.contradiction.result.contradictionScore);
  const ambiguityCapacity = clamp01(0.6 * ownership + 0.4 * stability);

  reasoning.push({
    step: "candidate-capacity",
    detail: `0.6·ownership(${ownership.toFixed(2)}) + 0.4·stability(${stability.toFixed(2)}) = ${ambiguityCapacity.toFixed(2)}.`,
    value: ambiguityCapacity,
  });

  if (ownership > 0.4) {
    strongestEvidence.push({
      id: "ownership-momentum",
      summary: `Trajectory momentum ${t.momentum.toFixed(2)} suggests the candidate generates direction without external structure.`,
    });
    evidenceChain.push(...t.trajectorySignals.flatMap((s) => s.derivedFrom));
  }
  if (stability > 0.7) {
    strongestEvidence.push({
      id: "narrative-stability",
      summary: "Low contradiction score implies the candidate operates with stable self-assessment under pressure.",
    });
    evidenceChain.push(...analysis.contradiction.evidenceChain);
  }

  // Required chaos tolerance derived from the org context.
  // CRITICAL: unknown context dimensions are NOT imputed — they are skipped
  // from the average and recorded as missing evidence. Never silently infer.
  function weightOf(v: string): number | null {
    return v === "extreme"
      ? 1
      : v === "high"
        ? 0.8
        : v === "medium"
          ? 0.5
          : v === "low"
            ? 0.2
            : null; // "unknown" or any unrecognised value
  }
  const ambiguityWeight = weightOf(ambiguity);
  const autonomyWeight = weightOf(autonomy);
  const knownWeights = [ambiguityWeight, autonomyWeight].filter(
    (w): w is number => w !== null,
  );
  const required =
    knownWeights.length === 0
      ? null
      : knownWeights.reduce((a, b) => a + b, 0) / knownWeights.length;
  // If required is unknown we cannot compute a fit — fall back to a neutral
  // 0.5 fit and flag heavily via missingEvidence + low confidence.
  const chaosFitScore =
    required === null
      ? 0.5
      : clamp01(1 - Math.max(0, required - ambiguityCapacity));

  reasoning.push({
    step: "chaos-fit",
    detail:
      required === null
        ? `required=unknown (org chaos dimensions ${knownWeights.length}/2 known), capacity=${ambiguityCapacity.toFixed(2)}, fit defaulted to 0.5 with low confidence.`
        : `required=${required.toFixed(2)} (${knownWeights.length}/2 dimensions), capacity=${ambiguityCapacity.toFixed(2)}, fit=${chaosFitScore.toFixed(2)}.`,
    value: chaosFitScore,
  });

  const toleranceLevel: ChaosToleranceResult["toleranceLevel"] =
    ambiguityCapacity > 0.75
      ? "high"
      : ambiguityCapacity > 0.55
        ? "medium"
        : ambiguityCapacity > 0.3
          ? "low"
          : "low";
  const gap = required === null ? null : required - ambiguityCapacity;
  const riskLevel: ChaosToleranceResult["riskLevel"] =
    gap === null
      ? "medium" // unknown chaos requirement → medium risk by default, surfaced via missingEvidence
      : gap > 0.3
        ? "high"
        : gap > 0.1
          ? "medium"
          : "low";

  // Confidence penalty when we had to default required = 0.5 due to unknowns.
  const unknownPenalty = required === null ? 0.3 : 0;
  const confidence = clamp01(
    0.5 * analysis.trajectory.confidence +
      0.3 * analysis.contradiction.confidence +
      0.2 *
        ((ctx.fields.ambiguityLevel.confidence +
          ctx.fields.autonomyExpectation.confidence) /
          2) -
      missingEvidence.length * 0.1 -
      unknownPenalty,
  );

  return envelope(
    "chaos-tolerance-agent",
    analysis.candidateId,
    {
      chaosFitScore: Number(chaosFitScore.toFixed(3)),
      toleranceLevel,
      riskLevel,
      strongestEvidence,
      missingEvidence,
    },
    reasoning,
    Array.from(new Set(evidenceChain)),
    confidence,
    `chaosFit=${chaosFitScore.toFixed(2)}, capacity=${ambiguityCapacity.toFixed(2)}, required=${required === null ? "unknown" : required.toFixed(2)}.`,
    Array.from(new Set(evidenceChain)),
    deps,
  );
}

// =========================================================================
// 4. RoleEnvironmentAgent
// =========================================================================
export function analyzeRoleEnvironment(
  analysis: CandidateAnalysisLike,
  ctx: OrganizationContext,
  deps: Now = DEFAULT_NOW,
): AgentReasoning<RoleEnvironmentResult> {
  const reasoning: ReasoningStep[] = [];
  const evidenceChain: string[] = [];

  // Derive a role environment from the org context. Unknown org fields
  // produce unknown role fields — never silently filled.
  function from<T extends string>(
    f: ContextField<T>,
    mapper: (v: T) => "low" | "medium" | "high" | "extreme",
  ): ContextField<"low" | "medium" | "high" | "extreme"> {
    if (f.value === "unknown")
      return { value: "unknown", confidence: 0, derivedFrom: [] };
    return {
      value: mapper(f.value),
      confidence: f.confidence,
      derivedFrom: f.derivedFrom,
    };
  }

  const roleAmbiguity = from(ctx.fields.ambiguityLevel, (v) => v);
  const expectedOutputSpeed: ContextField<
    "deliberate" | "steady" | "fast" | "breakneck"
  > = ctx.fields.executionSpeed.value === "unknown"
    ? { value: "unknown", confidence: 0, derivedFrom: [] }
    : {
        value: ctx.fields.executionSpeed.value,
        confidence: ctx.fields.executionSpeed.confidence,
        derivedFrom: ctx.fields.executionSpeed.derivedFrom,
      };
  const technicalDepthRequired = from(ctx.fields.technicalMaturity, (v) =>
    v === "hardened" ? "extreme" : v === "mature" ? "high" : v === "growing" ? "medium" : "low",
  );
  const collaborationIntensity = from(ctx.fields.managementDensity, (v) =>
    v === "dense" ? "high" : v === "layered" ? "medium" : "low",
  );
  const stakeholderComplexity = from(ctx.fields.companyStage, (v) =>
    v === "public" ? "extreme" : v === "growth" ? "high" : v === "series-b" ? "medium" : "low",
  );
  const ownershipLevel = from(ctx.fields.autonomyExpectation, (v) => v);
  const toleranceForLearningCurve = from(ctx.fields.riskTolerance, (v) =>
    v === "high" ? "high" : v === "medium" ? "medium" : "low",
  );
  const needForImmediateImpact = from(ctx.fields.roleCriticality, (v) =>
    v === "mission-critical" ? "extreme" : v === "critical" ? "high" : v === "important" ? "medium" : "low",
  );

  const profile: RoleEnvironmentResult["roleEnvironmentProfile"] = {
    roleAmbiguity,
    expectedOutputSpeed,
    technicalDepthRequired,
    collaborationIntensity,
    stakeholderComplexity,
    ownershipLevel,
    toleranceForLearningCurve,
    needForImmediateImpact,
  };

  for (const [k, f] of Object.entries(profile)) {
    if (f.value === "unknown") continue;
    evidenceChain.push(...f.derivedFrom);
    reasoning.push({
      step: `role.${k}`,
      detail: `${k} = ${f.value} (conf ${f.confidence.toFixed(2)}).`,
    });
  }

  // Compare candidate signals against role requirements.
  const mismatches: RoleEnvironmentMismatch[] = [];
  const investigationAreas: string[] = [];

  const candidateOwnership =
    Math.min(1, analysis.trajectory.result.momentum / 0.4) * 0.5 +
    analysis.trajectory.result.founderPotential * 0.5;
  if (
    ownershipLevel.value !== "unknown" &&
    (ownershipLevel.value === "high" || ownershipLevel.value === "extreme") &&
    candidateOwnership < 0.5
  ) {
    mismatches.push({
      field: "ownershipLevel",
      candidateSignal: `momentum/founderPotential composite = ${candidateOwnership.toFixed(2)}`,
      roleRequirement: `requires ${ownershipLevel.value} ownership`,
      severity: candidateOwnership < 0.3 ? "high" : "medium",
    });
  }

  const candidateImmediate =
    analysis.bayesian.result.fitScore > 0.65 &&
    analysis.contradiction.result.contradictionScore < 0.3;
  if (
    needForImmediateImpact.value !== "unknown" &&
    (needForImmediateImpact.value === "high" || needForImmediateImpact.value === "extreme") &&
    !candidateImmediate
  ) {
    mismatches.push({
      field: "needForImmediateImpact",
      candidateSignal: `fit ${analysis.bayesian.result.fitScore.toFixed(2)}, contradictions ${analysis.contradiction.result.contradictionScore.toFixed(2)}`,
      roleRequirement: `${needForImmediateImpact.value} immediate-impact bar`,
      severity: "high",
    });
  }

  if (
    roleAmbiguity.value !== "unknown" &&
    (roleAmbiguity.value === "high" || roleAmbiguity.value === "extreme")
  ) {
    if (analysis.bayesian.result.uncertaintyLevel > 0.5) {
      investigationAreas.push(
        "Validate the candidate has worked under significant role ambiguity before.",
      );
    }
  }
  if (technicalDepthRequired.value === "unknown") {
    investigationAreas.push(
      "Technical depth required is unknown — sample 2 reference projects to triangulate.",
    );
  }

  // Numerical fit: 1 - mean(severityWeight per mismatch).
  const mismatchPenalty = mismatches.reduce(
    (s, m) => s + (m.severity === "high" ? 0.3 : m.severity === "medium" ? 0.15 : 0.05),
    0,
  );
  const fit = clamp01(1 - mismatchPenalty);

  reasoning.push({
    step: "role-fit",
    detail: `1 − Σmismatch(${mismatchPenalty.toFixed(2)}) = ${fit.toFixed(2)}.`,
    value: fit,
  });

  const knownFields = Object.values(profile).filter(
    (f) => f.value !== "unknown",
  ).length;
  const confidence = clamp01(0.4 + (knownFields / 8) * 0.5);

  return envelope(
    "role-environment-agent",
    analysis.candidateId,
    {
      roleEnvironmentProfile: profile,
      candidateFitAgainstRoleEnvironment: Number(fit.toFixed(3)),
      mismatchAreas: mismatches,
      investigationAreas,
    },
    reasoning,
    Array.from(new Set(evidenceChain)),
    confidence,
    `roleEnvFit=${fit.toFixed(2)} from ${knownFields}/8 known role fields.`,
    Array.from(new Set(evidenceChain)),
    deps,
  );
}

// =========================================================================
// 5. HiringRiskAgent
// =========================================================================
export function analyzeHiringRisk(
  analysis: CandidateAnalysisLike,
  ctx: OrganizationContext,
  chaos: AgentReasoning<ChaosToleranceResult>,
  team: AgentReasoning<TeamChemistryResult>,
  role: AgentReasoning<RoleEnvironmentResult>,
  deps: Now = DEFAULT_NOW,
): AgentReasoning<HiringRiskResult> {
  const reasoning: ReasoningStep[] = [];
  const evidenceChain = [
    ...analysis.bayesian.evidenceChain,
    ...analysis.contradiction.evidenceChain,
    ...analysis.trajectory.evidenceChain,
    ...chaos.evidenceChain,
    ...team.evidenceChain,
    ...role.evidenceChain,
  ];

  // Each component returns a [0,1] risk score with the evidence chain id
  // that justifies it.
  const drivers: HiringRiskDriver[] = [];

  const execution = clamp01(
    0.5 * (1 - analysis.bayesian.result.fitScore) +
      0.3 * analysis.contradiction.result.contradictionScore +
      0.2 * (1 - role.result.candidateFitAgainstRoleEnvironment),
  );
  if (execution > 0.5)
    drivers.push({
      category: "execution",
      severity: execution > 0.7 ? "high" : "medium",
      summary: `Execution risk ${execution.toFixed(2)} — posterior fit weak or role-env mismatch.`,
      derivedFrom: analysis.bayesian.evidenceChain,
    });

  const autonomy = clamp01(
    1 -
      chaos.result.chaosFitScore *
        (chaos.result.toleranceLevel === "high" ? 1 : 0.85),
  );
  if (autonomy > 0.5)
    drivers.push({
      category: "autonomy",
      severity: autonomy > 0.7 ? "high" : "medium",
      summary: `Autonomy risk ${autonomy.toFixed(2)} — candidate capacity below role demand.`,
      derivedFrom: chaos.evidenceChain,
    });

  const culture = clamp01(
    0.6 * (1 - team.result.chemistryScore) +
      0.4 *
        (analysis.contradiction.result.unsupportedClaims.length > 0 ? 0.6 : 0.2),
  );
  if (culture > 0.5)
    drivers.push({
      category: "culture",
      severity: culture > 0.7 ? "high" : "medium",
      summary: `Culture risk ${culture.toFixed(2)} — team chemistry friction or narrative-inflation patterns.`,
      derivedFrom: team.result.collisionRisks.flatMap((c) => c.derivedFrom),
    });

  const managerFit = clamp01(
    ctx.fields.managementDensity.value === "flat"
      ? analysis.bayesian.result.fitScore < 0.5
        ? 0.7
        : 0.35
      : 0.25,
  );
  if (managerFit > 0.5)
    drivers.push({
      category: "managerFit",
      severity: managerFit > 0.7 ? "high" : "medium",
      summary: `Manager-fit risk ${managerFit.toFixed(2)} — flat team, no EM to absorb friction.`,
      derivedFrom: [],
    });

  const ramp = clamp01(
    0.5 * (1 - analysis.trajectory.result.trajectoryScore) +
      0.5 *
        (role.result.roleEnvironmentProfile.needForImmediateImpact.value ===
        "extreme"
          ? 0.7
          : 0.35),
  );
  if (ramp > 0.5)
    drivers.push({
      category: "ramp",
      severity: ramp > 0.7 ? "high" : "medium",
      summary: `Ramp risk ${ramp.toFixed(2)} — slow trajectory vs high immediate-impact bar.`,
      derivedFrom: analysis.trajectory.evidenceChain,
    });

  const retention = clamp01(
    analysis.trajectory.result.trajectorySignals.some(
      (s) => s.id === "plateau-detected",
    )
      ? 0.65
      : 0.3,
  );
  if (retention > 0.5)
    drivers.push({
      category: "retention",
      severity: "medium",
      summary: `Retention risk ${retention.toFixed(2)} — plateau signal suggests motivation drift.`,
      derivedFrom: analysis.trajectory.evidenceChain,
    });

  const communication = clamp01(
    ctx.fields.communicationStyle.value === "low-context" &&
      analysis.contradiction.result.contradictions.some(
        (c) => c.kind === "vocabulary-without-depth",
      )
      ? 0.7
      : ctx.fields.communicationStyle.value === "unknown"
        ? 0.4
        : 0.25,
  );
  if (communication > 0.5)
    drivers.push({
      category: "communication",
      severity: "medium",
      summary: `Communication risk ${communication.toFixed(2)} — low-context environment exposes shallow articulation.`,
      derivedFrom: analysis.contradiction.evidenceChain,
    });

  const seniorityCalibration = clamp01(
    analysis.contradiction.result.contradictions.some(
      (c) => c.kind === "fake-seniority",
    )
      ? 0.85
      : analysis.bayesian.result.fitScore > 0.7 &&
          analysis.contradiction.result.contradictionScore < 0.2
        ? 0.2
        : 0.45,
  );
  if (seniorityCalibration > 0.5)
    drivers.push({
      category: "seniorityCalibration",
      severity: seniorityCalibration > 0.7 ? "high" : "medium",
      summary: `Seniority-calibration risk ${seniorityCalibration.toFixed(2)} — claimed seniority not corroborated.`,
      derivedFrom: analysis.contradiction.evidenceChain,
    });

  const breakdown: HiringRiskBreakdown = {
    execution: Number(execution.toFixed(3)),
    autonomy: Number(autonomy.toFixed(3)),
    culture: Number(culture.toFixed(3)),
    managerFit: Number(managerFit.toFixed(3)),
    ramp: Number(ramp.toFixed(3)),
    retention: Number(retention.toFixed(3)),
    communication: Number(communication.toFixed(3)),
    seniorityCalibration: Number(seniorityCalibration.toFixed(3)),
  };
  // Overall risk = weighted mean (execution, autonomy, seniorityCal carry
  // the heaviest weight; retention and communication lighter).
  const weights = {
    execution: 0.2,
    autonomy: 0.15,
    culture: 0.12,
    managerFit: 0.1,
    ramp: 0.13,
    retention: 0.08,
    communication: 0.1,
    seniorityCalibration: 0.12,
  };
  const overall = clamp01(
    Object.entries(breakdown).reduce(
      (s, [k, v]) => s + v * (weights as Record<string, number>)[k]!,
      0,
    ),
  );
  reasoning.push({
    step: "overall-risk",
    detail: `Weighted mean across 8 risk categories = ${overall.toFixed(2)}.`,
    value: overall,
  });

  const mitigatingFactors: string[] = [];
  if (analysis.bayesian.result.fitScore > 0.7) {
    mitigatingFactors.push("High posterior fit insulates against ramp friction.");
  }
  if (team.result.complementaritySignals.length > 0) {
    mitigatingFactors.push(
      `Team complementarity: ${team.result.complementaritySignals.map((c) => c.summary).join("; ")}`,
    );
  }
  if (
    analysis.trajectory.result.trajectorySignals.some(
      (s) => s.id === "accelerating-builder",
    )
  ) {
    mitigatingFactors.push(
      "Accelerating-builder trajectory signal partly offsets seniority calibration concerns.",
    );
  }

  const nextInvestigations: string[] = [];
  drivers
    .filter((d) => d.severity === "high")
    .forEach((d) => {
      nextInvestigations.push(
        `Probe ${d.category} during back-channel references.`,
      );
    });
  if (chaos.result.missingEvidence.length > 0) {
    nextInvestigations.push(
      `Resolve missing chaos-tolerance evidence: ${chaos.result.missingEvidence.join(", ")}.`,
    );
  }

  const confidence = clamp01(
    0.4 *
      ((analysis.bayesian.confidence +
        analysis.contradiction.confidence +
        analysis.trajectory.confidence) /
        3) +
      0.6 * ((chaos.confidence + team.confidence + role.confidence) / 3),
  );

  return envelope(
    "hiring-risk-agent",
    analysis.candidateId,
    {
      overallHiringRisk: Number(overall.toFixed(3)),
      riskBreakdown: breakdown,
      strongestRiskDrivers: drivers.sort((a, b) =>
        b.severity === a.severity ? 0 : b.severity === "high" ? 1 : -1,
      ),
      mitigatingFactors,
      nextInvestigations,
    },
    reasoning,
    Array.from(new Set(evidenceChain)),
    confidence,
    `overallHiringRisk=${overall.toFixed(2)} from 8 categories.`,
    Array.from(new Set(evidenceChain)),
    deps,
  );
}
