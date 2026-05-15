# Architecture

> See [../../ARCHITECTURE.md](../../ARCHITECTURE.md) for the full deep map. This file is the index for architectural sub-topics.

## Module map

The framework is shipped as a single workspace package (`@workspace/framework`) with one subpath export per concern.

```
lib/framework/src/
  ingestion/                 Evidence intake. Adapters, normalization, conflict detection,
                             reliability, candidate + organization pipelines, audit, provenance.
  cognition/                 Cross-agent synthesis. Disagreement preservation,
                             uncertainty fusion, reconciliation, influence engine,
                             cross-agent memory.
  organization_intelligence/ Org graph, fit engine, organization-scoped memory and agents.
  evaluation/                Calibration, outcomes, longitudinal learning, evaluation engine,
                             cognition benchmark integration.
  intelligence_operations/   Investigations, hypotheses, evidence handling, adversarial
                             probes, consensus, workflow, case management.
  collaboration/             Reviewer coordination, consensus, dissent, override handling.
  security/                  Identity, multi-tenant isolation, capabilities, audit,
                             sensitive evidence, session integrity, security benchmarks.
  agents/                    Specialized agents (incl. flagship dossier agents).
  skills/                    Reusable cognition units.
  providers/                 LLM provider abstraction (OpenAI, Anthropic, custom).
  memory/                    Scoped persistent memory (candidate / org / role / global).
  orchestrator/              Event-driven broker.
  workflows/                 Declarative reasoning workflows.
  candidate_graph/           Trajectory-aware candidate graph.
  organization_graph/        Org / role / team graph.
  reports/                   Auditable synthesised intelligence briefs.
  registry/                  Composite seam wiring modules together.
  benchmarks/                Cognition benchmark scenarios + harness.
  shared/                    Primitives: Signal, Provenance, FrameworkEvent, ScopeKind.
```

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
        │ intelligence │
        │  operations  │  (investigations / hypotheses / adversarial)
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ collaboration│  (reviewers, consensus, override)
        └──────┬───────┘
               ▼
        ┌──────────────────────────────────────────────┐
        │  security  — every action passes through it  │
        └──────────────────────────────────────────────┘
```

## Control plane

The API server (`artifacts/api-server`) is a thin HTTP surface over the framework. The OpenAPI contract (`lib/api-spec/openapi.yaml`) is the single source of truth; routes are generated against the same Zod schemas the clients consume.

The console (`artifacts/console`) reads through that contract using generated React Query hooks. There is no implicit fetching path — every console call has a typed hook backed by an OpenAPI operation.

## Determinism contract

- Time is an argument. Every framework function that depends on time takes `now: string`.
- IDs are derived: `makeId(...parts)` + `fnv1a` hashing. No random IDs in cognition paths.
- Iteration order is stable. Maps are populated in deterministic order; serialization is canonical.
- The benchmark suite verifies determinism by running each scenario twice and asserting byte-identical outputs.

## Provenance contract

- Every artifact crossing a module boundary carries a `Provenance` record (`producedBy`, `producedAt`, `rationale`, `derivedFrom[]`).
- The shared `Signal<T>` primitive wraps every typed observation in `(value, confidence, provenance)`.
- The audit trail is the root of trust for human + system actions. Audit entries are frozen on append.

## Replayability

- Given the seed inputs + the framework version, any contributor can reproduce the framework's state.
- The committed cognition snapshot (`tests/cognitive-smoke/snapshot.json`) is the reference output. PR-driven snapshot updates are the only way it changes.

## Related reading

- [Cognition](../cognition/)
- [Provenance](../provenance/)
- [Benchmarks](../benchmarks/)
- [Security](../security/)
