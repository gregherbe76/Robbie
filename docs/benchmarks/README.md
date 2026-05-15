# Benchmarks

Benchmarks in this framework are not accuracy leaderboards. They are **reproducibility contracts**: deterministic scenarios that describe the framework's committed behavior. A failing benchmark means behavior drifted, not that a model got smarter.

There are two suites:

1. **Cognition benchmarks** — exercise the framework's reasoning end-to-end across synthetic candidate scenarios.
2. **Security benchmarks** — exercise the central `AccessDecisionEngine` across denial paths.

## Cognition benchmark suite

Source: scenarios in `lib/framework/src/benchmarks/corpus.ts`, harness in `lib/framework/src/benchmarks/`. Runner: `scripts/src/benchmark-cognition.ts`. Committed reference snapshot: `tests/cognitive-smoke/snapshot.json`.

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

### Guard categories

| Guard | Assertion |
|---|---|
| **determinism** | Two runs over the same world produce byte-identical outputs. Cognition is a pure function of `(world, inputs, now)`. |
| **provenance** | Every produced signal, memory entry, and report carries a complete provenance chain. No anonymous producers. |
| **calibration** | Reviewer calibration weights stay within the documented band for the scenario. Drift is a regression. |
| **snapshot** | Generated reports match the committed reference snapshot. Diffs require intentional `benchmark:cognition:update`. |
| **guards** | Mutation guards hold — frozen audit entries, refused cross-org reads, capability-mismatch denials. |

### Scenarios

| Scenario | What it stresses |
|---|---|
| `inflated_senior` | Strong surface credentials, weak trajectory evidence. Tests trajectory > pedigree weighting. |
| `founder_builder` | Non-traditional path with high agency signals. Tests evidence-density reasoning. |
| `plateaued_staff` | Long tenure, flat scope growth. Tests trajectory inflection detection. |
| `elite_ic` | High technical depth, deliberate IC choice. Tests fit reasoning against role family. |
| `high_variance_candidate` | Conflicting strong/weak signals. Tests disagreement preservation. |
| `ambiguous_generalist` | Wide skills, unclear depth. Tests uncertainty fusion when evidence is thin. |
| `fake_oss_signal` | Inflated open-source contribution. Tests adversarial probes against evidence inflation. |
| `chaos_thriver` | Strong performance in unstructured environments, weak in structured. Tests org-context-dependent fit. |
| `process_dependent_operator` | Inverse of chaos_thriver. Tests the same with reversed org context. |
| `underestimated_junior` | Junior with high-leverage signals. Tests calibration against pedigree under-weighting. |

### Updating snapshots

Snapshots are **not** auto-updated. If your change is supposed to alter cognition output:

```bash
pnpm benchmark:cognition:update
```

…then commit the regenerated snapshot alongside your code change. The PR description must explain why the output diff is intentional.

### Smoke variant

```bash
pnpm test:cognitive-smoke
```

Same scenarios, faster invocation, suitable for pre-merge CI gating.

## Security benchmark suite

Source: `lib/framework/src/security/benchmarks.ts`. Runs as part of API server bootstrap; results are visible at `/api/security/snapshot/<orgId>` and on the console Security page.

Eight deterministic scenarios, all expected to be denied by the access engine:

| Scenario | Denied by |
|---|---|
| `cross_org_access_attempt` | Organization boundary rule |
| `unauthorized_escalation_access` | Capability rule — missing `escalate_case` |
| `override_without_capability` | Capability rule — missing `override_recommendation` |
| `visibility_leakage` | Visibility rule — wrong investigation scope |
| `benchmark_contamination` | Capability rule — missing `create_public_benchmark` |
| `reviewer_impersonation` | Identity rule — reviewer/org mismatch |
| `sensitive_evidence_access` | Capability rule — missing `view_sensitive_evidence` |
| `hidden_audit_mutation` | Capability rule — missing `manage_org_memory` |

Every scenario is run through the audited `SecurityEngine.checkAccess`, so each result includes the audit entry IDs that were produced. Empty `auditEntryIds` on a denial scenario is a regression.

## Reproducibility guarantees

The framework asserts:

- **Identical inputs → identical outputs.** Same seed → same snapshot bytes.
- **Identical inputs → identical audit sequence numbers.** The audit trail is part of the reproducibility contract.
- **Snapshot diffs are intentional.** No snapshot field changes silently between runs.
- **No external dependencies during benchmark runs.** Benchmarks must not depend on network, file system mutation, or the wall clock.

## Adding a benchmark

See [../../CONTRIBUTING.md#adding-a-benchmark](../../CONTRIBUTING.md#adding-a-benchmark).

A new cognition scenario must:

- be synthetic (no real data),
- include the expected snapshot,
- specify which guards it stresses (e.g. "this scenario specifically exercises calibration drift on under-weighted juniors"),
- pass the same five-guard assertion the rest of the suite passes.

A new security scenario must:

- target a specific rule in the access engine,
- produce a non-empty `auditEntryIds` on denial,
- not duplicate an existing scenario's denial path.
