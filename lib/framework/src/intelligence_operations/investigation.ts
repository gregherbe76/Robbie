// =========================================================================
// 1. InvestigationEngine
//
// Iterative investigation under uncertainty. The framework does not pretend
// a single agent pass is a decision. When the seeded signals show enough
// uncertainty / contradiction / ambiguity / risk profile, an investigation
// is opened with explicit triggers, evidence gaps, and unresolved questions.
// =========================================================================

import type {
  AdversarialReview,
  EvidenceRequest,
  Investigation,
  InvestigationState,
  InvestigationTrigger,
  OpsClock,
} from "./types.js";
import { clamp01, round } from "./types.js";

/** Inputs for the investigation engine — one (case, agent-outputs) bundle.
 *  Kept structural so the bridge can adapt either flagship analysis types
 *  or richer downstream sources without coupling. */
export interface InvestigationInputs {
  caseId: string;
  candidateId: string;
  organizationId: string;
  generatedAt: string;
  // Cognition
  disagreementScore: number;
  ambiguityLevel: number;
  globalConfidence: number;
  unresolvedQuestionsFromCognition: string[];
  nextInvestigationsFromCognition: string[];
  // Contradiction
  contradictions: Array<{
    id: string;
    summary: string;
    severity: "low" | "medium" | "high";
  }>;
  unsupportedClaims: string[];
  // Org-fit
  fitRecommendation:
    | "strong_fit"
    | "conditional_fit"
    | "high_upside_high_risk"
    | "poor_context_fit"
    | "insufficient_context";
  hiringRiskNextInvestigations: string[];
  roleEnvironmentInvestigations: string[];
  // Evidence density
  evidenceCount: number;
}

const THRESHOLDS = {
  disagreement: 0.4,
  lowConfidence: 0.6,
  ambiguity: 0.5,
  evidenceDensity: 4,
} as const;

export function detectTriggers(
  inp: InvestigationInputs,
): InvestigationTrigger[] {
  const t: InvestigationTrigger[] = [];
  if (inp.disagreementScore > THRESHOLDS.disagreement) {
    t.push({
      kind: "high-disagreement",
      detail: `Cross-agent disagreement at ${round(inp.disagreementScore)} exceeds tolerance ${THRESHOLDS.disagreement}.`,
      metric: round(inp.disagreementScore),
      threshold: THRESHOLDS.disagreement,
    });
  }
  if (inp.globalConfidence < THRESHOLDS.lowConfidence) {
    t.push({
      kind: "low-confidence",
      detail: `Global confidence ${round(inp.globalConfidence)} is below sufficiency floor ${THRESHOLDS.lowConfidence}.`,
      metric: round(inp.globalConfidence),
      threshold: THRESHOLDS.lowConfidence,
    });
  }
  if (inp.ambiguityLevel > THRESHOLDS.ambiguity) {
    t.push({
      kind: "unresolved-ambiguity",
      detail: `Ambiguity ${round(inp.ambiguityLevel)} indicates competing reasonable interpretations.`,
      metric: round(inp.ambiguityLevel),
      threshold: THRESHOLDS.ambiguity,
    });
  }
  const severeContradictions = inp.contradictions.filter(
    (c) => c.severity === "high",
  ).length;
  if (severeContradictions > 0) {
    t.push({
      kind: "contradiction-severity",
      detail: `${severeContradictions} high-severity contradiction(s) require resolution.`,
      metric: severeContradictions,
      threshold: 1,
    });
  }
  if (inp.evidenceCount < THRESHOLDS.evidenceDensity) {
    t.push({
      kind: "weak-evidence-density",
      detail: `Only ${inp.evidenceCount} corroborating evidence items — below the ${THRESHOLDS.evidenceDensity}-item sufficiency bar.`,
      metric: inp.evidenceCount,
      threshold: THRESHOLDS.evidenceDensity,
    });
  }
  if (inp.fitRecommendation === "high_upside_high_risk") {
    t.push({
      kind: "high-upside-high-risk",
      detail: `Organisation-fit synthesizer flagged a high-upside / high-risk profile that requires explicit risk acceptance.`,
      metric: 1,
      threshold: 1,
    });
  }
  return t;
}

/** Aggregate evidence gaps from the available signals. */
function buildEvidenceGaps(inp: InvestigationInputs): string[] {
  const gaps = new Set<string>();
  for (const c of inp.unsupportedClaims) {
    gaps.add(`Unsupported claim: ${c}`);
  }
  if (inp.evidenceCount < THRESHOLDS.evidenceDensity) {
    gaps.add(
      `Evidence density is ${inp.evidenceCount}; minimum sufficiency is ${THRESHOLDS.evidenceDensity}.`,
    );
  }
  for (const q of inp.roleEnvironmentInvestigations) {
    gaps.add(`Role-environment gap: ${q}`);
  }
  return Array.from(gaps).sort((a, b) => a.localeCompare(b));
}

/** Compose the unresolved-question set from upstream investigators. */
function buildUnresolvedQuestions(inp: InvestigationInputs): string[] {
  const q = new Set<string>();
  for (const x of inp.unresolvedQuestionsFromCognition) q.add(x);
  for (const x of inp.nextInvestigationsFromCognition) q.add(x);
  for (const x of inp.hiringRiskNextInvestigations) q.add(x);
  return Array.from(q).sort((a, b) => a.localeCompare(b));
}

function pickState(triggers: InvestigationTrigger[]): InvestigationState {
  if (triggers.length === 0) return "resolved";
  const hasCritical = triggers.some(
    (t) =>
      t.kind === "contradiction-severity" || t.kind === "high-upside-high-risk",
  );
  if (hasCritical && triggers.length >= 3) return "escalated";
  if (triggers.some((t) => t.kind === "weak-evidence-density"))
    return "evidence_requested";
  if (triggers.length >= 2) return "under_review";
  return "open";
}

function recommendedNextActions(
  inp: InvestigationInputs,
  triggers: InvestigationTrigger[],
): string[] {
  const actions: string[] = [];
  if (triggers.some((t) => t.kind === "weak-evidence-density")) {
    actions.push(
      "Run an evidence-request cycle for unsupported claims before any decision.",
    );
  }
  if (triggers.some((t) => t.kind === "high-disagreement")) {
    actions.push(
      "Spin up an adversarial review pairing supporting vs refuting agents.",
    );
  }
  if (triggers.some((t) => t.kind === "contradiction-severity")) {
    actions.push(
      "Escalate to senior reviewer; do not advance until contradictions are reconciled.",
    );
  }
  if (triggers.some((t) => t.kind === "high-upside-high-risk")) {
    actions.push(
      "Founder review required — explicit risk acceptance must be logged.",
    );
  }
  if (triggers.some((t) => t.kind === "low-confidence")) {
    actions.push(
      "Defer decision until at least two new evidence sources resolve open questions.",
    );
  }
  if (actions.length === 0) {
    actions.push("Maintain monitoring; no active investigation required.");
  }
  return actions;
}

function buildTitle(
  inp: InvestigationInputs,
  triggers: InvestigationTrigger[],
): string {
  if (triggers.length === 0)
    return `Routine monitoring · ${inp.candidateId} @ ${inp.organizationId}`;
  const kinds = triggers
    .map((t) => t.kind)
    .slice()
    .sort();
  return `Investigation · ${kinds.join(" + ")} · ${inp.candidateId}`;
}

export class InvestigationEngine {
  constructor(private clock: OpsClock) {}

  open(inp: InvestigationInputs, originatingAgents: string[]): Investigation {
    const triggers = detectTriggers(inp);
    const evidenceGaps = buildEvidenceGaps(inp);
    const unresolvedQuestions = buildUnresolvedQuestions(inp);
    const state = pickState(triggers);
    const initialConf = clamp01(inp.globalConfidence);
    // Investigation does NOT silently mutate confidence; we expose what a
    // *resolution* would imply. Current === initial until evidence resolves.
    const delta = triggers.some((t) => t.kind === "contradiction-severity")
      ? -0.1
      : triggers.some((t) => t.kind === "high-disagreement")
        ? -0.05
        : 0;
    return {
      id: `inv:${inp.organizationId}:${inp.candidateId}`,
      caseId: inp.caseId,
      candidateId: inp.candidateId,
      organizationId: inp.organizationId,
      title: buildTitle(inp, triggers),
      rationale:
        triggers.length === 0
          ? "Signals are within thresholds — case held in monitoring only."
          : `Opened in response to ${triggers.length} trigger(s); the system does not advance under unresolved uncertainty.`,
      state,
      createdAt: inp.generatedAt,
      triggers,
      originatingAgents: originatingAgents.slice().sort((a, b) =>
        a.localeCompare(b),
      ),
      evidenceGaps,
      unresolvedQuestions,
      confidenceState: {
        initial: round(initialConf),
        current: round(clamp01(initialConf + delta)),
        delta: round(delta),
      },
      recommendedNextActions: recommendedNextActions(inp, triggers),
    };
  }
}

/** Cross-link helper: investigations move to `evidence_requested` when an
 *  evidence request is generated downstream, and to `escalated` when an
 *  escalation is raised. Pure function — easy to audit. */
export function reconcileInvestigationState(
  inv: Investigation,
  evidenceRequests: EvidenceRequest[],
  hasEscalation: boolean,
  adversarialReviews: AdversarialReview[],
): Investigation {
  if (inv.triggers.length === 0) return inv;
  let next: InvestigationState = inv.state;
  if (hasEscalation) next = "escalated";
  else if (evidenceRequests.length > 0) next = "evidence_requested";
  else if (adversarialReviews.length > 0) next = "under_review";
  return next === inv.state ? inv : { ...inv, state: next };
}
