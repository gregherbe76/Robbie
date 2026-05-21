# Examples

Four runnable scripts demonstrating the Robbie framework. Each is a single self-contained `.ts` file in `src/`.

## Run them

From the repo root:

```bash
pnpm install
pnpm --filter @workspace/examples run hello-ingest
pnpm --filter @workspace/examples run full-cognition
pnpm --filter @workspace/examples run security-audit
pnpm --filter @workspace/examples run custom-adapter

# or all four in sequence:
pnpm --filter @workspace/examples run all
```

No database, no API keys, no network calls — everything is in-process and deterministic.

## What each example shows

| File | Demonstrates |
|---|---|
| [`src/01-hello-ingest.ts`](./src/01-hello-ingest.ts) | Minimal use of `IngestionGateway`. Ingests one resume envelope, prints normalized evidence with provenance + reliability + audit trail. |
| [`src/02-full-cognition.ts`](./src/02-full-cognition.ts) | Ingest → cognition → fit → report. Runs the three flagship agents, `synthesizeCognition`, and `runOrganizationIntelligence`, then persists the synthesis as a `Report`. |
| [`src/03-security-audit.ts`](./src/03-security-audit.ts) | Capability-based authorization. Same-org read is allowed, cross-org read is refused. Inspects the append-only audit trail with per-org monotonic sequence numbers. |
| [`src/04-custom-adapter.ts`](./src/04-custom-adapter.ts) | Plugs a new `EvidenceAdapter` (synthetic "portfolio" source) into the `IngestionGateway` and ingests through it. |

## Using these outside this monorepo

Inside the repo, examples import from `@robbie/framework` and `pnpm` resolves it to the local workspace package. In your own project:

```bash
npm install @robbie/framework zod
# or
pnpm add @robbie/framework zod
```

The imports work unchanged.

## Tutorial

For a 50-line end-to-end walkthrough (ingest → cognition → organization fit → report), see [`docs/tutorial-ingest-cognition-report.md`](../docs/tutorial-ingest-cognition-report.md).

## Benchmark scenarios

The 10 deterministic cognition scenarios used as CI gates live in `lib/framework/src/benchmarks/corpus.ts`. They are not duplicated here — run them with `pnpm benchmark:cognition` from the repo root.
