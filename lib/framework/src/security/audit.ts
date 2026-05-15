/**
 * SecureAuditTrail — append-only, per-org sequenced audit trail.
 *
 * Properties:
 *   - append-only: there is no `update` or `delete`; tests assert the only
 *     mutation path is `append`.
 *   - per-org monotonic `sequence`: holes or rewrites are detectable.
 *   - deterministic ordering: same input sequence → same audit ids.
 *   - replayable: persistable as `(orgId, sequence)` keyed events.
 */

import { makeId } from "./hash.js";
import type { SecurityAuditEntry, SecurityAuditKind } from "./types.js";

export interface AppendAuditInput {
  organizationId: string;
  reviewerId: string | null;
  kind: SecurityAuditKind;
  targetResource: string;
  detail?: Readonly<Record<string, string | number | boolean | null>>;
  timestamp: string;
}

export class SecureAuditTrail {
  private entries: SecurityAuditEntry[] = [];
  private sequenceByOrg = new Map<string, number>();

  append(input: AppendAuditInput): SecurityAuditEntry {
    const nextSequence = (this.sequenceByOrg.get(input.organizationId) ?? 0) + 1;
    const entryId = makeId(
      "audit",
      input.organizationId,
      String(nextSequence),
      input.kind,
      input.targetResource,
    );
    const detail = Object.freeze({ ...(input.detail ?? {}) });
    const entry: SecurityAuditEntry = Object.freeze({
      entryId,
      sequence: nextSequence,
      organizationId: input.organizationId,
      reviewerId: input.reviewerId,
      kind: input.kind,
      targetResource: input.targetResource,
      detail,
      timestamp: input.timestamp,
    }) as SecurityAuditEntry;
    this.entries.push(entry);
    this.sequenceByOrg.set(input.organizationId, nextSequence);
    return entry;
  }

  listByOrg(organizationId: string): readonly SecurityAuditEntry[] {
    return this.entries
      .filter((e) => e.organizationId === organizationId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  listByReviewer(reviewerId: string): readonly SecurityAuditEntry[] {
    return this.entries
      .filter((e) => e.reviewerId === reviewerId)
      .sort((a, b) =>
        a.timestamp === b.timestamp ? a.sequence - b.sequence : a.timestamp.localeCompare(b.timestamp),
      );
  }

  all(): readonly SecurityAuditEntry[] {
    return [...this.entries];
  }

  /**
   * Verify per-org monotonicity. Used by the benchmark suite to assert the
   * audit log was not silently mutated.
   */
  verifyMonotonic(): { ok: true } | { ok: false; organizationId: string; expected: number; saw: number } {
    const seen = new Map<string, number>();
    for (const e of this.entries) {
      const prev = seen.get(e.organizationId) ?? 0;
      const expected = prev + 1;
      if (e.sequence !== expected) {
        return { ok: false, organizationId: e.organizationId, expected, saw: e.sequence };
      }
      seen.set(e.organizationId, e.sequence);
    }
    return { ok: true };
  }
}
