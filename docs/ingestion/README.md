# Ingestion

The `ingestion` module brings outside-world evidence into the framework as normalized, reliability-scored, provenance-preserving signals. Adapters are the plug-in surface; everything downstream consumes the same signal shape regardless of source.

## Layout

```
lib/framework/src/ingestion/
  gateway.ts              Public entry point. Routes raw evidence to the right adapter.
  adapters/               Source-specific adapters (reviewer notes, structured uploads, etc.).
  normalization.ts        Canonicalizes signals across adapters.
  reliability.ts          Source reliability profile + per-event reliability score.
  conflicts.ts            Detects contradictions between newly ingested and existing signals.
  candidate_pipeline.ts   Candidate-scoped pipeline orchestration.
  organization_pipeline.ts Organization-scoped pipeline orchestration.
  audit.ts                Ingestion-specific audit entries.
  provenance.ts           Provenance wiring at the ingestion boundary.
  hash.ts                 Stable hashing for payload identity + dedup.
  types.ts                Public types.
```

## Invariants

1. **No silent drops.** Ambiguous or contradictory inputs produce a `ConflictRecord`, not a discard.
2. **Provenance at the boundary.** Every ingested signal carries the adapter id, the source kind, and a payload hash before it touches any downstream module.
3. **Reliability is explicit.** Every adapter declares a reliability profile, and per-event reliability is computed (and recorded) at ingest, not inferred later.
4. **Deterministic identity.** Payload hashing means re-ingesting the same evidence produces the same signal id; duplicates are collapsed.
5. **Audited.** Every ingest is an audit event with the producer (adapter id) and the resulting signals' ids.

## Adapter contract

An adapter is a small module that:

- declares a `sourceKind` and a reliability profile,
- accepts a typed payload,
- produces normalized signals with provenance,
- writes ingestion audit entries through the supplied audit handle,
- never throws on ambiguous input — emits a `ConflictRecord` instead.

```ts
interface IngestionAdapter<Payload> {
  readonly sourceKind: string;
  readonly reliabilityProfile: ReliabilityProfile;

  ingest(input: {
    payload: Payload;
    organizationId: string;
    reviewerId: ReviewerId | null;   // null for system ingest
    now: string;
    audit: IngestionAuditHandle;
  }): IngestionResult;
}
```

`IngestionResult` includes the signals produced and any conflicts detected — never a partial success.

## Reliability profile

`ReliabilityProfile` captures what the system knows about how trustworthy a source typically is:

- baseline reliability,
- decay characteristics (does freshness matter?),
- corroboration rule (is a single observation enough, or does this kind of evidence require independent corroboration?),
- adversarial-probe affinity (is this kind of source historically easy to fake?).

These are static per adapter but per-event reliability can override them when the input itself carries a quality signal (e.g. a reviewer note with explicit uncertainty markers).

## Conflict detection

When new evidence contradicts existing memory or graph state, `conflicts.ts` produces a `ConflictRecord` rather than overwriting. The framework's collaboration layer can then attach the conflict to an investigation; the cognition layer surfaces it as a disagreement; the evaluation layer may use it for calibration.

Conflicts are not bugs — they are diagnostic.

## Pipelines

`candidate_pipeline.ts` and `organization_pipeline.ts` are thin orchestrators that:

1. Route the payload to the right adapter.
2. Run normalization.
3. Score reliability.
4. Check for conflicts.
5. Emit signals through the orchestrator so downstream modules can react.

The pipelines are deterministic given `(payload, now)` and they always produce an audit entry.

## Console view

The Ingestion page surfaces:

- Recent ingest events with adapter, reliability score, and signals produced.
- Active conflicts (with subject, conflicting signals, and the reviewer or system action that produced them).
- Reliability profile summaries per adapter.

## Adding an adapter

See [../../CONTRIBUTING.md#adding-an-ingestion-adapter](../../CONTRIBUTING.md#adding-an-ingestion-adapter).
