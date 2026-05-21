/**
 * Example 2 — Ingest → cognition → organization fit → report.
 *
 * The full happy-path. Uses one of the bundled SAMPLE_DOSSIERS so the
 * example stays self-contained, then runs:
 *
 *   bayesian / contradiction / trajectory agents
 *     → synthesizeCognition (disagreement, uncertainty, reconciliation)
 *       → organization_intelligence (fit, hiring risk, chaos fit)
 *
 * Run from repo root:
 *
 *   pnpm --filter @workspace/examples run full-cognition
 */

import {
  BayesianScoringAgent,
  ContradictionAgent,
  TrajectoryAgent,
  SAMPLE_DOSSIERS,
} from "@robbie/framework/agents/flagship";
import { synthesizeCognition } from "@robbie/framework/cognition";
import {
  SAMPLE_ORG,
  runOrganizationIntelligence,
} from "@robbie/framework/organization-intelligence";
import { InMemoryReportStore } from "@robbie/framework/reports";

const NOW_ISO = "2026-05-15T00:00:00.000Z";
const now = () => new Date(NOW_ISO);

const dossier = SAMPLE_DOSSIERS[0]!;

// 1. Three flagship agents, each producing an AgentReasoning<T> with
//    confidence, evidence chain, and provenance.
const bayesian = new BayesianScoringAgent({ now }).run(dossier);
const contradiction = new ContradictionAgent({ now }).run(dossier);
const trajectory = new TrajectoryAgent({ now }).run(dossier);

// 2. Cross-agent cognition: influence propagation, disagreement, uncertainty
//    fusion, reconciliation, archetype matching. Pure function of inputs.
const cognition = synthesizeCognition(
  { candidateId: dossier.candidateId, bayesian, contradiction, trajectory },
  { now },
);

// 3. Organization intelligence: fit assessment + report.
const { fit, report } = runOrganizationIntelligence(
  { candidateId: dossier.candidateId, bayesian, contradiction, trajectory },
  cognition,
  SAMPLE_ORG,
  { now },
);

console.log(`=== Candidate ${dossier.candidateId} — ${dossier.name} ===`);
console.log(`Target role: ${dossier.targetRole}`);
console.log(`Organization: ${SAMPLE_ORG.name}`);

console.log(`\n--- Bayesian ---`);
console.log(`fit=${bayesian.result.fitScore.toFixed(2)} confidence=${bayesian.confidence.toFixed(2)}`);

console.log(`\n--- Contradiction ---`);
console.log(`score=${contradiction.result.contradictionScore.toFixed(2)}  contradictions=${contradiction.result.contradictions.length}  unsupported=${contradiction.result.unsupportedClaims.length}`);

console.log(`\n--- Trajectory ---`);
console.log(`score=${trajectory.result.trajectoryScore.toFixed(2)}  confidence=${trajectory.confidence.toFixed(2)}`);

console.log(`\n--- Cognition synthesis ---`);
console.log(`recommendation: ${cognition.reconciliation.recommendationCategory}`);
console.log(`certainty:      ${cognition.uncertainty.certaintyCategory}`);
console.log(`globalConfidence: ${cognition.confidence.globalConfidence.toFixed(2)}`);
console.log(`disagreement:   ${cognition.disagreement.disagreementScore.toFixed(2)} (${cognition.disagreement.ambiguityLevel})`);
console.log(`unresolved questions: ${cognition.disagreement.unresolvedQuestions.length}`);

console.log(`\n--- Organization fit ---`);
console.log(`recommendation: ${fit.fitRecommendation}  confidence=${fit.fitConfidence.toFixed(2)}`);
console.log(`hiring risk:    ${report.hiringRisk.result.overallHiringRisk.toFixed(2)}`);
console.log(`chaos fit:      ${report.chaosFit.result.chaosFitScore.toFixed(2)}`);

// 4. Persist the synthesis as a report. The store is in-memory here; in
//    production, plug in a Postgres-backed ReportStore (same interface).
const reports = new InMemoryReportStore();
await reports.put({
  id: `rep:${dossier.candidateId}:cognition`,
  kind: "candidate",
  createdAt: NOW_ISO,
  title: `${dossier.name} — synthesis`,
  summary: `${cognition.uncertainty.certaintyCategory} → ${cognition.reconciliation.recommendationCategory}`,
  confidence: cognition.confidence.globalConfidence,
  sections: [
    {
      heading: "Recommendation",
      body: cognition.reconciliation.recommendation,
    },
    {
      heading: "Unresolved questions",
      body: cognition.disagreement.unresolvedQuestions.map((q) => `- ${q}`).join("\n") || "_none_",
    },
  ],
  evidence: cognition.influences.map((i) => ({
    id: i.id,
    kind: "cognition.influence",
    value: i,
    confidence: cognition.confidence.globalConfidence,
    provenance: {
      producedBy: "cognition-engine",
      producedAt: NOW_ISO,
      rationale: "synthesizeCognition over (bayesian, contradiction, trajectory)",
    },
  })),
});

const stored = await reports.list();
console.log(`\n--- Persisted reports ---`);
for (const r of stored) {
  console.log(`- [${r.kind}] ${r.title} — ${r.summary}`);
}
