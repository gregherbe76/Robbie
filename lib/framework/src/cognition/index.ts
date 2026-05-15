/**
 * Cross-agent cognition layer.
 *
 * Turns parallel agent execution into interactive recruiting cognition:
 * agents influence each other through deterministic propagation rules,
 * disagreements are surfaced explicitly, uncertainty is fused into a
 * single auditable model, and a reconciliation engine produces a
 * synthesis that preserves rather than flattens ambiguity.
 */

export * from "./types.js";
export {
  propagateInfluences,
  INFLUENCE_RULES,
  COGNITION_AGENT_IDS,
} from "./influence_engine.js";
export { analyzeDisagreement } from "./disagreement.js";
export { fuseUncertainty } from "./uncertainty_fusion.js";
export { reconcile } from "./reconciliation.js";
export {
  matchArchetypes,
  summarizeArchetypeFrequency,
} from "./cross_agent_memory.js";
export {
  synthesizeCognition,
  type CandidateAnalysisLike,
  type SynthesizeOptions,
} from "./synthesize.js";
