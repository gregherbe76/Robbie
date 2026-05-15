/**
 * Shared input types for the flagship intelligence agents.
 *
 * A `CandidateDossier` is the structured, multi-source input that the
 * BayesianScoringAgent, ContradictionAgent, and TrajectoryAgent all consume.
 * Sources are kept first-class so cross-source comparison is trivial and
 * evidence is always attributable.
 */

import type { Confidence, Provenance } from "../../shared/index.js";

export type EvidenceSource =
  | "cv"
  | "interview"
  | "github"
  | "reference"
  | "self";

export type EvidenceKind = "supports" | "refutes" | "neutral";

/**
 * A single observable fact from one of the candidate's sources.
 * Every evidence item carries its own weight and source — these drive
 * downstream Bayesian weighting and contradiction detection.
 */
export interface EvidenceItem {
  id: string;
  /** Domain the evidence is about, e.g. "distributed-systems", "leadership". */
  domain: string;
  source: EvidenceSource;
  kind: EvidenceKind;
  /** 0..1 — strength of the observation independent of source credibility. */
  weight: number;
  /** Human-readable summary used in reasoning chains. */
  summary: string;
  /** Optional pointer back to the claim this evidence speaks to. */
  claimId?: string;
}

/**
 * A self-reported assertion by the candidate (resume bullet, interview line).
 * Distinguishing claims from evidence is what makes contradiction detection
 * meaningful — a claim without supporting evidence is the flag.
 */
export interface Claim {
  id: string;
  domain: string;
  source: Extract<EvidenceSource, "cv" | "interview" | "self">;
  text: string;
  /** How strong the candidate phrased the claim, 0..1. */
  selfStatedStrength: number;
}

/**
 * One role in the candidate's chronological history.
 * `complexity`, `scope`, and `ownership` are normalised 0..1 so they can be
 * differentiated across time without unit drift.
 */
export interface RoleEvent {
  id: string;
  title: string;
  startedAt: string; // ISO date
  endedAt: string | null;
  durationMonths: number;
  complexity: number;
  scope: number;
  ownership: number;
  teamSize: number;
}

export interface GithubSignature {
  name: string;
  year: number;
  complexity: number;
  ownership: number;
  domain: string;
}

export interface GithubSnapshot {
  yearlyContributions: Array<{ year: number; commits: number; repos: number }>;
  signatureProjects: GithubSignature[];
}

export interface InterviewSnapshot {
  /** depthScore by domain, 0..1 — empirical depth observed during loop. */
  depthByDomain: Record<string, number>;
  /** Overall reasoning quality 0..1. */
  reasoningQuality: number;
  /** Count of buzzwords used without demonstrable depth backing them. */
  vocabularyWithoutDepth: number;
}

export interface OrganizationContext {
  /** Base-rate hire probability for the targeted role family, 0..1. */
  priorBaseline: number;
  /** Minimum normalised role complexity acceptable, 0..1. */
  complexityFloor: number;
  /** Domains the organisation considers critical for the role. */
  criticalDomains: string[];
}

export interface CandidateDossier {
  candidateId: string;
  name: string;
  targetRole: string;
  organizationContext: OrganizationContext;
  claims: Claim[];
  evidence: EvidenceItem[];
  roles: RoleEvent[];
  github: GithubSnapshot;
  interview: InterviewSnapshot;
}

/**
 * A single step in an agent's explicit chain-of-reasoning. Agents emit
 * these instead of free-form prose so the UI and audit log can render
 * the actual computation.
 */
export interface ReasoningStep {
  /** Short label, e.g. "prior", "evidence-weighted", "claim-check". */
  step: string;
  /** Human-readable detail. */
  detail: string;
  /** Numeric snapshot at this step (logit, score, etc). */
  value?: number;
  /** Evidence / claim / role ids this step depended on. */
  derivedFrom?: string[];
}

/**
 * Wrapped output every flagship agent must produce. The `result` is the
 * agent-specific payload; everything else is the auditability envelope.
 */
export interface AgentReasoning<T> {
  agentId: string;
  candidateId: string;
  result: T;
  confidence: Confidence;
  reasoning: ReasoningStep[];
  /** Evidence / claim / role ids the result depends on, for audit traversal. */
  evidenceChain: string[];
  provenance: Provenance;
}

/** Helper sigmoid + logit used by the Bayesian agent (re-exported for tests). */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function logit(p: number): number {
  const eps = 1e-6;
  const clamped = Math.min(1 - eps, Math.max(eps, p));
  return Math.log(clamped / (1 - clamped));
}

/** Credibility per source — used when weighting evidence in the Bayesian agent. */
export const SOURCE_CREDIBILITY: Record<EvidenceSource, number> = {
  github: 1.0,
  reference: 0.95,
  interview: 0.9,
  cv: 0.55,
  self: 0.3,
};
