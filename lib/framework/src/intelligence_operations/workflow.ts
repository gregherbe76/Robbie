// =========================================================================
// 5. DecisionReviewWorkflow + 6. EscalationEngine + 7. HumanOversightLayer
//
// These three engines together turn the case into a stateful operations
// object. The decision-review workflow exposes the current decision state
// without flattening uncertainty; the escalation engine surfaces high-risk
// cases; and the human-oversight layer keeps reviewers as first-class
// participants. All actions are logged; no silent mutations.
// =========================================================================

import type {
  DecisionReviewWorkflowState,
  DecisionState,
  DecisionWorkflowTransition,
  Escalation,
  EscalationReviewType,
  EscalationSeverity,
  Hypothesis,
  HumanAnnotation,
  HumanAnnotationKind,
  Investigation,
  EvidenceRequest,
  AdversarialReview,
} from "./types.js";
import { SEVERITY_RANK, round } from "./types.js";

// -------------------------------------------------------------------------
// 6. EscalationEngine
// -------------------------------------------------------------------------

export interface EscalationInputs {
  caseId: string;
  candidateId: string;
  organizationId: string;
  generatedAt: string;
  disagreementScore: number;
  globalConfidence: number;
  highSeverityContradictionCount: number;
  evidenceRequestCount: number;
  fitRecommendation: string;
  overconfidenceRisk: "low" | "medium" | "high";
  hiringRiskOverall: number;
}

function severityFromSignals(count: number): EscalationSeverity {
  if (count >= 4) return "critical";
  if (count >= 3) return "high";
  if (count >= 2) return "medium";
  return "low";
}

function reviewTypeFor(
  fit: string,
  highContradictions: number,
  hiringRisk: number,
): EscalationReviewType {
  if (fit === "high_upside_high_risk") return "founder-review";
  if (highContradictions >= 2) return "adversarial-panel";
  if (hiringRisk > 0.6) return "extended-investigation";
  if (hiringRisk > 0.45) return "reference-validation";
  return "senior-reviewer";
}

export class EscalationEngine {
  build(inp: EscalationInputs): Escalation | null {
    const signals: string[] = [];
    const unresolvedRisks: string[] = [];
    const blockingQuestions: string[] = [];
    if (inp.disagreementScore > 0.6) {
      signals.push(`extreme cross-agent disagreement (${round(inp.disagreementScore)})`);
      unresolvedRisks.push(
        "Agents disagree on the central question — single-pass advancement is unsafe.",
      );
      blockingQuestions.push(
        "Which agent's framing is correct, and on what evidence?",
      );
    }
    if (inp.globalConfidence < 0.4) {
      signals.push(`confidence collapse (${round(inp.globalConfidence)})`);
      unresolvedRisks.push(
        "Global confidence is below the action floor; advancing now would be guessing.",
      );
      blockingQuestions.push(
        "What additional evidence would raise confidence above 0.6?",
      );
    }
    if (inp.highSeverityContradictionCount >= 2) {
      signals.push(
        `${inp.highSeverityContradictionCount} unresolved high-severity contradictions`,
      );
      unresolvedRisks.push(
        "Contradiction cluster suggests narrative inflation or evaluator error.",
      );
      blockingQuestions.push(
        "Can a single coherent narrative survive all flagged contradictions?",
      );
    }
    if (inp.evidenceRequestCount >= 5) {
      signals.push(
        `evidence insufficiency (${inp.evidenceRequestCount} open requests)`,
      );
      unresolvedRisks.push(
        "Too many open evidence requests — the decision surface is not stable.",
      );
      blockingQuestions.push(
        "Which evidence requests must be resolved before any decision?",
      );
    }
    if (inp.fitRecommendation === "high_upside_high_risk") {
      signals.push(`high-upside / high-risk fit profile`);
      unresolvedRisks.push(
        "Asymmetric outcome distribution — explicit risk acceptance required.",
      );
      blockingQuestions.push(
        "Does the hiring committee explicitly accept the downside scenario?",
      );
    }
    if (inp.overconfidenceRisk === "high") {
      signals.push(`system-level over-confidence warning`);
      unresolvedRisks.push(
        "Calibration layer detected systematic over-confidence; current scores are not trustworthy at face value.",
      );
      blockingQuestions.push(
        "Should this case use a confidence haircut while the calibration drift is unresolved?",
      );
    }
    if (signals.length === 0) return null;
    const severity = severityFromSignals(signals.length);
    return {
      id: `esc:${inp.organizationId}:${inp.candidateId}`,
      caseId: inp.caseId,
      candidateId: inp.candidateId,
      organizationId: inp.organizationId,
      escalationReason: `Escalation raised on ${signals.length} signal(s): ${signals.join("; ")}.`,
      severity,
      recommendedReviewType: reviewTypeFor(
        inp.fitRecommendation,
        inp.highSeverityContradictionCount,
        inp.hiringRiskOverall,
      ),
      unresolvedRisks: unresolvedRisks
        .slice()
        .sort((a, b) => a.localeCompare(b)),
      blockingQuestions: blockingQuestions
        .slice()
        .sort((a, b) => a.localeCompare(b)),
      triggeringSignals: signals.slice().sort((a, b) => a.localeCompare(b)),
      createdAt: inp.generatedAt,
    };
  }
}

// -------------------------------------------------------------------------
// 7. HumanOversightLayer (seeded reviewer activity)
//
// Humans must be first-class participants. The framework ships with a
// deterministic seed reviewer that demonstrates how annotations attach to
// cases with rationale, confidence impact, and full provenance — never
// silent overrides.
// -------------------------------------------------------------------------

export interface HumanInputs {
  caseId: string;
  candidateId: string;
  organizationId: string;
  generatedAt: string;
  highContradictionCount: number;
  fitRecommendation: string;
  overconfidenceRisk: "low" | "medium" | "high";
  disagreementScore: number;
  globalConfidence: number;
}

interface SeededAnnotation {
  kind: HumanAnnotationKind;
  rationale: string;
  confidenceImpact: number;
  targetAgent?: string;
  targetField?: string;
  beforeValue?: number;
  afterValue?: number;
  evidence: string[];
}

export class HumanOversightLayer {
  build(inp: HumanInputs): HumanAnnotation[] {
    const seeds: SeededAnnotation[] = [];
    if (inp.highContradictionCount >= 2) {
      seeds.push({
        kind: "disagreement",
        rationale: `Reviewer disagrees with the bayesian fit score given ${inp.highContradictionCount} high-severity contradictions still open. Recommend confidence haircut until contradictions reconcile.`,
        confidenceImpact: -0.1,
        targetAgent: "bayesian-scorer",
        targetField: "fitConfidence",
        beforeValue: round(inp.globalConfidence),
        afterValue: round(Math.max(0, inp.globalConfidence - 0.1)),
        evidence: ["contradiction-detector"],
      });
    }
    if (inp.fitRecommendation === "high_upside_high_risk") {
      seeds.push({
        kind: "rationale-override",
        rationale: `Reviewer accepts the high-upside / high-risk profile but requires the founder to explicitly sign off on the downside before advancing.`,
        confidenceImpact: 0,
        targetField: "decisionState",
        evidence: ["organization-intelligence"],
      });
    }
    if (inp.overconfidenceRisk === "high") {
      seeds.push({
        kind: "uncertainty-acknowledgement",
        rationale: `Reviewer notes the system-level over-confidence warning and explicitly defers any "decision_ready" transition until the calibration drift is addressed.`,
        confidenceImpact: 0,
        targetField: "decisionState",
        evidence: ["evaluation-report-engine"],
      });
    }
    if (inp.disagreementScore < 0.2 && inp.globalConfidence > 0.7 && seeds.length === 0) {
      seeds.push({
        kind: "review-note",
        rationale: `Reviewer concurs with the system's read — agents broadly agree and confidence is well-supported. No override needed.`,
        confidenceImpact: 0,
        evidence: [],
      });
    }
    return seeds.map((s, i) => ({
      id: `hum:${inp.organizationId}:${inp.candidateId}:${i}`,
      caseId: inp.caseId,
      reviewer: "senior-reviewer-1",
      kind: s.kind,
      rationale: s.rationale,
      at: inp.generatedAt,
      confidenceImpact: round(s.confidenceImpact),
      targetAgent: s.targetAgent,
      targetField: s.targetField,
      beforeValue: s.beforeValue,
      afterValue: s.afterValue,
      evidence: s.evidence,
    }));
  }
}

// -------------------------------------------------------------------------
// 5. DecisionReviewWorkflow
// -------------------------------------------------------------------------

export interface WorkflowInputs {
  caseId: string;
  generatedAt: string;
  investigations: Investigation[];
  evidenceRequests: EvidenceRequest[];
  hypotheses: Hypothesis[];
  adversarialReviews: AdversarialReview[];
  escalation: Escalation | null;
  humanAnnotations: HumanAnnotation[];
  globalConfidence: number;
  overconfidenceRisk: "low" | "medium" | "high";
}

function decideState(inp: WorkflowInputs): {
  state: DecisionState;
  rationale: string;
  blocking: string[];
} {
  const openInvestigations = inp.investigations.filter(
    (i) => i.state !== "resolved" && i.state !== "archived",
  );
  const openEvidence = inp.evidenceRequests.filter(
    (e) => e.state === "open" || e.state === "in_progress",
  );
  const competing = inp.hypotheses.filter((h) => h.status === "competing");
  const unresolvedH = inp.hypotheses.filter((h) => h.status === "unresolved");
  const adversarialUnresolved = inp.adversarialReviews.flatMap((r) =>
    r.unresolvedTensions,
  );
  const blocking: string[] = [];

  if (inp.overconfidenceRisk === "high") {
    blocking.push(
      "Calibration layer reports system-level over-confidence — apply haircut before advancing.",
    );
  }
  if (inp.escalation && inp.escalation.severity !== "low") {
    blocking.push(
      `Escalation (${inp.escalation.severity}) requires ${inp.escalation.recommendedReviewType} sign-off.`,
    );
  }
  if (openEvidence.length > 0) {
    blocking.push(
      `${openEvidence.length} evidence request(s) still open — decision surface is not stable.`,
    );
  }
  if (competing.length > 0) {
    blocking.push(
      `${competing.length} competing hypothes(es) — disagreement preserved, not flattened.`,
    );
  }
  if (adversarialUnresolved.length > 0) {
    blocking.push(
      `${adversarialUnresolved.length} unresolved adversarial tension(s).`,
    );
  }

  if (inp.overconfidenceRisk === "high") {
    return {
      state: "calibration_warning",
      rationale:
        "System-level over-confidence detected by the calibration layer; the framework refuses to mark cases decision-ready until the drift is acknowledged or corrected.",
      blocking,
    };
  }
  if (inp.escalation) {
    return {
      state:
        inp.escalation.severity === "low"
          ? "investigation_required"
          : adversarialUnresolved.length > 0
            ? "adversarial_review"
            : "investigation_required",
      rationale: `Escalation (${inp.escalation.severity}) raised: ${inp.escalation.escalationReason}`,
      blocking,
    };
  }
  if (openEvidence.length > 0) {
    return {
      state: "evidence_pending",
      rationale: `Decision blocked on ${openEvidence.length} pending evidence request(s).`,
      blocking,
    };
  }
  if (competing.length > 0 || adversarialUnresolved.length > 0) {
    return {
      state: "adversarial_review",
      rationale: `Competing hypotheses or unresolved adversarial chains — disagreement is real, not noise.`,
      blocking,
    };
  }
  if (inp.humanAnnotations.length > 0) {
    return {
      state: "human_review",
      rationale: `Reviewer annotations recorded; case awaits human sign-off.`,
      blocking,
    };
  }
  if (unresolvedH.length > 0 || openInvestigations.length > 0) {
    return {
      state: openInvestigations.length > 0 ? "investigation_required" : "unresolved",
      rationale:
        openInvestigations.length > 0
          ? `${openInvestigations.length} investigation(s) still active.`
          : `${unresolvedH.length} unresolved hypothes(es); not enough resolution for a decision.`,
      blocking,
    };
  }
  if (inp.globalConfidence < 0.5) {
    return {
      state: "unresolved",
      rationale: `Confidence ${round(inp.globalConfidence)} too low for a decision-ready state, even with no blocking items.`,
      blocking,
    };
  }
  if (inp.globalConfidence >= 0.7 && blocking.length === 0) {
    return {
      state: "decision_ready",
      rationale: `All investigations resolved, no blocking factors, confidence ${round(inp.globalConfidence)} above sufficiency.`,
      blocking,
    };
  }
  return {
    state: "initial_assessment",
    rationale: `No blocking factors but confidence ${round(inp.globalConfidence)} is borderline — case held in initial assessment.`,
    blocking,
  };
}

export class DecisionReviewWorkflow {
  build(inp: WorkflowInputs): DecisionReviewWorkflowState {
    const decision = decideState(inp);
    const transitions: DecisionWorkflowTransition[] = [
      {
        id: `wf:${inp.caseId}:t:0`,
        at: inp.generatedAt,
        from: "initial_assessment",
        to: decision.state,
        reviewer: "intelligence-operations-engine",
        rationale: decision.rationale,
        confidenceBefore: round(inp.globalConfidence),
        confidenceAfter: round(inp.globalConfidence),
      },
    ];
    // Premature-certainty guard: refuses to mark `decision_ready` while any
    // unresolved tension exists. If something tried to override this, it would
    // be logged here. With the seed corpus the guard explains *why* we did
    // (or didn't) trigger.
    const guardTriggered =
      decision.state !== "decision_ready" && inp.globalConfidence >= 0.75;
    return {
      caseId: inp.caseId,
      state: decision.state,
      stateRationale: decision.rationale,
      blockingFactors: decision.blocking,
      uncertaintyPreserved:
        decision.state !== "decision_ready" || decision.blocking.length === 0,
      transitions,
      prematureCertaintyGuard: {
        triggered: guardTriggered,
        reason: guardTriggered
          ? `Confidence ${round(inp.globalConfidence)} is high but blocking factors remain — guard refused to mark decision_ready.`
          : "No premature-certainty conditions detected.",
      },
    };
  }
}
