/**
 * OrganizationContextIngestionPipeline.
 *
 * Sources: structured org profile, founder notes, role description,
 * operating principles, engineering culture docs, interview rubrics,
 * organizational surveys.
 *
 * Hard rules:
 *   - explicit "unknown" stays unknown (never interpolated)
 *   - every org field carries its own provenance + confidence
 *   - empty input ⇒ empty snapshot with a warning, not a fabricated one
 */

import type { Provenance } from "../shared/index.js";
import type {
  EvidenceItem,
  IngestionAuditEntry,
  IngestionWarning,
  NormalizedOrganization,
  OrganizationPipelineResult,
  SourceReliabilityAssessment,
} from "./types.js";
import { ProvenanceCaptureEngine } from "./provenance.js";
import { SourceReliabilityEngine } from "./reliability.js";
import { EvidenceNormalizationEngine } from "./normalization.js";
import { EvidenceConflictDetector } from "./conflicts.js";
import { IngestionAuditEngine } from "./audit.js";
import { makeId } from "./hash.js";

export type OrganizationSourceKind =
  | "structured_profile"
  | "founder_notes"
  | "role_description"
  | "operating_principles"
  | "engineering_culture"
  | "interview_rubrics"
  | "survey";

export interface OrganizationSource {
  rawId: string;
  kind: OrganizationSourceKind;
  submittedBy: string;
  /** Field-level claims with explicit unknowns. */
  fields: Array<{
    field: string;
    value: string | null;
    confidence: number;
    rationale?: string;
  }>;
}

export interface OrganizationPipelineInputs {
  jobId: string;
  organizationId: string;
  organizationName: string;
  sources: OrganizationSource[];
  now: string;
}

export class OrganizationContextIngestionPipeline {
  private prov = new ProvenanceCaptureEngine();
  private reliability = new SourceReliabilityEngine();
  private normalizer = new EvidenceNormalizationEngine();
  private conflictDetector = new EvidenceConflictDetector();

  run(inputs: OrganizationPipelineInputs): OrganizationPipelineResult {
    const audit = new IngestionAuditEngine();
    const warnings: IngestionWarning[] = [];
    const allEvidence: EvidenceItem[] = [];
    const reliability: SourceReliabilityAssessment[] = [];

    if (inputs.sources.length === 0) {
      warnings.push({
        code: "empty_org_input",
        severity: "warn",
        detail: "no organization sources provided",
      });
    }

    for (const src of inputs.sources) {
      audit.record({
        jobId: inputs.jobId,
        type: "raw_received",
        occurredAt: inputs.now,
        sourceKind: "organization_context",
        rawId: src.rawId,
        detail: `received ${src.kind} from ${src.submittedBy}`,
      });

      const srcEvidence: EvidenceItem[] = [];
      for (const f of src.fields) {
        const knownValue = f.value !== null && f.value.trim().length > 0;
        if (!knownValue) {
          // Explicit unknown — preserved as evidence, not interpolated.
          srcEvidence.push({
            id: makeId("ev", src.rawId, f.field, "unknown"),
            kind: "uncertainty_signal",
            subjectId: inputs.organizationId,
            claim: `${f.field}: explicit unknown`,
            attributes: { field: f.field, value: "", unknown: true },
            confidence: 0.9,
            reliability: 0.8,
            ambiguity: ["field_explicitly_unknown"],
            provenance: this.prov.build({
              producedBy: "ingestion.organization",
              producedAt: inputs.now,
              sourceKind: "organization_context",
              extractionMethod: "organization_pipeline_v1",
              rawId: src.rawId,
              rationale: f.rationale ?? `${f.field} marked unknown by ${src.submittedBy}`,
            }),
            rawReference: { locator: `$.fields[?(@.field=='${f.field}')]` },
          });
          continue;
        }

        srcEvidence.push({
          id: makeId("ev", src.rawId, f.field),
          kind: src.kind === "engineering_culture" || src.kind === "operating_principles"
            ? "organizational_signal"
            : "explicit_claim",
          subjectId: inputs.organizationId,
          claim: `${f.field}: ${f.value}`,
          attributes: { field: f.field, value: String(f.value), sourceKind: src.kind },
          confidence: Math.max(0.05, Math.min(0.99, f.confidence)),
          reliability: src.kind === "structured_profile" ? 0.85 : 0.7,
          ambiguity: [],
          provenance: this.prov.build({
            producedBy: "ingestion.organization",
            producedAt: inputs.now,
            sourceKind: "organization_context",
            extractionMethod: "organization_pipeline_v1",
            rawId: src.rawId,
            rationale: f.rationale ?? `${f.field} from ${src.kind}`,
          }),
          rawReference: { locator: `$.fields[?(@.field=='${f.field}')]` },
        });
      }

      allEvidence.push(...srcEvidence);
      const rel = this.reliability.assess({
        sourceKind: "organization_context",
        rawId: src.rawId,
        evidence: srcEvidence,
        structuredPayload: src.kind === "structured_profile",
      });
      reliability.push(rel);

      audit.record({
        jobId: inputs.jobId,
        type: "parsed",
        occurredAt: inputs.now,
        sourceKind: "organization_context",
        rawId: src.rawId,
        detail: `${src.kind} produced ${srcEvidence.length} evidence item(s)`,
      });
      audit.record({
        jobId: inputs.jobId,
        type: "reliability_assessed",
        occurredAt: inputs.now,
        sourceKind: "organization_context",
        rawId: src.rawId,
        detail: `reliability=${rel.reliabilityScore.toFixed(2)}`,
      });
    }

    const normalized = this.normalizer.normalize(allEvidence);
    audit.record({
      jobId: inputs.jobId,
      type: "normalized",
      occurredAt: inputs.now,
      sourceKind: "organization_context",
      rawId: inputs.jobId,
      detail: `normalized ${allEvidence.length} → ${normalized.length}`,
    });

    const provCheck = this.prov.validate(normalized);
    if (!provCheck.ok) {
      for (const v of provCheck.violations) {
        warnings.push({
          code: "provenance_violation",
          severity: "error",
          detail: `${v.evidenceId}: ${v.reason}`,
        });
      }
    }
    audit.record({
      jobId: inputs.jobId,
      type: "provenance_attached",
      occurredAt: inputs.now,
      sourceKind: "organization_context",
      rawId: inputs.jobId,
      detail: provCheck.ok ? "ok" : `${provCheck.violations.length} violation(s)`,
    });

    const conflicts = this.conflictDetector.detect({ evidence: normalized, now: inputs.now });
    audit.record({
      jobId: inputs.jobId,
      type: "contradiction_precheck",
      occurredAt: inputs.now,
      sourceKind: "organization_context",
      rawId: inputs.jobId,
      detail: `${conflicts.length} conflict(s) detected`,
    });

    const snapshot = this.buildSnapshot(
      inputs.organizationId,
      inputs.organizationName,
      normalized,
    );
    audit.record({
      jobId: inputs.jobId,
      type: "evidence_graph_inserted",
      occurredAt: inputs.now,
      sourceKind: "organization_context",
      rawId: inputs.jobId,
      detail: `org snapshot built with ${snapshot.fields.length} field(s), ${snapshot.unknowns.length} unknown(s)`,
    });

    return {
      jobId: inputs.jobId,
      organizationId: inputs.organizationId,
      normalizedOrganization: snapshot,
      extractedEvidence: normalized,
      sourceReliability: reliability,
      conflicts,
      ingestionWarnings: warnings,
      provenanceChain: this.prov.chain(normalized),
      audit: audit.entriesFor(inputs.jobId) as IngestionAuditEntry[],
    };
  }

  private buildSnapshot(
    organizationId: string,
    displayName: string,
    evidence: EvidenceItem[],
  ): NormalizedOrganization {
    const fields: NormalizedOrganization["fields"] = [];
    const unknowns: string[] = [];
    const seenField = new Set<string>();

    for (const e of evidence) {
      const field = String(e.attributes["field"] ?? "");
      if (!field) continue;
      if (seenField.has(field)) continue;
      seenField.add(field);

      if (e.attributes["unknown"] === true) {
        unknowns.push(field);
        continue;
      }

      fields.push({
        field,
        value: String(e.attributes["value"] ?? ""),
        confidence: e.confidence,
        provenance: e.provenance as Provenance,
      });
    }

    return {
      organizationId,
      displayName,
      fields: fields.sort((a, b) => a.field.localeCompare(b.field)),
      unknowns: unknowns.sort(),
    };
  }
}
