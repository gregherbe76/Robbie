# Cognition

The `cognition` module is the framework's cross-agent reasoning layer. It takes signals from multiple agents and produces synthesized artifacts — without collapsing the underlying disagreement.

## Files

- `synthesize.ts` — multi-agent synthesis pipeline.
- `disagreement.ts` — disagreement detection and preservation.
- `uncertainty_fusion.ts` — combining confidences across overlapping signals.
- `reconciliation.ts` — reconciling apparent contradictions when warranted; otherwise preserving them.
- `influence_engine.ts` — modeling how agents influence each other within a workflow.
- `cross_agent_memory.ts` — shared memory surface across cognitive agents.
- `types.ts` — public types.

## Key principles

### Disagreement is preserved

When two agents produce signals with overlapping subject + conflicting value, the framework does not "pick one" by averaging. The synthesis output records:

- both signals,
- their confidences,
- their provenance,
- a `DisagreementRecord` that downstream consumers (the console, the evaluation layer) can inspect.

Reconciliation is only invoked when the conflict is *structural* (one signal supersedes the other based on evidence freshness, source reliability, or explicit retraction). When reconciliation is not warranted, the conflict survives.

### Uncertainty is fused, not collapsed

Combining confidences uses an explicit fusion rule rather than a generic average. The fusion rule depends on the kind of signal:

- Independent observations of the same subject: confidences combine using a documented rule (see `uncertainty_fusion.ts`).
- Same-source restatements: deduplicated rather than fused.
- Adversarial counter-signals from the operations layer: tracked as separate evidence streams.

The point is that confidence combination is **explicit and inspectable**, not a hidden heuristic.

### Influence is observable

When agents are run in a workflow, an upstream agent's output may inform a downstream agent's prompt. The `influence_engine` records which agent's signals informed which downstream signal, so the lineage is recoverable later.

### Memory is scoped

The cognition layer reads and writes through `memory/`, which is scoped (`candidate | organization | role | global`). The cognition module never bypasses the scope; cross-scope reads are explicit, audited operations.

## Console view

The Cognition page surfaces:

- Recent synthesized artifacts with confidence and provenance.
- Active disagreement records, grouped by subject.
- Influence chains for the most recent workflow runs.
- Fusion decisions with the rule that was applied.

## Benchmark coverage

Cognition behavior is covered by the deterministic benchmark suite. Each scenario asserts:

- The synthesized output is byte-identical across runs.
- Every signal produced has a complete provenance chain.
- Calibration weights stay within band.
- The committed snapshot matches.

See [../benchmarks/](../benchmarks/).
