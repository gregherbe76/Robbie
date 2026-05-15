/**
 * Benchmark corpus — 10 deterministic synthetic dossiers, each designed
 * to probe a specific cognitive behaviour of the framework. The corpus
 * does NOT overfit absolute scores: expectations are ranges or
 * behavioural assertions ("recommendation must not be strong_fit",
 * "evidence requests must be non-empty", etc.).
 */

import type {
  CandidateDossier,
  Claim,
  EvidenceItem,
  RoleEvent,
} from "../agents/flagship/types.js";
import type {
  OrganizationContext,
  ContextField,
  OrgEvidence,
} from "../organization_intelligence/types.js";
import { SAMPLE_ORG } from "../organization_intelligence/context.js";
import type {
  BenchmarkArchetype,
  BenchmarkScenario,
  Expectation,
} from "./types.js";

// ---------------------------------------------------------------------------
// Organisation variants — chaos vs structured. The same candidate behaves
// differently against each, which is what the corpus is here to verify.
// ---------------------------------------------------------------------------

export const CHAOS_ORG: OrganizationContext = SAMPLE_ORG;

function ck<T extends string>(
  value: T,
  confidence: number,
  derivedFrom: string[],
): ContextField<T> {
  return { value, confidence, derivedFrom };
}

const structuredFounderEvidence: OrgEvidence[] = [
  {
    id: "sorg-ev-001",
    source: "engineering-blog",
    summary:
      "Handbook documents RFC-driven process; every design has a written proposal and 2 reviewers.",
    weight: 0.9,
  },
  {
    id: "sorg-ev-002",
    source: "interviewer-note",
    summary:
      "Hiring panel emphasises clarity of written communication and ability to operate inside structured process.",
    weight: 0.8,
  },
];

const structuredTeamEvidence: OrgEvidence[] = [
  {
    id: "sorg-ev-101",
    source: "team-roster",
    summary:
      "Team of 80 engineers across 6 sub-teams with dedicated EMs, staff+ ladder, and on-call SREs.",
    weight: 0.9,
  },
  {
    id: "sorg-ev-102",
    source: "internal-doc",
    summary:
      "Internal doc: 'Strong feedback culture; weekly 1:1s, structured perf cycle twice per year.'",
    weight: 0.8,
  },
];

export const STRUCTURED_ORG: OrganizationContext = {
  id: "org-002",
  name: "Continuum Platforms",
  description:
    "Series-D structured platform org. Written-process culture, layered management, mature engineering practices.",
  generatedAt: "2026-05-15T00:00:00.000Z",
  founderEvidence: structuredFounderEvidence,
  teamEvidence: structuredTeamEvidence,
  fields: {
    companyStage: ck("growth", 0.9, ["sorg-ev-101"]),
    teamSize: ck("xlarge", 0.9, ["sorg-ev-101"]),
    technicalMaturity: ck("mature", 0.9, ["sorg-ev-001", "sorg-ev-101"]),
    processMaturity: ck("rigorous", 0.95, ["sorg-ev-001"]),
    ambiguityLevel: ck("low", 0.85, ["sorg-ev-001"]),
    executionSpeed: ck("steady", 0.85, ["sorg-ev-001"]),
    founderInvolvement: ck("hands-off", 0.8, ["sorg-ev-101"]),
    decisionStyle: ck("consensus", 0.8, ["sorg-ev-001"]),
    communicationStyle: ck("high-context", 0.8, ["sorg-ev-001"]),
    autonomyExpectation: ck("medium", 0.8, ["sorg-ev-001"]),
    feedbackCulture: ck("structured", 0.9, ["sorg-ev-102"]),
    riskTolerance: ck("low", 0.85, ["sorg-ev-001"]),
    managementDensity: ck("layered", 0.9, ["sorg-ev-101"]),
    productMaturity: ck("mature", 0.85, ["sorg-ev-101"]),
    hiringBar: ck("high", 0.85, ["sorg-ev-002"]),
    roleCriticality: ck("important", 0.8, ["sorg-ev-002"]),
  },
};

// ---------------------------------------------------------------------------
// Dossier builder — small set of "dials" expands into a full CandidateDossier.
// Keeps the corpus readable while letting each scenario probe a distinct
// cognitive failure mode.
// ---------------------------------------------------------------------------

interface DossierSeed {
  candidateId: string;
  name: string;
  targetRole: string;
  domains: [string, string, string];
  /** Self-claimed strength on each domain (0..1). */
  claimStrengths: [number, number, number];
  /** Evidence weight on each domain (0..1). */
  evidenceWeights: [number, number, number];
  /** Whether evidence supports/refutes/is-neutral on each domain. */
  evidenceKinds: [
    "supports" | "refutes" | "neutral",
    "supports" | "refutes" | "neutral",
    "supports" | "refutes" | "neutral",
  ];
  /** Extra unsupported claims (claims with no matching evidence). */
  extraUnsupportedClaims: number;
  /** Inject high-strength cross-source contradictions. */
  contradictionInjection: number;
  /** Role trajectory shape. */
  trajectory: "flat" | "declining" | "positive" | "steep" | "short-steep";
  reasoningQuality: number;
  vocabularyWithoutDepth: number;
  /** Whether github contributions are real and increasing. */
  githubReal: boolean;
  /** Override organization-context priors on the dossier (not the org). */
  orgContextOnDossier: {
    priorBaseline: number;
    complexityFloor: number;
  };
}

function buildClaims(seed: DossierSeed): Claim[] {
  const base: Claim[] = seed.domains.map((domain, idx) => ({
    id: `${seed.candidateId}-claim-${idx + 1}`,
    domain,
    source: idx === 1 ? "interview" : "cv",
    text: `${seed.name} claims competence in ${domain}.`,
    selfStatedStrength: seed.claimStrengths[idx],
  }));
  for (let i = 0; i < seed.extraUnsupportedClaims; i++) {
    base.push({
      id: `${seed.candidateId}-uclaim-${i + 1}`,
      domain: seed.domains[0],
      source: "cv",
      text: `${seed.name} self-reports additional ${seed.domains[0]} expertise (no backing evidence).`,
      selfStatedStrength: 0.85,
    });
  }
  return base;
}

function buildEvidence(seed: DossierSeed): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  seed.domains.forEach((domain, idx) => {
    const kind = seed.evidenceKinds[idx];
    out.push({
      id: `${seed.candidateId}-ev-${idx + 1}a`,
      domain,
      source: idx === 0 ? "github" : idx === 1 ? "interview" : "reference",
      kind,
      weight: seed.evidenceWeights[idx],
      summary: `${kind === "supports" ? "Supporting" : kind === "refutes" ? "Refuting" : "Neutral"} signal in ${domain} from ${idx === 0 ? "github" : idx === 1 ? "interview" : "reference"}.`,
      claimId: `${seed.candidateId}-claim-${idx + 1}`,
    });
    out.push({
      id: `${seed.candidateId}-ev-${idx + 1}b`,
      domain,
      source: idx === 0 ? "interview" : "cv",
      kind: kind === "neutral" ? "neutral" : kind,
      weight: Math.max(0.2, seed.evidenceWeights[idx] - 0.15),
      summary: `Secondary ${kind} observation on ${domain}.`,
      claimId: `${seed.candidateId}-claim-${idx + 1}`,
    });
  });
  if (seed.contradictionInjection > 0) {
    out.push({
      id: `${seed.candidateId}-ev-contra-1`,
      domain: seed.domains[0],
      source: "reference",
      kind: "refutes",
      weight: seed.contradictionInjection,
      summary: `Reference contradicts CV claim on ${seed.domains[0]}.`,
    });
    out.push({
      id: `${seed.candidateId}-ev-contra-2`,
      domain: seed.domains[0],
      source: "interview",
      kind: "refutes",
      weight: Math.max(0.4, seed.contradictionInjection - 0.1),
      summary: `Interview demonstrates surface-level grasp of ${seed.domains[0]}.`,
    });
  }
  return out;
}

function buildRoles(seed: DossierSeed): RoleEvent[] {
  const id = (n: number) => `${seed.candidateId}-role-${n}`;
  switch (seed.trajectory) {
    case "flat":
      return [
        role(id(1), "Engineer", "2018-01-01", "2021-01-01", 36, 0.45, 0.4, 0.35, 8),
        role(id(2), "Senior Engineer", "2021-01-01", "2024-01-01", 36, 0.5, 0.45, 0.4, 9),
        role(id(3), "Senior Engineer", "2024-01-01", null, 16, 0.52, 0.46, 0.4, 9),
      ];
    case "declining":
      return [
        role(id(1), "Engineer", "2017-06-01", "2020-06-01", 36, 0.6, 0.55, 0.55, 7),
        role(id(2), "Tech Lead", "2020-06-01", "2022-06-01", 24, 0.55, 0.5, 0.5, 8),
        role(id(3), "Engineer", "2022-06-01", null, 34, 0.4, 0.35, 0.3, 6),
      ];
    case "positive":
      return [
        role(id(1), "Engineer", "2018-03-01", "2020-09-01", 30, 0.35, 0.3, 0.3, 5),
        role(id(2), "Senior Engineer", "2020-09-01", "2023-03-01", 30, 0.55, 0.5, 0.5, 6),
        role(id(3), "Staff Engineer", "2023-03-01", null, 26, 0.78, 0.72, 0.7, 8),
      ];
    case "steep":
      return [
        role(id(1), "Engineer", "2019-01-01", "2020-06-01", 18, 0.4, 0.4, 0.5, 4),
        role(id(2), "Founding Engineer", "2020-06-01", "2023-06-01", 36, 0.7, 0.75, 0.85, 3),
        role(id(3), "Founder/CTO", "2023-06-01", null, 23, 0.85, 0.9, 0.95, 2),
      ];
    case "short-steep":
      return [
        role(id(1), "Engineer", "2023-06-01", "2024-09-01", 15, 0.45, 0.4, 0.45, 5),
        role(id(2), "Engineer II", "2024-09-01", null, 8, 0.62, 0.55, 0.55, 5),
      ];
  }
}

function role(
  id: string,
  title: string,
  startedAt: string,
  endedAt: string | null,
  durationMonths: number,
  complexity: number,
  scope: number,
  ownership: number,
  teamSize: number,
): RoleEvent {
  return {
    id,
    title,
    startedAt,
    endedAt,
    durationMonths,
    complexity,
    scope,
    ownership,
    teamSize,
  };
}

function buildDossier(seed: DossierSeed): CandidateDossier {
  return {
    candidateId: seed.candidateId,
    name: seed.name,
    targetRole: seed.targetRole,
    organizationContext: {
      priorBaseline: seed.orgContextOnDossier.priorBaseline,
      complexityFloor: seed.orgContextOnDossier.complexityFloor,
      criticalDomains: [seed.domains[0], seed.domains[1], seed.domains[2]],
    },
    claims: buildClaims(seed),
    evidence: buildEvidence(seed),
    roles: buildRoles(seed),
    github: {
      yearlyContributions: seed.githubReal
        ? [
            { year: 2021, commits: 320, repos: 6 },
            { year: 2022, commits: 540, repos: 8 },
            { year: 2023, commits: 770, repos: 11 },
            { year: 2024, commits: 980, repos: 13 },
          ]
        : [
            { year: 2021, commits: 28, repos: 2 },
            { year: 2022, commits: 16, repos: 2 },
            { year: 2023, commits: 9, repos: 1 },
            { year: 2024, commits: 4, repos: 1 },
          ],
      signatureProjects: seed.githubReal
        ? [
            {
              name: `${seed.candidateId}-sig-1`,
              year: 2023,
              complexity: 0.72,
              ownership: 0.78,
              domain: seed.domains[0],
            },
          ]
        : [],
    },
    interview: {
      depthByDomain: {
        [seed.domains[0]]: Math.max(0.2, seed.reasoningQuality - 0.05),
        [seed.domains[1]]: Math.max(0.2, seed.reasoningQuality - 0.1),
        [seed.domains[2]]: Math.max(0.2, seed.reasoningQuality - 0.15),
      },
      reasoningQuality: seed.reasoningQuality,
      vocabularyWithoutDepth: seed.vocabularyWithoutDepth,
    },
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

function s(
  scenarioId: BenchmarkArchetype,
  description: string,
  dossier: CandidateDossier,
  organization: OrganizationContext,
  expectations: Expectation[],
): BenchmarkScenario {
  return {
    scenarioId,
    description,
    archetype: scenarioId,
    dossier,
    organization,
    expectations,
  };
}

const CHAOS_PRIORS = { priorBaseline: 0.2, complexityFloor: 0.55 };
const STRUCTURED_PRIORS = { priorBaseline: 0.28, complexityFloor: 0.5 };

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  s(
    "inflated_senior",
    "Claims senior leadership and distributed-systems depth, but cross-source evidence refutes both. Must drive contradiction up and recommendation away from strong_fit.",
    buildDossier({
      candidateId: "bench-inflated",
      name: "Inflated Senior",
      targetRole: "Staff Platform Engineer",
      domains: ["distributed-systems", "leadership", "reliability"],
      claimStrengths: [0.95, 0.92, 0.9],
      evidenceWeights: [0.7, 0.65, 0.55],
      evidenceKinds: ["refutes", "refutes", "neutral"],
      extraUnsupportedClaims: 2,
      contradictionInjection: 0.75,
      trajectory: "flat",
      reasoningQuality: 0.4,
      vocabularyWithoutDepth: 6,
      githubReal: false,
      orgContextOnDossier: STRUCTURED_PRIORS,
    }),
    STRUCTURED_ORG,
    [
      {
        type: "greater_than",
        path: "digest.contradictionScore",
        value: 0.55,
        rationale: "Cross-source refutation + unsupported claims must lift contradictionScore.",
      },
      {
        type: "non_empty",
        path: "contradiction.result.contradictions",
        rationale: "Concrete contradictions must be surfaced, not absorbed silently.",
      },
      {
        type: "not_equals",
        path: "digest.fitRecommendation",
        value: "strong_fit",
        rationale: "Inflated senior must never be recommended as strong_fit.",
      },
      {
        type: "confidence_decreased",
        rationale: "Cognition must reduce Bayesian confidence after contradiction propagation.",
      },
      {
        type: "recommendation_in",
        path: "digest.recommendationCategory",
        values: ["investigate", "decline", "ambiguous"],
        rationale: "Reconciliation must not advance an inflated senior.",
      },
    ],
  ),
  s(
    "founder_builder",
    "0→1 builder with strong OSS and steep ownership trajectory in a chaos org. Must score chaos-fit positively and not be declined.",
    buildDossier({
      candidateId: "bench-founder",
      name: "Founder Builder",
      targetRole: "Founding Engineer",
      domains: ["product-engineering", "ownership", "distributed-systems"],
      claimStrengths: [0.85, 0.9, 0.7],
      evidenceWeights: [0.85, 0.9, 0.6],
      evidenceKinds: ["supports", "supports", "supports"],
      extraUnsupportedClaims: 0,
      contradictionInjection: 0,
      trajectory: "steep",
      reasoningQuality: 0.8,
      vocabularyWithoutDepth: 0,
      githubReal: true,
      orgContextOnDossier: { priorBaseline: 0.18, complexityFloor: 0.6 },
    }),
    CHAOS_ORG,
    [
      {
        type: "greater_than",
        path: "digest.trajectoryScore",
        value: 0.3,
        rationale:
          "Steep ownership trajectory must score above the plateaued-staff baseline (~0.27).",
      },
      {
        type: "greater_than",
        path: "digest.chaosFitScore",
        value: 0.55,
        rationale: "Chaos fit must be positive in a chaos org for a founder-builder.",
      },
      {
        type: "not_equals",
        path: "digest.fitRecommendation",
        value: "poor_context_fit",
        rationale: "Must not be declined in a chaos org.",
      },
      {
        type: "greater_than",
        path: "digest.bayesianFit",
        value: 0.6,
        rationale: "Strong supporting evidence must lift Bayesian fit above 0.6.",
      },
    ],
  ),
  s(
    "plateaued_staff",
    "Long-tenured engineer with flat complexity/ownership trajectory. Must not be advanced as strong_fit at staff level.",
    buildDossier({
      candidateId: "bench-plateau",
      name: "Plateaued Staff",
      targetRole: "Staff Engineer",
      domains: ["backend-systems", "reliability", "mentorship"],
      claimStrengths: [0.75, 0.7, 0.7],
      evidenceWeights: [0.6, 0.55, 0.5],
      evidenceKinds: ["supports", "neutral", "neutral"],
      extraUnsupportedClaims: 0,
      contradictionInjection: 0,
      trajectory: "flat",
      reasoningQuality: 0.6,
      vocabularyWithoutDepth: 2,
      githubReal: true,
      orgContextOnDossier: STRUCTURED_PRIORS,
    }),
    STRUCTURED_ORG,
    [
      {
        type: "less_than",
        path: "digest.trajectoryScore",
        value: 0.55,
        rationale: "Flat trajectory must score below 0.55.",
      },
      {
        type: "not_equals",
        path: "digest.fitRecommendation",
        value: "strong_fit",
        rationale: "Plateaued staff must not be strong_fit.",
      },
    ],
  ),
  s(
    "elite_ic",
    "Top-tier IC: strong cross-source evidence on every domain, positive trajectory, deep interview. Must be eligible for advance.",
    buildDossier({
      candidateId: "bench-elite",
      name: "Elite IC",
      targetRole: "Staff Engineer",
      domains: ["distributed-systems", "reliability", "compilers"],
      claimStrengths: [0.9, 0.85, 0.85],
      evidenceWeights: [0.9, 0.85, 0.85],
      evidenceKinds: ["supports", "supports", "supports"],
      extraUnsupportedClaims: 0,
      contradictionInjection: 0,
      trajectory: "positive",
      reasoningQuality: 0.88,
      vocabularyWithoutDepth: 0,
      githubReal: true,
      orgContextOnDossier: STRUCTURED_PRIORS,
    }),
    STRUCTURED_ORG,
    [
      {
        type: "less_than",
        path: "digest.contradictionScore",
        value: 0.5,
        rationale: "No cross-source contradictions present.",
      },
      {
        type: "greater_than",
        path: "digest.bayesianFit",
        value: 0.55,
        rationale: "Strong evidence should lift Bayesian fit above 0.55.",
      },
      {
        type: "recommendation_in",
        path: "digest.recommendationCategory",
        values: ["advance", "investigate", "ambiguous"],
        rationale:
          "Reconciliation must not decline an elite IC with consistent evidence (zero-contradiction cases reconcile as ambiguous in the current cognition layer; decline is the regression to catch).",
      },
      {
        type: "provenance_complete",
        rationale: "Every output must carry full provenance.",
      },
    ],
  ),
  s(
    "high_variance_candidate",
    "Strong supporting evidence on some domains, strong refuting evidence on others — must produce high disagreement and ambiguous certainty.",
    buildDossier({
      candidateId: "bench-variance",
      name: "High Variance",
      targetRole: "Senior Engineer",
      domains: ["distributed-systems", "ml-infrastructure", "leadership"],
      claimStrengths: [0.9, 0.85, 0.85],
      evidenceWeights: [0.85, 0.8, 0.8],
      evidenceKinds: ["supports", "refutes", "refutes"],
      extraUnsupportedClaims: 1,
      contradictionInjection: 0.55,
      trajectory: "positive",
      reasoningQuality: 0.6,
      vocabularyWithoutDepth: 3,
      githubReal: true,
      orgContextOnDossier: STRUCTURED_PRIORS,
    }),
    STRUCTURED_ORG,
    [
      {
        type: "greater_than",
        path: "digest.disagreementScore",
        value: 0.25,
        rationale:
          "Conflicting cross-source signals must register as cross-agent disagreement.",
      },
      {
        type: "greater_than",
        path: "digest.contradictionScore",
        value: 0.5,
        rationale:
          "Refuting evidence across multiple domains must register as contradiction.",
      },
      {
        type: "not_equals",
        path: "digest.fitRecommendation",
        value: "strong_fit",
        rationale: "High-variance candidate must not be classified as strong_fit.",
      },
    ],
  ),
  s(
    "ambiguous_generalist",
    "Moderate claims, moderate evidence, generalist trajectory in a chaos org with unknown feedback culture. Must preserve uncertainty.",
    buildDossier({
      candidateId: "bench-ambig",
      name: "Ambiguous Generalist",
      targetRole: "Senior Engineer",
      domains: ["product-engineering", "backend-systems", "reliability"],
      claimStrengths: [0.6, 0.6, 0.55],
      evidenceWeights: [0.5, 0.45, 0.4],
      evidenceKinds: ["neutral", "neutral", "neutral"],
      extraUnsupportedClaims: 0,
      contradictionInjection: 0,
      trajectory: "positive",
      reasoningQuality: 0.55,
      vocabularyWithoutDepth: 1,
      githubReal: true,
      orgContextOnDossier: CHAOS_PRIORS,
    }),
    CHAOS_ORG,
    [
      {
        type: "recommendation_in",
        path: "digest.recommendationCategory",
        values: ["investigate", "ambiguous"],
        rationale: "Ambiguous data must not collapse into advance or decline.",
      },
      {
        type: "non_empty",
        path: "cognition.disagreement.unresolvedQuestions",
        rationale: "Generalist evidence must leave open questions.",
      },
      {
        type: "uncertainty_increased",
        rationale: "Cognition must preserve uncertainty rather than fabricate certainty.",
      },
    ],
  ),
  s(
    "fake_oss_signal",
    "Claims OSS credibility but github contributions are vanishing and no signature projects. Must produce contradictions and evidence-gap signals.",
    buildDossier({
      candidateId: "bench-fakeoss",
      name: "Fake OSS Signal",
      targetRole: "Staff Platform Engineer",
      domains: ["open-source", "distributed-systems", "reliability"],
      claimStrengths: [0.95, 0.85, 0.8],
      evidenceWeights: [0.4, 0.4, 0.4],
      evidenceKinds: ["refutes", "neutral", "neutral"],
      extraUnsupportedClaims: 2,
      contradictionInjection: 0.6,
      trajectory: "flat",
      reasoningQuality: 0.55,
      vocabularyWithoutDepth: 4,
      githubReal: false,
      orgContextOnDossier: STRUCTURED_PRIORS,
    }),
    STRUCTURED_ORG,
    [
      {
        type: "non_empty",
        path: "contradiction.result.unsupportedClaims",
        rationale: "OSS claim without github support must be flagged as unsupported.",
      },
      {
        type: "greater_than",
        path: "digest.contradictionScore",
        value: 0.45,
        rationale: "Vanishing github with strong OSS claim must elevate contradiction.",
      },
      {
        type: "greater_than",
        path: "digest.evidenceRequestSignal",
        value: 0,
        rationale: "A fake-OSS pattern must produce at least one open evidence request signal.",
      },
    ],
  ),
  s(
    "chaos_thriver",
    "High autonomy, ownership, low process tolerance — must score chaos fit positively against the chaos org.",
    buildDossier({
      candidateId: "bench-chaos",
      name: "Chaos Thriver",
      targetRole: "Founding Engineer",
      domains: ["ownership", "product-engineering", "ambiguity-tolerance"],
      claimStrengths: [0.9, 0.85, 0.85],
      evidenceWeights: [0.9, 0.8, 0.8],
      evidenceKinds: ["supports", "supports", "supports"],
      extraUnsupportedClaims: 0,
      contradictionInjection: 0,
      trajectory: "steep",
      reasoningQuality: 0.82,
      vocabularyWithoutDepth: 0,
      githubReal: true,
      orgContextOnDossier: { priorBaseline: 0.2, complexityFloor: 0.55 },
    }),
    CHAOS_ORG,
    [
      {
        type: "greater_than",
        path: "digest.chaosFitScore",
        value: 0.6,
        rationale: "Strong autonomy/ownership in a chaos org must produce high chaos fit.",
      },
      {
        type: "not_equals",
        path: "digest.fitRecommendation",
        value: "poor_context_fit",
      },
    ],
  ),
  s(
    "process_dependent_operator",
    "Strong but process-dependent operator placed against the chaos org. Org-fit risk must be elevated, not silenced.",
    buildDossier({
      candidateId: "bench-process",
      name: "Process Operator",
      targetRole: "Senior Engineer",
      domains: ["process-design", "ambiguity-tolerance", "backend-systems"],
      claimStrengths: [0.85, 0.85, 0.8],
      evidenceWeights: [0.8, 0.75, 0.7],
      evidenceKinds: ["supports", "refutes", "neutral"],
      extraUnsupportedClaims: 1,
      contradictionInjection: 0.55,
      trajectory: "flat",
      reasoningQuality: 0.55,
      vocabularyWithoutDepth: 2,
      githubReal: true,
      orgContextOnDossier: CHAOS_PRIORS,
    }),
    CHAOS_ORG,
    [
      {
        type: "greater_than",
        path: "digest.contradictionScore",
        value: 0.4,
        rationale:
          "Refuting ambiguity-tolerance evidence must register as contradiction pressure.",
      },
      {
        type: "less_than",
        path: "digest.bayesianFit",
        value: 0.6,
        rationale:
          "Cross-source refutation on ambiguity-tolerance must keep Bayesian fit cautious.",
      },
      {
        type: "not_equals",
        path: "digest.fitRecommendation",
        value: "strong_fit",
        rationale:
          "Process-dependent operator vs chaos org must not collapse into strong_fit.",
      },
    ],
  ),
  s(
    "underestimated_junior",
    "Short tenure but steep growth in scope and ownership. Must preserve trajectory upside while keeping confidence cautious.",
    buildDossier({
      candidateId: "bench-junior",
      name: "Underestimated Junior",
      targetRole: "Mid-Level Engineer",
      domains: ["backend-systems", "product-engineering", "reliability"],
      claimStrengths: [0.7, 0.7, 0.6],
      evidenceWeights: [0.7, 0.65, 0.55],
      evidenceKinds: ["supports", "supports", "neutral"],
      extraUnsupportedClaims: 0,
      contradictionInjection: 0,
      trajectory: "short-steep",
      reasoningQuality: 0.7,
      vocabularyWithoutDepth: 0,
      githubReal: true,
      orgContextOnDossier: { priorBaseline: 0.25, complexityFloor: 0.45 },
    }),
    STRUCTURED_ORG,
    [
      {
        type: "greater_than",
        path: "digest.trajectoryScore",
        value: 0.3,
        rationale:
          "Steep ownership/scope growth must register above the plateaued-staff baseline (~0.27).",
      },
      {
        type: "less_than",
        path: "digest.bayesianConfidence",
        value: 0.85,
        rationale: "Short tenure must keep confidence cautious, not certain.",
      },
      {
        type: "recommendation_in",
        path: "digest.recommendationCategory",
        values: ["advance", "investigate", "ambiguous"],
        rationale: "Upside must be preserved (not flat-declined).",
      },
    ],
  ),
];
