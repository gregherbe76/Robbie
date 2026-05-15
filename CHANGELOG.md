# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches 1.0.0. Pre-1.0 releases may introduce breaking changes; those are called out explicitly.

## [Unreleased]

### Added
- Public OSS posture: README, ARCHITECTURE, QUICKSTART, CONTRIBUTING, ROADMAP, SECURITY, GOVERNANCE, CODE_OF_CONDUCT, CHANGELOG, MIT LICENSE.
- `docs/` documentation tree with philosophy, provenance, architecture, cognition, benchmarks, and security guides.
- `.github/` issue and PR templates, CODEOWNERS, and CI workflow.

## [0.1.0] — initial framework

### Cognition
- 10-scenario deterministic cognition benchmark suite (`benchmark:cognition`) with five guard categories: determinism, provenance, calibration, snapshot, mutation guards.
- Cognitive smoke suite (`test:cognitive-smoke`) for CI gating.
- Cross-agent cognition layer: synthesize, disagreement preservation, uncertainty fusion, reconciliation, influence engine, cross-agent memory.
- Flagship agents: Bayesian, trajectory, contradiction, dossier.

### Ingestion
- Real-world ingestion layer with adapters, normalization, conflict detection, reliability scoring, audit, provenance, candidate and organization pipelines, and the ingestion gateway.

### Organization intelligence
- Organization graph, fit engine, organization-scoped memory, organization agents and context.

### Evaluation
- Calibration, longitudinal outcomes, learning, reports, evaluation engine, and the cognition benchmark hooks.

### Intelligence operations
- Investigations, hypotheses, evidence handling, adversarial probes, consensus, workflow engine, and case management.

### Collaboration
- Reviewer coordination, consensus, dissent preservation, override handling.

### Security
- Identity, multi-tenant isolation, capability-based authorization, append-only audit, sensitive evidence redaction with audited privileged reads, session and action integrity layer.
- Central `AccessDecisionEngine` with six ordered rules: identity, organization boundary, capability (derived server-side from action), visibility, escalation (pure capability), and session integrity.
- 8-scenario security benchmark suite: cross-org access attempt, unauthorized escalation, override without capability, cross-investigation visibility leakage, benchmark contamination, reviewer impersonation, sensitive evidence access, hidden audit mutation.
- Audit entries deep-frozen on append; per-org monotonic sequence numbers.

### Runtime
- API server (Express 5) with introspection routes for system, registry, memory, graph, reports, ingestion, cognition, evaluation, operations, collaboration, and security.
- Console (React + Vite + Tailwind + shadcn) with sections for every framework module: Overview, Ingestion, Collaboration, Security, Intelligence, Cognition, Organization, Evaluation, Operations, Benchmarks, Agents, Skills, Providers, Workflows, Memory, Candidate Graph, Organization Graph, Reports.
- OpenAPI-first HTTP contract; generated React Query hooks and Zod schemas.

### Infrastructure
- pnpm workspaces, Node 24, TypeScript 5.9 with NodeNext module resolution.
- Composite framework lib (`@workspace/framework`) with subpath exports per module.
- Drizzle ORM scaffolded; runtime defaults to deterministic in-memory seeds.
