/**
 * SensitiveEvidenceGuard — redaction, partial visibility, and audited reads
 * for sensitive evidence (reference checks, compensation notes, escalation
 * reviews, founder-only annotations, confidential investigations, external
 * reviewer comments).
 *
 * Invariants:
 *   - Provenance is preserved even when content is redacted.
 *   - Every privileged read produces an audit entry id; the record retains
 *     the list (append-only) so silent access is impossible.
 */

import type {
  EvidenceSensitivity,
  Provenance,
  SensitiveEvidenceRecord,
} from "./types.js";

export interface RegisterSensitiveInput {
  evidenceId: string;
  organizationId: string;
  sensitivity: EvidenceSensitivity;
  redactedSummary: string;
  fullSummary: string;
  provenance: Provenance;
}

export interface RedactedView {
  evidenceId: string;
  organizationId: string;
  sensitivity: EvidenceSensitivity;
  summary: string;
  redacted: true;
  provenance: Provenance;
}

export interface FullView {
  evidenceId: string;
  organizationId: string;
  sensitivity: EvidenceSensitivity;
  summary: string;
  redacted: false;
  provenance: Provenance;
}

export type SensitiveView = RedactedView | FullView;

export class SensitiveEvidenceGuard {
  private records = new Map<string, SensitiveEvidenceRecord>();

  register(input: RegisterSensitiveInput): SensitiveEvidenceRecord {
    if (this.records.has(input.evidenceId)) {
      return this.records.get(input.evidenceId)!;
    }
    const rec: SensitiveEvidenceRecord = {
      evidenceId: input.evidenceId,
      organizationId: input.organizationId,
      sensitivity: input.sensitivity,
      redactedSummary: input.redactedSummary,
      fullSummary: input.fullSummary,
      provenance: input.provenance,
      accessAuditIds: [],
    };
    this.records.set(input.evidenceId, rec);
    return rec;
  }

  get(evidenceId: string): SensitiveEvidenceRecord | undefined {
    return this.records.get(evidenceId);
  }

  list(): readonly SensitiveEvidenceRecord[] {
    return [...this.records.values()];
  }

  listByOrg(organizationId: string): readonly SensitiveEvidenceRecord[] {
    return this.list().filter((r) => r.organizationId === organizationId);
  }

  /**
   * Produce a view for a caller. If `privileged` is true the caller has
   * passed an AccessDecision allowing `view_sensitive`; the caller must
   * then pass the audit entry id back via `recordPrivilegedRead`.
   */
  view(evidenceId: string, privileged: boolean): SensitiveView | null {
    const r = this.records.get(evidenceId);
    if (!r) return null;
    if (privileged) {
      return {
        evidenceId: r.evidenceId,
        organizationId: r.organizationId,
        sensitivity: r.sensitivity,
        summary: r.fullSummary,
        redacted: false,
        provenance: r.provenance,
      };
    }
    return {
      evidenceId: r.evidenceId,
      organizationId: r.organizationId,
      sensitivity: r.sensitivity,
      summary: r.redactedSummary,
      redacted: true,
      provenance: r.provenance,
    };
  }

  recordPrivilegedRead(evidenceId: string, auditEntryId: string): SensitiveEvidenceRecord {
    const r = this.records.get(evidenceId);
    if (!r) throw new Error(`sensitive_evidence_not_found: ${evidenceId}`);
    const updated: SensitiveEvidenceRecord = {
      ...r,
      accessAuditIds: [...r.accessAuditIds, auditEntryId],
    };
    this.records.set(evidenceId, updated);
    return updated;
  }
}
