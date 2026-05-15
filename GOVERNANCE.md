# Governance

This document describes how the project is governed: who decides what, how disagreements are resolved, and what the maintainers will and will not accept.

## Project values

The maintainers commit to the framework's invariants above all features:

1. Deterministic execution.
2. Mandatory provenance.
3. Explicit uncertainty.
4. Capability-based authorization.
5. Append-only audit.
6. Multi-tenant isolation.
7. Benchmark coverage for behavior changes.
8. No ATS, no black-box scoring, no hidden inference.

A feature that requires weakening one of these will not be merged, regardless of how popular the use case is. The maintainers reserve the right to decline contributions that fight the framework's nature.

## Roles

### Contributor

Anyone who opens an issue, sends a PR, writes documentation, files a benchmark scenario, or participates in discussions. Contributors agree to the [Code of Conduct](./CODE_OF_CONDUCT.md) and to the contribution standards in [CONTRIBUTING.md](./CONTRIBUTING.md).

### Maintainer

A small group with merge rights. Maintainers are added by consensus of existing maintainers, typically after a sustained record of high-quality contributions across multiple framework modules. Maintainers are listed in `.github/CODEOWNERS`.

Maintainer responsibilities:

- Review PRs against the project values, not just for code correctness.
- Run the benchmark suites locally before approving cognition-affecting PRs.
- Reject snapshot changes that lack a documented justification.
- Maintain the public OpenAPI contract — additive changes preferred, breaking changes called out.
- Cut releases following the release policy below.

### Module steward (optional)

For larger modules (`cognition`, `security`, `evaluation`, `ingestion`), a maintainer may volunteer as the module steward — the first reviewer for PRs touching that module and the primary contact for module-level architectural decisions. Stewardship is optional and documented in `.github/CODEOWNERS`.

## Decision making

### Routine PRs

A single maintainer approval is sufficient for:

- Bug fixes that don't change benchmark output.
- Documentation, examples, CI changes.
- Refactors with zero output diff.

### Cognition-affecting PRs

Require:

- Approval from a maintainer.
- A reviewer-validated explanation of why benchmark snapshots changed (if they did).
- Updated provenance assertions in the affected scenarios.

### Security-layer PRs

Require:

- Approval from a maintainer who is comfortable with the security layer.
- A passing run of the 8-scenario security benchmark suite.
- An explicit statement in the PR description about which invariants were touched (capability derivation, session validation, audit immutability, multi-tenant boundary).

### Architectural changes

Defined as: changes to module boundaries, public framework exports, the OpenAPI contract beyond additive endpoints, or the deterministic execution model. Require:

- A design proposal (use the `cognition_proposal` issue template).
- Open discussion period — minimum 7 days for non-trivial proposals.
- Consensus of at least two maintainers; in case of dispute, the project lead breaks ties.

### Breaking changes pre-1.0

Permitted. Document them in [CHANGELOG.md](./CHANGELOG.md) and call them out in the PR title with a `breaking:` prefix.

## What gets rejected

Beyond the invariants, maintainers will reject:

- **Heuristics dressed as decisions** — undocumented branches in critical paths.
- **Provenance erasure** — code that produces an artifact without a producer, even temporarily.
- **Reviewer-type RBAC re-introduction** — gating an action on `reviewerType === X` instead of a capability check.
- **Audit mutability** — returning mutable references to audit entries, or "amend" semantics on the trail.
- **Benchmark deletion without replacement** — removing a scenario without an equivalent or better one.
- **Snapshot churn** — PRs whose primary effect is to regenerate snapshots.
- **Marketing language in code or docs** — the framework's tone is technical and calm.

## Release policy

- Pre-1.0 releases are tagged `v0.x.y` and may include breaking changes; they are documented.
- Each release is accompanied by an entry in [CHANGELOG.md](./CHANGELOG.md) summarizing cognition, ingestion, collaboration, benchmark, and security milestones.
- Generated artifacts (client, zod) are regenerated and committed at release.
- A release must pass:
  - `pnpm run typecheck`
  - `pnpm benchmark:cognition`
  - `pnpm test:cognitive-smoke`
  - CI green on the release commit.

## Communication

- Architecture discussions: GitHub Discussions or design-proposal issues.
- Bug reports: issues using the `bug_report` template.
- Benchmark regressions: issues using the `benchmark_regression` template.
- Security: see [SECURITY.md](./SECURITY.md).

## Conflicts

Most conflicts are resolved by going back to the invariants. If the invariants do not decide the question, maintainers seek consensus. If consensus is not reached, the project lead decides and documents the rationale in the relevant PR or issue.

## Amending governance

This document is changed by PR. Substantive changes require approval of a majority of maintainers and a minimum 7-day public review period.
