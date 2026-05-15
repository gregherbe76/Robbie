# Examples

The framework's worked examples live in **two places**:

1. **`lib/framework/src/benchmarks/corpus.ts`** — the 10 deterministic cognition scenarios, runnable as the benchmark suite. These are the canonical examples; they are both documentation and CI gates.

2. **`docs/examples/`** — narrative walkthroughs of each scenario for human readers.

To run the examples:

```bash
pnpm benchmark:cognition
```

To read about them:

- [docs/examples/](../docs/examples/) — scenario-by-scenario walkthrough.
- [docs/benchmarks/](../docs/benchmarks/) — the reproducibility contract.

## Scenarios at a glance

| Scenario | Cognitive challenge |
|---|---|
| `inflated_senior` | Strong surface, weak trajectory |
| `founder_builder` | Non-traditional path, high agency |
| `plateaued_staff` | Long tenure, flat scope growth |
| `elite_ic` | Deliberate IC choice |
| `high_variance_candidate` | Conflicting strong / weak signals |
| `ambiguous_generalist` | Wide skills, unclear depth |
| `fake_oss_signal` | Inflated open-source contribution |
| `chaos_thriver` | Thrives in unstructured env |
| `process_dependent_operator` | Thrives in structured env |
| `underestimated_junior` | Pedigree under-weighting |

Each scenario is synthetic. No real candidate data ships in this repository.

## Adding your own example

The right place to add an example is `lib/framework/src/benchmarks/corpus.ts` — write it as a benchmark scenario so it runs in CI alongside the others. See [CONTRIBUTING.md → Adding a benchmark](../CONTRIBUTING.md#adding-a-benchmark).
