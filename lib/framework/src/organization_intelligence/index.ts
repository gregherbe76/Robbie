/**
 * Organization Intelligence Layer.
 *
 * Evaluates candidate × organization fit through five agents
 * (FounderStyle, TeamChemistry, ChaosTolerance, RoleEnvironment,
 * HiringRisk), a fit engine, a report engine, and a memory integrator.
 * Every field carries explicit unknown values; nothing is silently
 * inferred.
 */

export * from "./types.js";
export {
  SAMPLE_ORG,
  getOrganization,
  listOrganizations,
  summariseContextCompleteness,
} from "./context.js";
export {
  analyzeFounderStyle,
  analyzeTeamChemistry,
  analyzeChaosTolerance,
  analyzeRoleEnvironment,
  analyzeHiringRisk,
} from "./agents.js";
export {
  computeCandidateOrgFit,
  generateOrganizationIntelligenceReport,
  runOrganizationIntelligence,
  type FitInputs,
  type ReportInputs,
} from "./fit_engine.js";
export {
  buildOrgContextMemory,
  buildFitMemory,
  buildOrgArchetypeMemory,
  type MemoryEntryShape,
} from "./memory.js";
