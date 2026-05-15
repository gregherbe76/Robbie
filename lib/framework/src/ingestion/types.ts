/**
 * Ingestion layer — type system.
 *
 * The ingestion layer is the boundary between the outside world and the
 * cognition layer. Everything that enters the framework via ingestion is
 * required to carry:
 *   - explicit provenance (who/what produced it, when, from what raw source)
 *   - explicit reliability (how trustworthy the source is, with reasons)
 *   - explicit uncertainty (confidence in [0,1] AND ambiguity markers)
 *
 * Evidence here is the atomic unit. A pipeline is a deterministic, replayable
 * transformation from raw input → normalized evidence + warnings + conflicts.
 */

import type { Confidence, Provenance } from "../shared/index.js";

// =============================================================================
// Ingestion source identifiers
// =============================================================================

export type IngestionSourceKind =
  | "resume"
  | "github"
  | "linkedin"
  | "interview_transcript"
  | "portfolio"
  | "organization_context"
  | "references"
  | "notes"
  | "external_evidence";

export type EvidenceKind =
  | "explicit_claim"
  | "demonstrated_behavior"
  | "contradiction_signal"
  | "uncertainty_signal"
  | "ownership_signal"
  | "trajectory_signal"
  | "organizational_signal";

// =============================================================================
// Raw input envelopes
// =============================================================================

export interface RawInputEnvelope {
  /** Stable id of this raw blob, used as provenance anchor. */
  rawId: string;
  /** Which adapter should accept it. */
  sourceKind: IngestionSourceKind;
  /** Free-form mime hint (text/plain, application/pdf, application/json, ...). */
  mediaType: string;
  /** Original location the content came from (URL, file name, …). May be unknown. */
  sourceUri?: string;
  /** Provided by the operator: who handed us this blob and when. */
  submittedBy: string;
  submittedAt: string;
  /** The actual payload. Adapter-specific shape; never modified after capture. */
  payload: unknown;
}

// =============================================================================
// Normalized evidence
// =============================================================================

export interface RawReference {
  /** Adapter-local locator inside the raw payload (line range, JSON path, …). */
  locator: string;
  /** Optional verbatim quote, preserved for explainability. */
  excerpt?: string;
}

export interface EvidenceItem {
  /** Deterministic id. */
  id: string;
  kind: EvidenceKind;
  /** Short, deterministic claim string in the framework's vocabulary. */
  claim: string;
  /** Subject this evidence is *about* (candidate id, org id, role id). */
  subjectId: string;
  /** Adapter-attributed structured attributes (e.g. role, repo, language). */
  attributes: Record<string, string | number | boolean>;
  /** Confidence in [0,1] in the extracted claim, not the source. */
  confidence: Confidence;
  /** Adapter-reported reliability of the source this came from. */
  reliability: Confidence;
  /** Ambiguity markers — empty array means "unambiguous". */
  ambiguity: string[];
  /** Provenance, always present. */
  provenance: Provenance;
  /** Raw reference back into the originating payload. */
  rawReference: RawReference;
  /** Ids of upstream evidence items this depends on (within ingestion only). */
  derivedFromEvidenceIds?: string[];
}

// =============================================================================
// Reliability
// =============================================================================

export interface ReliabilityFactor {
  factor: string;
  delta: number;
  rationale: string;
}

export interface SourceReliabilityAssessment {
  sourceKind: IngestionSourceKind;
  rawId: string;
  reliabilityScore: Confidence;
  reliabilityFactors: ReliabilityFactor[];
  uncertainty: string[];
  conflictsDetected: number;
  rationale: string;
}

// =============================================================================
// Conflicts
// =============================================================================

export type ConflictSeverity = "low" | "medium" | "high";

export interface EvidenceConflict {
  id: string;
  description: string;
  severity: ConflictSeverity;
  impactedEvidenceIds: string[];
  unresolvedQuestions: string[];
  recommendedInvestigation: string;
  detectedAt: string;
}

// =============================================================================
// Audit
// =============================================================================

export type IngestionEventType =
  | "raw_received"
  | "parsed"
  | "normalized"
  | "evidence_extracted"
  | "provenance_attached"
  | "contradiction_precheck"
  | "evidence_graph_inserted"
  | "conflict_detected"
  | "reliability_assessed"
  | "warning_emitted";

export interface IngestionAuditEntry {
  /** Deterministic id. */
  id: string;
  jobId: string;
  type: IngestionEventType;
  occurredAt: string;
  sourceKind: IngestionSourceKind;
  rawId: string;
  detail: string;
  /** Optional structured payload for downstream replay. */
  data?: Record<string, unknown>;
}

// =============================================================================
// Normalized candidate / organization snapshots
// =============================================================================

export interface NormalizedCandidate {
  candidateId: string;
  displayName: string;
  headline?: string;
  /** Deterministic, deduplicated set of declared roles. */
  roles: Array<{
    title: string;
    organization: string;
    startedAt?: string;
    endedAt?: string;
    /** Confidence that this role is real *and* described accurately. */
    confidence: Confidence;
    ambiguity: string[];
  }>;
  skills: Array<{
    name: string;
    confidence: Confidence;
    /** Origin sources for this skill (sourceKind values). */
    sources: IngestionSourceKind[];
  }>;
  education: Array<{
    institution: string;
    credential?: string;
    confidence: Confidence;
  }>;
  unknowns: string[];
}

export interface NormalizedOrganization {
  organizationId: string;
  displayName: string;
  /** Map of field name → { value, confidence, provenance } */
  fields: Array<{
    field: string;
    value: string;
    confidence: Confidence;
    provenance: Provenance;
  }>;
  unknowns: string[];
}

// =============================================================================
// Pipeline output
// =============================================================================

export interface IngestionWarning {
  code: string;
  detail: string;
  severity: "info" | "warn" | "error";
}

export interface CandidatePipelineResult {
  jobId: string;
  candidateId: string;
  normalizedCandidate: NormalizedCandidate;
  extractedEvidence: EvidenceItem[];
  sourceReliability: SourceReliabilityAssessment[];
  conflicts: EvidenceConflict[];
  ingestionWarnings: IngestionWarning[];
  provenanceChain: Provenance[];
  audit: IngestionAuditEntry[];
}

export interface OrganizationPipelineResult {
  jobId: string;
  organizationId: string;
  normalizedOrganization: NormalizedOrganization;
  extractedEvidence: EvidenceItem[];
  sourceReliability: SourceReliabilityAssessment[];
  conflicts: EvidenceConflict[];
  ingestionWarnings: IngestionWarning[];
  provenanceChain: Provenance[];
  audit: IngestionAuditEntry[];
}

// =============================================================================
// Job records
// =============================================================================

export type IngestionJobKind = "candidate" | "organization" | "transcript";
export type IngestionJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface IngestionJob {
  id: string;
  kind: IngestionJobKind;
  status: IngestionJobStatus;
  subjectId: string;
  submittedBy: string;
  submittedAt: string;
  completedAt: string;
  sourceKinds: IngestionSourceKind[];
  evidenceCount: number;
  conflictCount: number;
  warningCount: number;
  reliabilityAverage: Confidence;
}

// =============================================================================
// Adapter contract
// =============================================================================

export interface AdapterContext {
  /** Subject id (candidate id or organization id). */
  subjectId: string;
  /** Fixed "now" used for produced-at timestamps. ISO. */
  now: string;
  /** Id of the ingestion job this adapter is running under. */
  jobId: string;
}

export interface AdapterOutput {
  evidence: EvidenceItem[];
  reliability: SourceReliabilityAssessment;
  warnings: IngestionWarning[];
}

export interface EvidenceAdapter {
  sourceKind: IngestionSourceKind;
  /** Pure function: same envelope + context ⇒ same output. */
  ingest(envelope: RawInputEnvelope, ctx: AdapterContext): AdapterOutput;
}
