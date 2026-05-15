/**
 * MultiTenantIsolationLayer — hard isolation across orgs for memory, evidence,
 * cases, audit, calibration, benchmarks, and collaboration artifacts.
 *
 * The boundary engine knows *who owns what*; this layer enforces *no cross-
 * org reads, no calibration contamination, no benchmark leakage* on top of
 * that ownership.
 *
 * Isolation domains (used for grouping in the visibility graph):
 *   memory | evidence | case | audit | calibration | benchmark | collaboration
 *
 * Carve-outs:
 *   - `visibilityScope = global_demo` resources are visible to every org but
 *     never feed calibration or org memory.
 *   - `visibilityScope = global_benchmark` resources are visible to every org
 *     and are explicitly allowed to feed benchmarks but never calibration.
 */

import type { OrganizationBoundaryEngine } from "./organization.js";
import type { VisibilityScope } from "./types.js";

export type IsolationDomain =
  | "memory"
  | "evidence"
  | "case"
  | "audit"
  | "calibration"
  | "benchmark"
  | "collaboration";

export interface IsolationCheckInput {
  callerOrganizationId: string;
  targetResourceId: string;
  domain: IsolationDomain;
}

export interface IsolationCheckResult {
  allowed: boolean;
  reason: string;
  /** Resolved owner — null if the resource isn't registered (treated as deny). */
  owner: { organizationId: string; visibilityScope: VisibilityScope } | null;
}

export class MultiTenantIsolationLayer {
  constructor(private readonly boundaries: OrganizationBoundaryEngine) {}

  check(input: IsolationCheckInput): IsolationCheckResult {
    const owner = this.boundaries.ownerOf(input.targetResourceId);
    if (!owner) {
      return {
        allowed: false,
        reason: "resource_not_registered",
        owner: null,
      };
    }
    // Same-org reads always pass the isolation check (capability / visibility
    // checks happen elsewhere).
    if (owner.organizationId === input.callerOrganizationId) {
      return { allowed: true, reason: "same_org", owner };
    }
    // Carve-outs.
    if (owner.visibilityScope === "global_demo") {
      // Demo data must never feed calibration.
      if (input.domain === "calibration") {
        return {
          allowed: false,
          reason: "demo_resources_cannot_feed_calibration",
          owner,
        };
      }
      return { allowed: true, reason: "global_demo_carveout", owner };
    }
    if (owner.visibilityScope === "global_benchmark") {
      if (input.domain === "calibration") {
        return {
          allowed: false,
          reason: "benchmark_resources_cannot_feed_calibration",
          owner,
        };
      }
      return { allowed: true, reason: "global_benchmark_carveout", owner };
    }
    return {
      allowed: false,
      reason: "cross_org_access_denied",
      owner,
    };
  }
}
