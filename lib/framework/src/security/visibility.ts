/**
 * IntelligenceVisibilityEngine — visibility rules for intelligence artifacts.
 *
 * Visibility is *separate* from organization boundary: the boundary says
 * which org owns a resource; visibility says which reviewers inside that org
 * (or outside, for `*_public`) can see it.
 *
 * All visibility mutations are themselves auditable — the engine writes a
 * change record AND callers append an audit entry through the central engine.
 * The history is preserved (append-only) so visibility evolution is
 * inspectable.
 */

import { makeId } from "./hash.js";
import type {
  VisibilityLevel,
  VisibilityRecord,
} from "./types.js";

export interface SetVisibilityInput {
  resourceId: string;
  resourceKind: VisibilityRecord["resourceKind"];
  organizationId: string;
  level: VisibilityLevel;
  scopedInvestigationId?: string | null;
  scopedReviewerId?: string | null;
  changedBy: string;
  reason: string;
  now: string;
}

export class IntelligenceVisibilityEngine {
  /** Current visibility per resourceId. */
  private current = new Map<string, VisibilityRecord>();
  /** Full history per resourceId (append-only). */
  private history = new Map<string, VisibilityRecord[]>();

  set(input: SetVisibilityInput): VisibilityRecord {
    if (input.level === "investigation_private" && !input.scopedInvestigationId) {
      throw new Error("investigation_private_requires_investigation_id");
    }
    if (input.level === "reviewer_private" && !input.scopedReviewerId) {
      throw new Error("reviewer_private_requires_reviewer_id");
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new Error("visibility_change_requires_reason");
    }
    const previous = this.current.get(input.resourceId);
    const record: VisibilityRecord = {
      resourceId: input.resourceId,
      resourceKind: input.resourceKind,
      organizationId: input.organizationId,
      level: input.level,
      scopedInvestigationId: input.scopedInvestigationId ?? null,
      scopedReviewerId: input.scopedReviewerId ?? null,
      changedBy: input.changedBy,
      changedAt: input.now,
      reason: input.reason,
      previousLevel: previous?.level ?? null,
    };
    // Tag the record id for traceability (not part of the public type — used
    // internally for de-dup of identical replays).
    void makeId(
      "vis",
      input.resourceId,
      input.level,
      input.now,
      String(previous?.level ?? "none"),
    );
    this.current.set(input.resourceId, record);
    const arr = this.history.get(input.resourceId) ?? [];
    arr.push(record);
    this.history.set(input.resourceId, arr);
    return record;
  }

  current_(resourceId: string): VisibilityRecord | undefined {
    return this.current.get(resourceId);
  }

  historyOf(resourceId: string): readonly VisibilityRecord[] {
    return this.history.get(resourceId) ?? [];
  }

  /** All current visibility records (graph nodes). */
  all(): readonly VisibilityRecord[] {
    return [...this.current.values()].sort((a, b) =>
      a.changedAt.localeCompare(b.changedAt),
    );
  }

  /**
   * Pure visibility check — does the given (orgId, reviewerId, investigationId)
   * tuple satisfy the resource's current visibility level?
   *
   * The boundary check is performed *upstream* in MultiTenantIsolationLayer,
   * so by the time this runs the caller's org-vs-owner question is already
   * settled. Here we only ask: "given the level, is this caller eligible?"
   */
  check(args: {
    resourceId: string;
    callerOrganizationId: string;
    callerReviewerId: string;
    callerInvestigationId?: string | null;
    callerHasEscalationCapability: boolean;
  }): { passed: boolean; detail: string; level: VisibilityLevel | null } {
    const r = this.current.get(args.resourceId);
    if (!r) {
      return { passed: false, detail: "no_visibility_record", level: null };
    }
    switch (r.level) {
      case "organization_private":
        return r.organizationId === args.callerOrganizationId
          ? { passed: true, detail: "org_private_match", level: r.level }
          : { passed: false, detail: "org_private_mismatch", level: r.level };
      case "investigation_private":
        if (r.organizationId !== args.callerOrganizationId) {
          return { passed: false, detail: "investigation_private_wrong_org", level: r.level };
        }
        return r.scopedInvestigationId === args.callerInvestigationId
          ? { passed: true, detail: "investigation_private_match", level: r.level }
          : { passed: false, detail: "investigation_private_mismatch", level: r.level };
      case "reviewer_private":
        if (r.organizationId !== args.callerOrganizationId) {
          return { passed: false, detail: "reviewer_private_wrong_org", level: r.level };
        }
        return r.scopedReviewerId === args.callerReviewerId
          ? { passed: true, detail: "reviewer_private_match", level: r.level }
          : { passed: false, detail: "reviewer_private_mismatch", level: r.level };
      case "escalation_only":
        if (r.organizationId !== args.callerOrganizationId) {
          return { passed: false, detail: "escalation_only_wrong_org", level: r.level };
        }
        return args.callerHasEscalationCapability
          ? { passed: true, detail: "escalation_capability_held", level: r.level }
          : { passed: false, detail: "escalation_only_requires_escalate_case_capability", level: r.level };
      case "benchmark_public":
      case "demo_public":
        return { passed: true, detail: `${r.level}_open`, level: r.level };
    }
  }
}
