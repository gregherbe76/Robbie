/**
 * SourceReliabilityEngine.
 *
 * Reliability is *not* a fixed property of a source kind. It is an
 * explainable score built from factors. Each factor must contribute a
 * positive or negative delta with a human-readable rationale.
 *
 * Floors:
 *   - GitHub (direct commits, public repo evidence) starts high (0.85)
 *   - Resume self-description starts medium (0.55)
 *   - LinkedIn export starts medium (0.55)
 *   - Interview transcript starts medium-high (0.70) when diarized
 *   - Notes / unsupported claims start low (0.35)
 */

import type {
  EvidenceItem,
  IngestionSourceKind,
  ReliabilityFactor,
  SourceReliabilityAssessment,
} from "./types.js";

const BASELINE: Record<IngestionSourceKind, number> = {
  github: 0.85,
  resume: 0.55,
  linkedin: 0.55,
  interview_transcript: 0.7,
  portfolio: 0.6,
  organization_context: 0.65,
  references: 0.6,
  notes: 0.35,
  external_evidence: 0.5,
};

export class SourceReliabilityEngine {
  assess(input: {
    sourceKind: IngestionSourceKind;
    rawId: string;
    evidence: EvidenceItem[];
    diarized?: boolean;
    contradictionCount?: number;
    unsupportedClaimCount?: number;
    structuredPayload?: boolean;
  }): SourceReliabilityAssessment {
    const factors: ReliabilityFactor[] = [];
    let score = BASELINE[input.sourceKind];

    factors.push({
      factor: `baseline:${input.sourceKind}`,
      delta: 0,
      rationale: `baseline reliability for ${input.sourceKind} sources`,
    });

    if (input.sourceKind === "interview_transcript" && input.diarized === false) {
      factors.push({
        factor: "non_diarized_transcript",
        delta: -0.1,
        rationale: "transcript lacks speaker attribution, lowers reliability",
      });
      score -= 0.1;
    }

    if (input.structuredPayload === true) {
      factors.push({
        factor: "structured_payload",
        delta: 0.05,
        rationale: "structured input reduces parsing ambiguity",
      });
      score += 0.05;
    }

    const cc = input.contradictionCount ?? 0;
    if (cc > 0) {
      const delta = -Math.min(0.25, cc * 0.05);
      factors.push({
        factor: "contradiction_density",
        delta,
        rationale: `${cc} contradiction signal(s) degraded reliability`,
      });
      score += delta;
    }

    const uc = input.unsupportedClaimCount ?? 0;
    if (uc > 0) {
      const delta = -Math.min(0.2, uc * 0.04);
      factors.push({
        factor: "unsupported_claims",
        delta,
        rationale: `${uc} unsupported claim(s) reduce trust`,
      });
      score += delta;
    }

    if (input.evidence.length === 0) {
      factors.push({
        factor: "empty_extraction",
        delta: -0.1,
        rationale: "no evidence extracted; source uninformative",
      });
      score -= 0.1;
    }

    score = Math.max(0.05, Math.min(0.99, score));

    const uncertainty: string[] = [];
    if (input.sourceKind === "linkedin")
      uncertainty.push("self-reported timelines may inflate seniority");
    if (input.sourceKind === "resume")
      uncertainty.push("resume is self-curated; scope claims unverified");
    if (cc > 0) uncertainty.push("contradictions present in extracted evidence");

    return {
      sourceKind: input.sourceKind,
      rawId: input.rawId,
      reliabilityScore: score,
      reliabilityFactors: factors,
      uncertainty,
      conflictsDetected: cc,
      rationale: `score=${score.toFixed(2)} from ${factors.length} factor(s)`,
    };
  }
}
