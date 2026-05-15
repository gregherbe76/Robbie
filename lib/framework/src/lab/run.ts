/**
 * Top-level lab orchestrator.
 *
 * Validates input, builds a `ReplayConfigInput`, runs the real replay
 * pipeline, and projects the resulting trace into a compact
 * `LabRunSummary` for storage + listing.
 */

import { runReplayTraceFromConfig } from "../replay/runner.js";
import type { ReplayTrace } from "../replay/types.js";
import { buildLabConfig, computeLabRunId } from "./synthesize.js";
import { checkLabInputSafety } from "./safety.js";
import type { LabRunInput, LabRunSummary, LabSafetyError } from "./types.js";

export class LabSafetyValidationError extends Error {
  readonly code: LabSafetyError["reason"];
  readonly detail: string;
  constructor(reason: LabSafetyError["reason"], detail: string) {
    super(detail);
    this.code = reason;
    this.detail = detail;
    this.name = "LabSafetyValidationError";
  }
}

export interface LabRunResult {
  runId: string;
  trace: ReplayTrace;
  summary: LabRunSummary;
}

export function runLabTrace(
  input: LabRunInput,
  options?: { ttlMs?: number },
): LabRunResult {
  const safety = checkLabInputSafety(input);
  if (!safety.ok) {
    throw new LabSafetyValidationError(safety.reason, safety.detail);
  }
  const config = buildLabConfig(input);
  const trace = runReplayTraceFromConfig(config);
  const runId = computeLabRunId(input);
  const ttlMs = options?.ttlMs ?? 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const summary: LabRunSummary = {
    runId,
    signature: trace.signature,
    mode: input.mode,
    baseScenarioId:
      input.mode === "scenario" ? input.scenarioId : undefined,
    caseLabel: trace.summary.label,
    candidateName: trace.candidate.name,
    organizationName: trace.organization.name,
    generatedAt: trace.generatedAt,
    expiresAt,
    recommendation: trace.recommendation.fitRecommendation,
    uncertaintyCategory: trace.recommendation.uncertaintyCategory,
    globalConfidence: trace.recommendation.globalConfidence,
    disagreementSummary: {
      count: trace.disagreements.length,
      score: trace.cognition.disagreement.disagreementScore,
    },
    escalationSummary: {
      count: trace.escalations.length,
      triggers: Array.from(new Set(trace.escalations.map((e) => e.trigger))),
    },
    provenanceSummary: {
      nodeCount: trace.provenance.nodes.length,
      edgeCount: trace.provenance.edges.length,
    },
    calibrationSummary: {
      expectedCalibrationError: trace.calibration.expectedCalibrationError,
      overconfidentBuckets: trace.calibration.buckets.filter(
        (b) => b.overconfident,
      ).length,
    },
  };

  return { runId, trace, summary };
}
