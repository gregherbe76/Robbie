/**
 * Bootstraps the security layer with deterministic sample data. Two organizations,
 * a roster of reviewers with varied capabilities, a portfolio of resources at
 * different visibility levels, sensitive evidence records, an open session, and
 * a full run of the eight-scenario benchmark suite.
 */

import {
  SecurityEngine,
  type BenchmarkContext,
} from "@workspace/framework/security";

const T0 = "2026-05-15T08:00:00.000Z";
const T1 = "2026-05-15T08:05:00.000Z";
const T2 = "2026-05-15T08:10:00.000Z";
const T3 = "2026-05-15T08:15:00.000Z";
const T4 = "2026-05-15T08:20:00.000Z";
const T5 = "2026-05-15T08:25:00.000Z";
const T6 = "2026-05-15T08:30:00.000Z";
const T_BENCH = "2026-05-15T08:35:00.000Z";

let engine: SecurityEngine | null = null;
let benchmarkCtx: BenchmarkContext | null = null;
let primaryOrgId = "";
let secondaryOrgId = "";

function seed(): SecurityEngine {
  const e = new SecurityEngine();

  // ---- Orgs ---------------------------------------------------------------
  const primary = e.registerOrganization({
    displayName: "Stellaris Talent",
    tier: "growth",
    now: T0,
  });
  const secondary = e.registerOrganization({
    displayName: "Northwind Hiring",
    tier: "founder",
    now: T0,
  });
  primaryOrgId = primary.organizationId;
  secondaryOrgId = secondary.organizationId;

  // ---- Reviewers ----------------------------------------------------------
  const founder = e.registerReviewer({
    organizationId: primary.organizationId,
    reviewerType: "founder",
    displayName: "Dani Patel",
    now: T0,
  });
  const recruiter = e.registerReviewer({
    organizationId: primary.organizationId,
    reviewerType: "recruiter",
    displayName: "Maya Cho",
    now: T0,
  });
  const techReviewer = e.registerReviewer({
    organizationId: primary.organizationId,
    reviewerType: "technical_reviewer",
    displayName: "Ravi Subramaniam",
    now: T0,
  });
  const hiringManager = e.registerReviewer({
    organizationId: primary.organizationId,
    reviewerType: "hiring_manager",
    displayName: "Olu Adesanya",
    now: T0,
  });
  const externalReviewer = e.registerReviewer({
    organizationId: primary.organizationId,
    reviewerType: "external_reviewer",
    displayName: "Priya Iyer (external panel)",
    now: T0,
    scopedToInvestigationId: "inv_ada_l_staff",
  });
  // Dedicated low-capability reviewer used by the benchmark suite — only
  // `review_evidence`. Has neither escalate_case, override_recommendation,
  // view_sensitive_evidence, create_public_benchmark, nor manage_org_memory,
  // so every denial scenario probes a distinct rule.
  const limited = e.registerReviewer({
    organizationId: primary.organizationId,
    reviewerType: "external_reviewer",
    displayName: "Restricted Probe Reviewer",
    capabilities: ["review_evidence"],
    scopedToInvestigationId: "inv_probe_scope",
    now: T0,
  });
  void recruiter;

  const secondaryFounder = e.registerReviewer({
    organizationId: secondary.organizationId,
    reviewerType: "founder",
    displayName: "Alex Yi",
    now: T0,
  });

  // ---- Resources (cases / evidence / audit slots / benchmarks) -----------
  e.registerResource({
    resourceId: "case_ada_l_staff",
    resourceKind: "case",
    organizationId: primary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "organization_private",
    createdBy: founder.reviewerId,
    reason: "Primary staff engineer review case for Stellaris.",
    now: T1,
  });
  e.registerResource({
    resourceId: "case_sam_k_senior",
    resourceKind: "case",
    organizationId: primary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "investigation_private",
    scopedInvestigationId: "inv_sam_k_senior",
    createdBy: recruiter.reviewerId,
    reason: "Senior engineer investigation; scoped to invited reviewers.",
    now: T1,
  });
  e.registerResource({
    resourceId: "audit_ada_l_staff",
    resourceKind: "audit",
    organizationId: primary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "organization_private",
    createdBy: founder.reviewerId,
    reason: "Audit slot for Ada L. staff engineer case.",
    now: T1,
  });
  e.registerResource({
    resourceId: "override_ada_l_staff",
    resourceKind: "override",
    organizationId: primary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "escalation_only",
    createdBy: founder.reviewerId,
    reason: "Founder override on Ada L. — escalation-only by policy.",
    now: T2,
  });
  e.registerResource({
    resourceId: "evidence_ada_l_reference",
    resourceKind: "evidence",
    organizationId: primary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "escalation_only",
    createdBy: founder.reviewerId,
    reason: "Sensitive reference call summary.",
    now: T2,
  });
  e.registerResource({
    resourceId: "evidence_ada_l_comp_note",
    resourceKind: "evidence",
    organizationId: primary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "founder_only" === "founder_only" ? "escalation_only" : "organization_private",
    createdBy: founder.reviewerId,
    reason: "Compensation note — founder-only sensitivity.",
    now: T2,
  });
  e.registerResource({
    resourceId: "memory_org_calibration",
    resourceKind: "memory",
    organizationId: primary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "organization_private",
    createdBy: founder.reviewerId,
    reason: "Org-private calibration memory.",
    now: T2,
  });
  e.registerResource({
    resourceId: "benchmark_systems_depth_v1",
    resourceKind: "benchmark",
    organizationId: primary.organizationId,
    visibilityScope: "global_benchmark",
    initialVisibility: "benchmark_public",
    createdBy: founder.reviewerId,
    reason: "Public benchmark contributed back to the framework.",
    now: T3,
  });
  e.registerResource({
    resourceId: "demo_walkthrough_case",
    resourceKind: "case",
    organizationId: primary.organizationId,
    visibilityScope: "global_demo",
    initialVisibility: "demo_public",
    createdBy: founder.reviewerId,
    reason: "Demo dataset visible to all observers.",
    now: T3,
  });
  // Secondary org resource (for cross-org boundary tests).
  e.registerResource({
    resourceId: "case_northwind_private",
    resourceKind: "case",
    organizationId: secondary.organizationId,
    visibilityScope: "organization",
    initialVisibility: "organization_private",
    createdBy: secondaryFounder.reviewerId,
    reason: "Secondary org private case.",
    now: T3,
  });

  // ---- Sensitive evidence records ----------------------------------------
  e.registerSensitive({
    evidenceId: "evidence_ada_l_reference",
    organizationId: primary.organizationId,
    sensitivity: "escalation_only",
    redactedSummary:
      "Reference call: [redacted — escalation-only]. Tone of feedback: mixed-positive.",
    fullSummary:
      "Reference call with prior manager at PaymentsCo: candidate shipped consensus repo solo within 4 months; flagged stress tolerance under unclear scope. Manager declined to be quoted.",
    provenance: {
      sourceKind: "reviewer",
      sourceId: founder.reviewerId,
      createdBy: founder.reviewerId,
      createdAt: T2,
    },
  });
  e.registerSensitive({
    evidenceId: "evidence_ada_l_comp_note",
    organizationId: primary.organizationId,
    sensitivity: "founder_only",
    redactedSummary: "Compensation note: [founder-only]. Target band: redacted.",
    fullSummary:
      "Founder note: target offer band L5-L6 equivalent with accelerated equity; floor is non-negotiable per board.",
    provenance: {
      sourceKind: "reviewer",
      sourceId: founder.reviewerId,
      createdBy: founder.reviewerId,
      createdAt: T2,
    },
  });

  // ---- Sessions + access probes ------------------------------------------
  const founderSession = e.openSession(founder.reviewerId, primary.organizationId, T4);
  const limitedSession = e.openSession(limited.reviewerId, primary.organizationId, T4);
  // Cross-org probe (will deny) — populates the access log + audit.
  e.checkAccess({
    reviewerId: secondaryFounder.reviewerId,
    organizationId: secondary.organizationId,
    targetResourceId: "case_ada_l_staff",
    targetOrganizationId: primary.organizationId,
    targetVisibility: "organization_private",
    action: "read",
    requiredCapability: "review_evidence",
    sessionId: null,
    now: T5,
  });
  // Allowed probe — recruiter reads the organization_private case.
  e.checkAccess({
    reviewerId: recruiter.reviewerId,
    organizationId: primary.organizationId,
    targetResourceId: "case_ada_l_staff",
    targetOrganizationId: primary.organizationId,
    targetVisibility: "organization_private",
    action: "read",
    requiredCapability: "review_evidence",
    sessionId: null,
    now: T5,
  });
  // External reviewer attempts to read the investigation-private case for
  // their *own* invited investigation — should pass.
  e.checkAccess({
    reviewerId: externalReviewer.reviewerId,
    organizationId: primary.organizationId,
    targetResourceId: "case_sam_k_senior",
    targetOrganizationId: primary.organizationId,
    targetVisibility: "investigation_private",
    targetInvestigationId: "inv_sam_k_senior",
    action: "read",
    requiredCapability: "review_evidence",
    sessionId: null,
    now: T6,
  });
  // Privileged sensitive view by founder — produces an audited read.
  e.viewSensitive({
    evidenceId: "evidence_ada_l_reference",
    reviewerId: founder.reviewerId,
    organizationId: primary.organizationId,
    sessionId: founderSession.sessionId,
    now: T6,
  });

  // ---- Run the benchmark suite ------------------------------------------
  benchmarkCtx = {
    primaryOrgId: primary.organizationId,
    secondaryOrgId: secondary.organizationId,
    primaryReviewerId: founder.reviewerId,
    secondaryReviewerId: secondaryFounder.reviewerId,
    limitedReviewerId: limited.reviewerId,
    privateResourceId: "case_ada_l_staff",
    investigationScopedResourceId: "case_sam_k_senior",
    investigationId: "inv_sam_k_senior",
    sensitiveResourceId: "evidence_ada_l_reference",
    benchmarkResourceId: "benchmark_systems_depth_v1",
    auditResourceId: "audit_ada_l_staff",
    limitedReviewerSessionId: limitedSession.sessionId,
    now: T_BENCH,
  };
  // Use of unused locals (silence lint when no other reference): touch the
  // primary references that aren't otherwise read.
  void techReviewer;
  void hiringManager;
  e.runBenchmarks(benchmarkCtx);

  return e;
}

export function getSecurityEngine(): SecurityEngine {
  if (!engine) engine = seed();
  return engine;
}

export function getPrimaryOrganizationId(): string {
  if (!engine) engine = seed();
  return primaryOrgId;
}

export function getSecondaryOrganizationId(): string {
  if (!engine) engine = seed();
  return secondaryOrgId;
}

export function getSecurityBenchmarkContext(): BenchmarkContext {
  if (!engine) engine = seed();
  return benchmarkCtx!;
}
