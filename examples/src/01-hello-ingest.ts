/**
 * Example 1 — Hello, ingest.
 *
 * The smallest possible Robbie program. Ingests a single resume envelope
 * through the IngestionGateway and prints the normalized evidence with
 * its full provenance chain.
 *
 * Run from repo root:
 *
 *   pnpm --filter @workspace/examples run hello-ingest
 *
 * Outside this monorepo, `npm install @robbie/framework zod` and the
 * imports below resolve unchanged.
 */

import { IngestionGateway, type RawInputEnvelope } from "@robbie/framework/ingestion";

const NOW = "2026-05-15T00:00:00.000Z";

const resumeEnvelope: RawInputEnvelope = {
  rawId: "raw-resume-001",
  sourceKind: "resume",
  mediaType: "text/plain",
  submittedBy: "intake-bot",
  submittedAt: NOW,
  payload: {
    text: [
      "Avery Chen — Staff Platform Engineer",
      "",
      "Experience",
      "Staff Engineer, PaymentsCo (2024 - Present)",
      "Architected the entire consensus layer single-handedly.",
      "Senior Engineer, PaymentsCo (2022 - 2023)",
      "Owned the distributed transaction log end-to-end.",
      "",
      "Skills",
      "Rust, Distributed Systems, Raft, PostgreSQL",
    ].join("\n"),
  },
};

const gateway = new IngestionGateway();

const result = gateway.ingestCandidate({
  candidateId: "cand-avery",
  candidateDisplayName: "Avery Chen",
  envelopes: [resumeEnvelope],
  submittedBy: "intake-bot",
  now: NOW,
});

console.log("=== Normalized candidate ===");
console.log(JSON.stringify(result.normalizedCandidate, null, 2));

console.log(`\n=== ${result.extractedEvidence.length} evidence items ===`);
for (const ev of result.extractedEvidence.slice(0, 5)) {
  console.log(`- [${ev.kind}] ${ev.claim}`);
  console.log(`    confidence=${ev.confidence.toFixed(2)} reliability=${ev.reliability.toFixed(2)}`);
  console.log(`    producedBy=${ev.provenance.producedBy} at ${ev.provenance.producedAt}`);
  if (ev.ambiguity.length > 0) console.log(`    ambiguity: ${ev.ambiguity.join(", ")}`);
}

console.log(`\n=== Source reliability (${result.sourceReliability.length}) ===`);
for (const r of result.sourceReliability) {
  console.log(`- ${r.sourceKind}: ${r.reliabilityScore.toFixed(2)} (${r.reliabilityFactors.map((f) => f.factor).join(", ")})`);
}

console.log(`\n=== Conflicts (${result.conflicts.length}) ===`);
for (const c of result.conflicts) {
  console.log(`- [${c.severity}] ${c.description}`);
}

console.log(`\n=== Audit trail (${result.audit.length} entries) ===`);
for (const a of result.audit) {
  console.log(`- ${a.type} :: ${a.detail}`);
}
