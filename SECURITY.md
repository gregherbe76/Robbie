# Security

This document covers (a) how to report a vulnerability, (b) what the framework guarantees today, and (c) what is explicitly *not* yet guaranteed.

## Reporting a vulnerability

If you believe you have found a security issue in this framework, **do not open a public issue**. Instead:

1. Email the maintainers at `security@<project-domain>` (or use GitHub's private vulnerability reporting if enabled).
2. Include a description, reproduction steps, and the scope of impact you observed.
3. We aim to acknowledge within 72 hours and provide a remediation timeline within 7 days for confirmed issues.
4. Please give us a reasonable window (typically 30–90 days, depending on severity) to remediate before any public disclosure.

We do not currently run a paid bounty program. Coordinated disclosure is acknowledged in the changelog (with your permission) and in release notes.

### Out of scope

- Issues in dependencies that are already publicly tracked (open an issue if the framework should pin to a fixed version).
- Findings against the **demo dataset**, which is synthetic and intentional.
- Self-XSS in the console caused by pasting attacker-controlled scripts into the developer tools.

## Privacy posture

- **Demo datasets are synthetic.** No real candidate or employee data ships in this repository. All names, roles, and notes in the seed are invented for illustration.
- The framework's runtime does not phone home, does not emit telemetry by default, and does not include analytics SDKs.
- The reference setup runs entirely **local-first** — no external API keys are required for the skeleton to operate.
- If you plug in an LLM provider (OpenAI, Anthropic, custom), the framework's provider abstraction makes the call surface explicit. Per-call inputs/outputs are visible in logs.

### Working with real candidate data

If you deploy this framework with real candidate data, you take on the operational responsibility for that data. The framework helps you, but it does not absolve you:

- Treat ingested evidence as PII unless proven otherwise.
- Configure the security layer's visibility levels deliberately; do not store sensitive evidence at `organization_private` if it should be `escalation_only`.
- Audit data is append-only inside the framework, but you are responsible for backups, retention policies, and lawful-access procedures.
- The framework does not currently enforce data residency. If your deployment requires it, you must enforce it at the infrastructure layer.

## Provenance guarantees

The framework asserts and enforces these provenance properties:

1. Every signal, memory entry, report, access decision, and audit entry carries a producer (agent / reviewer / ingestion adapter).
2. Lineage is recursive: derived signals reference the signals they were derived from. The audit trail is the root of trust.
3. Provenance is not editable. There is no "amend" path for audit entries; corrections are appended.
4. Audit entries are deep-frozen on append. Mutation attempts via returned references are rejected by the runtime.

## Auditability guarantees

- Per-organization audit sequence numbers are monotonic; missing sequence numbers are detectable.
- Every access decision passes through the central `AccessDecisionEngine` and is recorded with its full rule trace (which rule passed, which failed, with what reason).
- Sensitive-evidence views produce a dedicated audit entry linked back to the evidence record.
- Visibility changes are append-only history; previous levels are recoverable.

## Authorization guarantees

- Authorization is **capability-based**, not reviewer-type-based. Reviewer types have default capability bundles but no implicit "founder bypass."
- Required capabilities are derived from the action server-side. Caller-supplied capability tokens that don't match the action are rejected before evaluation.
- Sessions are validated on every privileged action: existence, reviewer match, organization match, not-closed.

## Multi-tenant isolation

- Every protected resource carries an `organizationId`.
- Cross-organization reads are refused at the boundary unless the resource is explicitly tagged for a shared carve-out (`global_demo`, `global_benchmark`).
- Carve-outs are themselves audited.

## What the framework does NOT yet guarantee

Be explicit about gaps; do not deploy as if they were closed.

| Area | Current state | Plan |
|---|---|---|
| **At-rest encryption** | The reference runtime stores in-memory. No encryption-at-rest hooks. | See the Postgres adapter milestone in [ROADMAP.md](./ROADMAP.md). |
| **Transport encryption** | The skeleton does not terminate TLS. Deploy behind a TLS-terminating proxy. | Out of scope for the skeleton. |
| **Authentication of human reviewers** | Reviewer identity is deterministic but not authenticated. The skeleton trusts the API caller. | Pluggable auth (OIDC, Replit Auth) is a near-term priority. |
| **Rate limiting / DoS protection** | None at the framework layer. | Deploy behind a rate-limiting reverse proxy. |
| **Provider-side data handling** | Outside the framework's control. The framework gives you observability of provider calls. | Reference policy adapters planned. |
| **Replay defense** | Sessions chain signed actions; idempotency keys collapse duplicates. Cross-session replay is not yet enforced at HTTP. | HTTP-level replay defense planned. |
| **Side-channel timing** | No specific timing-attack hardening in the access decision path. | Out of scope until threat model demands it. |

## Future enterprise hardening

These are tracked but not yet shipped:

- Pluggable identity backend with OIDC / SAML adapters.
- Pluggable secret backend (Vault, AWS Secrets Manager).
- Cross-region replication with deterministic conflict resolution.
- Formal threat model under `docs/security/threat-model.md`.
- Third-party security audit before v1.0.

## Reproducing security benchmarks

The framework ships an 8-scenario security benchmark suite that runs through the audited access engine. Reproduce with:

```bash
pnpm --filter @workspace/api-server run dev
curl -s localhost:80/api/security/snapshot/<orgId> \
  | jq '.benchmarkResults[] | {scenarioId, expectedOutcome, actualOutcome, passed}'
```

A scenario can fail in two ways: behavior drift (the actual outcome changed) or environment drift (a benchmark resource is missing). Both are bugs.
