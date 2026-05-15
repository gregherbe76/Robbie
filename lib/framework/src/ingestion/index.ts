/**
 * Ingestion layer — public surface.
 *
 * The boundary between the outside world and the cognition layer. Every
 * piece of evidence that enters the framework here carries explicit
 * provenance, reliability, and uncertainty.
 *
 * Use the IngestionGateway from application code; the engines and
 * adapters are exposed so callers can compose pipelines or swap adapters.
 */

export type {
  AdapterContext,
  AdapterOutput,
  CandidatePipelineResult,
  ConflictSeverity,
  EvidenceAdapter,
  EvidenceConflict,
  EvidenceItem,
  EvidenceKind,
  IngestionAuditEntry,
  IngestionEventType,
  IngestionJob,
  IngestionJobKind,
  IngestionJobStatus,
  IngestionSourceKind,
  IngestionWarning,
  NormalizedCandidate,
  NormalizedOrganization,
  OrganizationPipelineResult,
  RawInputEnvelope,
  RawReference,
  ReliabilityFactor,
  SourceReliabilityAssessment,
} from "./types.js";

export { ProvenanceCaptureEngine, combineConfidences } from "./provenance.js";
export { SourceReliabilityEngine } from "./reliability.js";
export { EvidenceNormalizationEngine } from "./normalization.js";
export { EvidenceConflictDetector, countContradictionsBySource } from "./conflicts.js";
export { IngestionAuditEngine, type EvidenceLineageNode } from "./audit.js";

export {
  CandidateEvidenceIngestionPipeline,
  makeJobId,
  type CandidatePipelineInputs,
} from "./candidate_pipeline.js";
export {
  OrganizationContextIngestionPipeline,
  type OrganizationPipelineInputs,
  type OrganizationSource,
  type OrganizationSourceKind,
} from "./organization_pipeline.js";

export {
  IngestionGateway,
  type GatewayState,
  type IngestCandidateInput,
  type IngestOrganizationInput,
  type IngestTranscriptInput,
} from "./gateway.js";

export { GitHubEvidenceAdapter, type GitHubPayload, type GitHubRepoSnapshot } from "./adapters/github.js";
export { LinkedInProfileAdapter, type LinkedInPayload, type LinkedInRole } from "./adapters/linkedin.js";
export { ResumeParsingAdapter, type ResumePayload } from "./adapters/resume.js";
export {
  InterviewTranscriptAdapter,
  type TranscriptPayload,
  type TranscriptTurn,
} from "./adapters/transcript.js";

export { makeId as makeIngestionId, fnv1a as ingestionHash } from "./hash.js";
