# Architecture

> An open-source, provenance-first recruiting intelligence framework.
> Not an ATS, not a CRM, not a CV matcher.

This document is the deep map. For the philosophical premises see [docs/PHILOSOPHY.md](./docs/PHILOSOPHY.md). For onboarding see [QUICKSTART.md](./QUICKSTART.md). For per-module deep dives see [docs/](./docs/).

## Philosophy

Recruiting is **probabilistic organizational reasoning under uncertainty**. Signals are noisy, reviewers disagree, evidence ages, organizations differ, and institutional learning compounds. The framework treats every claim as a confidence-weighted signal with full provenance so reasoning is explainable, auditable, and replayable end-to-end.

## What this is NOT

- ❌ An ATS or pipeline tool
- ❌ A recruiting CRM
- ❌ A CV matcher
- ❌ An interview summarizer
- ❌ A chatbot recruiter

## What this IS

- ✅ A multi-agent recruiting cognition framework
- ✅ A provenance-first reasoning infrastructure
- ✅ A deterministic intelligence operations platform
- ✅ A plugin-oriented, event-driven foundation for higher-order recruiting intelligence products

## Module map

The framework ships as a single workspace package `@workspace/framework` with one subpath export per concern.

```
lib/framework/src/
  ingestion/                 Evidence intake. Adapters, normalization, conflicts,
                             reliability, candidate + organization pipelines,
                             audit, provenance, payload hashing.
  cognition/                 Cross-agent synthesis. Disagreement preservation,
                             uncertainty fusion, reconciliation, influence
                             engine, cross-agent memory.
  organization_intelligence/ Org graph context, fit engine, organization-scoped
                             memory and agents.
  evaluation/                Calibration, longitudinal outcomes, learning,
                             evaluation reports, cognition benchmark integration.
  intelligence_operations/   Investigations, cases, hypotheses, evidence
                             handling, adversarial probes, consensus, workflow.
  collaboration/             Reviewer coordination, consensus with dissent
                             preservation, override handling.
  security/                  Identity, multi-tenant isolation, capabilities,
                             append-only audit, sensitive evidence redaction,
                             session integrity, security benchmark suite.
  agents/                    Specialized agents incl. flagship dossier agents
                             (Bayesian, trajectory, contradiction, dossier).
  skills/                    Reusable cognition units (declared inputs → outputs).
  providers/                 LLM provider abstraction (OpenAI, Anthropic, custom).
  memory/                    Scoped persistent memory (candidate / org / role / global).
  orchestrator/              Event-driven broker. Only inter-module message path.
  workflows/                 Declarative reasoning workflows. Not pipeline stages.
  candidate_graph/           Trajectory-aware candidate graph.
  organization_graph/        Org / role / team graph with calibration history.
  reports/                   Auditable synthesised intelligence briefs.
  registry/                  Composite seam wiring modules together.
  benchmarks/                Cognition corpus (10 deterministic scenarios)
                             + harness. Snapshot: tests/cognitive-smoke/snapshot.json.
  shared/                    Primitives: Signal, Provenance, FrameworkEvent,
                             ScopeKind, deterministic id helpers.

artifacts/
  api-server/                Express 5 control plane. Thin HTTP surface over
                             FrameworkRegistry. Routes generated against the
                             same Zod schemas the clients consume.
  console/                   React + Vite + Tailwind + shadcn operator UI.
                             One section per framework module.
  mockup-sandbox/            Component preview server (development only).

lib/
  api-spec/                  OpenAPI contract — single source of truth.
  api-client-react/          Generated React Query hooks (do not edit).
  api-zod/                   Generated Zod schemas (do not edit).
  db/                        Drizzle schemas; runtime defaults to in-memory.

scripts/                     benchmark:cognition, benchmark:cognition:update,
                             test:cognitive-smoke runners.
```

## Architectural pillars

1. **Modular.** Each module has its own subpath export. Nothing imports from a sibling implementation directly; everything flows through public surfaces.
2. **Open-source friendly.** No proprietary lock-in. Provider, memory, and graph backends are swappable behind small interfaces.
3. **Plugin-oriented.** Agents, skills, providers, and workflows register into typed registries at boot. Third parties can ship plugins as separate packages.
4. **Agent-native.** The unit of cognition is the `Agent`, not the request handler. Agents compose `Skills` over `Memory` via `Providers`.
5. **Event-driven.** Inter-agent coordination flows through `FrameworkEvent`s on the `Orchestrator`. No agent-to-agent coupling.
6. **Workflow-ready.** Workflows are declarative reasoning programs triggered by events. They orchestrate skills, NOT recruiting stages.
7. **Scalable.** The in-process orchestrator can be swapped for an external broker (NATS, Kafka, Postgres LISTEN/NOTIFY) without touching agent/skill code.
8. **Observable.** Every signal carries `Provenance`. Every report carries the `Signal[]` it was derived from. Every provider call is logged.

## Probabilistic primitives

Every artifact that crosses a module boundary uses these primitives:

- `Signal<T>` — a typed observation wrapped in `(value, confidence, provenance)`.
- `Confidence` — `∈ [0, 1]`. Not optional. Not implicit. Not a label.
- `Provenance` — `producedBy`, `producedAt`, `rationale`, `derivedFrom[]`. Recursive lineage.
- `FrameworkEvent` — the only inter-module message shape.
- `ScopeKind` — `candidate | organization | role | global`.

No claim exists in the system without a confidence and a provenance trail.

## Data flow

```
        ┌─────────────┐
inputs ─►   ingestion │── normalized signals with reliability + provenance
        └──────┬──────┘
               ▼
        ┌─────────────┐         ┌───────────────────────┐
        │  cognition  │◄────────┤        memory          │
        └──────┬──────┘         └───────────┬───────────┘
               │                            ▲
               ▼                            │
        ┌──────────────────────────────┐    │
        │ organization_intelligence    │    │
        │ (fit engine + org graph)     │    │
        └──────┬───────────────────────┘    │
               ▼                            │
        ┌──────────────┐  outcomes  ┌───────┴─────────┐
        │  reports     │──────────► │   evaluation    │
        └──────┬───────┘            └─────────────────┘
               │
               ▼
        ┌──────────────┐
        │ intelligence │  investigations · hypotheses · adversarial probes
        │  operations  │
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ collaboration│  reviewers · consensus · dissent · override
        └──────┬───────┘
               ▼
        ┌──────────────────────────────────────────────┐
        │  security  — every action passes through it  │
        └──────────────────────────────────────────────┘
```

## Ingestion flow

1. Raw evidence enters via `ingestion.gateway`.
2. The gateway routes the payload to the right adapter (by source kind).
3. The adapter:
   - normalizes the payload into typed signals,
   - declares a reliability profile and computes per-event reliability,
   - emits provenance referencing the adapter id + payload hash,
   - writes an ingestion audit entry,
   - detects and records conflicts with existing memory rather than overwriting.
4. The candidate / organization pipeline emits the signals through the orchestrator.

See [docs/ingestion/](./docs/ingestion/).

## Cognition flow

1. Signals arrive at the cognition layer.
2. Multiple agents produce overlapping signals; disagreement is preserved, not averaged.
3. `uncertainty_fusion` combines confidences across overlapping signals using documented rules per signal kind.
4. `disagreement` keeps `DisagreementRecord`s for inspection.
5. `reconciliation` is invoked only when conflict is structural (supersession by freshness, retraction, reliability).
6. `influence_engine` records which upstream agent influenced which downstream signal.
7. The synthesized output is itself a `Signal[]` with full provenance back to ingested evidence.

See [docs/cognition/](./docs/cognition/).

## Organization intelligence flow

1. Synthesized signals reach `organization_intelligence.fit_engine`.
2. The fit engine reads:
   - the candidate's subgraph from `candidate_graph`,
   - the organization's subgraph from `organization_graph`,
   - organization-scoped calibration from `evaluation`.
3. Fit is computed as a function of *both* graphs.
4. Output: a confidence-weighted assessment with supporting subgraph, identified risks, identified leverage moments, and a recommended next action.

See [docs/organization-intelligence/](./docs/organization-intelligence/).

## Evaluation / calibration flow

1. Outcomes are recorded post-hoc — "what actually happened" with the producer of that observation.
2. For each signal that contributed to the original decision, `learning.ts` computes a calibration delta.
3. The delta is applied to the producer's weighting profile (per-reviewer-per-role).
4. The update is itself a recorded artifact with provenance back to the outcome.
5. Subsequent fit assessments consume the updated weights deterministically.

See [docs/evaluation/](./docs/evaluation/).

## Intelligence operations flow

1. An investigation is opened (by automation or by a reviewer) when fit confidence is low, dissent is high, or adversarial probes warrant deeper inspection.
2. The investigation collects hypotheses, supporting + countering evidence, and adversarial probes.
3. Consensus is attempted via `consensus.ts` — but dissent is preserved as a first-class artifact, not collapsed.
4. The investigation closes with an outcome that flows back into evaluation.

See [docs/collaboration/](./docs/collaboration/).

## Collaboration flow

1. Reviewers participate as identities with capability bundles, not RBAC roles.
2. Disagreement is structural. Two reviewers producing conflicting signals do not "resolve to" one position; both survive.
3. Overrides are structured events with the previous recommendation, the new recommendation, and the justification.
4. Every reviewer action passes through the security layer for capability + session validation.

## Security boundaries

The security layer is the choke point. Every action that mutates state, reads sensitive evidence, or crosses an organization boundary passes through `AccessDecisionEngine.decide`, which evaluates six ordered rules:

1. `reviewer_identity` — reviewer exists, reviewer.org matches request.org.
2. `organization_boundary` — resource.org matches request.org, or resource is in an explicit `global_demo` / `global_benchmark` carve-out.
3. `capability` — required capability derived server-side from `action`; reviewer holds it.
4. `visibility` — resource's current visibility level admits the caller.
5. `escalation_restriction` — escalate actions require `escalate_case` (capability-based, no reviewer-type back door).
6. `session_integrity` — for writes / privileged actions, validated against the session integrity layer.

Audit entries are append-only, per-org monotonic, and deep-frozen on append. The 8-scenario security benchmark runs through the audited `checkAccess` path.

See [docs/security/](./docs/security/) and [SECURITY.md](./SECURITY.md).

## Benchmark infrastructure

Two suites, both deterministic:

- **Cognition** — scenarios in `lib/framework/src/benchmarks/corpus.ts`, harness in `lib/framework/src/benchmarks/`, runner `scripts/src/benchmark-cognition.ts`, committed snapshot at `tests/cognitive-smoke/snapshot.json`. 10 scenarios, 5 guard categories (determinism, provenance, calibration, snapshot, mutation guards).
- **Security** (`lib/framework/src/security/benchmarks.ts`) — 8 denial scenarios, all routed through the audited access engine, all asserting non-empty `auditEntryIds`.

The cognition snapshot is committed in-tree at `tests/cognitive-smoke/snapshot.json`. Updates are explicit (`pnpm benchmark:cognition:update`) and require PR justification.

See [docs/benchmarks/](./docs/benchmarks/) and [benchmarks/README.md](./benchmarks/README.md).

## Provenance model

Every artifact is a node in a directed acyclic provenance graph rooted at ingested evidence.

```
Signal { value, confidence, provenance }
Provenance { producedBy, producedAt, rationale, derivedFrom: ProvenanceRef[] }
```

A producer is one of: `AgentId | ReviewerId | IngestionAdapterId | SystemRef`. Anonymous producers are forbidden. Provenance is never erased during reconciliation — the reconciliation itself becomes a new producer, with the original producer preserved on the original signal.

See [docs/provenance/](./docs/provenance/).

## Deterministic execution model

The framework's reasoning is a pure function of `(world, inputs, now)`:

- Time is always an argument. No `Date.now()` inside cognition.
- No `Math.random()` inside cognition. IDs derive from `fnv1a` + `makeId(...parts)`.
- Iteration order is stable. Maps are populated and serialized canonically.
- Snapshots are committed; the benchmark suite fails CI on drift.

## Replayability philosophy

Given the inputs + the framework version, any contributor can reproduce the framework's state byte-for-byte. The audit trail is part of the reproducibility contract — sequence numbers match across runs.

## Memory model

Memory is **the moat**. Every agent insight, every reviewer observation, every reconciliation is persisted as a `MemoryEntry` scoped to a subject (`candidate | organization | role | global`). Backends are pluggable; the reference implementation is in-process for development, Postgres + pgvector is on the roadmap.

The memory layer respects the security layer's visibility rules — there is no read path that bypasses access decisions.

## OpenAPI architecture

The HTTP contract (`lib/api-spec/openapi.yaml`) is the single source of truth. From it:

- React Query hooks are generated into `lib/api-client-react/src/generated/`.
- Zod schemas are generated into `lib/api-zod/src/generated/`.
- The API server uses the same Zod schemas to validate inputs and outputs.

The generated files are never hand-edited. Adding an endpoint means editing the OpenAPI spec, regenerating, and implementing the route against the generated zod schema.

## Control plane

`api-server` is a thin HTTP surface over `FrameworkRegistry`. The route map roughly mirrors the module map:

- `GET /api/system/overview` — telemetry counts across every module
- `GET /api/registry/{agents,skills,providers,workflows}` — registry introspection
- `GET /api/memory/entries` — persistent memory tail
- `GET /api/graph/{candidate,organization}` — graph snapshots
- `GET /api/reports` — synthesised reports with evidence
- `GET /api/ingestion/*` — recent ingest, conflicts, reliability profiles
- `GET /api/cognition/*` — synthesis, disagreement, fusion decisions
- `GET /api/evaluation/*` — calibration, outcomes
- `GET /api/operations/*` — investigations, hypotheses
- `GET /api/collaboration/*` — consensus records, overrides
- `GET /api/security/snapshot/{orgId}` — org boundaries, reviewers, decisions, audit, benchmarks
- `POST /api/security/check-access` — programmatic access checks

## Console

The console (`artifacts/console`) is the operator face. One section per framework module; data is read through the generated hooks; confidence + provenance are first-class visual primitives.

Pages: Overview · Ingestion · Collaboration · Security · Intelligence · Cognition · Organization · Evaluation · Operations · Benchmarks · Agents · Skills · Providers · Workflows · Memory · Candidate Graph · Organization Graph · Reports.

## Extending the framework

A plugin is any package that registers into the framework registries at boot:

```ts
import { registry } from "@workspace/framework";

const reg = registry.createFrameworkRegistry();
reg.agents.register(myTrajectoryAgent);
reg.skills.register(myTrajectorySkill);
reg.providers.register(myAnthropicProvider);
reg.workflows.register(myOnboardingWorkflow);
```

HTTP exposure, console rendering, audit wiring, and benchmark eligibility all pick up the new component automatically.

## Why no ATS / kanban / pipeline

Pipeline stages encode the workflow of a recruiter, not the cognition of hiring. The framework deliberately stays one layer below — products built on top can implement their own stages by subscribing to framework events. The framework reasons about people and organizations.

## Related reading

- [docs/PHILOSOPHY.md](./docs/PHILOSOPHY.md) — why the framework is shaped this way.
- [QUICKSTART.md](./QUICKSTART.md) — install and run.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — invariants you must preserve.
- [SECURITY.md](./SECURITY.md) — security posture, disclosure, guarantees.
- [ROADMAP.md](./ROADMAP.md) — what is and isn't planned.
- [GOVERNANCE.md](./GOVERNANCE.md) — how the project is run.
