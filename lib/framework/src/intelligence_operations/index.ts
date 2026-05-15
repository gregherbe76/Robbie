// =========================================================================
// Intelligence Operations Layer — public surface.
//
// Investigations, adversarial reviews, evidence requests, hypotheses,
// decision-review workflows, escalations, human oversight, multi-reviewer
// consensus, persistent intelligence cases, and operations audit.
// =========================================================================

export * from "./types.js";
export {
  InvestigationEngine,
  detectTriggers,
  reconcileInvestigationState,
  type InvestigationInputs,
} from "./investigation.js";
export {
  AdversarialReviewEngine,
  type AdversarialInputs,
} from "./adversarial.js";
export {
  EvidenceRequestEngine,
  type EvidenceInputs,
} from "./evidence.js";
export {
  HypothesisTrackingSystem,
  type HypothesisInputs,
} from "./hypotheses.js";
export {
  DecisionReviewWorkflow,
  EscalationEngine,
  HumanOversightLayer,
  type EscalationInputs,
  type HumanInputs,
  type WorkflowInputs,
} from "./workflow.js";
export {
  MultiReviewerConsensusEngine,
  type ConsensusInputs,
} from "./consensus.js";
export {
  IntelligenceCaseSystem,
  OperationsAuditEngine,
  runIntelligenceOperationsLayer,
  type CaseInputs,
  type OperationsLayerInputs,
} from "./case.js";
