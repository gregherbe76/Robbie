/**
 * Example 3 — Capability check + audit.
 *
 * Demonstrates capability-based authorization: a reviewer with the
 * `review_evidence` capability is allowed to read an evidence resource,
 * but the same reviewer is refused when they try to read a resource
 * scoped to a different organization. Every check produces an audit
 * entry through the audited SecurityEngine.checkAccess path.
 *
 * Run from repo root:
 *
 *   pnpm --filter @workspace/examples run security-audit
 */

import { SecurityEngine } from "@robbie/framework/security";

const T0 = "2026-05-15T08:00:00.000Z";
const T1 = "2026-05-15T08:05:00.000Z";
const T2 = "2026-05-15T08:10:00.000Z";

const engine = new SecurityEngine();

// Two orgs (multi-tenant isolation will refuse cross-org reads).
const orgA = engine.registerOrganization({ displayName: "Stellaris Talent", tier: "growth", now: T0 });
const orgB = engine.registerOrganization({ displayName: "Northwind Hiring", tier: "founder", now: T0 });

// A reviewer in org A, with only `review_evidence` capability.
const reviewer = engine.registerReviewer({
  organizationId: orgA.organizationId,
  reviewerType: "technical_reviewer",
  displayName: "Probe Reviewer",
  capabilities: ["review_evidence"],
  now: T0,
});

// A resource in org A, and a resource in org B.
engine.registerResource({
  resourceId: "case_org_a_001",
  resourceKind: "case",
  organizationId: orgA.organizationId,
  visibilityScope: "organization",
  initialVisibility: "organization_private",
  createdBy: reviewer.reviewerId,
  reason: "Same-org case for the probe reviewer.",
  now: T1,
});
engine.registerResource({
  resourceId: "case_org_b_001",
  resourceKind: "case",
  organizationId: orgB.organizationId,
  visibilityScope: "organization",
  initialVisibility: "organization_private",
  createdBy: reviewer.reviewerId, // wrong-org probe — engine will refuse access below
  reason: "Other-org case, used to probe the cross-org boundary.",
  now: T1,
});

const session = engine.openSession(reviewer.reviewerId, orgA.organizationId, T2);

// 1. Same-org read with a matching capability → allowed.
const allowed = engine.checkAccess({
  reviewerId: reviewer.reviewerId,
  organizationId: orgA.organizationId,
  targetResourceId: "case_org_a_001",
  targetOrganizationId: orgA.organizationId,
  targetVisibility: "organization_private",
  action: "read",
  requiredCapability: "review_evidence",
  sessionId: session.sessionId,
  now: T2,
});

// 2. Cross-org read — engine refuses at the organization-boundary rule.
const denied = engine.checkAccess({
  reviewerId: reviewer.reviewerId,
  organizationId: orgA.organizationId,
  targetResourceId: "case_org_b_001",
  targetOrganizationId: orgB.organizationId,
  targetVisibility: "organization_private",
  action: "read",
  requiredCapability: "review_evidence",
  sessionId: session.sessionId,
  now: T2,
});

function show(label: string, d: typeof allowed): void {
  console.log(`\n--- ${label} ---`);
  console.log(`allowed: ${d.allowed}`);
  console.log(`reason:  ${d.reason}`);
  console.log(`rules evaluated:`);
  for (const r of d.evaluatedRules) {
    console.log(`  - ${r.rule}: ${r.passed ? "pass" : "fail"} (${r.detail})`);
  }
}

show("Same-org read", allowed);
show("Cross-org read", denied);

// 3. Append-only audit trail. Every checkAccess produced an entry with a
//    monotonic per-org sequence number, frozen on append.
const audit = engine.listAudit(orgA.organizationId);
console.log(`\n--- Audit trail (${audit.length} entries in org A) ---`);
for (const entry of audit) {
  console.log(`  #${entry.sequence} ${entry.kind} → ${entry.targetResource}`);
}
