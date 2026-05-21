# @robbie/memory-postgres

> Postgres-backed `MemoryStore` adapter for [`@robbie/framework`](https://www.npmjs.com/package/@robbie/framework).

[![npm](https://img.shields.io/npm/v/@robbie/memory-postgres.svg)](https://www.npmjs.com/package/@robbie/memory-postgres)
[![license](https://img.shields.io/badge/license-MIT-737373)](./LICENSE)

The Robbie framework ships an in-memory reference implementation of `MemoryStore`. This package implements the same interface against Postgres, with optional **pgvector** support for cosine-similarity retrieval.

## Install

```bash
npm install @robbie/framework @robbie/memory-postgres pg
# or
pnpm add @robbie/framework @robbie/memory-postgres pg
```

`pg` and `@robbie/framework` are peer dependencies.

## Schema

Apply the bundled schema once per database. Idempotent — running it again is safe.

```bash
psql "$DATABASE_URL" -f node_modules/@robbie/memory-postgres/schema.sql
```

Or programmatically (for tests / dev):

```ts
import { Pool } from "pg";
import { PostgresMemoryStore } from "@robbie/memory-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const store = new PostgresMemoryStore({ pool });
await store.migrate();
```

The schema creates:

- `robbie_memory_entries` (one row per memory entry, with provenance + tags + optional embedding)
- B-tree indexes on `(scope, subject_id)`, `key`, `confidence`
- A GIN index on `tags`
- An `ivfflat` cosine index on `embedding` (if pgvector is installed)

## Usage

```ts
import { Pool } from "pg";
import { PostgresMemoryStore } from "@robbie/memory-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const memory = new PostgresMemoryStore({ pool });

await memory.put({
  id: "mem:cand-001:cognition",
  scope: "candidate",
  subjectId: "cand-001",
  key: "cognition.synthesis",
  value: { recommendation: "ambiguous", globalConfidence: 0.69 },
  summary: "ambiguous → ambiguous; global confidence 0.69",
  confidence: 0.69,
  provenance: {
    producedBy: "cognition-engine",
    producedAt: "2026-05-15T00:00:00.000Z",
    rationale: "synthesizeCognition over (bayesian, contradiction, trajectory)",
  },
  createdAt: "2026-05-15T00:00:00.000Z",
  tags: ["cognition", "ambiguous"],
});

const recent = await memory.query({
  scope: "candidate",
  subjectId: "cand-001",
  minConfidence: 0.5,
  limit: 10,
});
```

## Semantic search (optional)

If pgvector is enabled, `querySimilar` returns the most similar entries by cosine distance. This method is **not part of the framework's `MemoryStore` interface** — it's an adapter-specific extension. Use it when you need vector retrieval; use `query()` for the framework-standard contract.

```ts
const hits = await memory.querySimilar(embeddingVector, {
  k: 5,
  scope: "candidate",
  minConfidence: 0.6,
});
for (const hit of hits) {
  console.log(`${hit.id} — similarity ${hit.similarity.toFixed(3)}`);
}
```

If you constructed the store with `pgvector: false`, `querySimilar` throws.

## Options

```ts
new PostgresMemoryStore({
  pool,                                // pg.Pool, PoolClient, or any { query() }
  pgvector: true,                      // default true
  table: "robbie_memory_entries",      // default; override if you namespace
});
```

The `pool` parameter accepts any object with a `query(text, values)` method — Pool, PoolClient, transaction client, or a test double.

## What this adapter does *not* do

- **No invariant enforcement.** Provenance, confidence, and ids are the caller's responsibility. The framework's own engines build these correctly; this adapter just persists what you hand it.
- **No multi-tenant isolation.** Tenant boundaries belong in the security layer (`@robbie/framework/security`), not in the storage layer. If you store cross-org memory in a single table, your read path must filter by tenant.
- **No encryption at rest.** Use Postgres-native or platform-level encryption.
- **No automatic migrations beyond the initial schema.** Schema evolution is your deployment pipeline's problem.

## Status

**0.1 pre-release.** Tracks `@robbie/framework` versioning. The `MemoryStore` interface may evolve in minor versions before 1.0; this adapter will move in lockstep.

## License

MIT.
