// =========================================================================
// 9. IntelligenceCaseSystem + 10. OperationsAuditEngine + composer
//
// The intelligence case is the operational unit of recruiting intelligence.
// One case per (candidate × organization), aggregating every other engine's
// output and exposing the live operational state.
//
// The audit engine emits a deterministic, append-only timeline of every
// artifact created during a single layer run — making the entire reasoning
// process replayable and historically inspectable.
// =========================================================================

import type {
  AdversarialReview,
  AuditEvent,
  AuditEventKind,
  ConsensusReport,
  DecisionReviewWorkflowState,
  Escalation,
  EscalationSeverity,
  EvidenceRequest,
  HumanAnnotation,
  Hypothesis,
  IntelligenceCase,
  Investigation,
  OperationsMetrics,
  OperationsReport,
  DecisionState,
  ReviewerRecommendation,
} from "./types.js";
import { SEVERITY_RANK, round } from "./types.js";
import {
  InvestigationEngine,
  reconcileInvestigationState,
  type InvestigationInputs,
} from "./investigation.js";
import {
  AdversarialReviewEngine,
  type AdversarialInputs,
} from "./adversarial.js";
import {
  EvidenceRequestEngine,
  type EvidenceInputs,
} from "./evidence.js";
import {
  HypothesisTrackingSystem,
  type HypothesisInputs,
} from "./hypotheses.js";
import {
  DecisionReviewWorkflow,
  EscalationEngine,
  HumanOversightLayer,
  type EscalationInputs,
  type HumanInputs,
  type WorkflowInputs,
} from "./workflow.js";
import {
  MultiReviewerConsensusEngine,
  type ConsensusInputs,
} from "./consensus.js";

// -------------------------------------------------------------------------
// 10. OperationsAuditEngine
// -------------------------------------------------------------------------

interface AuditAppendInput {
  caseId: string;
  at: string;
  actor: string;
  kind: AuditEventKind;
  summary: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
  relatedRefIds?: string[];
}

export class OperationsAuditEngine {
  private events: AuditEvent[] = [];
  private counter = 0;

  append(e: AuditAppendInput): AuditEvent {
    const id = `aud:${e.caseId}:${String(this.counter).padStart(4, "0")}`;
    this.counter++;
    const ev: AuditEvent = {
      id,
      caseId: e.caseId,
      at: e.at,
      actor: e.actor,
      kind: e.kind,
      summary: e.summary,
      confidenceBefore: e.confidenceBefore,
      confidenceAfter: e.confidenceAfter,
      relatedRefIds: (e.relatedRefIds ?? []).slice().sort((a, b) =>
        a.localeCompare(b),
      ),
    };
    this.events.push(ev);
    return ev;
  }

  all(): AuditEvent[] {
    // Stable order: timestamp then id.
    return this.events.slice().sort((a, b) => {
      if (a.at < b.at) return -1;
      if (a.at > b.at) return 1;
      return a.id.localeCompare(b.id);
    });
  }
}

// -------------------------------------------------------------------------
// 9. IntelligenceCaseSystem — composer for one case
// -------------------------------------------------------------------------

export interface CaseInputs {
  candidateId: string;
  candidateName: string;
  organizationId: string;
  targetRole: string;
  generatedAt: string;
  investigation: InvestigationInputs;
  adversarial: AdversarialInputs;
  evidence: EvidenceInputs;
  hypotheses: HypothesisInputs;
  escalation: EscalationInputs;
  human: HumanInputs;
  consensus: Omit<ConsensusInputs, "caseId" | "workflowDecisionState">;
  // signals derived elsewhere
  longitudinalUpdates: string[];
  calibrationWarnings: string[];
  originatingAgents: string[];
}

function effectiveConfidence(args: {
  globalConfidence: number;
  unresolvedAdversarialChains: number;
  openEvidenceRequests: number;
  escalationSeverity: EscalationSeverity | null;
  humanAdjustment: number;
  overconfidenceRisk: "low" | "medium" | "high";
}): number {
  let c = args.globalConfidence;
  c -= 0.02 * args.unresolvedAdversarialChains;
  c -= 0.015 * args.openEvidenceRequests;
  if (args.escalationSeverity === "critical") c -= 0.2;
  else if (args.escalationSeverity === "high") c -= 0.12;
  else if (args.escalationSeverity === "medium") c -= 0.07;
  if (args.overconfidenceRisk === "high") c -= 0.1;
  else if (args.overconfidenceRisk === "medium") c -= 0.05;
  c += args.humanAdjustment;
  return round(Math.max(0, Math.min(1, c)));
}

export class IntelligenceCaseSystem {
  constructor(
    private engines: {
      investigation: InvestigationEngine;
      adversarial: AdversarialReviewEngine;
      evidence: EvidenceRequestEngine;
      hypotheses: HypothesisTrackingSystem;
      escalation: EscalationEngine;
      human: HumanOversightLayer;
      workflow: DecisionReviewWorkflow;
      consensus: MultiReviewerConsensusEngine;
    },
    private audit: OperationsAuditEngine,
  ) {}

  build(input: CaseInputs): IntelligenceCase {
    const caseId = `${input.organizationId}::${input.candidateId}`;
    this.audit.append({
      caseId,
      at: input.generatedAt,
      actor: "intelligence-case-system",
      kind: "case-opened",
      summary: `Case opened for ${input.candidateId} @ ${input.organizationId}.`,
    });

    // 1. Investigation
    const investigation = this.engines.investigation.open(
      input.investigation,
      input.originatingAgents,
    );
    if (investigation.triggers.length > 0) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "investigation-engine",
        kind: "investigation-opened",
        summary: `${investigation.triggers.length} trigger(s): ${investigation.triggers.map((t) => t.kind).join(", ")}.`,
        confidenceBefore: investigation.confidenceState.initial,
        confidenceAfter: investigation.confidenceState.current,
        relatedRefIds: [investigation.id],
      });
    }

    // 2. Adversarial review
    const adversarial = this.engines.adversarial.build(input.adversarial);
    if (adversarial.arguments.length > 0) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "adversarial-review-engine",
        kind: "adversarial-review-added",
        summary: `${adversarial.arguments.length} arguments (${adversarial.unresolvedTensions.length} unresolved tensions).`,
        relatedRefIds: [adversarial.id],
      });
    }

    // 3. Evidence requests
    const evidence = this.engines.evidence.build(input.evidence);
    for (const e of evidence) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "evidence-request-engine",
        kind: "evidence-requested",
        summary: `${e.priority.toUpperCase()} · ${e.requestedEvidence}`,
        confidenceBefore: undefined,
        confidenceAfter: undefined,
        relatedRefIds: [e.id],
      });
    }

    // 4. Hypotheses
    const hypotheses = this.engines.hypotheses.build(input.hypotheses);
    for (const h of hypotheses) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "hypothesis-tracking-system",
        kind: "hypothesis-added",
        summary: `${h.status.toUpperCase()} · ${h.statement} (conf ${h.confidence})`,
        confidenceAfter: h.confidence,
        relatedRefIds: [h.id, ...h.competingWith],
      });
    }

    // 6. Escalation
    const escalation = this.engines.escalation.build(input.escalation);
    if (escalation) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "escalation-engine",
        kind: "escalation-raised",
        summary: `${escalation.severity.toUpperCase()} · ${escalation.recommendedReviewType} · ${escalation.escalationReason}`,
        relatedRefIds: [escalation.id],
      });
    }

    // 7. Human oversight
    const humanAnnotations = this.engines.human.build(input.human);
    for (const a of humanAnnotations) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: a.reviewer,
        kind: "human-annotation",
        summary: `${a.kind} · ${a.rationale}`,
        confidenceBefore: a.beforeValue,
        confidenceAfter: a.afterValue,
        relatedRefIds: [a.id],
      });
    }

    // Reconcile investigation state with downstream artifacts
    const reconciledInvestigation = reconcileInvestigationState(
      investigation,
      evidence,
      escalation !== null,
      adversarial.arguments.length > 0 ? [adversarial] : [],
    );
    if (reconciledInvestigation.state !== investigation.state) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "investigation-engine",
        kind: "investigation-state-changed",
        summary: `state ${investigation.state} → ${reconciledInvestigation.state}`,
        relatedRefIds: [investigation.id],
      });
    }

    // Calibration warnings → audit
    for (const w of input.calibrationWarnings) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "evaluation-report-engine",
        kind: "calibration-warning",
        summary: w,
      });
    }

    // 5. Workflow
    const workflowInputs: WorkflowInputs = {
      caseId,
      generatedAt: input.generatedAt,
      investigations: [reconciledInvestigation],
      evidenceRequests: evidence,
      hypotheses,
      adversarialReviews: [adversarial],
      escalation,
      humanAnnotations,
      globalConfidence: input.consensus.bayesianConfidence,
      overconfidenceRisk: input.escalation.overconfidenceRisk,
    };
    const workflow = this.engines.workflow.build(workflowInputs);
    this.audit.append({
      caseId,
      at: input.generatedAt,
      actor: "decision-review-workflow",
      kind: "decision-state-changed",
      summary: `decision state set to ${workflow.state}: ${workflow.stateRationale}`,
    });

    // 8. Consensus
    const consensus = this.engines.consensus.build({
      ...input.consensus,
      caseId,
      workflowDecisionState: workflow.state,
    });

    // Longitudinal audit
    for (const u of input.longitudinalUpdates) {
      this.audit.append({
        caseId,
        at: input.generatedAt,
        actor: "longitudinal-learning",
        kind: "longitudinal-update",
        summary: u,
      });
    }

    // Aggregate signals
    const openEvidenceRequestCount = evidence.filter(
      (e) => e.state === "open" || e.state === "in_progress",
    ).length;
    const openInvestigationCount =
      reconciledInvestigation.state !== "resolved" &&
      reconciledInvestigation.state !== "archived"
        ? 1
        : 0;
    const competingPairs = hypotheses.filter(
      (h) => h.status === "competing",
    ).length;
    const escalationSeverityMax = escalation ? escalation.severity : null;
    const humanAdjustment = humanAnnotations.reduce(
      (s, a) => s + a.confidenceImpact,
      0,
    );
    const effective = effectiveConfidence({
      globalConfidence: input.consensus.bayesianConfidence,
      unresolvedAdversarialChains: adversarial.chains.filter(
        (c) => c.unresolved,
      ).length,
      openEvidenceRequests: openEvidenceRequestCount,
      escalationSeverity: escalationSeverityMax,
      humanAdjustment,
      overconfidenceRisk: input.escalation.overconfidenceRisk,
    });

    return {
      id: caseId,
      candidateId: input.candidateId,
      candidateName: input.candidateName,
      organizationId: input.organizationId,
      targetRole: input.targetRole,
      createdAt: input.generatedAt,
      decisionState: workflow.state,
      decisionStateRationale: workflow.stateRationale,
      workflow,
      investigations: [reconciledInvestigation],
      evidenceRequests: evidence,
      hypotheses,
      adversarialReviews: [adversarial],
      escalations: escalation ? [escalation] : [],
      humanAnnotations,
      consensus,
      calibrationWarnings: input.calibrationWarnings,
      longitudinalUpdates: input.longitudinalUpdates,
      unresolvedQuestionCount:
        reconciledInvestigation.unresolvedQuestions.length +
        adversarial.unresolvedTensions.length +
        consensus.unresolvedQuestions.length,
      openEvidenceRequestCount,
      openInvestigationCount,
      competingHypothesisCount: competingPairs,
      escalationSeverityMax,
      effectiveConfidence: effective,
    };
  }
}

// -------------------------------------------------------------------------
// Top-level composer
// -------------------------------------------------------------------------

export interface OperationsLayerInputs {
  generatedAt: string;
  cases: CaseInputs[];
}

export function runIntelligenceOperationsLayer(
  inputs: OperationsLayerInputs,
): OperationsReport {
  const audit = new OperationsAuditEngine();
  const engines = {
    investigation: new InvestigationEngine({
      now: () => new Date(inputs.generatedAt),
    }),
    adversarial: new AdversarialReviewEngine(),
    evidence: new EvidenceRequestEngine(),
    hypotheses: new HypothesisTrackingSystem(),
    escalation: new EscalationEngine(),
    human: new HumanOversightLayer(),
    workflow: new DecisionReviewWorkflow(),
    consensus: new MultiReviewerConsensusEngine(),
  };
  const caseSystem = new IntelligenceCaseSystem(engines, audit);

  const sortedInputs = inputs.cases
    .slice()
    .sort((a, b) =>
      `${a.organizationId}::${a.candidateId}`.localeCompare(
        `${b.organizationId}::${b.candidateId}`,
      ),
    );
  const cases = sortedInputs.map((c) => caseSystem.build(c));

  // Metrics
  const casesByDecisionState: Record<DecisionState, number> = {
    initial_assessment: 0,
    investigation_required: 0,
    adversarial_review: 0,
    human_review: 0,
    evidence_pending: 0,
    calibration_warning: 0,
    decision_ready: 0,
    unresolved: 0,
  };
  let openInvestigations = 0;
  let pendingEvidenceRequests = 0;
  let activeEscalations = 0;
  let unresolvedHypotheses = 0;
  let competingPairs = 0;
  let humanInterventions = 0;
  let guardsTriggered = 0;
  let confSum = 0;
  for (const c of cases) {
    casesByDecisionState[c.decisionState]++;
    openInvestigations += c.openInvestigationCount;
    pendingEvidenceRequests += c.openEvidenceRequestCount;
    activeEscalations += c.escalations.length;
    unresolvedHypotheses += c.hypotheses.filter(
      (h) => h.status === "unresolved",
    ).length;
    competingPairs += c.competingHypothesisCount;
    humanInterventions += c.humanAnnotations.length;
    if (c.workflow.prematureCertaintyGuard.triggered) guardsTriggered++;
    confSum += c.effectiveConfidence;
  }
  const metrics: OperationsMetrics = {
    totalCases: cases.length,
    casesByDecisionState,
    openInvestigations,
    pendingEvidenceRequests,
    activeEscalations,
    unresolvedHypotheses,
    competingHypothesisPairs: competingPairs,
    averageEffectiveConfidence: round(
      cases.length > 0 ? confSum / cases.length : 0,
    ),
    humanInterventions,
    prematureCertaintyGuardsTriggered: guardsTriggered,
  };

  return {
    generatedAt: inputs.generatedAt,
    generatedBy: "intelligence-operations-engine",
    cases,
    audit: audit.all(),
    metrics,
  };
}
