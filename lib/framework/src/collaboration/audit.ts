/**
 * CollaborationAuditEngine.
 *
 * Append-only audit ledger for the collaboration layer. Every meaningful
 * mutation is recorded as a CollaborationAuditEntry, with provenance and a
 * structured before/after delta where applicable. The engine never mutates
 * past entries.
 */

import { makeId } from "./hash.js";
import type { CollaborationAuditEntry, CollaborationAuditKind } from "./types.js";

export interface AppendAuditInput {
  caseId: string;
  kind: CollaborationAuditKind;
  actorId: string;
  summary: string;
  beforeAfter?: {
    field: string;
    before: string | number | null;
    after: string | number | null;
  };
  derivedFrom?: readonly string[];
  now: string;
}

export class CollaborationAuditEngine {
  private entries: CollaborationAuditEntry[] = [];

  append(input: AppendAuditInput): CollaborationAuditEntry {
    const entryId = makeId(
      "aud",
      input.caseId,
      input.kind,
      input.actorId,
      input.summary,
      input.now,
      String(this.entries.length),
    );
    const entry: CollaborationAuditEntry = {
      entryId,
      caseId: input.caseId,
      kind: input.kind,
      actorId: input.actorId,
      summary: input.summary,
      beforeAfter: input.beforeAfter ?? null,
      derivedFrom: [...(input.derivedFrom ?? [])],
      timestamp: input.now,
    };
    this.entries.push(entry);
    return entry;
  }

  listByCase(caseId: string): readonly CollaborationAuditEntry[] {
    return this.entries
      .filter((e) => e.caseId === caseId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  all(): readonly CollaborationAuditEntry[] {
    return this.entries.slice();
  }
}
