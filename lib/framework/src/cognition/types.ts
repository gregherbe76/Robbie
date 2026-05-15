/**
 * Cross-agent cognition layer types.
 *
 * The cognition layer turns three independent agent outputs into an
 * interactive reasoning system: agents influence each other through
 * confidence propagation, contradiction pressure, uncertainty fusion,
 * and reconciliation — deterministically, auditably, explainably.
 */

export type InfluenceKind =
  | "confidence-penalty"
  | "confidence-amplification"
  | "uncertainty-boost"
  | "evidence-reinforcement"
  | "contradiction-pressure";

/** One agent node in the cognitive graph. */
export interface AgentNode {
  id: string;
  name: string;
  /** Confidence reported by the agent itself, pre-propagation. */
  initialConfidence: number;
  /** Confidence after the influence engine has propagated adjustments. */
  adjustedConfidence: number;
  /** Primary metric the agent emits (fitScore, contradictionScore, …). */
  metric: { name: string; value: number };
}

/** A directional influence edge between two agents (or to "global"). */
export interface InfluenceEdge {
  id: string;
  from: string;
  to: string; // agent id or "global"
  kind: InfluenceKind;
  weight: number; // 0..1 — how strongly the edge fired for this candidate
  reason: string;
}

/** A single propagated adjustment, with full audit trail. */
export interface PropagatedInfluence {
  id: string;
  sourceAgent: string;
  targetAgent: string; // agent id or "global"
  kind: InfluenceKind;
  reason: string;
  adjustment: number; // signed delta applied to confidence
  before: number;
  after: number;
  derivedFrom: string[]; // evidence / claim ids that triggered the rule
}

export interface Disagreement {
  id: string;
  agentA: string;
  agentB: string;
  metricA: { name: string; value: number };
  metricB: { name: string; value: number };
  score: number; // 0..1 — how far apart the two agents are on a shared axis
  rationale: string;
}

export type CertaintyCategory =
  | "high-confidence-positive"
  | "high-confidence-negative"
  | "uncertain-positive"
  | "uncertain-negative"
  | "ambiguous";

export interface UncertaintyFusion {
  certaintyCategory: CertaintyCategory;
  uncertaintyLevel: number;
  ambiguityScore: number;
  evidenceReliability: number;
  confidenceDistribution: Record<string, number>;
}

export interface ConfidencePropagation {
  globalConfidence: number;
  localAdjustments: Record<string, number>;
  uncertaintyMap: Record<string, number>;
  saturationApplied: boolean;
}

export interface DisagreementAnalysis {
  disagreementScore: number;
  disagreements: Disagreement[];
  unresolvedQuestions: string[];
  ambiguityLevel: number;
  confidenceTension: number;
}

export interface ReconciliationSynthesis {
  recommendationCategory: "advance" | "investigate" | "decline" | "ambiguous";
  recommendation: string;
  majorTensions: string[];
  strongestEvidence: Array<{ id: string; summary: string; weight: number }>;
  unresolvedConcerns: string[];
  trajectoryOutlook: string;
  confidenceNarrative: string;
  nextInvestigations: string[];
}

export interface ArchetypeMatch {
  archetypeId: string;
  archetypeName: string;
  matchScore: number;
  rationale: string;
  signals: string[];
}

export interface CrossAgentMemoryView {
  matchedArchetypes: ArchetypeMatch[];
  recurringPatterns: string[];
}

export interface CognitiveSynthesis {
  candidateId: string;
  generatedAt: string;
  graph: { nodes: AgentNode[]; edges: InfluenceEdge[] };
  influences: PropagatedInfluence[];
  confidence: ConfidencePropagation;
  disagreement: DisagreementAnalysis;
  uncertainty: UncertaintyFusion;
  reconciliation: ReconciliationSynthesis;
  memory: CrossAgentMemoryView;
}
