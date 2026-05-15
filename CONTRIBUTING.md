# Contributing

Thanks for considering a contribution. Before sending a PR, please read this whole document. The framework is held to a small set of non-negotiable invariants; PRs that violate them will not be merged regardless of feature appeal.

## Invariants (non-negotiable)

These are the rules the framework is built on. Every contribution must preserve them.

### 1. Deterministic execution

- Given the same inputs and the same `now`, every framework function must produce byte-identical outputs.
- No `Math.random`, no `Date.now()` inside cognition paths — `now` is always an argument.
- IDs are derived deterministically (`makeId(...parts)` + `fnv1a`), never randomly.

### 2. Mandatory provenance

- Every signal, memory entry, report, decision, audit entry, and visibility change must carry a complete provenance trail: who produced it (agent, reviewer, ingestion adapter), when, and what it was derived from.
- "Anonymous" or "system-wide" provenance is not allowed.

### 3. Explicit uncertainty

- Confidence is a first-class field, `confidence ∈ [0, 1]`. Not optional. Not implicit.
- Do not collapse multiple signals into a scalar score without preserving the underlying signals.

### 4. No hidden inference

- If your code makes a probabilistic judgment, the judgment must be a `Signal` with provenance, not a hard-coded branch.
- Heuristics are allowed; undocumented heuristics in critical paths are not.

### 5. No ATS concepts

- Pipeline stages, candidate states, kanban columns, applicant statuses — these are product concerns, not framework concerns.
- The framework reasons about people and organizations. Products built on top can model stages.

### 6. No black-box scoring

- Every score must be reproducible from inputs alone, and every input must be a signal with provenance.

### 7. Capability-based authorization

- Authorization is by capability, not reviewer role. Adding a "if reviewerType === X" gate to bypass a capability check is a bug.
- New actions must declare their required capability in `CAPABILITY_FOR_ACTION`.

### 8. Benchmark coverage required

- New cognition behavior must come with a benchmark scenario (in `lib/framework/src/benchmarks/`).
- New security behavior must come with a security benchmark scenario.

### 9. Mutation guards required

- Append-only artifacts (audit entries, signed actions, visibility history) must remain append-only.
- Returned references must be unmutable (frozen) or copies.

### 10. Replayability preserved

- Anyone with the inputs must be able to replay the framework to the same state. If your change breaks replay, it must add a deterministic migration path.

## How to contribute

### Workflow

1. Open an issue first for non-trivial changes. Use the appropriate issue template.
2. Fork, branch, and implement.
3. Run the full local check:
   ```bash
   pnpm run typecheck
   pnpm benchmark:cognition
   pnpm test:cognitive-smoke
   ```
4. If your change affects the HTTP contract, regenerate:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
5. Open a PR using the PR template. Be explicit about which invariants your change touches and how you preserved them.

### Commit messages

- Imperative, specific, and module-scoped: `security: derive required capability from action in AccessDecisionEngine`.
- No emoji prefixes. No `chore:` for substantive changes.

### Snapshots

- The cognition snapshot (`tests/cognitive-smoke/snapshot.json`) is intentional. If you regenerate it, your PR description must explain *why* the output changed.
- Snapshot updates without a corresponding cognition or schema change will be rejected.

## Contribution paths

### Adding an agent

1. Place it under `lib/framework/src/agents/<area>/` with its own module folder.
2. Declare a manifest: `{ id, role, capabilities, defaultProvider }`.
3. Register it in the agent registry.
4. Add a benchmark scenario that exercises its decision path.
5. Update the relevant console page if the agent surfaces a new artifact kind.

### Adding a skill

1. Skills live under `lib/framework/src/skills/<category>/`.
2. Declare inputs → outputs as typed interfaces. No `any`.
3. Skills must be pure with respect to their inputs + `now`.
4. Wire it into the skill registry.

### Adding an ingestion adapter

1. Adapters live under `lib/framework/src/ingestion/adapters/`.
2. Adapters must:
   - declare a source kind,
   - produce normalized signals with provenance,
   - declare a reliability profile (or compute one),
   - never silently drop ambiguous inputs — write a conflict entry instead.
3. Add a benchmark scenario that ingests a synthetic payload through your adapter.

### Adding a cognition module

1. Place it under `lib/framework/src/cognition/`.
2. Cognition modules consume signals and produce signals — never side-effects.
3. Disagreement must be preserved through your module, not collapsed.
4. Update the snapshot manifest; provide a justification in the PR.

### Adding a security capability or action

1. Add the capability to `Capability` in `security/types.ts`.
2. Add the action to `AccessAction` and map it in `CAPABILITY_FOR_ACTION`.
3. Update default capability bundles in `DEFAULT_CAPABILITIES_BY_TYPE` only if the new capability is broadly applicable; otherwise leave it explicit.
4. Add a benchmark scenario that asserts denial for a reviewer without the capability.

### Adding a benchmark

1. Cognition benchmarks: `lib/framework/src/benchmarks/corpus.ts` (scenarios) + `lib/framework/src/benchmarks/` (harness). The committed snapshot lives at `tests/cognitive-smoke/snapshot.json`.
2. Security benchmarks: `lib/framework/src/security/benchmarks.ts`.
3. Each scenario must be:
   - synthetic (no real data),
   - deterministic (same inputs → same outputs),
   - documented (what it asserts and why).

### Adding a collaboration flow

1. Place it under `lib/framework/src/collaboration/`.
2. Disagreement and consensus must remain inspectable; do not merge dissent silently.

## Code style

- TypeScript strict mode, `noImplicitAny`, `noUncheckedIndexedAccess`.
- NodeNext module resolution. Imports include the `.js` extension.
- No `console.log` in server code. Use `req.log` in route handlers and the singleton `logger` elsewhere.
- Prefer named exports. Prefer interfaces over type aliases for public shapes.
- Keep files small. Split out subengines into their own modules.

## Reviewing PRs (for maintainers)

Reject if:

- Any invariant above is weakened or worked around.
- Snapshots changed without justification.
- Authorization added through reviewer-type rather than capability.
- New mutable references returned from append-only structures.
- New code lacks provenance on its artifacts.
- New cognition path lacks a benchmark scenario.

## Code of Conduct

By contributing you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
