/**
 * Seed `OrganizationContext` records. In production these would be
 * populated from interviewer notes, founder statements, engineering blogs,
 * etc. — every field carries the evidence ids it was derived from and a
 * confidence in [0,1]. Unknown is an explicit value, never inferred.
 */

import type { ContextField, OrganizationContext, OrgEvidence } from "./types.js";

function ck<T extends string>(
  value: T,
  confidence: number,
  derivedFrom: string[],
  note?: string,
): ContextField<T> {
  const f: ContextField<T> = { value, confidence, derivedFrom };
  if (note !== undefined) f.note = note;
  return f;
}

function unknown<T extends string>(note?: string): ContextField<T> {
  const f: ContextField<T> = { value: "unknown", confidence: 0, derivedFrom: [] };
  if (note !== undefined) f.note = note;
  return f;
}

const SAMPLE_ORG_GENERATED_AT = "2026-05-15T00:00:00.000Z";

const founderEvidence: OrgEvidence[] = [
  {
    id: "org-ev-001",
    source: "founder-statement",
    summary:
      "Founder: 'We ship every day. If you need a PRD before you start, this isn't your company.'",
    weight: 0.9,
  },
  {
    id: "org-ev-002",
    source: "engineering-blog",
    summary:
      "Engineering blog describes weekly architecture reviews led personally by the CTO co-founder.",
    weight: 0.75,
  },
  {
    id: "org-ev-003",
    source: "press",
    summary:
      "Press profile describes founder as 'demanding, technically deep, and impatient with process'.",
    weight: 0.7,
  },
  {
    id: "org-ev-004",
    source: "interviewer-note",
    summary:
      "Interviewer notes that founder personally reviews every senior engineering offer.",
    weight: 0.8,
  },
];

const teamEvidence: OrgEvidence[] = [
  {
    id: "org-ev-101",
    source: "team-roster",
    summary:
      "Team of 14 engineers; only 2 with > 8 yrs experience. Heavy mid-level concentration.",
    weight: 0.85,
  },
  {
    id: "org-ev-102",
    source: "team-roster",
    summary: "No engineering manager hired yet; founders manage all reports.",
    weight: 0.8,
  },
  {
    id: "org-ev-103",
    source: "internal-doc",
    summary:
      "Internal doc references on-call rotation handled by every engineer.",
    weight: 0.6,
  },
];

export const SAMPLE_ORG: OrganizationContext = {
  id: "org-001",
  name: "Vector Systems",
  description:
    "Series-A infrastructure startup. Founder-led, high-velocity, low-process. Hiring bar is exceptional but context is messy.",
  generatedAt: SAMPLE_ORG_GENERATED_AT,
  founderEvidence,
  teamEvidence,
  fields: {
    companyStage: ck("series-a", 0.9, ["org-ev-002"]),
    teamSize: ck("medium", 0.85, ["org-ev-101"]),
    technicalMaturity: ck("growing", 0.7, ["org-ev-002", "org-ev-103"]),
    processMaturity: ck("ad-hoc", 0.8, ["org-ev-001", "org-ev-103"]),
    ambiguityLevel: ck("high", 0.85, ["org-ev-001", "org-ev-003"]),
    executionSpeed: ck("breakneck", 0.9, ["org-ev-001"]),
    founderInvolvement: ck("omnipresent", 0.85, ["org-ev-002", "org-ev-004"]),
    decisionStyle: ck("leadership", 0.7, ["org-ev-003", "org-ev-004"]),
    communicationStyle: ck("low-context", 0.6, ["org-ev-001", "org-ev-003"]),
    autonomyExpectation: ck("high", 0.85, ["org-ev-001", "org-ev-103"]),
    feedbackCulture: unknown("No direct evidence of feedback rituals."),
    riskTolerance: ck("high", 0.7, ["org-ev-001", "org-ev-003"]),
    managementDensity: ck("flat", 0.85, ["org-ev-102"]),
    productMaturity: ck("early", 0.65, ["org-ev-002"]),
    hiringBar: ck("exceptional", 0.8, ["org-ev-004"]),
    roleCriticality: ck("critical", 0.75, ["org-ev-004"]),
  },
};

export function getOrganization(id: string): OrganizationContext | null {
  if (id === SAMPLE_ORG.id) return SAMPLE_ORG;
  return null;
}

export function listOrganizations(): OrganizationContext[] {
  return [SAMPLE_ORG];
}

export function summariseContextCompleteness(ctx: OrganizationContext): {
  averageFieldConfidence: number;
  knownFields: number;
  unknownFields: string[];
} {
  const entries = Object.entries(ctx.fields);
  let total = 0;
  let known = 0;
  const unknownFields: string[] = [];
  for (const [k, v] of entries) {
    total += v.confidence;
    if (v.value === "unknown") unknownFields.push(k);
    else known += 1;
  }
  return {
    averageFieldConfidence: Number((total / entries.length).toFixed(3)),
    knownFields: known,
    unknownFields,
  };
}
