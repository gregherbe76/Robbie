# Benchmarks

> The benchmark **implementations** live next to the framework:
>
> - **Cognition suite** — scenarios in `lib/framework/src/benchmarks/corpus.ts`, harness in `lib/framework/src/benchmarks/`, runner in `scripts/src/benchmark-cognition.ts`, snapshot at `tests/cognitive-smoke/snapshot.json`.
> - **Security suite** — `lib/framework/src/security/benchmarks.ts`.
>
> This directory is the manifest + reproducibility guide.

## Run

```bash
# Cognition benchmark — 10 scenarios, 5 guard categories.
pnpm benchmark:cognition

# Cognition smoke variant — same scenarios, CI-friendly.
pnpm test:cognitive-smoke

# Security benchmark — 8 denial scenarios. Visible via:
curl -s localhost:80/api/security/snapshot/<orgId> | jq '.benchmarkResults'
```

## Manifest

### Cognition scenarios (10)

| Id | Cognitive challenge |
|---|---|
| `inflated_senior` | Strong surface credentials, weak trajectory evidence. |
| `founder_builder` | Non-traditional path, high agency signals. |
| `plateaued_staff` | Long tenure, flat scope growth. |
| `elite_ic` | High technical depth, deliberate IC choice. |
| `high_variance_candidate` | Conflicting strong/weak signals. |
| `ambiguous_generalist` | Wide skills, unclear depth. |
| `fake_oss_signal` | Inflated open-source contribution. |
| `chaos_thriver` | Thrives in unstructured environments. |
| `process_dependent_operator` | Thrives in structured environments. |
| `underestimated_junior` | Pedigree under-weighting. |

### Cognition guards (5)

| Guard | Assertion |
|---|---|
| `determinism` | Two runs → byte-identical outputs. |
| `provenance` | Every artifact has a complete provenance chain. |
| `calibration` | Reviewer / agent calibration stays within band. |
| `snapshot` | Output matches the committed reference. |
| `guards` | Mutation guards hold (frozen audit, refused cross-org, capability-mismatch denial). |

### Security scenarios (8)

| Id | Denied by |
|---|---|
| `cross_org_access_attempt` | Organization boundary rule. |
| `unauthorized_escalation_access` | Capability rule (missing `escalate_case`). |
| `override_without_capability` | Capability rule (missing `override_recommendation`). |
| `visibility_leakage` | Visibility rule (wrong investigation scope). |
| `benchmark_contamination` | Capability rule (missing `create_public_benchmark`). |
| `reviewer_impersonation` | Identity rule (reviewer/org mismatch). |
| `sensitive_evidence_access` | Capability rule (missing `view_sensitive_evidence`). |
| `hidden_audit_mutation` | Capability rule (missing `manage_org_memory`). |

## Deterministic guarantees

- **Same inputs → same outputs.** Time is an argument; IDs are derived; iteration is stable; serialization is canonical.
- **Same inputs → same audit sequence numbers.** The audit trail is part of the reproducibility contract.
- **Snapshots are intentional.** They change only via `pnpm benchmark:cognition:update`, with a justification in the PR description.
- **No external dependencies.** Benchmarks must not depend on network access, file-system mutation outside the snapshot directory, or the wall clock.

## Mutation guards

The cognition suite's `guards` category asserts a small but critical set of mutation invariants that exist outside any single scenario:

1. **Audit entries are deep-frozen on append.** Attempts to mutate `detail` or any field on a returned audit entry fail.
2. **Cross-org reads are refused at the access engine boundary.** No silent allow path exists; all carve-outs are explicit and audited.
3. **Capability tokens are derived from action server-side.** The benchmark suite probes this directly by submitting `(action, weakerCapability)` pairs and asserting denial.
4. **Visibility history is append-only.** Previous levels are recoverable; the engine refuses overwriting paths.

## When a benchmark fails

| Failure mode | What it means | What to do |
|---|---|---|
| `determinism=fail` | Two runs produced different outputs. Likely cause: `Math.random`, `Date.now`, unstable Map iteration, or non-canonical serialization slipped in. | Trace the diff; restore determinism before merging. |
| `provenance=fail` | An artifact has no producer or a broken `derivedFrom` chain. | Find the producer call site; add provenance. Reject the PR if provenance was deliberately dropped. |
| `calibration=fail` | Reviewer / agent calibration drifted out of band. | Either intentional (justify in PR; update band + scenario) or a regression in the evaluation layer. |
| `snapshot=fail` | The committed snapshot differs from the new output. | If intentional: `pnpm benchmark:cognition:update` and explain. If not: revert the change that caused the drift. |
| `guards=fail` | A mutation invariant was violated. | Almost always a serious bug. Fix before merging. |
| Security scenario `expected=access_denied actual=access_allowed` | The access engine allowed a denial path. | Severe — investigate immediately. |
| Security scenario `auditEntryIds=[]` on a denial | The denial path did not produce an audit entry. | The benchmark is no longer running through the audited engine path; restore wiring. |

## Adding benchmarks

See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-benchmark).
