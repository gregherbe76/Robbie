/**
 * Flagship intelligence agents.
 *
 * Three production-grade agents that turn the framework from generic
 * "agent infrastructure" into a concrete recruiting intelligence system.
 * All three extend `BaseAgent`, emit reasoning chains, and attach full
 * provenance to their outputs.
 */

export * from "./types.js";
export { BaseAgent } from "./base.js";
export { BayesianScoringAgent } from "./bayesian.js";
export type { BayesianFitResult } from "./bayesian.js";
export { ContradictionAgent } from "./contradiction.js";
export type {
  ContradictionResult,
  Contradiction,
  ContradictionSeverity,
} from "./contradiction.js";
export { TrajectoryAgent } from "./trajectory.js";
export type {
  TrajectoryResult,
  TrajectorySignal,
  TrajectoryRisk,
} from "./trajectory.js";
export { SAMPLE_DOSSIERS } from "./dossiers.js";
