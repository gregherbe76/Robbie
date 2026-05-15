/**
 * ReviewerIdentityProvider — deterministic reviewer identity, fingerprinting,
 * and capability assignment.
 *
 * Rules:
 *  - Every reviewer is owned by exactly one organization. There is no
 *    "platform-level" reviewer. `system_agent` reviewers are still scoped.
 *  - Identity ids are deterministic — same (orgId, type, displayName) →
 *    same reviewerId. This is essential for replayable audit.
 *  - External reviewers must be scoped to a single investigation; the engine
 *    refuses registration otherwise.
 *  - No anonymous reviewers. `displayName` is required and non-empty.
 */

import { fnv1a, makeId } from "./hash.js";
import {
  DEFAULT_CAPABILITIES_BY_TYPE,
  type Capability,
  type ReviewerType,
  type SecurityReviewerIdentity,
} from "./types.js";

export interface RegisterReviewerInput {
  organizationId: string;
  reviewerType: ReviewerType;
  displayName: string;
  capabilities?: readonly Capability[];
  scopedToInvestigationId?: string | null;
  now: string;
}

export class ReviewerIdentityProvider {
  private reviewers = new Map<string, SecurityReviewerIdentity>();
  private byOrg = new Map<string, Set<string>>();

  register(input: RegisterReviewerInput): SecurityReviewerIdentity {
    if (!input.displayName || input.displayName.trim().length === 0) {
      throw new Error("reviewer_displayname_required");
    }
    if (
      input.reviewerType === "external_reviewer" &&
      !input.scopedToInvestigationId
    ) {
      throw new Error("external_reviewer_requires_investigation_scope");
    }
    const reviewerId = makeId(
      "rev",
      input.organizationId,
      input.reviewerType,
      input.displayName,
    );
    const existing = this.reviewers.get(reviewerId);
    if (existing) return existing;

    const fingerprint = fnv1a(
      [input.organizationId, input.reviewerType, input.displayName].join("|"),
    );
    const calibrationIdentityKey = makeId(
      "calid",
      input.organizationId,
      input.reviewerType,
      input.displayName,
    );
    const capabilities =
      input.capabilities ?? DEFAULT_CAPABILITIES_BY_TYPE[input.reviewerType];

    const reviewer: SecurityReviewerIdentity = {
      reviewerId,
      organizationId: input.organizationId,
      reviewerType: input.reviewerType,
      displayName: input.displayName,
      fingerprint,
      capabilities: [...capabilities],
      calibrationIdentityKey,
      createdAt: input.now,
      scopedToInvestigationId: input.scopedToInvestigationId ?? null,
    };
    this.reviewers.set(reviewerId, reviewer);

    if (!this.byOrg.has(input.organizationId)) {
      this.byOrg.set(input.organizationId, new Set());
    }
    this.byOrg.get(input.organizationId)!.add(reviewerId);

    return reviewer;
  }

  get(reviewerId: string): SecurityReviewerIdentity | undefined {
    return this.reviewers.get(reviewerId);
  }

  require(reviewerId: string): SecurityReviewerIdentity {
    const r = this.reviewers.get(reviewerId);
    if (!r) throw new Error(`reviewer_not_found: ${reviewerId}`);
    return r;
  }

  listByOrg(organizationId: string): readonly SecurityReviewerIdentity[] {
    const ids = this.byOrg.get(organizationId);
    if (!ids) return [];
    return [...ids]
      .map((id) => this.reviewers.get(id)!)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listAll(): readonly SecurityReviewerIdentity[] {
    return [...this.reviewers.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  hasCapability(reviewerId: string, capability: Capability): boolean {
    const r = this.reviewers.get(reviewerId);
    if (!r) return false;
    return r.capabilities.includes(capability);
  }
}
