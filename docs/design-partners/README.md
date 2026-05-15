# Design partner toolkit

This document is written for teams considering a pilot with the
recruiting intelligence framework. It is intentionally blunt about
current maturity. **Read every section.** Selecting partners on a clear
picture is more useful than impressing them with one.

---

## What you get today

- An **open-source framework** (`@workspace/framework`) that performs
  recruiting reasoning through eight composable layers — ingestion,
  flagship agents, cognition synthesis, organization fit, intelligence
  operations (escalation), evaluation (calibration), collaboration,
  security.
- A **deterministic replay runner** with five worked cases. Same input
  → same trace bytes. Replay signatures are sha256-stable and verified
  on every benchmark request.
- A **benchmark layer** with mutation guards and intentional
  calibration failures. The system tells you which confidence bands it
  does not trust about itself.
- An **operator console** (`/console/*`) for live introspection of
  registries, memory, graphs, reports.
- A **public surface** (`/`, `/architecture`, `/benchmarks-public`,
  `/demo`, `/api-explorer`, `/docs`) suitable for sharing with
  governance and exec audiences.

## What you do not get today

- **Persistent storage.** The runtime currently uses in-memory seeds.
  The Drizzle schema is scaffolded, but the server does not yet persist
  memory, graphs, or reports across restarts by default.
- **A production-hardened deployment**. No rate limiting, no built-in
  authn/authz, no audit log retention, no observability backends, no
  multi-tenant isolation guarantees.
- **A working OpenAI/Anthropic pipeline**. Provider adapters exist; the
  skeleton ships without keys, and the flagship agents reason on
  deterministic, locally-computed evidence.
- **An ATS integration**. There is intentionally no candidate-pipeline
  surface. The framework is decision-support infrastructure, not a
  recruiting workflow tool. If you need a kanban with stages, this is
  the wrong project.
- **A managed service**. There is no hosted offering. You run the OSS.

## Architecture in one screen

| Layer                       | Module                                  | What it does                                                            |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| 1 Ingestion                 | `lib/framework/src/ingestion`           | Normalises multi-source input into evidence + claims with provenance.   |
| 2 Flagship agents           | `lib/framework/src/agents`              | Bayesian scorer, contradiction detector, trajectory modeller.           |
| 3 Cognition synthesis       | `lib/framework/src/cognition`           | Confidence propagation, disagreement, fusion, recommendation.           |
| 4 Organization intelligence | `lib/framework/src/organization_*`      | Role-environment fit; mismatch detection.                               |
| 5 Intelligence operations   | `lib/framework/src/intelligence_operations` | Real `EscalationEngine`, adversarial review, multi-reviewer consensus. |
| 6 Evaluation                | `lib/framework/src/evaluation`          | Live calibration computation; overconfident-band detection.             |
| 7 Collaboration             | `lib/framework/src/collaboration`       | Reviewer annotations, overrides, evidence requests.                     |
| 8 Security                  | `lib/framework/src/security`            | Access logs, audit trail.                                               |

Supporting modules: `memory`, `candidate_graph`, `organization_graph`,
`providers`, `registry`, `skills`, `workflows`, `reports`, `replay`.

## Deployment expectations for a pilot

A realistic pilot configuration:

1. **Self-hosted** — single node, Postgres available (you implement
   the persistence wiring against the scaffolded Drizzle schema if you
   need it; the framework as shipped runs from memory).
2. **No PII at rest** in the framework runtime. Source-of-truth for
   candidate data stays in your ATS / CRM. The framework ingests, runs
   the trace, returns the report; you decide what to persist.
3. **Auth wrapped at the proxy layer**. The OSS server does not ship
   with built-in authn/authz; deploy behind your reverse proxy /
   identity provider.
4. **You own observability**. We surface structured logs and tracing
   hooks; you wire them into your stack.

## What we ask of a design partner

- One real recruiting decision per week, run through the framework
  alongside your existing process. We do not replace your process; we
  produce a parallel trace.
- A weekly written critique of a single replay — what the framework
  got right, what it got wrong, what was confusing.
- Tolerance for breaking changes. The framework is `0.x`. Manifests
  and APIs change between minors. We pin a release for your pilot and
  upgrade together.

## Known limitations

- **Calibration is imperfect by design and self-reported.** The
  evaluation engine flags overconfident bands; it does not yet
  recalibrate retroactively. The 0.45–0.60 and 0.60–0.75 bands on the
  ambiguous-generalist and org-mismatch archetypes are the largest
  open gaps.
- **Provider abstraction without remote calls.** The skeleton runs
  flagship agents on deterministic rules. Plugging in real provider
  calls is supported but introduces non-determinism in the replay
  unless you snapshot.
- **Operator console UI is utilitarian.** Designed for engineers and
  governance reviewers, not for daily recruiter use.
- **No multi-tenant isolation** at the framework layer. One framework
  instance per tenant for the pilot.
- **No SLAs, no support contract.** This is OSS.

## Roadmap transparency

The next public phase, ordered:

1. **Persistence wiring** — Drizzle implementations of the in-memory
   stores, with migration guardrails.
2. **Calibration retroactives** — pull realised outcomes back into the
   evaluation engine to recalibrate the next decision.
3. **Provider adapters that survive replay** — snapshot + replay of
   real model responses so determinism survives external calls.
4. **Extension-loader runtime** — the manifest contracts in
   `docs/PLUGINS.md` exist as types today; the dynamic loader is a
   future addition.

If the order matters to you, tell us; design partners influence it.

## Contact

Open an issue on the GitHub repo. No sales calls. No private decks.
