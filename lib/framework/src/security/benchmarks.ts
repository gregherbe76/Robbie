/**
 * SecurityBenchmarkSuite — deterministic security smoke tests that exercise
 * the central AccessDecisionEngine through eight canonical denial scenarios.
 *
 * Each scenario:
 *   - constructs a synthetic AccessRequest,
 *   - submits it through the SecurityEngine's audited `checkAccess` so audit
 *     entries are produced and linked back to the scenario,
 *   - asserts the expected outcome (almost always: access_denied),
 *   - records the decision's id and any audit entries that were generated.
 *
 * Replay: identical input world → identical results.
 */

import type {
  AccessAction,
  AccessDecision,
  AccessRequest,
  Capability,
  SecurityAuditEntry,
  SecurityBenchmarkResult,
  SecurityBenchmarkScenario,
  VisibilityLevel,
} from "./types.js";

export interface BenchmarkContext {
  /** Two orgs preregistered so cross-org tests are meaningful. */
  primaryOrgId: string;
  secondaryOrgId: string;
  /** A reviewer in primaryOrg with broad capabilities (founder). */
  primaryReviewerId: string;
  /** A reviewer in secondaryOrg used as the impersonation/cross-org actor. */
  secondaryReviewerId: string;
  /** A low-capability reviewer in primaryOrg (no override / view_sensitive). */
  limitedReviewerId: string;
  /** Registered resource owned by primaryOrg with `organization_private` visibility. */
  privateResourceId: string;
  /** Registered resource with `investigation_private` visibility. */
  investigationScopedResourceId: string;
  /** Investigation id that owns `investigationScopedResourceId`. */
  investigationId: string;
  /** Sensitive resource in primaryOrg requiring `view_sensitive_evidence`. */
  sensitiveResourceId: string;
  /** Resource with `benchmark_public` visibility used for write-attack probe. */
  benchmarkResourceId: string;
  /** Org-scoped audit-only resource. */
  auditResourceId: string;
  /** Open session for the limited reviewer; used to satisfy session rule on
   *  scenarios that still need to reach later rules (e.g. capability denial). */
  limitedReviewerSessionId: string;
  now: string;
}

export interface SecurityBenchmarkScenarioSpec {
  id: SecurityBenchmarkScenario;
  displayName: string;
  description: string;
  expected: "access_denied" | "access_allowed";
  buildRequest: (ctx: BenchmarkContext) => AccessRequest;
}

export const SECURITY_BENCHMARK_SCENARIOS: readonly SecurityBenchmarkScenarioSpec[] = [
  {
    id: "cross_org_access_attempt",
    displayName: "Cross-org access attempt",
    description:
      "Reviewer from secondary org attempts to read a private resource owned by primary org. Must be denied at the organization boundary.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.secondaryReviewerId,
      organizationId: c.secondaryOrgId,
      targetResourceId: c.privateResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "organization_private" as VisibilityLevel,
      action: "read" as AccessAction,
      requiredCapability: "review_evidence" as Capability,
      sessionId: null,
      now: c.now,
    }),
  },
  {
    id: "unauthorized_escalation_access",
    displayName: "Unauthorized escalation access",
    description:
      "Reviewer without the `escalate_case` capability attempts to escalate. Must be denied by capability check.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.limitedReviewerId,
      organizationId: c.primaryOrgId,
      targetResourceId: c.privateResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "organization_private",
      action: "escalate",
      requiredCapability: "escalate_case",
      sessionId: c.limitedReviewerSessionId,
      now: c.now,
    }),
  },
  {
    id: "override_without_capability",
    displayName: "Override without capability",
    description:
      "Reviewer lacking `override_recommendation` attempts to override a recommendation.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.limitedReviewerId,
      organizationId: c.primaryOrgId,
      targetResourceId: c.privateResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "organization_private",
      action: "override",
      requiredCapability: "override_recommendation",
      sessionId: c.limitedReviewerSessionId,
      now: c.now,
    }),
  },
  {
    id: "visibility_leakage",
    displayName: "Cross-investigation visibility leakage",
    description:
      "Reviewer in the correct org but the wrong investigation tries to read an `investigation_private` resource. Must be denied by the visibility engine.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.limitedReviewerId,
      organizationId: c.primaryOrgId,
      targetResourceId: c.investigationScopedResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "investigation_private",
      targetInvestigationId: "inv_wrong_scope",
      action: "read",
      requiredCapability: "review_evidence",
      sessionId: null,
      now: c.now,
    }),
  },
  {
    id: "benchmark_contamination",
    displayName: "Benchmark contamination",
    description:
      "Caller attempts to modify a global-benchmark resource without `create_public_benchmark`.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.limitedReviewerId,
      organizationId: c.primaryOrgId,
      targetResourceId: c.benchmarkResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "benchmark_public",
      action: "modify_benchmark",
      requiredCapability: "create_public_benchmark",
      sessionId: c.limitedReviewerSessionId,
      now: c.now,
    }),
  },
  {
    id: "reviewer_impersonation",
    displayName: "Reviewer impersonation",
    description:
      "Caller passes a reviewerId belonging to another org while claiming to operate from their own. Identity check must reject.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.secondaryReviewerId,
      organizationId: c.primaryOrgId,
      targetResourceId: c.privateResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "organization_private",
      action: "read",
      requiredCapability: "review_evidence",
      sessionId: null,
      now: c.now,
    }),
  },
  {
    id: "sensitive_evidence_access",
    displayName: "Sensitive evidence access",
    description:
      "Reviewer lacking `view_sensitive_evidence` attempts to view sensitive content.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.limitedReviewerId,
      organizationId: c.primaryOrgId,
      targetResourceId: c.sensitiveResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "escalation_only",
      action: "view_sensitive",
      requiredCapability: "view_sensitive_evidence",
      sessionId: c.limitedReviewerSessionId,
      now: c.now,
    }),
  },
  {
    id: "hidden_audit_mutation",
    displayName: "Hidden audit mutation",
    description:
      "Caller without `manage_org_memory` tries to silently change the visibility of an audit slot. Visibility changes must be denied unless the capability is held.",
    expected: "access_denied",
    buildRequest: (c) => ({
      reviewerId: c.limitedReviewerId,
      organizationId: c.primaryOrgId,
      targetResourceId: c.auditResourceId,
      targetOrganizationId: c.primaryOrgId,
      targetVisibility: "organization_private",
      action: "modify_visibility",
      requiredCapability: "manage_org_memory",
      sessionId: c.limitedReviewerSessionId,
      now: c.now,
    }),
  },
];

export interface BenchmarkProbeResult {
  decision: AccessDecision;
  auditEntryIds: readonly string[];
}

/**
 * `decideAndAudit` is supplied by `SecurityEngine` so each probe goes through
 * the audited `checkAccess` path and the suite can record the new audit
 * entries produced for the scenario.
 */
export class SecurityBenchmarkSuite {
  constructor(
    private readonly decideAndAudit: (req: AccessRequest) => BenchmarkProbeResult,
  ) {}

  run(ctx: BenchmarkContext): readonly SecurityBenchmarkResult[] {
    return SECURITY_BENCHMARK_SCENARIOS.map((s) => {
      const req = s.buildRequest(ctx);
      const { decision, auditEntryIds } = this.decideAndAudit(req);
      const actualOutcome = decision.allowed ? "access_allowed" : "access_denied";
      return {
        scenarioId: s.id,
        displayName: s.displayName,
        description: s.description,
        expectedOutcome: s.expected,
        actualOutcome,
        passed: actualOutcome === s.expected,
        decision,
        auditEntryIds: [...auditEntryIds],
        ranAt: ctx.now,
      } satisfies SecurityBenchmarkResult;
    });
  }

  listScenarios(): readonly {
    id: SecurityBenchmarkScenario;
    displayName: string;
    description: string;
  }[] {
    return SECURITY_BENCHMARK_SCENARIOS.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      description: s.description,
    }));
  }
}

export { type SecurityAuditEntry };
