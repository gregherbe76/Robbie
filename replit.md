# Recruiting Intelligence Console

An open-source, AI-native **recruiting intelligence framework** — a multi-agent recruiting cognition system with persistent memory, probabilistic reasoning, graph intelligence, specialized agents, declarative workflows, reusable skills, and built-in explainability and auditability. This is **not** an ATS, CRM, CV matcher, summarizer, or chatbot.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (runtime + introspection endpoints)
- `pnpm --filter @workspace/console run dev` — Recruiting Intelligence Console (operator UI)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + Shadcn UI + wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (schema scaffolded; runtime uses in-memory seeds today)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- LLM providers: OpenAI + Anthropic via a provider abstraction (no keys required for the framework skeleton)

## Where things live

- `lib/framework/src/` — the framework core. One folder per concern, each with its own `index.ts`:
  - `agents/`, `skills/`, `providers/`, `orchestrator/`, `workflows/`, `memory/`,
    `candidate_graph/`, `organization_graph/`, `reports/`, `registry/`, `shared/`
- `lib/api-spec/openapi.yaml` — single source of truth for the HTTP contract
- `lib/api-client-react/src/generated/` — generated React Query hooks + Zod schemas
- `artifacts/api-server/src/framework/bootstrap.ts` — seeds the framework registries
- `artifacts/api-server/src/routes/` — introspection routes (system, registry, memory, graph, reports)
- `artifacts/console/src/pages/` — operator console (Overview, Agents, Skills, Providers, Workflows, Memory, Graphs, Reports)
- `ARCHITECTURE.md` — philosophy, module map, and design decisions

## Architecture decisions

- **Framework, not application.** The system is shipped as a library (`@workspace/framework`) with thin runtime surfaces (the API server) and an introspection UI (the console). No pipeline stages, no kanban, no candidate workflows in the ATS sense.
- **Provider abstraction first.** All model calls flow through `providers/`. OpenAI and Anthropic are interchangeable adapters; "custom" is supported.
- **Registries everywhere.** Agents, skills, providers, and workflows are all registry-backed and introspected through `/registry/*` endpoints.
- **Probabilistic by default.** Memory entries and reports carry a `confidence ∈ [0,1]`. The UI renders confidence as a first-class visual primitive.
- **Provenance is data.** Memory carries `sourceAgentId`; workflow steps reference `agentId + skillId`. The UI surfaces who-produced-what.
- **Graphs are explicit.** Candidate and organization knowledge are exposed as node/edge snapshots rather than relational rows.

## Product

The Console is the operator face of the framework. It shows the live state of the cognition system:

- **Overview** — system telemetry, recent memory, recent reports, health
- **Agents** — registered agents, their role, capabilities, status, default provider
- **Skills** — skills grouped by category with inputs → outputs
- **Providers** — LLM provider adapters and configuration status
- **Workflows** — declarative workflows and their ordered (agent · skill) steps
- **Memory** — persistent memory entries with scope, key, summary, confidence, provenance
- **Candidate / Organization Graph** — node-link snapshots with edge relations + adjacency fallback
- **Reports** — synthesised intelligence briefs with kind and confidence

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Runtime currently uses in-memory seeds in `bootstrap.ts`. No `DATABASE_URL` is required for the skeleton to run.
- Do not run `pnpm dev` at the workspace root. Use workflows or `pnpm --filter <pkg> run dev`.
- Regenerate hooks/schemas after editing `lib/api-spec/openapi.yaml`: `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `ARCHITECTURE.md` for the framework's philosophy and module-by-module map
