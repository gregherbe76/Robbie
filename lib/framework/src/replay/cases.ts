/**
 * Public demo replay cases.
 *
 * Each demo case is a thin projection over an existing benchmark scenario.
 * We deliberately do NOT introduce new candidate data — the demo and the
 * cognitive benchmark share the same dossiers, so what the visitor sees
 * is exactly what `pnpm benchmark:cognition` exercises.
 *
 * One case (`org-mismatch`) pairs an existing dossier with a different
 * organization context to demonstrate role-environment mismatch. This is
 * a configuration override only; the dossier is unchanged.
 *
 * Each case also ships deterministic **calibration seed data**
 * (predictions + outcomes). The seeds are the only per-case authored
 * data; the resulting calibration view is produced *live* by the
 * framework's evaluation engine (`computeCalibration` +
 * `analyzeReliability`). This means the demo can credibly claim that
 * the calibration snapshot comes from the real engine, not from
 * hand-built buckets.
 */

import type { OrganizationContext } from "../organization_intelligence/index.js";
import type { CandidateDossier } from "../agents/flagship/index.js";
import type { BenchmarkScenario } from "../benchmarks/index.js";
import {
  BENCHMARK_SCENARIOS,
  CHAOS_ORG,
  STRUCTURED_ORG,
} from "../benchmarks/index.js";
import type { OutcomeEvent, PredictionRecord } from "../evaluation/index.js";
import type { ReplayCaseId, ReplayCaseSummary } from "./types.js";

interface CaseConfig {
  caseId: ReplayCaseId;
  label: string;
  oneLiner: string;
  /** Which benchmark scenario this case projects from. */
  scenarioId: BenchmarkScenario["scenarioId"];
  /**
   * Optional organization override. When omitted, the scenario's own
   * organization is used as-is.
   */
  organizationOverride?: OrganizationContext;
  expectedRecommendation: string;
  /**
   * Deterministic seed data fed into the evaluation engine to produce
   * the calibration view live. Each entry describes a confidence band
   * and the realised positive rate the engine should observe.
   */
  calibrationSeeds: CalibrationSeedShape;
  /** Case-authored self-critique. Falls back to engine narrative. */
  selfCritique: string;
}

/**
 * Compact, deterministic description of the calibration distribution
 * each case should exhibit. The runner expands this into concrete
 * `PredictionRecord`s and `OutcomeEvent`s that the evaluation engine
 * digests; that engine is what produces the displayed calibration view.
 */
export interface CalibrationSeedShape {
  /** Predictions evenly spaced across these confidence bands. */
  buckets: Array<{
    /** Mean self-reported confidence in [0,1]. */
    midpoint: number;
    /** Number of synthetic predictions in this band. */
    count: number;
    /** Realised positive rate in [0,1] for outcomes in this band. */
    actualPositiveRate: number;
  }>;
  /** Stable id seed for prediction/outcome records. */
  seedKey: string;
}

const SEED_BASE_CLOCK_MS = Date.parse("2026-01-01T00:00:00.000Z");

/**
 * Expand a compact seed shape into concrete prediction + outcome
 * records that the evaluation engine can consume. The number of
 * positives in each band is rounded deterministically, so the same
 * shape always yields the same records.
 */
export function expandCalibrationSeeds(seeds: CalibrationSeedShape): {
  predictions: PredictionRecord[];
  outcomes: OutcomeEvent[];
} {
  const predictions: PredictionRecord[] = [];
  const outcomes: OutcomeEvent[] = [];
  let idx = 0;
  for (const b of seeds.buckets) {
    const positives = Math.round(b.actualPositiveRate * b.count);
    for (let i = 0; i < b.count; i++) {
      const id = `${seeds.seedKey}-${idx}`;
      const realisedPositive = i < positives;
      const ts = new Date(SEED_BASE_CLOCK_MS + idx * 60_000).toISOString();
      predictions.push({
        id: `pred-${id}`,
        predictionKind: "candidate-fit",
        organizationId: "calibration-corpus",
        candidateId: id,
        score: b.midpoint,
        confidence: b.midpoint,
        producedBy: "bayesian-scorer",
        predictedAt: ts,
        rationale: `seed prediction in band ${b.midpoint.toFixed(2)}`,
      });
      outcomes.push({
        id: `out-${id}`,
        timestamp: ts,
        organizationId: "calibration-corpus",
        candidateId: id,
        // `successful_hire` is positive-polarity for candidate-fit predictions;
        // `failed_hire` is negative. The evaluation engine aligns the two.
        outcomeType: realisedPositive ? "successful_hire" : "poor_performance",
        evidence: [],
        confidence: 1,
        provenance: {
          observedBy: "calibration-corpus",
          observedAt: ts,
          rationale: "deterministic calibration seed outcome",
          evidence: [],
        },
      });
      idx++;
    }
  }
  return { predictions, outcomes };
}

// ---------------------------------------------------------------------------
// Per-case calibration seeds
//
// Each case includes at least one band where claimed confidence
// exceeds realised positive rate by ≥ 0.15 — the evaluation engine
// flags that band as "overconfident" automatically.
// ---------------------------------------------------------------------------

// Engine bins (DEFAULT_BUCKETS in evaluation.ts):
//   [0.2,0.4) [0.4,0.6) [0.6,0.75) [0.75,0.85) [0.85,1.01)
// Expected positive rate = bucket midpoint. The engine classifies a
// bucket as "overconfident" when (observed - expected) <= -0.15.

const seedsFounder: CalibrationSeedShape = {
  seedKey: "founder",
  buckets: [
    { midpoint: 0.30, count: 40, actualPositiveRate: 0.28 },
    { midpoint: 0.50, count: 40, actualPositiveRate: 0.47 },
    { midpoint: 0.68, count: 36, actualPositiveRate: 0.48 }, // overconfident
    { midpoint: 0.80, count: 24, actualPositiveRate: 0.77 },
  ],
};

const seedsInflated: CalibrationSeedShape = {
  seedKey: "inflated",
  buckets: [
    { midpoint: 0.30, count: 52, actualPositiveRate: 0.31 },
    { midpoint: 0.50, count: 44, actualPositiveRate: 0.30 }, // overconfident
    { midpoint: 0.68, count: 32, actualPositiveRate: 0.62 },
    { midpoint: 0.80, count: 20, actualPositiveRate: 0.78 },
  ],
};

const seedsAmbiguous: CalibrationSeedShape = {
  seedKey: "ambiguous",
  buckets: [
    { midpoint: 0.30, count: 32, actualPositiveRate: 0.33 },
    { midpoint: 0.50, count: 48, actualPositiveRate: 0.27 }, // overconfident
    { midpoint: 0.68, count: 20, actualPositiveRate: 0.55 },
    { midpoint: 0.80, count: 12, actualPositiveRate: 0.75 },
  ],
};

const seedsChaos: CalibrationSeedShape = {
  seedKey: "chaos",
  buckets: [
    { midpoint: 0.30, count: 28, actualPositiveRate: 0.29 },
    { midpoint: 0.50, count: 36, actualPositiveRate: 0.48 },
    { midpoint: 0.68, count: 32, actualPositiveRate: 0.46 }, // overconfident
    { midpoint: 0.80, count: 16, actualPositiveRate: 0.80 },
  ],
};

const seedsMismatch: CalibrationSeedShape = {
  seedKey: "mismatch",
  buckets: [
    { midpoint: 0.30, count: 24, actualPositiveRate: 0.32 },
    { midpoint: 0.50, count: 32, actualPositiveRate: 0.22 }, // overconfident
    { midpoint: 0.68, count: 20, actualPositiveRate: 0.40 }, // overconfident
    { midpoint: 0.80, count: 12, actualPositiveRate: 0.75 },
  ],
};

// ---------------------------------------------------------------------------
// Case index
// ---------------------------------------------------------------------------

export const REPLAY_CASES: CaseConfig[] = [
  {
    caseId: "founder-builder",
    label: "Founder builder",
    oneLiner:
      "0→1 builder with steep ownership trajectory and real OSS, paired with a chaos org.",
    scenarioId: "founder_builder",
    expectedRecommendation: "advance / strong_fit",
    calibrationSeeds: seedsFounder,
    selfCritique:
      "Founder-builder upside is real, but the system flags its own over-trust in the upper-mid band — visible outcomes underperform claimed fit. Treat upper-mid confidence with caution.",
  },
  {
    caseId: "inflated-senior",
    label: "Inflated senior",
    oneLiner:
      "Senior-leadership claims that cross-source evidence refutes. Tests contradiction pressure.",
    scenarioId: "inflated_senior",
    expectedRecommendation: "investigate / not strong_fit",
    calibrationSeeds: seedsInflated,
    selfCritique:
      "The system over-trusts mid-band claims when cross-source evidence refutes them. The contradiction layer should pull harder here.",
  },
  {
    caseId: "ambiguous-generalist",
    label: "Ambiguous generalist",
    oneLiner:
      "Wide vocabulary, neutral evidence, no depth. Tests the system's ability to preserve uncertainty.",
    scenarioId: "ambiguous_generalist",
    expectedRecommendation: "ambiguous / investigate",
    calibrationSeeds: seedsAmbiguous,
    selfCritique:
      "Ambiguous profiles trip the system. Mid-band confidence systematically overstates fit; the demo case sits squarely in that failure regime.",
  },
  {
    caseId: "chaos-thriver",
    label: "Chaos thriver",
    oneLiner:
      "High autonomy, supports across domains, paired with a chaos org. Tests org-fit reasoning.",
    scenarioId: "chaos_thriver",
    expectedRecommendation: "advance / conditional_fit",
    calibrationSeeds: seedsChaos,
    selfCritique:
      "Chaos thrivers genuinely outperform in chaos orgs, but the system over-projects upper-mid confidence. Outcomes only confirm fit in the top band.",
  },
  {
    caseId: "org-mismatch",
    label: "Org mismatch",
    oneLiner:
      "A process-dependent operator placed into a chaos org. Capability is real; environment is wrong.",
    scenarioId: "process_dependent_operator",
    organizationOverride: CHAOS_ORG,
    expectedRecommendation: "poor_context_fit / investigate",
    calibrationSeeds: seedsMismatch,
    selfCritique:
      "Role-environment mismatch is the framework's largest open calibration failure. Capability looks strong; environment is wrong; outcomes collapse.",
  },
];

export function findCase(caseId: string): CaseConfig | null {
  return (
    REPLAY_CASES.find((c) => c.caseId === (caseId as ReplayCaseId)) ?? null
  );
}

export function listCaseSummaries(): ReplayCaseSummary[] {
  return REPLAY_CASES.map((c) => {
    const scenario = lookupScenario(c.scenarioId);
    const dossier: CandidateDossier = scenario.dossier;
    const org = c.organizationOverride ?? scenario.organization;
    return {
      caseId: c.caseId,
      label: c.label,
      oneLiner: c.oneLiner,
      candidateName: dossier.name,
      targetRole: dossier.targetRole,
      organizationName: org.name,
      expectedRecommendation: c.expectedRecommendation,
    };
  });
}

export function lookupScenario(
  scenarioId: BenchmarkScenario["scenarioId"],
): BenchmarkScenario {
  const found = BENCHMARK_SCENARIOS.find((s) => s.scenarioId === scenarioId);
  if (!found) {
    throw new Error(`replay: unknown scenario ${scenarioId}`);
  }
  return found;
}

export { CHAOS_ORG, STRUCTURED_ORG };
