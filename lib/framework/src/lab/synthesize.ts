/**
 * Synthesise a `ReplayConfigInput` from a `LabRunInput`.
 *
 * Two modes:
 *  - "scenario": start from a canonical hero case, optionally swap the
 *    organization and append synthetic resume/transcript text as
 *    additional claims/evidence.
 *  - "synthetic": consume the user-provided dossier + organization
 *    directly and use neutral calibration seeds so the calibration view
 *    is still produced live by the evaluation engine.
 */

import { createHash } from "node:crypto";
import type { CandidateDossier } from "../agents/flagship/index.js";
import type { OrganizationContext } from "../organization_intelligence/index.js";
import {
  REPLAY_CASES,
  lookupScenario,
  type CalibrationSeedShape,
} from "../replay/cases.js";
import type { ReplayConfigInput } from "../replay/runner.js";
import type {
  LabRunInput,
  LabScenarioInput,
  LabSyntheticInput,
} from "./types.js";

/**
 * Neutral calibration seed shape used for purely-synthetic lab runs.
 * Includes one over-confident band so the calibration view always
 * shows the framework's standard failure mode.
 */
const NEUTRAL_SEEDS: CalibrationSeedShape = {
  seedKey: "lab-synthetic",
  buckets: [
    { midpoint: 0.3, count: 30, actualPositiveRate: 0.31 },
    { midpoint: 0.5, count: 40, actualPositiveRate: 0.32 }, // overconfident
    { midpoint: 0.68, count: 24, actualPositiveRate: 0.6 },
    { midpoint: 0.8, count: 16, actualPositiveRate: 0.78 },
  ],
};

const SHORT_HASH = (s: string): string =>
  createHash("sha256").update(s).digest("hex").slice(0, 8);

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
}

/**
 * Derive deterministic synthetic claims + evidence from plain-text
 * resume/transcript snippets. Each sentence becomes one ingestion-level
 * artefact with a hash-derived id so the trace stays byte-stable.
 */
function appendSyntheticEvidence(
  base: CandidateDossier,
  resumeText: string | undefined,
  transcriptText: string | undefined,
): CandidateDossier {
  const claims = [...base.claims];
  const evidence = [...base.evidence];

  if (resumeText && resumeText.trim()) {
    const sentences = splitSentences(resumeText);
    sentences.forEach((s, i) => {
      const id = `lab-claim-${SHORT_HASH(`r:${i}:${s}`)}`;
      claims.push({
        id,
        text: s,
        domain: "self-reported",
        source: "cv",
        selfStatedStrength: 0.55,
      });
    });
  }
  if (transcriptText && transcriptText.trim()) {
    const sentences = splitSentences(transcriptText);
    sentences.forEach((s, i) => {
      const id = `lab-ev-${SHORT_HASH(`t:${i}:${s}`)}`;
      evidence.push({
        id,
        domain: "self-reported",
        source: "interview",
        kind: "supports",
        weight: 0.55,
        summary: s,
      });
    });
  }

  return { ...base, claims, evidence };
}

function buildFromScenario(input: LabScenarioInput): ReplayConfigInput {
  const base = REPLAY_CASES.find((c) => c.caseId === input.scenarioId);
  if (!base) {
    throw new Error(`lab: unknown scenario ${input.scenarioId}`);
  }
  const scenario = lookupScenario(base.scenarioId);
  const dossier = appendSyntheticEvidence(
    scenario.dossier,
    input.resumeText,
    input.transcriptText,
  );
  const organization =
    input.organizationOverride ??
    base.organizationOverride ??
    scenario.organization;

  // Lab runs synthesised on top of a hero case keep that case's
  // calibration seeds — same shape, same engine output.
  return {
    caseId: `lab:${base.caseId}:${SHORT_HASH(JSON.stringify(input))}`,
    label: `Lab · ${base.label}`,
    oneLiner: base.oneLiner,
    expectedRecommendation: base.expectedRecommendation,
    selfCritique: base.selfCritique,
    dossier,
    organization,
    calibrationSeeds: base.calibrationSeeds,
  };
}

function buildFromSynthetic(input: LabSyntheticInput): ReplayConfigInput {
  const dossier = appendSyntheticEvidence(
    input.dossier,
    input.resumeText,
    input.transcriptText,
  );
  return {
    caseId: `lab:synthetic:${SHORT_HASH(JSON.stringify(input))}`,
    label: input.label?.trim() || `Lab · ${dossier.name}`,
    oneLiner:
      "User-provided synthetic dossier replayed through the framework's deterministic pipeline.",
    expectedRecommendation: "user-provided / no expectation",
    selfCritique:
      "Lab runs use neutral calibration seeds. The over-confident mid-band remains visible so the framework's standard calibration failure is still surfaced.",
    dossier,
    organization: input.organization,
    calibrationSeeds: NEUTRAL_SEEDS,
  };
}

export function buildLabConfig(input: LabRunInput): ReplayConfigInput {
  return input.mode === "scenario"
    ? buildFromScenario(input)
    : buildFromSynthetic(input);
}

/**
 * Stable, content-derived run id. Identical inputs always produce the
 * same runId so users can re-derive a shareable link without re-posting.
 */
export function computeLabRunId(input: LabRunInput): string {
  const json = stableStringify(input);
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
