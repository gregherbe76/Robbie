/**
 * OrganizationBoundaryEngine — registry of organizations and the strict
 * boundary every other security primitive consults.
 *
 * Boundary rules:
 *  - Every entity is owned by exactly one organization OR explicitly marked
 *    as `global_demo` / `global_benchmark`.
 *  - There is no implicit cross-org access — even reads. Callers must go
 *    through `AccessDecisionEngine`.
 *  - Resolution is deterministic: the same id always resolves to the same
 *    org, even after replays.
 */

import { makeId } from "./hash.js";
import type {
  Organization,
  OrganizationScopedEntity,
  OrganizationTier,
  Provenance,
  VisibilityScope,
} from "./types.js";

export interface RegisterOrganizationInput {
  displayName: string;
  tier: OrganizationTier;
  now: string;
}

export class OrganizationBoundaryEngine {
  private organizations = new Map<string, Organization>();
  /** resourceId → (organizationId, visibilityScope) */
  private resourceIndex = new Map<
    string,
    { organizationId: string; visibilityScope: VisibilityScope }
  >();

  register(input: RegisterOrganizationInput): Organization {
    const organizationId = makeId("org", input.displayName, input.tier);
    const existing = this.organizations.get(organizationId);
    if (existing) return existing;
    const org: Organization = {
      organizationId,
      displayName: input.displayName,
      tier: input.tier,
      createdAt: input.now,
      calibrationNamespace: makeId("calns", organizationId),
    };
    this.organizations.set(organizationId, org);
    return org;
  }

  get(organizationId: string): Organization | undefined {
    return this.organizations.get(organizationId);
  }

  require(organizationId: string): Organization {
    const o = this.organizations.get(organizationId);
    if (!o) throw new Error(`organization_not_found: ${organizationId}`);
    return o;
  }

  list(): readonly Organization[] {
    return [...this.organizations.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  /**
   * Register a resource against an organization scope. Idempotent for the
   * same (resourceId, organizationId, scope) triple; conflicting writes throw.
   */
  registerResource(
    resourceId: string,
    organizationId: string,
    visibilityScope: VisibilityScope,
  ): void {
    if (!this.organizations.has(organizationId)) {
      throw new Error(`organization_not_found: ${organizationId}`);
    }
    const existing = this.resourceIndex.get(resourceId);
    if (existing) {
      if (
        existing.organizationId !== organizationId ||
        existing.visibilityScope !== visibilityScope
      ) {
        throw new Error(
          `boundary_conflict: ${resourceId} already owned by ${existing.organizationId} (${existing.visibilityScope})`,
        );
      }
      return;
    }
    this.resourceIndex.set(resourceId, { organizationId, visibilityScope });
  }

  /** Returns null if the resource is not registered (callers should treat as deny). */
  ownerOf(
    resourceId: string,
  ): { organizationId: string; visibilityScope: VisibilityScope } | null {
    return this.resourceIndex.get(resourceId) ?? null;
  }

  /**
   * Validate that an entity carries the full org-scoped envelope. Throws on
   * structural violations so seeds fail loud.
   */
  validateEntity(entity: OrganizationScopedEntity): void {
    if (!entity.organizationId) throw new Error("entity_missing_organization_id");
    if (!this.organizations.has(entity.organizationId)) {
      throw new Error(`organization_not_found: ${entity.organizationId}`);
    }
    if (!entity.visibilityScope) throw new Error("entity_missing_visibility_scope");
    if (!entity.provenance || !entity.provenance.sourceId) {
      throw new Error("entity_missing_provenance");
    }
    if (!entity.createdBy) throw new Error("entity_missing_created_by");
    if (!entity.createdAt) throw new Error("entity_missing_created_at");
  }

  /** Construct a provenance record with all required fields populated. */
  buildProvenance(input: {
    sourceKind: Provenance["sourceKind"];
    sourceId: string;
    createdBy: string;
    createdAt: string;
  }): Provenance {
    return { ...input };
  }
}
