# Provenance

Provenance is not metadata in this framework. It is **the artifact**. Every signal, memory entry, report, decision, audit entry, and visibility change carries the chain of producers that brought it into being.

## The Signal primitive

```ts
interface Signal<T> {
  value: T;
  confidence: number;          // ∈ [0, 1]
  provenance: Provenance;
}

interface Provenance {
  producedBy: ProducerRef;     // AgentId | ReviewerId | IngestionAdapterId | SystemRef
  producedAt: string;          // ISO-8601
  rationale: string;           // short, human-readable
  derivedFrom: ProvenanceRef[];// recursive lineage
}
```

A `Signal<T>` is the unit of observation that crosses every module boundary. There is no "raw value" path — even ingested evidence is wrapped in a signal whose provenance points to the ingestion adapter.

## Lineage is recursive

`derivedFrom` lets the framework reconstruct the full lineage of any artifact:

```
report
 └─ derivedFrom: [synthesisOutput]
      └─ derivedFrom: [signalA, signalB, signalC]
           ├─ signalA.derivedFrom: [ingestedEvidence1]
           ├─ signalB.derivedFrom: [ingestedEvidence2, reviewerNote5]
           └─ signalC.derivedFrom: [ingestedEvidence3]
```

You can walk the chain in the console (decision inspector, memory page, reports page) or programmatically via `framework.shared.lineage(...)`.

## Where provenance appears

| Artifact | Provenance carrier |
|---|---|
| Ingested evidence | adapter id, ingest time, source URI / payload hash |
| Normalized signal | adapter id + normalizer rule, derived from raw ingest |
| Memory entry | source agent id + skill id, derived from the signals that produced the entry |
| Cognition synthesis | the agents and signals that contributed |
| Fit assessment | the candidate and organization subgraph that supported it |
| Reviewer note | reviewer id, session id, signed action id |
| Override | reviewer id, capability used, previous state, justification |
| Visibility change | reviewer id, reason, previous level |
| Access decision | rule-by-rule trace + reviewer id + session id |
| Audit entry | reviewer id (or `null` for system actions), sequence number, frozen on append |

## Why provenance is data

Three reasons:

1. **Accountability.** Years later you can ask "why did we hire X" and reconstruct the answer from evidence with named producers, not from a model's softmax.
2. **Replayability.** Provenance is the substrate of determinism. If a contributor changes a downstream module, the upstream lineage tells reviewers exactly what changed.
3. **Calibration.** The evaluation layer needs to attribute outcomes to specific producers (which reviewer's signals predicted well? which agent overconfidence held?). Without provenance, this attribution is guesswork.

## Provenance integrity

The framework enforces provenance through a combination of:

- **Types.** Public functions that produce artifacts require a `producer` argument.
- **Runtime checks.** Engines reject inputs missing required provenance fields.
- **Audit.** Provenance gaps are themselves audit events; they cannot be hidden.
- **Benchmarks.** The cognition suite's `provenance` guard fails when an artifact lacks a complete chain.

## Anti-patterns

These are explicitly forbidden in the framework:

- **Anonymous producers.** No `"system"` placeholder for an artifact that was actually produced by an agent or reviewer.
- **Backfilled provenance.** Writing an artifact without provenance and adding it later. The artifact does not exist until it has provenance.
- **Provenance erasure.** Replacing a producer reference during reconciliation. The reconciliation is its own producer; the original signal's producer stays.
- **Cross-org producer impersonation.** A reviewer from one organization producing artifacts in another. The security layer denies this at the boundary.

## Reading the lineage in the console

- **Memory page** → click an entry → see the signals it was derived from.
- **Reports page** → click a report → see the synthesis output that produced it, then the signals beneath that.
- **Security → Decision inspector** → see the full rule trace and the reviewer + session that authored the request.
- **Operations → Investigation detail** → see the hypotheses, the supporting evidence, and the adversarial probes attached to each.
