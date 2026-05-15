/**
 * Replay runner.
 *
 * Composes the existing framework pipeline (flagship agents → cognition →
 * organization-intelligence) into a single deterministic trace. Every step
 * carries a monotonically increasing fixed-clock timestamp and provenance
 * pointers, so the trace is replayable bit-for-bit.
 */

import { createHash } from "node:crypto";
import {
  BayesianScoringAgent,
  ContradictionAgent,
  TrajectoryAgent,
  type CandidateDossier,
} from "../agents/flagship/index.js";
import { synthesizeCognition } from "../cognition/index.js";
import { runOrganizationIntelligence } from "../organization_intelligence/index.js";
import type { OrganizationContext } from "../organization_intelligence/index.js";
import {
  EscalationEngine,
  type EscalationInputs,
} from "../intelligence_operations/index.js";
import {
  analyzeReliability,
  computeCalibration,
} from "../evaluation/index.js";
import type { CalibrationCurve } from "../evaluation/index.js";
import {
  expandCalibrationSeeds,
  findCase,
  lookupScenario,
  type CalibrationSeedShape,
} from "./cases.js";
import type {
  CalibrationBucket as ReplayCalibrationBucket,
  CalibrationView,
  EscalationEvent,
  OrgFitView,
  ProvenanceEdge,
  ProvenanceGraph,
  ProvenanceNode,
  RecommendationView,
  ReplayCaseId,
  ReplayDisagreement,
  ReplayPropagation,
  ReplayStep,
  ReplayTrace,
} from "./types.js";

const BASE_CLOCK_MS = Date.parse("2026-05-15T12:00:00.000Z");
/** Spacing between deterministic step timestamps, in ms. */
const STEP_SPACING_MS = 250;

function tsAt(ord: number): string {
  return new Date(BASE_CLOCK_MS + ord * STEP_SPACING_MS).toISOString();
}

/** Stable, content-derived signature of the trace for client cache busting. */
function signTrace(value: unknown): string {
  const json = stableStringify(value);
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

function ingestionSteps(
  dossier: CandidateDossier,
  baseOrd: number,
): { steps: ReplayStep[]; nextOrd: number } {
  let ord = baseOrd;
  const steps: ReplayStep[] = [];
  steps.push({
    id: `step-ingest-${ord}`,
    ord,
    t: tsAt(ord),
    layer: "ingestion",
    title: "Dossier received",
    summary: `Ingested dossier for ${dossier.name} targeting ${dossier.targetRole}.`,
    rationale:
      "Ingestion normalises multi-source input (CV, interview, github, references) into evidence + claims with explicit provenance.",
    inputs: [],
    outputs: [dossier.candidateId],
  });
  ord++;
  steps.push({
    id: `step-ingest-${ord}`,
    ord,
    t: tsAt(ord),
    layer: "ingestion",
    title: "Claims normalised",
    summary: `${dossier.claims.length} candidate claim(s) parsed and domain-tagged.`,
    rationale:
      "Claims are the candidate's self-reported assertions. Distinguishing claim from evidence is what makes contradiction detection meaningful.",
    inputs: [dossier.candidateId],
    outputs: dossier.claims.map((c) => c.id),
  });
  ord++;
  steps.push({
    id: `step-ingest-${ord}`,
    ord,
    t: tsAt(ord),
    layer: "ingestion",
    title: "Evidence extracted",
    summary: `${dossier.evidence.length} evidence item(s) attributed across sources.`,
    rationale:
      "Each evidence item carries its own weight and source. Source credibility flows into Bayesian weighting downstream.",
    inputs: dossier.claims.map((c) => c.id),
    outputs: dossier.evidence.map((e) => e.id),
  });
  ord++;
  steps.push({
    id: `step-ingest-${ord}`,
    ord,
    t: tsAt(ord),
    layer: "ingestion",
    title: "Role history attributed",
    summary: `${dossier.roles.length} role(s) attributed with tenure + ownership signals.`,
    rationale:
      "Role history is the substrate for trajectory reasoning. Tenure, ownership, and recency are preserved as separate signals — never collapsed into a single 'experience' number.",
    inputs: [dossier.candidateId],
    outputs: dossier.roles.map((r) => r.id),
  });
  ord++;
  return { steps, nextOrd: ord };
}

interface AgentRunOutputs {
  bayesianId: string;
  contradictionId: string;
  trajectoryId: string;
}

function agentSteps(
  dossier: CandidateDossier,
  baseOrd: number,
  results: {
    bayesianFit: number;
    bayesianConf: number;
    contradictionScore: number;
    contradictionConf: number;
    contradictionCount: number;
    trajectoryScore: number;
    trajectoryConf: number;
  },
): { steps: ReplayStep[]; nextOrd: number; outputs: AgentRunOutputs } {
  let ord = baseOrd;
  const evidenceIds = dossier.evidence.map((e) => e.id);
  const outputs: AgentRunOutputs = {
    bayesianId: `sig:${dossier.candidateId}:bayesian`,
    contradictionId: `sig:${dossier.candidateId}:contradiction`,
    trajectoryId: `sig:${dossier.candidateId}:trajectory`,
  };
  const steps: ReplayStep[] = [
    {
      id: `step-agents-${ord}`,
      ord,
      t: tsAt(ord),
      layer: "agents",
      agentId: "bayesian-scorer",
      title: "Bayesian fit",
      summary: `P(hire) = ${results.bayesianFit.toFixed(2)} at confidence ${results.bayesianConf.toFixed(2)}.`,
      rationale:
        "Bayesian scorer combines a role-conditioned prior with source-weighted evidence via log-odds. Confidence reflects evidence diversity, not score magnitude.",
      inputs: evidenceIds,
      outputs: [outputs.bayesianId],
      confidence: results.bayesianConf,
    },
    {
      id: `step-agents-${ord + 1}`,
      ord: ord + 1,
      t: tsAt(ord + 1),
      layer: "agents",
      agentId: "contradiction-detector",
      title: "Cross-source contradictions",
      summary: `${results.contradictionCount} contradiction(s); contradictionScore ${results.contradictionScore.toFixed(2)}.`,
      rationale:
        "Contradiction detector flags claims whose supporting evidence is missing, weaker than the claim, or refuted by an independent source.",
      inputs: [...dossier.claims.map((c) => c.id), ...evidenceIds],
      outputs: [outputs.contradictionId],
      confidence: results.contradictionConf,
    },
    {
      id: `step-agents-${ord + 2}`,
      ord: ord + 2,
      t: tsAt(ord + 2),
      layer: "agents",
      agentId: "trajectory-modeler",
      title: "Trajectory & momentum",
      summary: `Trajectory score ${results.trajectoryScore.toFixed(2)}.`,
      rationale:
        "Trajectory modeller computes velocity, acceleration, and momentum across role history; it does not collapse the curve into a single number.",
      inputs: dossier.roles.map((r) => r.id),
      outputs: [outputs.trajectoryId],
      confidence: results.trajectoryConf,
    },
  ];
  ord += 3;
  return { steps, nextOrd: ord, outputs };
}

function cognitionSteps(
  candidateId: string,
  baseOrd: number,
  cognition: {
    globalConfidence: number;
    propagationCount: number;
    disagreementScore: number;
    disagreementCount: number;
    uncertaintyCategory: string;
    recommendationCategory: string;
    archetype: string | null;
  },
  agentOutputs: AgentRunOutputs,
): { steps: ReplayStep[]; nextOrd: number } {
  let ord = baseOrd;
  const inputs = [
    agentOutputs.bayesianId,
    agentOutputs.contradictionId,
    agentOutputs.trajectoryId,
  ];
  const steps: ReplayStep[] = [
    {
      id: `step-cog-${ord}`,
      ord,
      t: tsAt(ord),
      layer: "propagation",
      agentId: "cognition-engine",
      title: "Influence propagation",
      summary: `${cognition.propagationCount} propagation event(s); global confidence ${cognition.globalConfidence.toFixed(2)}.`,
      rationale:
        "Agents do not run in isolation. Contradictions penalise Bayesian confidence; missing evidence boosts uncertainty; supported trajectory amplifies fit.",
      inputs,
      outputs: [`cog:${candidateId}:propagation`],
      confidence: cognition.globalConfidence,
    },
    {
      id: `step-cog-${ord + 1}`,
      ord: ord + 1,
      t: tsAt(ord + 1),
      layer: "disagreement",
      agentId: "cognition-engine",
      title: "Disagreement analysis",
      summary: `${cognition.disagreementCount} preserved disagreement(s); score ${cognition.disagreementScore.toFixed(2)}.`,
      rationale:
        "Disagreements are not averaged away. They are surfaced as first-class artefacts with rationale.",
      inputs,
      outputs: [`cog:${candidateId}:disagreement`],
    },
    {
      id: `step-cog-${ord + 2}`,
      ord: ord + 2,
      t: tsAt(ord + 2),
      layer: "cognition",
      agentId: "cognition-engine",
      title: "Uncertainty fusion",
      summary: `Certainty category: ${cognition.uncertaintyCategory}.`,
      rationale:
        "Per-agent uncertainty is fused into a single, auditable model rather than collapsed into a point estimate.",
      inputs,
      outputs: [`cog:${candidateId}:uncertainty`],
    },
    {
      id: `step-cog-${ord + 3}`,
      ord: ord + 3,
      t: tsAt(ord + 3),
      layer: "cognition",
      agentId: "cognition-engine",
      title: "Reconciliation",
      summary: `Recommendation category: ${cognition.recommendationCategory}${cognition.archetype ? `; archetype: ${cognition.archetype}` : ""}.`,
      rationale:
        "Reconciliation does not vote across agents. It reasons about the structure of disagreement and the shape of uncertainty.",
      inputs: [
        `cog:${candidateId}:propagation`,
        `cog:${candidateId}:disagreement`,
        `cog:${candidateId}:uncertainty`,
      ],
      outputs: [`cog:${candidateId}:reconciliation`],
    },
  ];
  ord += 4;
  return { steps, nextOrd: ord };
}

function orgFitSteps(
  candidateId: string,
  baseOrd: number,
  view: OrgFitView,
): { steps: ReplayStep[]; nextOrd: number } {
  let ord = baseOrd;
  const steps: ReplayStep[] = [
    {
      id: `step-org-${ord}`,
      ord,
      t: tsAt(ord),
      layer: "org-fit",
      agentId: "org-intelligence",
      title: "Organization fit",
      summary: `${view.fitRecommendation} at confidence ${view.fitConfidence.toFixed(2)}; chaos-fit ${view.chaosFitScore.toFixed(2)}.`,
      rationale:
        "Fit is computed against organization context (founder style, team chemistry, chaos tolerance, role environment, hiring risk) — not against a generic candidate template.",
      inputs: [`cog:${candidateId}:reconciliation`],
      outputs: [`orgfit:${candidateId}`],
      confidence: view.fitConfidence,
    },
  ];
  ord++;
  if (view.tensions.length > 0) {
    steps.push({
      id: `step-org-${ord}`,
      ord,
      t: tsAt(ord),
      layer: "org-fit",
      agentId: "org-intelligence",
      title: "Role-environment mismatch",
      summary: `${view.tensions.length} tension(s) across role environment.`,
      rationale:
        "Mismatch between candidate signal and environment requirement is surfaced field-by-field. Capability fit ≠ environment fit.",
      inputs: [`orgfit:${candidateId}`],
      outputs: view.tensions.map((_, i) => `tension:${candidateId}:${i}`),
    });
    ord++;
  }
  return { steps, nextOrd: ord };
}

function escalationSteps(
  baseOrd: number,
  escalations: EscalationEvent[],
): { steps: ReplayStep[]; nextOrd: number } {
  let ord = baseOrd;
  const steps: ReplayStep[] = [];
  for (const esc of escalations) {
    steps.push({
      id: `step-esc-${ord}`,
      ord,
      t: tsAt(ord),
      layer: "escalation",
      agentId: "intelligence-operations",
      title: `Escalation: ${esc.trigger}`,
      summary: esc.summary,
      rationale: esc.detail,
      inputs: esc.requestedEvidence,
      outputs: [esc.id],
    });
    ord++;
  }
  return { steps, nextOrd: ord };
}

function calibrationStep(baseOrd: number, ece: number): ReplayStep {
  return {
    id: `step-calib-${baseOrd}`,
    ord: baseOrd,
    t: tsAt(baseOrd),
    layer: "calibration",
    agentId: "evaluation-engine",
    title: "Calibration snapshot",
    summary: `Expected calibration error ${ece.toFixed(2)}.`,
    rationale:
      "Calibration compares the system's claimed confidence to empirical outcomes. The system surfaces its own failures rather than hiding them.",
    inputs: [],
    outputs: ["calibration:snapshot"],
  };
}

function recommendationStep(
  baseOrd: number,
  view: RecommendationView,
): ReplayStep {
  return {
    id: `step-rec-${baseOrd}`,
    ord: baseOrd,
    t: tsAt(baseOrd),
    layer: "recommendation",
    agentId: "cognition-engine",
    title: "Decision support",
    summary: `${view.fitRecommendation} · ${view.uncertaintyCategory} · global confidence ${view.globalConfidence.toFixed(2)}.`,
    rationale:
      "The framework is decision support. The decision is the reviewer's; the framework's contract is to surface the evidence, the disagreements, and the uncertainty in full.",
    inputs: ["cog:reconciliation", "orgfit", "calibration:snapshot"],
    outputs: ["recommendation:final"],
    confidence: view.globalConfidence,
  };
}

// ---------------------------------------------------------------------------
// Provenance graph
// ---------------------------------------------------------------------------

function buildProvenanceGraph(
  dossier: CandidateDossier,
  agentOutputs: AgentRunOutputs,
  influences: ReplayPropagation[],
  generatedAt: string,
): ProvenanceGraph {
  const nodes: ProvenanceNode[] = [];
  const edges: ProvenanceEdge[] = [];

  for (const claim of dossier.claims) {
    nodes.push({
      id: claim.id,
      kind: "claim",
      label: `Claim · ${claim.domain}`,
      detail: claim.text,
      producedBy: "ingestion",
      producedAt: generatedAt,
    });
  }
  for (const role of dossier.roles) {
    nodes.push({
      id: role.id,
      kind: "role",
      label: `Role · ${role.title}`,
      detail: `${role.startedAt} → ${role.endedAt ?? "present"}, ${role.durationMonths}mo`,
      producedBy: "ingestion",
      producedAt: generatedAt,
    });
  }
  for (const ev of dossier.evidence) {
    nodes.push({
      id: ev.id,
      kind: "evidence",
      label: `Evidence · ${ev.source}`,
      detail: ev.summary,
      producedBy: ev.source,
      producedAt: generatedAt,
      confidence: ev.weight,
    });
    if (ev.claimId) {
      edges.push({
        from: ev.id,
        to: ev.claimId,
        relation: ev.kind === "refutes" ? "refutes" : "supports",
      });
    }
  }
  nodes.push({
    id: agentOutputs.bayesianId,
    kind: "agent-signal",
    label: "Bayesian fit",
    detail: "Posterior fit score derived from claims + weighted evidence.",
    producedBy: "bayesian-scorer",
    producedAt: generatedAt,
  });
  nodes.push({
    id: agentOutputs.contradictionId,
    kind: "agent-signal",
    label: "Contradiction score",
    detail: "Cross-source disagreement signal.",
    producedBy: "contradiction-detector",
    producedAt: generatedAt,
  });
  nodes.push({
    id: agentOutputs.trajectoryId,
    kind: "agent-signal",
    label: "Trajectory",
    detail: "Velocity, scope, ownership across role history.",
    producedBy: "trajectory-modeler",
    producedAt: generatedAt,
  });
  for (const ev of dossier.evidence) {
    edges.push({
      from: ev.id,
      to: agentOutputs.bayesianId,
      relation: "derives",
    });
  }
  for (const claim of dossier.claims) {
    edges.push({
      from: claim.id,
      to: agentOutputs.contradictionId,
      relation: "derives",
    });
  }
  for (const role of dossier.roles) {
    edges.push({
      from: role.id,
      to: agentOutputs.trajectoryId,
      relation: "derives",
    });
  }
  for (const inf of influences) {
    const infNodeId = inf.id;
    nodes.push({
      id: infNodeId,
      kind: "cognition-influence",
      label: `Influence · ${inf.kind}`,
      detail: inf.reason,
      producedBy: "cognition-engine",
      producedAt: generatedAt,
    });
    edges.push({
      from: agentOutputs[
        inf.sourceAgent.includes("bayesian")
          ? "bayesianId"
          : inf.sourceAgent.includes("contradiction")
            ? "contradictionId"
            : "trajectoryId"
      ],
      to: infNodeId,
      relation: "influences",
    });
  }
  nodes.push({
    id: "recommendation:final",
    kind: "recommendation",
    label: "Final decision support",
    detail: "Synthesised reconciliation across all upstream signals.",
    producedBy: "cognition-engine",
    producedAt: generatedAt,
  });
  edges.push({
    from: agentOutputs.bayesianId,
    to: "recommendation:final",
    relation: "produces",
  });
  edges.push({
    from: agentOutputs.contradictionId,
    to: "recommendation:final",
    relation: "produces",
  });
  edges.push({
    from: agentOutputs.trajectoryId,
    to: "recommendation:final",
    relation: "produces",
  });
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// View projections from real engine outputs
// ---------------------------------------------------------------------------

function buildOrgFitView(
  fit: ReturnType<typeof runOrganizationIntelligence>,
): OrgFitView {
  return {
    fitRecommendation: fit.fit.fitRecommendation,
    fitConfidence: fit.fit.fitConfidence,
    chaosFitScore: fit.report.chaosFit.result.chaosFitScore,
    founderFitHeadline: fit.report.founderFit.result.founderStyle,
    roleEnvironmentMismatchCount:
      fit.report.roleEnvironment.result.mismatchAreas.length,
    tensions: fit.report.roleEnvironment.result.mismatchAreas.map((m) => ({
      field: String(m.field),
      candidateSignal: m.candidateSignal,
      orgSignal: m.roleRequirement,
      severity: m.severity,
    })),
    successConditions: fit.report.successConditions,
    failureModes: fit.report.failureModes,
    interviewFocusAreas: fit.report.interviewFocusAreas,
  };
}

/**
 * Run the framework's real `EscalationEngine` and project its single
 * structured `Escalation` into one or more replay-visible
 * `EscalationEvent`s — one per triggering signal. The triggering
 * signals come straight from the engine; nothing is invented locally.
 */
function buildEscalationsFromEngine(
  inp: EscalationInputs,
  reliability: { overconfidenceRisk: "low" | "medium" | "high" },
): EscalationEvent[] {
  const engine = new EscalationEngine();
  const escalation = engine.build({
    ...inp,
    overconfidenceRisk: reliability.overconfidenceRisk,
  });
  if (!escalation) return [];

  const triggers = escalation.triggeringSignals;
  const risks = escalation.unresolvedRisks;
  const questions = escalation.blockingQuestions;
  return triggers.map((signal, i) => ({
    id: `${escalation.id}:${i}`,
    ord: i,
    trigger: classifyTrigger(signal),
    summary: signal,
    detail: risks[i] ?? escalation.escalationReason,
    requestedEvidence: questions.slice(i, i + 1),
    reviewerDisagreement:
      signal.includes("disagreement") || signal.includes("contradiction")
        ? {
            reviewerA: "trajectory-agent",
            reviewerB: "contradiction-agent",
            summary: questions[i] ?? escalation.escalationReason,
          }
        : undefined,
  }));
}

function classifyTrigger(signal: string): EscalationEvent["trigger"] {
  const s = signal.toLowerCase();
  if (s.includes("contradiction")) return "contradiction";
  if (s.includes("confidence") || s.includes("over-confidence"))
    return "uncertainty";
  if (s.includes("evidence")) return "missing-evidence";
  if (s.includes("disagreement")) return "adversarial-review";
  if (s.includes("upside") || s.includes("risk")) return "reviewer-override";
  return "uncertainty";
}

// ---------------------------------------------------------------------------
// Calibration view — produced LIVE by the evaluation engine.
//
// Each case ships deterministic prediction+outcome seeds (`cases.ts`).
// We feed those into `computeCalibration` + `analyzeReliability` — the
// exact same engines that power the evaluation layer — and project the
// resulting curve into the replay's `CalibrationView`. No buckets are
// hand-built here.
// ---------------------------------------------------------------------------

function buildCalibrationView(
  curve: CalibrationCurve,
  classifications: Array<{
    bucket: string;
    classification:
      | "justified"
      | "fragile"
      | "overconfident"
      | "underconfident"
      | "unstable";
    note: string;
  }>,
  overconfidenceRisk: "low" | "medium" | "high",
  fallbackCritique: string,
): CalibrationView {
  // Drop empty bins for display — the engine emits a fixed bin schema,
  // but the demo only wants to show bands that have predictions.
  const buckets: ReplayCalibrationBucket[] = curve.buckets
    .map((b, i): ReplayCalibrationBucket | null => {
      if (b.predictions === 0) return null;
      const cls = classifications[i];
      return {
        range: `${b.lower.toFixed(2)}–${b.upper.toFixed(2)}`,
        lower: b.lower,
        upper: b.upper,
        claimed: b.midpoint,
        actual: b.observedPositiveRate,
        count: b.predictions,
        overconfident: cls?.classification === "overconfident",
        critique: cls?.note ?? "",
      };
    })
    .filter((b): b is ReplayCalibrationBucket => b !== null);
  return {
    expectedCalibrationError: Number(
      curve.expectedCalibrationError.toFixed(3),
    ),
    overconfidenceWarning: overconfidenceRisk !== "low",
    buckets,
    selfCritique: fallbackCritique,
  };
}

function buildRecommendationView(
  cognitionReconRecommendation: string,
  fitRecommendation: ReturnType<typeof runOrganizationIntelligence>["fit"]["fitRecommendation"],
  uncertaintyCategory: string,
  globalConfidence: number,
  cognitionHeadline: string,
  strongestEvidence: Array<{ id: string; summary: string; weight: number }>,
  strongestRisks: Array<{ id: string; summary: string; severity: string }>,
  unresolvedQuestions: string[],
  disagreementCount: number,
): RecommendationView {
  return {
    category: cognitionReconRecommendation as RecommendationView["category"],
    fitRecommendation,
    uncertaintyCategory,
    globalConfidence,
    headline: cognitionHeadline,
    strongestEvidence,
    strongestRisks,
    unresolvedQuestions,
    reviewerDisagreementSummary:
      disagreementCount === 0
        ? "No reviewer disagreement preserved; agents converged on the same shape."
        : `${disagreementCount} disagreement(s) preserved verbatim across agents. None were averaged away.`,
    decisionSupportDisclaimer:
      "Decision support. The hire/no-hire decision is the reviewer's. The framework's contract is to surface evidence, disagreement, and uncertainty in full.",
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Inline config for `runReplayTraceFromConfig`. The shape mirrors a
 * `CaseConfig` from `cases.ts`, except the dossier and organization are
 * passed in directly (rather than looked up from a benchmark scenario).
 * This is what the public Cognition Lab uses to feed user-provided
 * synthetic input through the same deterministic pipeline as the hero
 * cases.
 */
export interface ReplayConfigInput {
  caseId: string;
  label: string;
  oneLiner: string;
  expectedRecommendation: string;
  selfCritique: string;
  dossier: CandidateDossier;
  organization: OrganizationContext;
  calibrationSeeds: CalibrationSeedShape;
}

/**
 * Canonical hero case entry point. Looks up the case + scenario and
 * delegates to `runReplayTraceFromConfig`.
 */
export function runReplayTrace(caseId: ReplayCaseId): ReplayTrace {
  const c = findCase(caseId);
  if (!c) {
    throw new Error(`replay: unknown case ${caseId}`);
  }
  const scenario = lookupScenario(c.scenarioId);
  return runReplayTraceFromConfig({
    caseId: c.caseId,
    label: c.label,
    oneLiner: c.oneLiner,
    expectedRecommendation: c.expectedRecommendation,
    selfCritique: c.selfCritique,
    dossier: scenario.dossier,
    organization: c.organizationOverride ?? scenario.organization,
    calibrationSeeds: c.calibrationSeeds,
  });
}

export function runReplayTraceFromConfig(
  config: ReplayConfigInput,
): ReplayTrace {
  const dossier: CandidateDossier = config.dossier;
  const organization: OrganizationContext = config.organization;

  const generatedAt = new Date(BASE_CLOCK_MS).toISOString();
  const fixedNow = () => new Date(BASE_CLOCK_MS);
  const fixedClock = { now: fixedNow };

  // ---- run the real framework engines ------------------------------------
  // Inject the fixed clock into every flagship agent so that any
  // time-dependent reasoning (e.g. TrajectoryAgent.momentum) is
  // pinned to the same instant. Without this the trace would drift
  // across calendar boundaries.
  const bayesian = new BayesianScoringAgent({ now: fixedNow }).run(dossier);
  const contradiction = new ContradictionAgent({ now: fixedNow }).run(dossier);
  const trajectory = new TrajectoryAgent({ now: fixedNow }).run(dossier);

  const cognition = synthesizeCognition(
    {
      candidateId: dossier.candidateId,
      bayesian,
      contradiction,
      trajectory,
    },
    fixedClock,
  );

  const orgResult = runOrganizationIntelligence(
    {
      candidateId: dossier.candidateId,
      bayesian,
      contradiction,
      trajectory,
    },
    cognition,
    organization,
    fixedClock,
  );

  // ---- build trace artefacts --------------------------------------------
  const orgFitView = buildOrgFitView(orgResult);

  // Calibration is produced LIVE by the evaluation engine on the
  // case's deterministic prediction+outcome seeds. The case file
  // never authors buckets directly.
  const { predictions, outcomes } = expandCalibrationSeeds(
    config.calibrationSeeds,
  );
  const calibrationResult = computeCalibration(predictions, outcomes);
  const reliability = analyzeReliability(calibrationResult.global, []);
  const calibrationView = buildCalibrationView(
    calibrationResult.global,
    reliability.bucketClassifications,
    reliability.overconfidenceRisk,
    config.selfCritique,
  );

  // Escalations are produced LIVE by the EscalationEngine on the real
  // cognition + org-fit + calibration signals. Nothing is invented.
  const highSeverityContradictionCount =
    contradiction.result.contradictions.filter(
      (c) => c.severity === "high",
    ).length;
  const escalations = buildEscalationsFromEngine(
    {
      caseId: `replay:${config.caseId}`,
      candidateId: dossier.candidateId,
      organizationId: organization.id,
      generatedAt,
      disagreementScore: cognition.disagreement.disagreementScore,
      globalConfidence: cognition.confidence.globalConfidence,
      highSeverityContradictionCount,
      evidenceRequestCount: contradiction.result.contradictions.length,
      fitRecommendation: orgResult.fit.fitRecommendation,
      overconfidenceRisk: reliability.overconfidenceRisk,
      hiringRiskOverall: orgResult.report.hiringRisk.result.overallHiringRisk,
    },
    reliability,
  );

  const propagations: ReplayPropagation[] = cognition.influences.map((p) => ({
    ...p,
    pivotal:
      Math.abs(p.adjustment) >=
      0.6 *
        Math.max(
          ...cognition.influences.map((x) => Math.abs(x.adjustment)),
          0.0001,
        ),
  }));
  const disagreements: ReplayDisagreement[] =
    cognition.disagreement.disagreements.map((d) => ({
      ...d,
      kind: "agent",
    }));

  const recommendationView = buildRecommendationView(
    cognition.reconciliation.recommendationCategory,
    orgResult.fit.fitRecommendation,
    cognition.uncertainty.certaintyCategory,
    cognition.confidence.globalConfidence,
    cognition.reconciliation.recommendation,
    cognition.reconciliation.strongestEvidence,
    orgResult.report.hiringRisk.result.strongestRiskDrivers.map((d) => ({
      id: `${d.category}`,
      summary: d.summary,
      severity: d.severity,
    })),
    [
      ...cognition.disagreement.unresolvedQuestions,
      ...orgResult.report.interviewFocusAreas,
    ].slice(0, 8),
    cognition.disagreement.disagreements.length,
  );

  // ---- assemble timeline ------------------------------------------------
  const ingest = ingestionSteps(dossier, 0);
  const agentsBlock = agentSteps(dossier, ingest.nextOrd, {
    bayesianFit: bayesian.result.fitScore,
    bayesianConf: bayesian.confidence,
    contradictionScore: contradiction.result.contradictionScore,
    contradictionConf: contradiction.confidence,
    contradictionCount: contradiction.result.contradictions.length,
    trajectoryScore: trajectory.result.trajectoryScore,
    trajectoryConf: trajectory.confidence,
  });
  const cogBlock = cognitionSteps(
    dossier.candidateId,
    agentsBlock.nextOrd,
    {
      globalConfidence: cognition.confidence.globalConfidence,
      propagationCount: cognition.influences.length,
      disagreementScore: cognition.disagreement.disagreementScore,
      disagreementCount: cognition.disagreement.disagreements.length,
      uncertaintyCategory: cognition.uncertainty.certaintyCategory,
      recommendationCategory: cognition.reconciliation.recommendationCategory,
      archetype: cognition.memory.matchedArchetypes[0]?.archetypeName ?? null,
    },
    agentsBlock.outputs,
  );
  const orgBlock = orgFitSteps(
    dossier.candidateId,
    cogBlock.nextOrd,
    orgFitView,
  );
  const escBlock = escalationSteps(orgBlock.nextOrd, escalations);
  const calStep = calibrationStep(
    escBlock.nextOrd,
    calibrationView.expectedCalibrationError,
  );
  const recStep = recommendationStep(calStep.ord + 1, recommendationView);

  const steps: ReplayStep[] = [
    ...ingest.steps,
    ...agentsBlock.steps,
    ...cogBlock.steps,
    ...orgBlock.steps,
    ...escBlock.steps,
    calStep,
    recStep,
  ];

  const provenance = buildProvenanceGraph(
    dossier,
    agentsBlock.outputs,
    propagations,
    generatedAt,
  );

  const trace: Omit<ReplayTrace, "signature"> = {
    caseId: config.caseId,
    summary: {
      caseId: config.caseId,
      label: config.label,
      oneLiner: config.oneLiner,
      candidateName: dossier.name,
      targetRole: dossier.targetRole,
      organizationName: organization.name,
      expectedRecommendation: config.expectedRecommendation,
    },
    generatedAt,
    candidate: {
      id: dossier.candidateId,
      name: dossier.name,
      targetRole: dossier.targetRole,
      claimCount: dossier.claims.length,
      evidenceCount: dossier.evidence.length,
      roleCount: dossier.roles.length,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      description: organization.description,
    },
    steps,
    cognition,
    disagreements,
    propagations,
    provenance,
    orgFit: orgFitView,
    organizationReport: orgResult.report,
    escalations,
    calibration: calibrationView,
    recommendation: recommendationView,
  };

  return { ...trace, signature: signTrace(trace) };
}
