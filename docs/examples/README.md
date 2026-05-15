# Examples

The framework ships with **10 deterministic scenarios** that double as both worked examples and the cognition benchmark suite. They live in `lib/framework/src/benchmarks/corpus.ts` and run with:

```bash
pnpm benchmark:cognition
```

Each scenario is a synthetic candidate world — input evidence, organization context, expected cognition behavior, and a committed snapshot of the output.

## Scenario index

| Scenario | What it stresses | Expected cognition behavior |
|---|---|---|
| `inflated_senior` | Strong surface credentials, weak trajectory evidence | Trajectory > pedigree weighting; lower confidence than the surface suggests; investigation opened. |
| `founder_builder` | Non-traditional path with high agency signals | High agency recognized; org-context-dependent fit recommendation. |
| `plateaued_staff` | Long tenure, flat scope growth | Trajectory inflection detected; reduced fit confidence for growth-stage roles. |
| `elite_ic` | High technical depth, deliberate IC choice | Fit reasoning honors IC preference; not pushed toward management role family. |
| `high_variance_candidate` | Conflicting strong/weak signals | Disagreement preserved; consensus record with explicit dissent. |
| `ambiguous_generalist` | Wide skills, unclear depth | Uncertainty fusion produces low confidence; investigation opened. |
| `fake_oss_signal` | Inflated open-source contribution | Adversarial probe refutes the surface signal; calibration delta applied to the producing source. |
| `chaos_thriver` | Performs in unstructured environments, weak in structured | Fit recommendation is org-context-dependent; warned against process-heavy org. |
| `process_dependent_operator` | Inverse of `chaos_thriver` | Fit recommendation is org-context-dependent; warned against early founder-mode org. |
| `underestimated_junior` | Junior with high-leverage signals | Calibration corrects pedigree under-weighting; supports investigation. |

## What each scenario contains

Each scenario file declares:

```ts
{
  id: "founder_builder",
  evidence: [/* ingested signals */],
  organization: { /* org context */ },
  reviewers: [/* reviewer identities + capabilities */],
  expected: {
    snapshot: "<reference output>",
    guards: ["determinism", "provenance", "calibration", "snapshot", "guards"],
    disagreements: [/* expected disagreement records */],
    escalations: [/* expected investigations opened */],
  }
}
```

Running the suite confirms every guard. A failing guard means the framework drifted; either the change was intentional (regenerate the snapshot with `benchmark:cognition:update`) or it's a regression.

## Reading a scenario in the console

When the API server runs, it bootstraps with a curated subset of scenarios as seed data. Open the console and walk through:

1. **Ingestion** — see the evidence that came in for the scenario.
2. **Cognition** — see the multi-agent synthesis. Note where signals overlap and where they disagree.
3. **Organization** → fit engine — see the fit assessment with its supporting subgraph.
4. **Operations** — if the scenario warrants an investigation, you'll find it here with hypotheses + adversarial probes.
5. **Evaluation** — see how the scenario's outcome (if any) updated calibration.
6. **Reports** — see the synthesized intelligence brief.
7. **Security** → audit timeline — every step above produced audit entries; you can replay them.

## Adding a scenario

Add new scenarios to `lib/framework/src/benchmarks/corpus.ts`. See [../../CONTRIBUTING.md#adding-a-benchmark](../../CONTRIBUTING.md#adding-a-benchmark). A new scenario:

- must be synthetic — no real candidate data, ever,
- must be deterministic — same inputs → same outputs,
- must declare its expected guards,
- must come with a committed snapshot.
