# Recruiting Intelligence Framework — Architecture

> A System of Recruiting Intelligence — not an ATS, not a CRM, not a CV matcher.
> An open-source, multi-agent, graph-aware, probabilistic recruiting cognition framework.

## Philosophy

Recruiting is a **probabilistic system**. Hiring decisions are made under
uncertainty, signals interact non-linearly, and **trajectory matters more
than static pedigree**. Memory and institutional learning compound — they
are the moat. The framework treats every claim as a confidence-weighted
signal with full provenance so that reasoning is **explainable and auditable**
end-to-end.

## What this is NOT

- ❌ An ATS or pipeline tool
- ❌ A recruiting CRM
- ❌ A semantic CV matcher
- ❌ An interview summarizer
- ❌ A chatbot recruiter

## What this IS

- ✅ A multi-agent recruiting **cognition** framework
- ✅ A graph-aware reasoning infrastructure
- ✅ A plugin-oriented, event-driven foundation for building higher-order
  recruiting intelligence products

## Module map

The required folders are implemented as a single workspace package
`@workspace/framework` so they can be shared by the API server, future
worker processes, and any external plugins. The literal folder layout
matches the requested names:

```
lib/framework/src/
  agents/                # Specialized agents with manifests + capabilities
  skills/                # Reusable, declaratively-described cognition units
  memory/                # Persistent, scoped memory (candidate/org/role/global)
  orchestrator/          # Event-driven broker between agents and workflows
  providers/             # Provider abstraction (OpenAI, Anthropic, custom)
  candidate_graph/       # Trajectory-aware candidate graph
  organization_graph/    # Hiring-org graph (teams, roles, calibration)
  workflows/             # Reasoning workflows (NOT pipeline stages)
  reports/               # Auditable synthesis with full evidence chain
  registry/              # Composite seam wiring all modules together
  shared/                # Cross-module primitives (Signal, Provenance, ...)

artifacts/
  api-server/            # Backend control plane (Express + TS)
    src/routes/          # Thin HTTP surface over the framework registry
  console/               # Frontend explorer shell (React + Vite + Tailwind + shadcn)

lib/
  api-spec/              # OpenAPI contract — single source of truth
  api-client-react/      # Generated React Query hooks (do not edit)
  api-zod/               # Generated Zod schemas (do not edit)
  db/                    # Drizzle ORM + schema
```

## Architectural pillars

1. **Modular** — every module is an independent surface with its own
   interface; nothing imports from a sibling implementation directly.
2. **Open-source friendly** — no proprietary lock-in; provider, memory,
   and graph backends are swappable behind small interfaces.
3. **Plugin-oriented** — agents, skills, providers, and workflows are
   registered into typed registries at boot. Third parties can ship
   plugins as separate packages and register them at startup.
4. **Agent-native** — the unit of cognition is the `Agent`, not the
   request handler. Agents compose `Skills` over `Memory` via `Providers`.
5. **Event-driven** — all inter-agent coordination flows through
   `FrameworkEvent`s on the `Orchestrator`. No agent-to-agent coupling.
6. **Workflow-ready** — workflows are declarative reasoning programs
   triggered by events. They orchestrate skills, NOT recruiting stages.
7. **Scalable** — the in-process orchestrator can be swapped for an
   external broker (NATS, Kafka, Postgres LISTEN/NOTIFY) without
   touching agent/skill code.
8. **Observable** — every signal carries `Provenance`. Every report
   carries the `Signal[]` it was derived from. Every provider call is
   logged with input, output, and trace id.

## Probabilistic primitives

Everything that crosses a module boundary uses these primitives:

- `Signal<T>` — a typed observation with `confidence ∈ [0,1]` and `Provenance`.
- `Provenance` — `producedBy`, `producedAt`, `rationale`, `derivedFrom[]`.
- `FrameworkEvent` — the only inter-module message.
- `ScopeKind` — `candidate | organization | role | global`.

No claim exists in the system without a confidence and a provenance trail.

## Memory model

Memory is **the moat**. Every agent insight is persisted as a `MemoryEntry`
scoped to a subject (`candidate | organization | role | global`). Backends
are plug-in; the reference implementation is in-process for development,
and Postgres + pgvector are the intended production targets.

## Provider abstraction

All LLM access flows through `LLMProvider`. OpenAI and Anthropic adapters
share the same interface, so an agent declares `defaultProvider` and the
registry resolves it at invocation time. This also means routing
decisions (cheap vs. strong model, structured-output capable vs. not) are
declarative and observable.

## Graph intelligence

Two graphs interact:

- **Candidate graph** — roles, companies, projects, skills, mentors, signals.
  Captures trajectory and evidence density.
- **Organization graph** — teams, roles, hiring managers, competencies,
  calibration history.

Fit reasoning is a function of **both** graphs, not one-sided keyword
matching against a CV.

## Why no ATS / Kanban / pipeline

Pipeline stages encode the workflow of a recruiter, not the cognition of
hiring. This framework deliberately stays one layer below — products
built on top can implement their own stages, kanban boards, or CRM
features by subscribing to framework events.

## Control plane

The `api-server` is a thin HTTP surface over `FrameworkRegistry`. Routes:

- `GET /api/system/overview` — counts across every module
- `GET /api/registry/{agents,skills,providers,workflows}` — registry introspection
- `GET /api/memory/entries` — persistent memory tail
- `GET /api/graph/{candidate,organization}` — graph snapshots
- `GET /api/reports` — synthesised reports with evidence

The console (`/`) is a React + Tailwind + shadcn explorer for these surfaces.

## Extending the framework

A plugin is any package that calls into the registries at boot:

```ts
import { createFrameworkRegistry } from "@workspace/framework/registry";

const reg = createFrameworkRegistry();
reg.agents.register(myTrajectoryAgent);
reg.skills.register(myTrajectorySkill);
reg.providers.register(myAnthropicProvider);
reg.workflows.register(myOnboardingWorkflow);
```

Everything else — HTTP, telemetry, persistence — picks up the new
component automatically.
