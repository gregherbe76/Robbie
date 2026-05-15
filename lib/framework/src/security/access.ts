/**
 * AccessDecisionEngine — the single choke point every protected read/write
 * passes through.
 *
 * Every decision returns a fully evaluated rule-set so reviewers can inspect
 * *why* a request was allowed or denied. Decisions are deterministic given
 * the same world state and inputs, so they replay identically in tests and
 * benchmarks.
 *
 * Authorization is **capability-based**, not role-based. The engine derives
 * the required capability for an action from `CAPABILITY_FOR_ACTION` and
 * refuses requests that supply a weaker token. Escalation privilege is just
 * the `escalate_case` capability — there is no reviewer-type back door.
 */

import { makeId } from "./hash.js";
import type { IntelligenceVisibilityEngine } from "./visibility.js";
import type { MultiTenantIsolationLayer } from "./isolation.js";
import type { ReviewerIdentityProvider } from "./identity.js";
import type { RoleCapabilitySystem } from "./capabilities.js";
import { CAPABILITY_FOR_ACTION } from "./capabilities.js";
import type { SessionAndActionIntegrityLayer } from "./session.js";
import type {
  AccessDecision,
  AccessRequest,
  EvaluatedRule,
} from "./types.js";

export class AccessDecisionEngine {
  private decisions = new Map<string, AccessDecision>();

  constructor(
    private readonly identities: ReviewerIdentityProvider,
    private readonly capabilities: RoleCapabilitySystem,
    private readonly isolation: MultiTenantIsolationLayer,
    private readonly visibility: IntelligenceVisibilityEngine,
    private readonly sessions: SessionAndActionIntegrityLayer,
  ) {}

  decide(req: AccessRequest): AccessDecision {
    const rules: EvaluatedRule[] = [];

    // Rule 1 — reviewer identity must exist and belong to the caller's org.
    const reviewer = this.identities.get(req.reviewerId);
    if (!reviewer) {
      rules.push({
        rule: "reviewer_identity",
        passed: false,
        detail: `reviewer_not_found: ${req.reviewerId}`,
      });
      return this.finalize(req, rules);
    }
    if (reviewer.organizationId !== req.organizationId) {
      rules.push({
        rule: "reviewer_identity",
        passed: false,
        detail: `reviewer_org_mismatch: reviewer=${reviewer.organizationId} caller=${req.organizationId}`,
      });
      return this.finalize(req, rules);
    }
    rules.push({
      rule: "reviewer_identity",
      passed: true,
      detail: `verified: ${reviewer.reviewerType}`,
    });

    // Rule 2 — organization boundary / multi-tenant isolation.
    const iso = this.isolation.check({
      callerOrganizationId: req.organizationId,
      targetResourceId: req.targetResourceId,
      domain:
        req.action === "view_sensitive"
          ? "evidence"
          : req.action === "modify_benchmark"
            ? "benchmark"
            : req.action === "manage_memory"
              ? "memory"
              : req.action === "escalate"
                ? "case"
                : req.action === "modify_visibility"
                  ? "audit"
                  : "case",
    });
    rules.push({
      rule: "organization_boundary",
      passed: iso.allowed,
      detail: iso.reason,
    });
    if (!iso.allowed) return this.finalize(req, rules);

    // Rule 3 — capability. The engine computes the required capability from
    // the action; the caller-supplied `requiredCapability` is informational
    // and must match, otherwise the request is rejected as a policy-downgrade
    // attempt.
    const expectedCapability = CAPABILITY_FOR_ACTION[req.action];
    if (req.requiredCapability !== expectedCapability) {
      rules.push({
        rule: "capability",
        passed: false,
        detail: `capability_mismatch_for_action: action=${req.action} expected=${expectedCapability} supplied=${req.requiredCapability}`,
      });
      return this.finalize(req, rules);
    }
    const cap = this.capabilities.check(req.reviewerId, expectedCapability);
    rules.push({ rule: "capability", passed: cap.passed, detail: cap.detail });
    if (!cap.passed) return this.finalize(req, rules);

    // Rule 4 — visibility. Escalation privilege is the `escalate_case`
    // capability (no reviewer-type RBAC).
    const callerHasEscalationCapability =
      reviewer.capabilities.includes("escalate_case");
    const vis = this.visibility.check({
      resourceId: req.targetResourceId,
      callerOrganizationId: req.organizationId,
      callerReviewerId: req.reviewerId,
      callerInvestigationId: req.targetInvestigationId ?? null,
      callerHasEscalationCapability,
    });
    rules.push({ rule: "visibility", passed: vis.passed, detail: vis.detail });
    if (!vis.passed) return this.finalize(req, rules);

    // Rule 5 — escalation restriction. Pure capability check, recorded
    // separately so the trace makes the policy decision explicit.
    const escalationOk =
      req.action !== "escalate" || callerHasEscalationCapability;
    rules.push({
      rule: "escalation_restriction",
      passed: escalationOk,
      detail: escalationOk
        ? "escalation_allowed_or_not_applicable"
        : "missing_escalate_case_capability",
    });
    if (!escalationOk) return this.finalize(req, rules);

    // Rule 6 — session integrity. For mutating / privileged actions the
    // caller must supply a session id that exists, belongs to this reviewer
    // and org, and is still open.
    const needsSession =
      req.action === "write" ||
      req.action === "override" ||
      req.action === "escalate" ||
      req.action === "view_sensitive" ||
      req.action === "modify_visibility" ||
      req.action === "modify_benchmark" ||
      req.action === "manage_memory";
    let sessionPassed = true;
    let sessionDetail = "session_not_required";
    if (needsSession) {
      if (!req.sessionId) {
        sessionPassed = false;
        sessionDetail = "session_required";
      } else {
        const sess = this.sessions.getSession(req.sessionId);
        if (!sess) {
          sessionPassed = false;
          sessionDetail = `session_not_found: ${req.sessionId}`;
        } else if (sess.reviewerId !== req.reviewerId) {
          sessionPassed = false;
          sessionDetail = "session_reviewer_mismatch";
        } else if (sess.organizationId !== req.organizationId) {
          sessionPassed = false;
          sessionDetail = "session_org_mismatch";
        } else if (sess.closedAt !== null) {
          sessionPassed = false;
          sessionDetail = "session_closed";
        } else {
          sessionDetail = `session_valid: ${sess.sessionId}`;
        }
      }
    }
    rules.push({
      rule: "session_integrity",
      passed: sessionPassed,
      detail: sessionDetail,
    });
    if (!sessionPassed) return this.finalize(req, rules);

    return this.finalize(req, rules);
  }

  private finalize(req: AccessRequest, rules: EvaluatedRule[]): AccessDecision {
    const allowed = rules.every((r) => r.passed);
    const decisionId = makeId(
      "decision",
      req.reviewerId,
      req.targetResourceId,
      req.action,
      req.now,
    );
    const decision: AccessDecision = {
      decisionId,
      allowed,
      reason: allowed
        ? "all_rules_passed"
        : (rules.find((r) => !r.passed)?.detail ?? "unknown_denial"),
      evaluatedRules: rules,
      reviewerId: req.reviewerId,
      organizationId: req.organizationId,
      targetResource: req.targetResourceId,
      action: req.action,
      timestamp: req.now,
    };
    Object.freeze(decision.evaluatedRules);
    Object.freeze(decision);
    this.decisions.set(decisionId, decision);
    return decision;
  }

  get(decisionId: string): AccessDecision | undefined {
    return this.decisions.get(decisionId);
  }

  listByOrg(organizationId: string): readonly AccessDecision[] {
    return [...this.decisions.values()]
      .filter((d) => d.organizationId === organizationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  all(): readonly AccessDecision[] {
    return [...this.decisions.values()];
  }
}
