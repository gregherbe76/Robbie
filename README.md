<h1 align="center">Recruiting Intelligence Framework</h1>

<p align="center">
  <em>An open-source, provenance-first cognition framework for recruiting under uncertainty.</em>
</p>

<p align="center">
  <a href="#quickstart"><img alt="quickstart" src="https://img.shields.io/badge/quickstart-1%20command-0a7"></a>
  <a href="#deterministic-cognition"><img alt="deterministic" src="https://img.shields.io/badge/cognition-deterministic-3b82f6"></a>
  <a href="#benchmark-philosophy"><img alt="benchmarks" src="https://img.shields.io/badge/benchmarks-10%2F10%20guards-22c55e"></a>
  <a href="#provenance-first-reasoning"><img alt="provenance" src="https://img.shields.io/badge/provenance-first--class-8b5cf6"></a>
  <a href="#license"><img alt="license" src="https://img.shields.io/badge/license-MIT-737373"></a>
  <a href="#"><img alt="node" src="https://img.shields.io/badge/node-24-339933"></a>
  <a href="#"><img alt="typescript" src="https://img.shields.io/badge/typescript-5.9-3178c6"></a>
</p>

---

## What this project is

A framework for building **recruiting intelligence systems** — software that reasons about people, organizations, evidence, and uncertainty, with every claim carrying a confidence and a provenance trail.

It is shipped as a library (`@workspace/framework`) with two thin runtime surfaces:

- an **API server** that exposes the framework over HTTP with an OpenAPI contract,
- a **console** that lets operators introspect the live state of the cognition system (agents, skills, memory, graphs, decisions, audits, benchmarks).

It is intentionally **not**:

- ❌ an ATS
- ❌ a recruiting CRM
- ❌ a CV matcher or résumé summarizer
- ❌ a chatbot recruiter
- ❌ an automated hiring system

Products like those can be built on top of this framework — they are not what the framework is.

## Why it exists

Hiring is not document management. It is **probabilistic organizational reasoning under uncertainty** — signals interact non-linearly, trajectory matters more than pedigree, reviewers disagree, evidence ages, and institutional learning compounds. Existing tools treat people as rows; this framework treats hiring as a cognition problem and gives that problem a first-class data model: signals with confidence, evidence with provenance, agents with capability, reviewers with calibration, and decisions with auditable rule traces.

## Core philosophy

1. **Probabilistic by default.** Every claim carries `confidence ∈ [0,1]`. The UI renders confidence as a first-class visual primitive, not an afterthought.
2. **Provenance is data.** Every signal, memory entry, report, and access decision references the agent, skill, reviewer, or ingestion adapter that produced it. Nothing exists without a producer.
3. **Deterministic cognition.** Given the same input world, the framework produces byte-identical outputs. Same evidence → same memory keys → same reports → same audit sequence numbers.
4. **Disagreement is preserved.** Reviewer and agent disagreement is a first-class artifact, not an inconvenience to be averaged away.
5. **Capability-based authorization.** Not RBAC. Every action requires a specific capability; there are no reviewer-type back doors.
6. **No silent cross-org access.** Multi-tenant isolation is hard. Cross-org reads are refused unless the resource is in an explicit `global_demo` or `global_benchmark` carve-out.
7. **Audit-first.** The audit trail is append-only with per-org monotonic sequence numbers. Entries are frozen on append; mutation attempts cannot rewrite history.

## What makes it different

| Most recruiting software | This framework |
|---|---|
| Pipeline stages encode the recruiter's workflow | Cognition models the reasoning process |
| Scores are scalar and opaque | Decisions are rule-traced, with confidence and dissent preserved |
| Reviewers are roles in an RBAC matrix | Reviewers are calibrated identities with capability bundles |
| Memory is a notes field | Memory is scoped, typed, confidence-weighted, and provenance-linked |
| Evidence is a file upload | Evidence is a signal with source, reliability, and lineage |
| Cross-tenant separation is a column | Cross-tenant separation is a refused boundary by default |
| Benchmarks are absent | Benchmarks are deterministic, snapshotted, and CI-gated |

## Architecture overview

```
┌────────────────────────────────────────────────────────────────────┐
│                       @workspace/framework                          │
│                                                                    │
│  ingestion ─► cognition ─► organization_intelligence ─► reports    │
│      │           │                  │                     │        │
│      ▼           ▼                  ▼                     ▼        │
│   memory     evaluation       intelligence_operations  collaboration│
│      │           │                  │                     │        │
│      └───────────┴─── shared ───────┴─────────────────────┘        │
│                                                                    │
│                       security  ◄── choke point for every action   │
│                                                                    │
│   agents · skills · providers · workflows · orchestrator           │
│   candidate_graph · organization_graph · registry · benchmarks     │
└────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
     @workspace/api-server            @workspace/console
     (Express + OpenAPI)              (React + Vite)
```

19 framework modules, all introspectable through the registry and the console. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the deep map.

## Feature overview

- **19 framework modules** for ingestion, cognition, organization intelligence, evaluation, intelligence operations, collaboration, security, memory, agents, skills, providers, workflows, orchestrator, candidate graph, organization graph, reports, registry, benchmarks, and shared primitives.
- **OpenAPI-first**: the HTTP contract is the single source of truth. React Query hooks and Zod schemas are generated from it.
- **Deterministic cognition engine** with snapshot guards, calibration guards, and a mutation-guard test suite that fails CI on drift.
- **Capability-based security layer** with multi-tenant isolation, audited sensitive-evidence reads, append-only audit trail, and 8 deterministic security benchmarks.
- **Collaborative intelligence operations** — investigations, hypotheses, adversarial probes, consensus, disagreement preservation.
- **Console** with sections for every layer: Overview, Ingestion, Collaboration, Security, Intelligence, Cognition, Organization, Evaluation, Operations, Benchmarks, Agents, Skills, Providers, Workflows, Memory, Graphs, Reports.

## Deterministic cognition

A cognition run is a pure function of `(world, inputs, time)`. The framework's benchmark suite verifies this across five guard categories:

```
$ pnpm benchmark:cognition

Cognitive benchmark — 10/10 passed
  determinism=ok  provenance=ok  calibration=ok  snapshot=ok  guards=ok
  PASS inflated_senior         (failures: 0)
  PASS founder_builder         (failures: 0)
  PASS plateaued_staff         (failures: 0)
  PASS elite_ic                (failures: 0)
  PASS high_variance_candidate (failures: 0)
  PASS ambiguous_generalist    (failures: 0)
  PASS fake_oss_signal         (failures: 0)
  PASS chaos_thriver           (failures: 0)
  PASS process_dependent_operator (failures: 0)
  PASS underestimated_junior   (failures: 0)
```

| Guard | What it asserts |
|---|---|
| **determinism** | Two runs over the same world produce byte-identical outputs. |
| **provenance** | Every produced signal, memory entry, and report carries a complete provenance chain. |
| **calibration** | Reviewer calibration weights stay within the expected band for the scenario. |
| **snapshot** | Generated reports match the committed reference snapshot. |
| **guards** | Mutation guards (frozen audit entries, refused cross-org reads, capability mismatch denials) hold. |

Snapshots are kept in-tree and regenerated with an explicit `benchmark:cognition:update` command — never silently.

## Provenance-first reasoning

```
Signal
 ├─ value:        T
 ├─ confidence:   ∈ [0, 1]
 └─ provenance:
     ├─ producedBy:   AgentId | ReviewerId | IngestionAdapterId
     ├─ producedAt:   ISO-8601
     ├─ rationale:    string
     └─ derivedFrom:  Signal[]  ◄── recursive lineage
```

Every cognitive artifact in the framework — a memory entry, a fit assessment, a calibration delta, a sensitive-evidence view — is reducible to a signal graph rooted at ingested evidence. See [docs/provenance/](./docs/provenance/) for the full model.

## Benchmark philosophy

Benchmarks in this framework are **not** accuracy leaderboards. They are reproducibility contracts:

- Scenarios are synthetic, deterministic, and version-controlled.
- A failing benchmark means the framework's behavior drifted, not that a model got smarter.
- `pnpm benchmark:cognition` runs the cognition suite; `pnpm test:cognitive-smoke` runs the gated smoke variant.
- A separate **security benchmark suite** runs through the audited access engine and asserts denial paths for cross-org access, escalation without capability, override without capability, cross-investigation visibility leakage, benchmark contamination, reviewer impersonation, sensitive evidence access, and hidden audit mutation.

See [docs/benchmarks/](./docs/benchmarks/) for the manifest and reproducibility guide.

## Example intelligence flow

```ts
import { ingestion, security } from "@workspace/framework";

// 1. Construct the ingestion gateway. Adapters (GitHub, LinkedIn, resume,
//    transcript) are plug-in; each declares a reliability profile and
//    produces normalized evidence with explicit provenance.
const gateway = new ingestion.IngestionGateway();

// 2. Ingest a candidate world. The pipeline normalizes, scores reliability,
//    detects conflicts, and emits provenance-stamped evidence items.
const result = gateway.ingestCandidate({
  candidateId: "cand_001",
  candidateDisplayName: "Avery Chen",
  envelopes: rawEvidenceEnvelopes,
  submittedBy: "reviewer_42",
  now: "2026-05-15T12:00:00.000Z",
});
// result.normalizedCandidate, result.extractedEvidence[],
// result.sourceReliability[], result.conflicts[], result.provenanceChain[], result.audit[]

// 3. Downstream layers (cognition, organization_intelligence, evaluation,
//    intelligence_operations, collaboration) consume the result. Every
//    evidence item carries a Signal<T> shape with confidence + provenance.

// 4. Every privileged action is checked against the central access engine,
//    and every check produces an audit entry through the audited
//    SecurityEngine.checkAccess(...) path.
const decision: security.AccessDecision = securityEngine.checkAccess({
  reviewerId: "reviewer_42",
  organizationId: "org_acme",
  targetResourceId: "case_acme_001",
  targetOrganizationId: "org_acme",
  targetVisibility: "organization_private",
  action: "read",
  requiredCapability: "review_evidence",
  sessionId: openSessionId,
  now: "2026-05-15T12:00:01.000Z",
});
// decision.allowed, decision.reason, decision.evaluatedRules[]
```

See `lib/framework/src/index.ts` for the full public surface and per-module subpath exports (`@workspace/framework/ingestion`, `/cognition`, `/security`, …).

## Example outputs

The seeded console run produces:

- **Multiple organizations** with hard tenant isolation
- **Multiple reviewers** with deterministic identities and capability bundles
- **Visibility-tracked resources** spanning cases, evidence, overrides, memory, benchmarks, demos
- **Sensitive evidence records** with redacted + audited full views
- **Access decisions** with full rule traces
- **Audit entries** with monotonic per-org sequence numbers, frozen on append
- **8 security benchmarks** all passing with non-empty audit linkage
- **10 cognition benchmarks** all passing across 5 guard categories

## Screenshots

The console exposes the live state of the cognition system. Each section corresponds to a framework module; data is read through the OpenAPI surface and rendered with confidence + provenance as first-class visual primitives.

> Console pages: Overview · Ingestion · Collaboration · Security · Intelligence · Cognition · Organization · Evaluation · Operations · Benchmarks · Agents · Skills · Providers · Workflows · Memory · Candidate Graph · Organization Graph · Reports

## Quickstart

```bash
git clone <repo>
cd recruiting-intelligence-framework
pnpm install

# Run the full type check across all packages (lib build + leaf typecheck).
pnpm run typecheck

# Run the deterministic cognition benchmark.
pnpm benchmark:cognition

# Run the cognition smoke suite.
pnpm test:cognitive-smoke
```

To bring up the runtime + console see [QUICKSTART.md](./QUICKSTART.md).

## Benchmark commands

| Command | Purpose |
|---|---|
| `pnpm benchmark:cognition` | Run the deterministic cognition benchmark suite. |
| `pnpm benchmark:cognition:update` | Regenerate the snapshot baseline (intentional, never silent). |
| `pnpm test:cognitive-smoke` | Fast gated smoke run for CI. |
| `pnpm run typecheck` | Full typecheck across the workspace. |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks and Zod schemas from `openapi.yaml`. |

## Repository structure

```
lib/
  framework/        # The framework itself — 19 modules.
    src/
      ingestion/                 # Evidence intake, normalization, reliability scoring
      cognition/                 # Cross-agent synthesis, disagreement, uncertainty fusion
      organization_intelligence/ # Org graph + fit engine
      evaluation/                # Calibration, outcomes, longitudinal learning
      intelligence_operations/   # Investigations, hypotheses, adversarial probes
      collaboration/             # Reviewer coordination, consensus, override handling
      security/                  # Identity, isolation, capabilities, audit, sensitive evidence
      agents/                    # Specialized agents (incl. flagship dossier agents)
      skills/                    # Reusable cognition units
      providers/                 # LLM provider adapters (OpenAI, Anthropic, custom)
      memory/                    # Scoped persistent memory
      orchestrator/              # Event-driven broker
      workflows/                 # Declarative reasoning workflows
      candidate_graph/           # Trajectory-aware candidate graph
      organization_graph/        # Org / role / team graph
      reports/                   # Auditable synthesised intelligence briefs
      registry/                  # Composite seam wiring modules together
      benchmarks/                # Cognition benchmark corpus + harness
      shared/                    # Primitives: Signal, Provenance, FrameworkEvent, ...
  api-spec/         # OpenAPI contract — single source of truth.
  api-client-react/ # Generated React Query hooks (do not edit by hand).
  api-zod/          # Generated Zod schemas.
  db/               # Drizzle schemas.

artifacts/
  api-server/       # Express 5 control plane.
  console/          # React + Vite operator console.
  mockup-sandbox/   # Component preview server.

scripts/            # Benchmark + smoke runners.
docs/               # Architecture, philosophy, provenance, benchmarks, security docs.
.github/            # Issue templates, PR template, CI workflows.
```

## Security & privacy philosophy

- Demo datasets are **synthetic**. No real candidate data ships in the repo.
- Cross-org reads are refused at the access engine boundary. Carve-outs (`global_demo`, `global_benchmark`) are explicit and audited.
- Sensitive evidence has a redacted view that all callers see by default. Full views require the `view_sensitive_evidence` capability and produce an audit entry.
- Reviewer identities are deterministic and fingerprinted. There is no anonymous override path.
- Session integrity is verified on every privileged action. See [SECURITY.md](./SECURITY.md).

## Contribution guide

Contributions are welcome from people who agree with the framework's invariants: deterministic execution, mandatory provenance, explicit uncertainty, capability-based authorization, append-only audit. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full standards and the contribution paths (new agents, skills, ingestion adapters, benchmarks, cognition modules).

## Roadmap

See [ROADMAP.md](./ROADMAP.md). Current focus areas:

- Hosted memory layer (Postgres + pgvector reference adapter)
- Graph intelligence expansion (edge inference, trajectory primitives)
- Organizational learning beyond per-reviewer calibration
- Benchmark expansion (adversarial scenarios, multi-org reasoning)

## Governance

This is an OSS infrastructure project, governed by the maintainers' commitment to the framework's invariants. Architectural changes that weaken provenance, determinism, or boundary enforcement will be rejected regardless of feature appeal. See [GOVERNANCE.md](./GOVERNANCE.md).

## License

MIT — see [LICENSE](./LICENSE).

---

<p align="center"><sub>
Recruiting is not document management.<br/>
It is probabilistic organizational intelligence under uncertainty.
</sub></p>
