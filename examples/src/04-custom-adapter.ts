/**
 * Example 4 — Custom evidence adapter.
 *
 * Shows how to plug a new ingestion source into the framework. We define
 * a "portfolio" adapter that reads a structured payload describing
 * shipped projects and emits ownership / complexity signals with full
 * provenance.
 *
 * Adapters are pure functions of (envelope, context). The framework
 * holds the registry — your adapter just declares its sourceKind and
 * implements `ingest()`.
 *
 * Run from repo root:
 *
 *   pnpm --filter @workspace/examples run custom-adapter
 */

import {
  IngestionGateway,
  ProvenanceCaptureEngine,
  SourceReliabilityEngine,
  ingestionHash,
  makeIngestionId,
  type AdapterContext,
  type AdapterOutput,
  type EvidenceAdapter,
  type EvidenceItem,
  type RawInputEnvelope,
} from "@robbie/framework/ingestion";

interface PortfolioPayload {
  ownerHandle: string;
  fetchedAt: string;
  projects: Array<{
    id: string;
    title: string;
    role: "sole_owner" | "co_owner" | "contributor";
    complexity: number; // 0..1
    shippedAt: string;
    public: boolean;
  }>;
}

class PortfolioEvidenceAdapter implements EvidenceAdapter {
  readonly sourceKind = "portfolio" as const;
  private prov = new ProvenanceCaptureEngine();
  private reliability = new SourceReliabilityEngine();

  ingest(envelope: RawInputEnvelope, ctx: AdapterContext): AdapterOutput {
    const payload = envelope.payload as PortfolioPayload;
    const evidence: EvidenceItem[] = [];

    const provFor = (locator: string, rationale: string) =>
      this.prov.build({
        producedBy: "ingestion.portfolio",
        producedAt: ctx.now,
        sourceKind: "portfolio",
        extractionMethod: "portfolio_v1",
        rawId: envelope.rawId,
        rationale,
        derivedFrom: [`portfolio:${envelope.rawId}:${locator}`],
      });

    for (const project of payload.projects) {
      const isSoleOwner = project.role === "sole_owner";
      evidence.push({
        id: makeIngestionId("ev", envelope.rawId, "project", project.id),
        kind: isSoleOwner ? "ownership_signal" : "demonstrated_behavior",
        subjectId: ctx.subjectId,
        claim: `${project.role.replace("_", " ")} of ${project.title}`,
        attributes: {
          fieldType: "portfolio_project",
          projectId: project.id,
          role: project.role,
          complexity: project.complexity,
          shippedAt: project.shippedAt,
          public: project.public,
        },
        // Sole ownership is a strong signal; co-owned/contributor is weaker.
        confidence: isSoleOwner ? 0.7 : 0.55,
        // Public projects can be cross-checked; private cannot.
        reliability: project.public ? 0.75 : 0.5,
        ambiguity: project.public ? [] : ["unverifiable_private_project"],
        provenance: provFor(project.id, "extracted portfolio project entry"),
        rawReference: {
          locator: `$.projects[?(@.id=="${project.id}")]`,
          excerpt: project.title,
        },
      });
    }

    return {
      evidence,
      reliability: this.reliability.assess({
        sourceKind: "portfolio",
        rawId: envelope.rawId,
        evidence,
        structuredPayload: true,
      }),
      warnings: [],
    };
  }
}

void ingestionHash; // exported for advanced callers; not used here

// ---------------------------------------------------------------------------
// Wire the adapter into a gateway and ingest a candidate's portfolio.
// ---------------------------------------------------------------------------

const NOW = "2026-05-15T00:00:00.000Z";

const gateway = new IngestionGateway();
gateway.registerAdapter(new PortfolioEvidenceAdapter());

console.log(`Supported source kinds: ${gateway.supportedSourceKinds().join(", ")}`);

const envelope: RawInputEnvelope = {
  rawId: "raw-portfolio-001",
  sourceKind: "portfolio",
  mediaType: "application/json",
  sourceUri: "https://portfolio.example/avery",
  submittedBy: "intake-bot",
  submittedAt: NOW,
  payload: {
    ownerHandle: "avery-chen",
    fetchedAt: NOW,
    projects: [
      {
        id: "raft-tutorial",
        title: "Raft from scratch in Rust",
        role: "sole_owner",
        complexity: 0.78,
        shippedAt: "2024-03-01",
        public: true,
      },
      {
        id: "internal-tooling-rebuild",
        title: "Internal tooling rebuild (PaymentsCo)",
        role: "co_owner",
        complexity: 0.62,
        shippedAt: "2023-09-01",
        public: false,
      },
    ],
  } satisfies PortfolioPayload,
};

const result = gateway.ingestCandidate({
  candidateId: "cand-avery",
  candidateDisplayName: "Avery Chen",
  envelopes: [envelope],
  submittedBy: "intake-bot",
  now: NOW,
});

console.log(`\n=== Evidence from custom adapter (${result.extractedEvidence.length}) ===`);
for (const ev of result.extractedEvidence) {
  console.log(`- [${ev.kind}] ${ev.claim}`);
  console.log(`    confidence=${ev.confidence.toFixed(2)} reliability=${ev.reliability.toFixed(2)}`);
  if (ev.ambiguity.length > 0) console.log(`    ambiguity: ${ev.ambiguity.join(", ")}`);
  console.log(`    derivedFrom: ${(ev.provenance.derivedFrom ?? []).join(", ")}`);
}
