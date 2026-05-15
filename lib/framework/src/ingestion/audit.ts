/**
 * IngestionAuditEngine.
 *
 * Append-only, replayable audit trail of every ingestion event. The full
 * audit log + the original RawInputEnvelope set must be sufficient to
 * reconstruct the entire ingestion run deterministically.
 */

import type {
  EvidenceItem,
  IngestionAuditEntry,
  IngestionEventType,
  IngestionSourceKind,
} from "./types.js";
import { makeId } from "./hash.js";

export interface EvidenceLineageNode {
  evidenceId: string;
  kind: string;
  claim: string;
  producedBy: string;
  derivedFrom: string[];
}

export class IngestionAuditEngine {
  private entries: IngestionAuditEntry[] = [];

  /** Record a discrete ingestion event. Returns the appended entry. */
  record(input: {
    jobId: string;
    type: IngestionEventType;
    occurredAt: string;
    sourceKind: IngestionSourceKind;
    rawId: string;
    detail: string;
    data?: Record<string, unknown>;
  }): IngestionAuditEntry {
    const entry: IngestionAuditEntry = {
      id: makeId(
        "audit",
        input.jobId,
        input.type,
        input.rawId,
        String(this.entries.length),
      ),
      jobId: input.jobId,
      type: input.type,
      occurredAt: input.occurredAt,
      sourceKind: input.sourceKind,
      rawId: input.rawId,
      detail: input.detail,
      data: input.data,
    };
    this.entries.push(entry);
    return entry;
  }

  entriesFor(jobId: string): IngestionAuditEntry[] {
    return this.entries.filter((e) => e.jobId === jobId);
  }

  all(): IngestionAuditEntry[] {
    return [...this.entries];
  }

  /** Build a lineage graph from an evidence set. */
  lineage(evidence: EvidenceItem[]): EvidenceLineageNode[] {
    return evidence
      .map((ev) => ({
        evidenceId: ev.id,
        kind: ev.kind,
        claim: ev.claim,
        producedBy: ev.provenance.producedBy,
        derivedFrom: [
          ...(ev.provenance.derivedFrom ?? []),
          ...(ev.derivedFromEvidenceIds ?? []),
        ].sort(),
      }))
      .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  }
}
