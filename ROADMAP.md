# Roadmap

This roadmap describes where the framework is, where it is going, and what is explicitly out of scope. Items move from *exploratory* to *in progress* to *completed* through issues and PRs; the roadmap is updated when those transitions happen.

Legend: ✅ completed · 🚧 in progress · 🧭 exploratory · ❌ explicit non-goal

## Current architecture (v0.1.x)

✅ **19 framework modules** under `@workspace/framework`:
  ingestion, cognition, organization_intelligence, evaluation, intelligence_operations, collaboration, security, agents, skills, providers, memory, orchestrator, workflows, candidate_graph, organization_graph, reports, registry, benchmarks, shared.

✅ **OpenAPI-first contract** (`lib/api-spec/openapi.yaml`) with generated React Query hooks and Zod schemas.

✅ **Deterministic cognition benchmark suite** — 10 scenarios, 5 guard categories (determinism, provenance, calibration, snapshot, mutation guards), CI-runnable.

✅ **Security layer** — identity, multi-tenant isolation, capability-based authorization, append-only audit, sensitive-evidence redaction, session integrity, 8 security benchmarks.

✅ **Operator console** with sections for every framework module; confidence and provenance rendered as first-class visual primitives.

✅ **Reference in-memory backends** for memory, graphs, sessions, audit. No external services required to run the skeleton.

## Short-term priorities

🚧 **Postgres + pgvector memory adapter.** Reference implementation of the memory backend using the schemas already scaffolded in `lib/db`. Goal: zero behavioral drift vs. the in-memory adapter; same benchmark outputs.

🚧 **Cognition snapshot diffing UI.** A console view that shows why two snapshots differ when a benchmark update is required.

🚧 **Adversarial benchmark suite.** Companion to the cognition suite, focused on inputs designed to confuse a single-agent system: contradictory references, manufactured signals, missing context.

🚧 **Provenance integrity check in CI.** Static analysis that fails the build if a public framework function produces an artifact without provenance.

🚧 **Reviewer calibration export.** A deterministic export format for calibration weights so they can be carried across deployments.

## Ecosystem plans

🧭 **Plugin packaging guide.** Third-party agents, skills, and ingestion adapters as separate packages that register themselves at boot.

🧭 **Hosted memory layer reference.** A reference deployment of the memory layer behind a thin authenticated HTTP surface, for teams that want a managed backend without giving up framework determinism.

🧭 **Provider router.** Routing decisions (cheap vs. strong model, structured-output vs. not) as a declarative policy, not in-line branches.

🧭 **CLI for benchmark replay.** `pnpm framework replay --scenario <id> --until <step>` for step-through cognition debugging.

## Graph intelligence

🚧 **Edge inference primitives.** Confidence-weighted edge derivation in both the candidate and organization graphs.

🧭 **Trajectory primitives.** Time-aware reasoning over the candidate graph — career inflection detection, signal aging, evidence freshness.

🧭 **Cross-graph fit explanations.** Surfacing fit assessments as a small subgraph of supporting edges, not as a scalar.

## Organizational learning

🧭 **Beyond per-reviewer calibration.** Calibration as a function of the (reviewer, role family, organization) tuple, with explicit drift detection when reviewers move between organizations.

🧭 **Outcome-feedback loops.** Closed-loop learning from longitudinal outcomes, with snapshotted before/after weights so changes are auditable.

🧭 **Disagreement attribution.** Stable explanations for why specific reviewers disagree on specific kinds of evidence.

## Benchmark expansion

🧭 **Multi-organization reasoning scenarios.** Benchmarks that exercise cross-tenant carve-outs, calibration namespaces, and global benchmark contributions.

🧭 **Long-horizon scenarios.** Scenarios that run over simulated quarters, asserting that long-running calibration and memory updates remain deterministic.

🧭 **Stress benchmarks for the security engine.** Property-based tests that fuzz access requests against the rule set.

## Explicit non-goals

❌ **An ATS or pipeline tool.** Stages, kanban, applicant tracking belong in products built on top of the framework, not in the framework.

❌ **A recruiting CRM.** Outreach sequences, email templates, calendar integrations — out of scope.

❌ **A CV matcher.** Document → vector → score reductions discard everything the framework is designed to preserve.

❌ **A chatbot recruiter.** The framework's surface is data, not conversation.

❌ **Black-box scoring models.** Every score must be reducible to provenance-rooted signals.

## Versioning posture

- Pre-1.0 the framework will make breaking changes as needed; deprecations are documented in [CHANGELOG.md](./CHANGELOG.md) and called out in PRs.
- The OpenAPI contract is versioned with the framework. Generated client/zod files are regenerated from the contract — never hand-edited.
- Snapshot files are part of the public interface in the sense that they represent the framework's committed behavior. Changes are intentional and reviewed.

## How to influence the roadmap

- Open a discussion or issue using the `cognition_proposal` template.
- Strong proposals come with a benchmark scenario that captures the desired behavior.
- "It would be cool if…" issues are welcome but lower priority than ones with reproducible evidence.
