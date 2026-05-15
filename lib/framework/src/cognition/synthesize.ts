/**
 * Top-level cognitive synthesis.
 *
 * Composes every cognition-layer engine into a single deterministic
 * function that turns the three agent outputs into a `CognitiveSynthesis`.
 * Order is fixed: influence propagation → disagreement → uncertainty
 * fusion → reconciliation → archetype memory.
 */

import type {
  AgentReasoning,
  BayesianFitResult,
  ContradictionResult,
  TrajectoryResult,
} from "../agents/flagship/index.js";
import { propagateInfluences } from "./influence_engine.js";
import { analyzeDisagreement } from "./disagreement.js";
import { fuseUncertainty } from "./uncertainty_fusion.js";
import { reconcile } from "./reconciliation.js";
import { matchArchetypes } from "./cross_agent_memory.js";
import type { CognitiveSynthesis } from "./types.js";

export interface CandidateAnalysisLike {
  candidateId: string;
  bayesian: AgentReasoning<BayesianFitResult>;
  contradiction: AgentReasoning<ContradictionResult>;
  trajectory: AgentReasoning<TrajectoryResult>;
}

export interface SynthesizeOptions {
  now?: () => Date;
}

export function synthesizeCognition(
  analysis: CandidateAnalysisLike,
  opts: SynthesizeOptions = {},
): CognitiveSynthesis {
  const now = opts.now ?? (() => new Date());
  const { graph, influences, confidence } = propagateInfluences(analysis);
  const disagreement = analyzeDisagreement(analysis, confidence);
  const uncertainty = fuseUncertainty(analysis, confidence, disagreement);
  const reconciliation = reconcile(
    analysis,
    confidence,
    disagreement,
    uncertainty,
  );
  const memory = matchArchetypes(analysis);

  return {
    candidateId: analysis.candidateId,
    generatedAt: now().toISOString(),
    graph,
    influences,
    confidence,
    disagreement,
    uncertainty,
    reconciliation,
    memory,
  };
}
