# Tutorial — Ingest → Cognition → Report in 50 lines

A complete walkthrough of the Robbie framework, end-to-end, in one file. Copy this into a `.ts` file in your own project, install `@robbie/framework` and `zod`, and run it with `tsx` or compile with `tsc`.

What it does, in order:

1. **Ingest** a resume envelope through the `IngestionGateway`. The framework extracts normalized evidence with full provenance.
2. **Reason** over a candidate dossier with the three flagship agents (Bayesian fit, contradiction detection, trajectory analysis).
3. **Synthesize** their outputs through the cognition layer (disagreement preservation, uncertainty fusion, reconciliation).
4. **Evaluate** the candidate against an organization context (chaos fit, hiring risk, team chemistry).
5. **Persist** the result as a `Report` with full evidence lineage.

```ts
import { IngestionGateway } from "@robbie/framework/ingestion";
import {
  BayesianScoringAgent, ContradictionAgent, TrajectoryAgent, SAMPLE_DOSSIERS,
} from "@robbie/framework/agents/flagship";
import { synthesizeCognition } from "@robbie/framework/cognition";
import { SAMPLE_ORG, runOrganizationIntelligence } from "@robbie/framework/organization-intelligence";
import { InMemoryReportStore } from "@robbie/framework/reports";

const NOW = "2026-05-15T00:00:00.000Z";
const now = () => new Date(NOW);

// 1. Ingest a resume envelope. Real adapters: github, linkedin, resume,
//    interview_transcript, portfolio. Each emits provenance-stamped evidence.
const gateway = new IngestionGateway();
const ingested = gateway.ingestCandidate({
  candidateId: "cand-001",
  candidateDisplayName: "Avery Park",
  envelopes: [{
    rawId: "raw-r-1", sourceKind: "resume", mediaType: "text/plain",
    submittedBy: "intake-bot", submittedAt: NOW,
    payload: { text: "Avery Park — Staff Engineer\nExperience\nStaff Engineer, PaymentsCo (2024 - Present)\nSkills\nRust, Distributed Systems" },
  }],
  submittedBy: "intake-bot", now: NOW,
});
console.log(`Ingested ${ingested.extractedEvidence.length} evidence items, ${ingested.conflicts.length} conflicts`);

// 2. The framework decouples evidence ingestion from cognition. Cognition runs
//    over a CandidateDossier (curated facts, claims, evidence, roles). Build
//    one yourself from ingested.normalizedCandidate, or use a sample dossier
//    here for brevity.
const dossier = SAMPLE_DOSSIERS[0]!;
const bayesian = new BayesianScoringAgent({ now }).run(dossier);
const contradiction = new ContradictionAgent({ now }).run(dossier);
const trajectory = new TrajectoryAgent({ now }).run(dossier);

// 3. Cross-agent cognition. Disagreement is preserved; uncertainty is fused.
const cognition = synthesizeCognition(
  { candidateId: dossier.candidateId, bayesian, contradiction, trajectory },
  { now },
);

// 4. Organization fit.
const { fit, report } = runOrganizationIntelligence(
  { candidateId: dossier.candidateId, bayesian, contradiction, trajectory },
  cognition, SAMPLE_ORG, { now },
);

// 5. Persist as a report. In production, swap InMemoryReportStore for a
//    Postgres-backed adapter implementing the same `ReportStore` interface.
const reports = new InMemoryReportStore();
await reports.put({
  id: `rep:${dossier.candidateId}`, kind: "candidate", createdAt: NOW,
  title: `${dossier.name} — synthesis`,
  summary: `${cognition.uncertainty.certaintyCategory} → ${cognition.reconciliation.recommendationCategory}`,
  confidence: cognition.confidence.globalConfidence,
  sections: [{ heading: "Recommendation", body: cognition.reconciliation.recommendation }],
  evidence: cognition.influences.map((i) => ({
    id: i.id, kind: "cognition.influence", value: i,
    confidence: cognition.confidence.globalConfidence,
    provenance: { producedBy: "cognition-engine", producedAt: NOW },
  })),
});

console.log(`recommendation: ${fit.fitRecommendation} (confidence ${fit.fitConfidence.toFixed(2)})`);
console.log(`hiring risk:    ${report.hiringRisk.result.overallHiringRisk.toFixed(2)}`);
```

## What you get

- **Provenance** on every evidence item. `ev.provenance.producedBy`, `producedAt`, `rationale`, `derivedFrom` are always populated. Reports inherit the full chain.
- **Deterministic outputs.** Same `now`, same dossier, same org → byte-identical synthesis. Useful for testing, replay, audit.
- **Disagreement preservation.** `cognition.disagreement.disagreementScore` and `unresolvedQuestions` surface contradictions instead of averaging them out.
- **Explicit unknowns.** Fields without evidence are not silently inferred — they appear in `normalizedCandidate.unknowns` and `report.contextConfidence.unknownFields`.

## Building a dossier from real ingestion output

The sample dossier shortcut works for the tutorial, but production callers build a dossier from ingested evidence themselves. The `CandidateDossier` shape (in `@robbie/framework/agents/flagship`) requires:

- `claims[]` — explicit candidate-stated claims with `selfStatedStrength`
- `evidence[]` — supporting / contradicting evidence pointing at claims
- `roles[]` — role trajectory with duration, complexity, scope, ownership
- `github` / `interview` — optional structured signals
- `organizationContext` — priors derived from the target org

`ingested.normalizedCandidate`, `ingested.extractedEvidence`, and the source-reliability output give you everything you need to construct it. The reason this isn't a one-call shortcut is that turning raw evidence into a dossier is a judgement step — you decide which evidence supports which claim, and the framework doesn't infer that for you.

## Next steps

- See [`examples/`](../examples/) for four runnable scripts: hello ingest, full cognition, security + audit, and a custom adapter.
- See [`docs/PHILOSOPHY.md`](./PHILOSOPHY.md) for why every decision in the framework looks the way it does.
- See [`docs/provenance/`](./provenance/) for the full provenance model.
- For persistence, see [`lib/integrations/memory-postgres/`](../lib/integrations/memory-postgres/) — a Postgres `MemoryStore` adapter you can drop in.
