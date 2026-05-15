# Quickstart

Bring the framework up from a fresh clone in under five minutes. No API keys required for the skeleton; the runtime uses deterministic in-memory seeds.

## Prerequisites

- **Node.js 24** (see `.nvmrc` if present, or run `node -v`)
- **pnpm 9+** (`npm i -g pnpm`)
- No database required for the skeleton — the bootstrap seeds in-process.

## 1. Install

```bash
git clone <repo>
cd recruiting-intelligence-framework
pnpm install
```

## 2. Verify the build

```bash
pnpm run typecheck
```

Builds the composite framework libs first, then typechecks every leaf workspace package. This is the canonical full check — prefer its result over your editor's LSP if they disagree.

## 3. Run the deterministic cognition benchmark

```bash
pnpm benchmark:cognition
```

Expected output:

```
Cognitive benchmark — 10/10 passed
  determinism=ok  provenance=ok  calibration=ok  snapshot=ok  guards=ok
  PASS inflated_senior
  PASS founder_builder
  PASS plateaued_staff
  PASS elite_ic
  PASS high_variance_candidate
  PASS ambiguous_generalist
  PASS fake_oss_signal
  PASS chaos_thriver
  PASS process_dependent_operator
  PASS underestimated_junior
```

Each scenario is a synthetic candidate profile; the suite asserts:

| Guard | Assertion |
|---|---|
| determinism | Two runs over the same world produce byte-identical outputs. |
| provenance | Every produced signal, memory entry, and report has a full provenance chain. |
| calibration | Reviewer calibration weights are within the expected band. |
| snapshot | Generated reports match the committed reference snapshot. |
| guards | Mutation guards hold (frozen audit entries, refused cross-org reads, capability mismatch denials). |

If a guard fails, the framework's behavior drifted — investigate before regenerating snapshots.

## 4. Run the cognitive smoke suite

```bash
pnpm test:cognitive-smoke
```

The smoke suite is the CI gate. Same scenarios, faster invocation, suitable for pre-merge checks.

## 5. Bring up the runtime

The runtime is two services: the API server and the console.

```bash
# Terminal 1 — API server (Express + OpenAPI, in-memory seeds).
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Console (React + Vite + Tailwind).
pnpm --filter @workspace/console run dev
```

> On Replit, both services are managed as workflows. Use the project's preview pane and dropdown.

Once running, the console exposes the live state of every framework module:

- **Overview** — system telemetry, recent memory, recent reports
- **Ingestion** — recent evidence ingest, reliability scores, conflicts
- **Cognition** — cross-agent synthesis, disagreement, uncertainty fusion
- **Organization** — org graph, fit assessments
- **Evaluation** — calibration deltas, longitudinal outcomes
- **Operations** — investigations, hypotheses, adversarial probes
- **Collaboration** — reviewer coordination, consensus, override handling
- **Security** — org boundaries, reviewer identities, capabilities, visibility, decision inspector, sensitive evidence viewer, audit timeline, security benchmark panel
- **Benchmarks** — cognition benchmark results
- **Agents · Skills · Providers · Workflows · Memory · Graphs · Reports**

## 6. First cognition walkthrough

1. Open the **Ingestion** page. The seed runs four ingestion adapters; you'll see normalized signals, reliability scores, and conflict detection.
2. Switch to **Cognition**. Watch how multiple agents produce overlapping signals; disagreement is preserved, not averaged.
3. Open **Organization** → fit assessments are computed against the org graph using both candidate and org graph context.
4. Open **Evaluation** → reviewer calibration deltas update as outcomes are recorded.
5. Open **Operations** → an investigation may have been opened automatically for high-uncertainty cases.
6. Open **Security** → click any reviewer to inspect their recent decisions and audit trail. Open the decision inspector; pick a denied decision and read the per-rule trace.

## Updating snapshots

Cognition snapshots are intentionally not auto-updated. If a code change is supposed to alter the cognition output, run:

```bash
pnpm benchmark:cognition:update
```

…review the diff, and commit it together with the code change. Reviewers should reject PRs where the snapshot update is not justified by an explicit cognition change in the description.

## OpenAPI / codegen

The HTTP contract lives in `lib/api-spec/openapi.yaml`. After editing the contract:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates React Query hooks (`lib/api-client-react/src/generated/`) and Zod schemas (`lib/api-zod/src/generated/`). Never hand-edit the generated files.

## What can go wrong

| Symptom | Likely cause |
|---|---|
| `pnpm dev` at workspace root fails | Don't run dev at the root; run per-package or via workflows. |
| `tsc --build` works but editor disagrees | Trust the CLI. Restart the TS server. |
| Snapshot mismatch on a fresh clone | Your branch lacks an intentional snapshot update. Inspect the diff, regenerate if intended. |
| Cross-org read returns 403-like denial in the console | Working as designed. Use the decision inspector to see the rule that denied it. |

## Next reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the deep map.
- [docs/PHILOSOPHY.md](./docs/PHILOSOPHY.md) — why the framework is shaped this way.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — invariants you must preserve.
