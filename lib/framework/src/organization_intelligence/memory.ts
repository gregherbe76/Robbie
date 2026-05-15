/**
 * OrganizationMemoryIntegrator.
 *
 * Turns organisation-intelligence outputs into framework-shaped memory
 * entries (every entry carries producedBy, producedAt, rationale,
 * derivedFrom, confidence, scope=organization/candidate, and tags).
 *
 * The integrator returns the entries rather than persisting them itself
 * so bootstrap (which holds the registry handle) can write them.
 */

import type {
  CandidateOrganizationFitResult,
  OrganizationContext,
  OrganizationIntelligenceReport,
} from "./types.js";
import { summariseContextCompleteness } from "./context.js";

export interface MemoryEntryShape {
  id: string;
  scope: "candidate" | "organization";
  subjectId: string;
  key: string;
  value: unknown;
  summary: string;
  confidence: number;
  provenance: {
    producedBy: string;
    producedAt: string;
    rationale: string;
    derivedFrom: string[];
  };
  createdAt: string;
  tags: string[];
}

export function buildOrgContextMemory(
  org: OrganizationContext,
  createdAt: string,
): MemoryEntryShape {
  const completeness = summariseContextCompleteness(org);
  return {
    id: `mem:org:${org.id}:context`,
    scope: "organization",
    subjectId: org.id,
    key: "organization.context",
    value: {
      completeness: completeness.averageFieldConfidence,
      knownFields: completeness.knownFields,
      unknownFields: completeness.unknownFields,
    },
    summary: `Context completeness ${completeness.averageFieldConfidence.toFixed(2)} (${completeness.knownFields}/${Object.keys(org.fields).length} fields known).`,
    confidence: completeness.averageFieldConfidence,
    provenance: {
      producedBy: "organization-memory-integrator",
      producedAt: createdAt,
      rationale: `Snapshot of organization context with ${completeness.unknownFields.length} unknown field(s).`,
      derivedFrom: [
        ...org.founderEvidence.map((e) => e.id),
        ...org.teamEvidence.map((e) => e.id),
      ],
    },
    createdAt,
    tags: ["organization", "context", "longitudinal"],
  };
}

export function buildFitMemory(
  fit: CandidateOrganizationFitResult,
  report: OrganizationIntelligenceReport,
  createdAt: string,
): MemoryEntryShape {
  return {
    id: `mem:org:${fit.organizationId}:candidate:${fit.candidateId}:fit`,
    scope: "candidate",
    subjectId: fit.candidateId,
    key: `organization.fit.${fit.organizationId}`,
    value: {
      organizationId: fit.organizationId,
      recommendation: fit.fitRecommendation,
      fitConfidence: fit.fitConfidence,
      overallHiringRisk: report.hiringRisk.result.overallHiringRisk,
      chaosFit: report.chaosFit.result.chaosFitScore,
      roleEnvFit: report.roleEnvironment.result.candidateFitAgainstRoleEnvironment,
      teamChemistry: report.teamChemistry.result.chemistryScore,
    },
    summary: `${fit.fitRecommendation} @ ${fit.organizationId} (conf ${fit.fitConfidence.toFixed(2)}).`,
    confidence: fit.fitConfidence,
    provenance: {
      producedBy: "candidate-org-fit-engine",
      producedAt: createdAt,
      rationale: fit.finalRationale,
      derivedFrom: [
        ...report.founderFit.evidenceChain,
        ...report.teamChemistry.evidenceChain,
        ...report.chaosFit.evidenceChain,
        ...report.roleEnvironment.evidenceChain,
        ...report.hiringRisk.evidenceChain,
      ],
    },
    createdAt,
    tags: [
      "organization-fit",
      fit.fitRecommendation,
      `org:${fit.organizationId}`,
    ],
  };
}

export interface ArchetypeFrequencyInput {
  organizationId: string;
  recommendation: CandidateOrganizationFitResult["fitRecommendation"];
}

/**
 * Aggregate fit recommendations across a corpus into one
 * "successful/failed/borderline archetype" memory entry per organisation.
 * This is the longitudinal-learning surface — over time the framework can
 * detect hiring-bar drift and recurring failure modes.
 */
export function buildOrgArchetypeMemory(
  organizationId: string,
  fits: ArchetypeFrequencyInput[],
  createdAt: string,
): MemoryEntryShape {
  const counts: Record<string, number> = {};
  for (const f of fits) {
    counts[f.recommendation] = (counts[f.recommendation] ?? 0) + 1;
  }
  const total = fits.length;
  const summary =
    total === 0
      ? "No candidate × org fits scored yet."
      : Object.entries(counts)
          .map(([k, n]) => `${k}=${n}`)
          .join(", ");
  return {
    id: `mem:org:${organizationId}:archetype-frequency`,
    scope: "organization",
    subjectId: organizationId,
    key: "organization.archetype-frequency",
    value: { total, counts },
    summary: `Fit-recommendation distribution across ${total} candidate(s): ${summary}.`,
    confidence: Math.min(1, 0.4 + total / 5),
    provenance: {
      producedBy: "organization-memory-integrator",
      producedAt: createdAt,
      rationale:
        "Longitudinal aggregation of candidate × organization fit recommendations for hiring-bar-drift detection.",
      derivedFrom: [],
    },
    createdAt,
    tags: ["organization", "archetype", "longitudinal"],
  };
}
