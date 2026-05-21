# @robbie/framework

> Provenance-first, deterministic cognition framework for recruiting intelligence.

[![npm](https://img.shields.io/npm/v/@robbie/framework.svg)](https://www.npmjs.com/package/@robbie/framework)
[![license](https://img.shields.io/badge/license-MIT-737373)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-339933)](#)

A library for building **recruiting intelligence systems** — software that reasons about people, organizations, evidence, and uncertainty, with every claim carrying a confidence and a provenance trail.

This is the **framework layer only**. It exposes pure functions and storage-agnostic interfaces. Auth, rate-limiting, persistence, observability, and UI are explicitly out-of-scope and meant to be supplied by the host application.

This package is part of the [Robbie](https://github.com/gregherbe76/robbie) monorepo. See the repo root for the full architecture, governance, philosophy, and benchmarks.

## Install

```bash
npm install @robbie/framework zod
# or
pnpm add @robbie/framework zod
```

`zod` is a peer dependency.

## Quick example

```ts
import { IngestionGateway } from "@robbie/framework/ingestion";
import {
  BayesianScoringAgent,
  ContradictionAgent,
  TrajectoryAgent,
} from "@robbie/framework/agents/flagship";
import { synthesizeCognition } from "@robbie/framework/cognition";

const NOW = "2026-05-15T00:00:00.000Z";
const now = () => new Date(NOW);

const gateway = new IngestionGateway();
const ingested = gateway.ingestCandidate({
  candidateId: "cand-001",
  candidateDisplayName: "Avery Chen",
  envelopes: [/* RawInputEnvelope[] */],
  submittedBy: "intake-bot",
  now: NOW,
});

// Downstream layers (agents, cognition, organization_intelligence, reports)
// consume the ingestion result. Every signal carries confidence + provenance.
```

See [`examples/`](https://github.com/gregherbe76/robbie/tree/main/examples) for runnable scripts and [`docs/tutorial-ingest-cognition-report.md`](https://github.com/gregherbe76/robbie/blob/main/docs/tutorial-ingest-cognition-report.md) for a 50-line walkthrough.

## Subpath exports

The framework exposes 25 subpath exports. Import only what you need:

```ts
import { IngestionGateway } from "@robbie/framework/ingestion";
import { synthesizeCognition } from "@robbie/framework/cognition";
import { runOrganizationIntelligence } from "@robbie/framework/organization-intelligence";
import { AccessDecisionEngine } from "@robbie/framework/security";
import { InMemoryStore } from "@robbie/framework/memory";
import { InMemoryReportStore } from "@robbie/framework/reports";
import type { Signal, Provenance, Confidence } from "@robbie/framework/shared";
```

Or import the umbrella:

```ts
import { ingestion, cognition, security, memory, reports } from "@robbie/framework";
```

## Core invariants

1. **Probabilistic by default** — every claim has `confidence ∈ [0,1]`.
2. **Provenance is data** — every signal references its producer recursively.
3. **Deterministic cognition** — same inputs → byte-identical outputs.
4. **Disagreement is preserved** — agents and reviewers can disagree; the framework never averages it away.
5. **Capability-based authorization** — no RBAC back doors.
6. **No silent cross-org access** — multi-tenant boundaries are refused, not bypassed.
7. **Audit-first** — append-only, per-org monotonic sequence numbers, frozen on append.

See [`docs/PHILOSOPHY.md`](https://github.com/gregherbe76/robbie/blob/main/docs/PHILOSOPHY.md) for the full rationale.

## Persistence

The framework ships **in-memory reference implementations** of `MemoryStore` and `ReportStore`. For production, plug in a real adapter — for example [`@robbie/memory-postgres`](https://github.com/gregherbe76/robbie/tree/main/lib/integrations/memory-postgres).

## Status

**0.1 pre-release.** Semantic versioning kicks in post-1.0. The API surface may change between minor versions. Production deployments should pin an exact version and wrap the framework with their own auth, rate-limit, and observability layer.

## License

MIT.
