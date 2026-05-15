/**
 * Organization Intelligence Layer types.
 *
 * Models candidate × organization fit. Every field uses `ContextField<T>`
 * which forces unknown values to be explicit — the system never silently
 * infers what it has not been told.
 */

import type { AgentReasoning, ReasoningStep } from "../agents/flagship/index.js";
import type { Provenance } from "../shared/index.js";

/** A typed value carried with confidence + evidence ids. */
export interface ContextField<T extends string> {
  value: T | "unknown";
  confidence: number;
  derivedFrom: string[];
  note?: string;
}

/** Evidence item attached to an organisation or role. */
export interface OrgEvidence {
  id: string;
  source:
    | "founder-statement"
    | "team-roster"
    | "engineering-blog"
    | "press"
    | "internal-doc"
    | "interviewer-note"
    | "role-spec";
  summary: string;
  weight: number; // 0..1
}

export type CompanyStage =
  | "seed"
  | "series-a"
  | "series-b"
  | "growth"
  | "public";
export type TeamSize = "small" | "medium" | "large" | "xlarge";
export type Maturity = "prototype" | "growing" | "mature" | "hardened";
export type ProcessMaturity = "ad-hoc" | "emerging" | "structured" | "rigorous";
export type AmbiguityLevel = "low" | "medium" | "high" | "extreme";
export type ExecutionSpeed = "deliberate" | "steady" | "fast" | "breakneck";
export type FounderInvolvement =
  | "hands-off"
  | "strategic"
  | "hands-on"
  | "omnipresent";
export type DecisionStyle =
  | "consensus"
  | "leadership"
  | "command"
  | "autonomous";
export type CommunicationStyle =
  | "high-context"
  | "medium-context"
  | "low-context";
export type AutonomyExpectation = "low" | "medium" | "high" | "extreme";
export type FeedbackCulture = "rare" | "structured" | "continuous";
export type RiskTolerance = "low" | "medium" | "high";
export type ManagementDensity = "flat" | "light" | "layered" | "dense";
export type ProductMaturity = "prototype" | "early" | "scaling" | "mature";
export type HiringBar = "standard" | "high" | "exceptional";
export type RoleCriticality =
  | "standard"
  | "important"
  | "critical"
  | "mission-critical";
export type Level = "low" | "medium" | "high" | "extreme";

export interface OrganizationContext {
  id: string;
  name: string;
  description: string;
  generatedAt: string;
  founderEvidence: OrgEvidence[];
  teamEvidence: OrgEvidence[];
  fields: {
    companyStage: ContextField<CompanyStage>;
    teamSize: ContextField<TeamSize>;
    technicalMaturity: ContextField<Maturity>;
    processMaturity: ContextField<ProcessMaturity>;
    ambiguityLevel: ContextField<AmbiguityLevel>;
    executionSpeed: ContextField<ExecutionSpeed>;
    founderInvolvement: ContextField<FounderInvolvement>;
    decisionStyle: ContextField<DecisionStyle>;
    communicationStyle: ContextField<CommunicationStyle>;
    autonomyExpectation: ContextField<AutonomyExpectation>;
    feedbackCulture: ContextField<FeedbackCulture>;
    riskTolerance: ContextField<RiskTolerance>;
    managementDensity: ContextField<ManagementDensity>;
    productMaturity: ContextField<ProductMaturity>;
    hiringBar: ContextField<HiringBar>;
    roleCriticality: ContextField<RoleCriticality>;
  };
}

export type FounderArchetype =
  | "high-speed-operator"
  | "deep-technical"
  | "chaotic-visionary"
  | "structured-operator"
  | "high-control"
  | "autonomous-builder-friendly";

export interface FounderStyleResult {
  founderStyle: FounderArchetype | "unknown";
  communicationStyle: CommunicationStyle | "unknown";
  strengthsForCandidateTypes: string[];
  risksForCandidateTypes: string[];
  communicationImplications: string[];
}

export interface ComplementaritySignal {
  id: string;
  summary: string;
  weight: number;
}
export interface CollisionRisk {
  id: string;
  severity: "low" | "medium" | "high";
  summary: string;
  derivedFrom: string[];
}
export interface TeamChemistryResult {
  chemistryScore: number;
  complementaritySignals: ComplementaritySignal[];
  collisionRisks: CollisionRisk[];
  missingTeamContext: string[];
}

export interface ChaosToleranceResult {
  chaosFitScore: number;
  toleranceLevel: Level | "unknown";
  riskLevel: "low" | "medium" | "high";
  strongestEvidence: Array<{ id: string; summary: string }>;
  missingEvidence: string[];
}

export interface HiringRiskBreakdown {
  execution: number;
  autonomy: number;
  culture: number;
  managerFit: number;
  ramp: number;
  retention: number;
  communication: number;
  seniorityCalibration: number;
}

export interface HiringRiskDriver {
  category: keyof HiringRiskBreakdown;
  severity: "low" | "medium" | "high";
  summary: string;
  derivedFrom: string[];
}

export interface HiringRiskResult {
  overallHiringRisk: number;
  riskBreakdown: HiringRiskBreakdown;
  strongestRiskDrivers: HiringRiskDriver[];
  mitigatingFactors: string[];
  nextInvestigations: string[];
}

export interface RoleEnvironmentProfile {
  roleAmbiguity: ContextField<Level>;
  expectedOutputSpeed: ContextField<ExecutionSpeed>;
  technicalDepthRequired: ContextField<Level>;
  collaborationIntensity: ContextField<Level>;
  stakeholderComplexity: ContextField<Level>;
  ownershipLevel: ContextField<Level>;
  toleranceForLearningCurve: ContextField<Level>;
  needForImmediateImpact: ContextField<Level>;
}

export interface RoleEnvironmentMismatch {
  field: keyof RoleEnvironmentProfile;
  candidateSignal: string;
  roleRequirement: string;
  severity: "low" | "medium" | "high";
}

export interface RoleEnvironmentResult {
  roleEnvironmentProfile: RoleEnvironmentProfile;
  candidateFitAgainstRoleEnvironment: number;
  mismatchAreas: RoleEnvironmentMismatch[];
  investigationAreas: string[];
}

export type FitRecommendation =
  | "strong_fit"
  | "conditional_fit"
  | "high_upside_high_risk"
  | "poor_context_fit"
  | "insufficient_context";

export interface CandidateOrganizationFitResult {
  candidateId: string;
  organizationId: string;
  fitRecommendation: FitRecommendation;
  fitConfidence: number;
  contextCompleteness: number;
  successConditions: string[];
  failureModes: string[];
  onboardingRisks: string[];
  managementImplications: string[];
  interviewFocusAreas: string[];
  finalRationale: string;
}

export interface OrganizationIntelligenceReport {
  candidateId: string;
  organizationId: string;
  generatedAt: string;
  fitSummary: {
    recommendation: FitRecommendation;
    confidence: number;
    headline: string;
  };
  contextConfidence: {
    averageFieldConfidence: number;
    knownFields: number;
    unknownFields: string[];
  };
  founderFit: AgentReasoning<FounderStyleResult>;
  teamChemistry: AgentReasoning<TeamChemistryResult>;
  chaosFit: AgentReasoning<ChaosToleranceResult>;
  roleEnvironment: AgentReasoning<RoleEnvironmentResult>;
  hiringRisk: AgentReasoning<HiringRiskResult>;
  successConditions: string[];
  failureModes: string[];
  interviewFocusAreas: string[];
  finalRecommendation: {
    category: FitRecommendation;
    narrative: string;
    confidence: number;
  };
}

export type { AgentReasoning, ReasoningStep, Provenance };
