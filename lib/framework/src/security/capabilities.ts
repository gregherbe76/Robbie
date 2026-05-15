/**
 * RoleCapabilitySystem — capability-based access (NOT generic RBAC).
 *
 * The framework never asks "is this user an admin?". It only asks "does this
 * reviewer hold the *specific* capability required for this action?".
 *
 * Capabilities are declarative tokens (e.g. `view_sensitive_evidence`) and
 * are explicitly mapped to actions via `requiredCapabilityFor`. Code that
 * performs a protected operation MUST look up the capability here instead of
 * inlining a string — that way the central registry remains the source of
 * truth and the AccessDecisionEngine can enumerate evaluated rules.
 */

import { ALL_CAPABILITIES, type AccessAction, type Capability } from "./types.js";
import type { ReviewerIdentityProvider } from "./identity.js";

export const CAPABILITY_FOR_ACTION: Record<AccessAction, Capability> = {
  read: "review_evidence",
  write: "review_evidence",
  override: "override_recommendation",
  escalate: "escalate_case",
  view_sensitive: "view_sensitive_evidence",
  modify_visibility: "manage_org_memory",
  modify_benchmark: "create_public_benchmark",
  manage_memory: "manage_org_memory",
};

export class RoleCapabilitySystem {
  constructor(private readonly identities: ReviewerIdentityProvider) {}

  requiredCapabilityFor(action: AccessAction): Capability {
    return CAPABILITY_FOR_ACTION[action];
  }

  capabilitiesOf(reviewerId: string): readonly Capability[] {
    const r = this.identities.get(reviewerId);
    return r ? r.capabilities : [];
  }

  check(reviewerId: string, capability: Capability): { passed: boolean; detail: string } {
    const reviewer = this.identities.get(reviewerId);
    if (!reviewer) {
      return { passed: false, detail: `reviewer_not_found: ${reviewerId}` };
    }
    if (!reviewer.capabilities.includes(capability)) {
      return {
        passed: false,
        detail: `missing_capability: ${capability} (held: ${reviewer.capabilities.join(", ") || "none"})`,
      };
    }
    return { passed: true, detail: `holds: ${capability}` };
  }

  listAll(): readonly Capability[] {
    return ALL_CAPABILITIES;
  }
}
