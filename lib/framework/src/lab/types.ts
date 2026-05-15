/**
 * Public Cognition Lab types.
 *
 * The lab lets developers feed synthetic candidate evidence and
 * organization context through the same deterministic replay pipeline
 * that powers the hero demo. It is NOT an ATS, a resume uploader, or
 * an AI recruiter — it is a sandbox for deterministic hiring cognition
 * replay.
 */

import type { CandidateDossier } from "../agents/flagship/index.js";
import type { OrganizationContext } from "../organization_intelligence/index.js";
import type { ReplayCaseId } from "../replay/types.js";

/** Hero scenarios users can pick from in "scenario" mode. */
export type LabScenarioId = ReplayCaseId;

export interface LabScenarioInput {
  mode: "scenario";
  /** One of the canonical hero case ids. */
  scenarioId: LabScenarioId;
  /** Optional organization JSON to swap the scenario's org out for. */
  organizationOverride?: OrganizationContext;
  /** Plain-text synthetic resume appended to the base dossier. */
  resumeText?: string;
  /** Plain-text synthetic transcript appended to the base dossier. */
  transcriptText?: string;
}

export interface LabSyntheticInput {
  mode: "synthetic";
  /** Free-form label shown in the lab UI. */
  label?: string;
  /** Full candidate dossier JSON. */
  dossier: CandidateDossier;
  /** Full organization context JSON. */
  organization: OrganizationContext;
  resumeText?: string;
  transcriptText?: string;
}

export type LabRunInput = LabScenarioInput | LabSyntheticInput;

/** Compact summary written into the run store and returned by POST. */
export interface LabRunSummary {
  runId: string;
  signature: string;
  mode: "scenario" | "synthetic";
  /** Canonical scenario id when mode==='scenario'. */
  baseScenarioId?: string;
  caseLabel: string;
  candidateName: string;
  organizationName: string;
  generatedAt: string;
  expiresAt: string;
  recommendation: string;
  uncertaintyCategory: string;
  globalConfidence: number;
  disagreementSummary: {
    count: number;
    score: number;
  };
  escalationSummary: {
    count: number;
    triggers: string[];
  };
  provenanceSummary: {
    nodeCount: number;
    edgeCount: number;
  };
  calibrationSummary: {
    expectedCalibrationError: number;
    overconfidentBuckets: number;
  };
}

export interface LabSafetyError {
  ok: false;
  reason:
    | "input_too_large"
    | "input_contains_disallowed_terms"
    | "dossier_invalid"
    | "organization_invalid"
    | "unknown_scenario";
  detail: string;
}

export type LabSafetyResult = { ok: true } | LabSafetyError;
