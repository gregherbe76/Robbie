# Security

The security layer is the framework's authorization and audit substrate. Every action that mutates state, reads sensitive evidence, or crosses an organization boundary passes through it.

For the public-facing security posture (disclosure, privacy, guarantees), see [../../SECURITY.md](../../SECURITY.md). This document covers the **layer architecture**.

## Modules

```
lib/framework/src/security/
  types.ts            Public types — Organization, ReviewerIdentity, Capability,
                      VisibilityLevel, AccessDecision, AuditEntry, etc.
  organization.ts     OrganizationBoundaryEngine — registry + ownership map.
  identity.ts         ReviewerIdentityProvider — deterministic identity, fingerprints,
                      capability bundles, calibration identity keys.
  isolation.ts        MultiTenantIsolationLayer — hard cross-org refusal with
                      explicit shared/demo carve-outs.
  visibility.ts       IntelligenceVisibilityEngine — per-resource visibility level
                      with append-only history.
  capabilities.ts     RoleCapabilitySystem — capability tokens, action→capability map.
  audit.ts            SecureAuditTrail — append-only, per-org monotonic sequence,
                      entries frozen on append.
  access.ts           AccessDecisionEngine — 6-rule choke point.
  sensitive.ts        SensitiveEvidenceGuard — redacted views by default, audited
                      privileged reads.
  session.ts          SessionAndActionIntegrityLayer — session opening/closing,
                      signed actions, idempotency, per-session action chain.
  benchmarks.ts       SecurityBenchmarkSuite — 8 deterministic denial scenarios.
  engine.ts           SecurityEngine — public orchestrator over private sub-engines.
  index.ts            Subpath barrel.
```

## The six access rules

`AccessDecisionEngine.decide(req)` evaluates these in order. The first failure short-circuits with a recorded rule trace; allows require all six.

1. **`reviewer_identity`** — the reviewer exists, and `reviewer.organizationId === req.organizationId`. Cross-org reviewer impersonation is refused here.
2. **`organization_boundary`** — the target resource's owning organization matches the caller's, unless the resource is in an explicit carve-out (`global_demo`, `global_benchmark`).
3. **`capability`** — the required capability is derived from `req.action` via `CAPABILITY_FOR_ACTION` server-side. The caller-supplied `requiredCapability` must match; mismatches are rejected as policy-downgrade attempts. The reviewer must hold the capability.
4. **`visibility`** — the resource's current visibility level admits the caller. For `escalation_only`, the caller must hold the `escalate_case` capability (no reviewer-type back door).
5. **`escalation_restriction`** — if the action is `escalate`, the caller must hold `escalate_case`. Recorded explicitly so the trace is unambiguous.
6. **`session_integrity`** — for write / privileged actions, the session must exist, belong to the reviewer + organization, and be open. Validated against `SessionAndActionIntegrityLayer`.

Every decision is returned as `AccessDecision` with the full rule list (passed/failed + detail), stored, and audited.

## Capability-based, not RBAC

Capabilities are tokens. Reviewer types have *default capability bundles* for convenience (see `DEFAULT_CAPABILITIES_BY_TYPE`), but the engine never gates on `reviewerType`. To add a new privilege:

1. Add the capability to `Capability`.
2. Add the action it gates to `AccessAction`.
3. Map the action to the capability in `CAPABILITY_FOR_ACTION`.

There is no "founder bypass" path. Founders are reviewers whose default bundle happens to include broad capabilities; an action that requires a capability they don't hold will be denied.

## Audit invariants

- Append-only. There is no `update` or `delete` on audit entries.
- Per-organization sequence numbers are monotonic. A missing sequence is detectable.
- Entries are deep-frozen on append. `Object.freeze` is applied to both `detail` and the entry itself. Returned references cannot be mutated.
- Provenance: every entry references the reviewer who acted (or `null` for system actions); access denials carry the rule trace.

## Visibility levels

| Level | Who can read |
|---|---|
| `organization_private` | Anyone in the owning organization. |
| `investigation_private` | Members of the owning investigation only. |
| `reviewer_private` | The owning reviewer only. |
| `escalation_only` | Holders of `escalate_case` only, within the owning organization. |
| `benchmark_public` | Anyone (global_benchmark carve-out). |
| `demo_public` | Anyone (global_demo carve-out). |

Visibility changes are themselves audited. Previous levels are recoverable through `getVisibility(resourceId).history`.

## Sensitive evidence

`SensitiveEvidenceGuard` enforces a two-view model:

- **Redacted view** — what all callers see by default.
- **Full view** — gated by `view_sensitive_evidence`, and every privileged read appends an audit entry (`sensitive_evidence_view`) linked back to the evidence record.

This means the *fact that someone read sensitive evidence* is itself permanent, auditable history.

## Session integrity

A session is opened for a reviewer + organization. Signed actions carry:

- the session id,
- the payload hash,
- a deterministic signature derived from `(sessionId, reviewerId, payloadHash, now)`,
- an idempotency key.

Per-session action chains fold each signature into a running hash. A missing or reordered action breaks `verifyChain`. Duplicate writes with the same idempotency key collapse to the original action.

## Benchmarks

The 8-scenario security benchmark runs through `SecurityEngine.checkAccess` (the audited path), so every result includes the audit entries it produced. See [../benchmarks/](../benchmarks/).

## Operating the security layer

- **Console** → Security page. Eight sections: org boundaries, reviewer identities, capability explorer, visibility graph, access decision inspector with per-rule trace, sensitive evidence viewer, audit timeline with sequence numbers, security benchmark panel.
- **HTTP** → `/api/security/snapshot/<orgId>`, `/api/security/access-log/<orgId>`, `/api/security/reviewer/<reviewerId>`, `/api/security/check-access`, `/api/security/visibility/<resourceId>`, `/api/security/change-visibility`, `/api/security/audit/<orgId>`.

## What the layer does NOT do

- Authenticate human reviewers — reviewer identity is deterministic, not authenticated. Plug in OIDC / SAML / Replit Auth in the runtime layer above.
- Encrypt at rest — the reference runtime is in-memory.
- Rate-limit requests — deploy behind a rate-limiting proxy.
- Defend against side-channel timing attacks — out of scope until the threat model demands it.

See [../../SECURITY.md](../../SECURITY.md) for the full posture and the gap table.
