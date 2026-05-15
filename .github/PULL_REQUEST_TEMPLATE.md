<!--
Thanks for sending a PR.

Read CONTRIBUTING.md before opening this PR. PRs that weaken the framework's
invariants (determinism, provenance, explicit uncertainty, capability-based
authorization, append-only audit, multi-tenant isolation, benchmark coverage)
will not be merged regardless of feature appeal.
-->

## Summary

<!-- One paragraph. What does this PR do? -->

## Motivation

<!-- Why is this change worth making? Link the issue or proposal it implements. -->

## Modules touched

- [ ] cognition
- [ ] ingestion
- [ ] organization_intelligence
- [ ] evaluation
- [ ] intelligence_operations
- [ ] collaboration
- [ ] security
- [ ] agents / skills / providers
- [ ] memory / orchestrator / workflows
- [ ] candidate_graph / organization_graph
- [ ] reports / registry
- [ ] benchmarks
- [ ] api-server
- [ ] console
- [ ] OpenAPI / generated client / generated zod
- [ ] tooling / scripts / CI

## Invariants

How does this PR preserve each framework invariant it touches?

- **Determinism**:
- **Provenance**:
- **Explicit uncertainty**:
- **Capability-based authorization**:
- **Append-only audit**:
- **Multi-tenant isolation**:
- **No ATS / black-box scoring**:

## Benchmark impact

- [ ] Does not affect benchmark output.
- [ ] Affects benchmark output. Snapshot regenerated **intentionally** with `pnpm benchmark:cognition:update`. Justification:

<!-- If snapshots changed, summarise the diff and why it is correct. -->

## Verification

- [ ] `pnpm run typecheck`
- [ ] `pnpm benchmark:cognition`
- [ ] `pnpm test:cognitive-smoke`
- [ ] If OpenAPI changed: `pnpm --filter @workspace/api-spec run codegen`

## Breaking changes

- [ ] No breaking changes.
- [ ] Breaking changes (described below + CHANGELOG entry under Unreleased).

## Additional context

<!-- Anything reviewers should know. Screenshots for console changes welcome. -->
