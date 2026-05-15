/**
 * IngestionGateway.
 *
 * The framework's single entry point for outside-world evidence. Holds an
 * adapter registry, dispatches envelopes to the right pipeline, maintains
 * a job log, and exposes deduplicated evidence + conflict views.
 *
 * Hard rules:
 *   - never overwrite existing evidence silently
 *   - never drop conflicting evidence
 *   - every operation produces an ingestion event + audit log entry
 */

import type {
  CandidatePipelineResult,
  EvidenceAdapter,
  EvidenceItem,
  IngestionJob,
  IngestionJobKind,
  IngestionSourceKind,
  OrganizationPipelineResult,
  RawInputEnvelope,
} from "./types.js";
import {
  CandidateEvidenceIngestionPipeline,
  makeJobId,
} from "./candidate_pipeline.js";
import {
  OrganizationContextIngestionPipeline,
  type OrganizationSource,
} from "./organization_pipeline.js";
import { fnv1a } from "./hash.js";
import { GitHubEvidenceAdapter } from "./adapters/github.js";
import { LinkedInProfileAdapter } from "./adapters/linkedin.js";
import { ResumeParsingAdapter } from "./adapters/resume.js";
import { InterviewTranscriptAdapter } from "./adapters/transcript.js";

function fingerprint(env: RawInputEnvelope): string {
  try {
    return fnv1a(JSON.stringify(env.payload ?? null));
  } catch {
    return fnv1a(String(env.payload));
  }
}

export interface IngestCandidateInput {
  candidateId: string;
  candidateDisplayName: string;
  envelopes: RawInputEnvelope[];
  submittedBy: string;
  /** Fixed clock for deterministic runs. */
  now: string;
}

export interface IngestOrganizationInput {
  organizationId: string;
  organizationName: string;
  sources: OrganizationSource[];
  submittedBy: string;
  now: string;
}

export interface IngestTranscriptInput {
  candidateId: string;
  envelope: RawInputEnvelope;
  submittedBy: string;
  now: string;
}

export interface GatewayState {
  jobs: IngestionJob[];
  candidateResults: Record<string, CandidatePipelineResult>;
  organizationResults: Record<string, OrganizationPipelineResult>;
  /** Job id → pipeline result (candidate or org), for /events/{id} lookup. */
  resultsByJobId: Record<string, CandidatePipelineResult | OrganizationPipelineResult>;
}

export class IngestionGateway {
  private adapters: EvidenceAdapter[];
  private candidatePipeline = new CandidateEvidenceIngestionPipeline();
  private orgPipeline = new OrganizationContextIngestionPipeline();

  private jobs: IngestionJob[] = [];
  private candidateResults = new Map<string, CandidatePipelineResult>();
  private organizationResults = new Map<string, OrganizationPipelineResult>();
  private resultsByJobId = new Map<string, CandidatePipelineResult | OrganizationPipelineResult>();
  /** Job id → list of envelopes that came in with that job (for the candidate pipeline). */
  private envelopesByCandidate = new Map<string, RawInputEnvelope[]>();
  /** sourceKind:rawId → content fingerprint, used to refuse silent overwrites. */
  private envelopeFingerprints = new Map<string, string>();

  constructor(adapters?: EvidenceAdapter[]) {
    this.adapters = adapters ?? [
      new GitHubEvidenceAdapter(),
      new LinkedInProfileAdapter(),
      new ResumeParsingAdapter(),
      new InterviewTranscriptAdapter(),
    ];
  }

  registerAdapter(adapter: EvidenceAdapter): void {
    this.adapters = this.adapters.filter((a) => a.sourceKind !== adapter.sourceKind);
    this.adapters.push(adapter);
  }

  supportedSourceKinds(): IngestionSourceKind[] {
    const set = new Set<IngestionSourceKind>(this.adapters.map((a) => a.sourceKind));
    // organization_context is handled by the org pipeline, not an adapter
    set.add("organization_context");
    return Array.from(set).sort();
  }

  // ---------------------------------------------------------------------------

  ingestCandidate(input: IngestCandidateInput): CandidatePipelineResult {
    const jobId = makeJobId("candidate", input.candidateId, input.now, String(input.envelopes.length));
    const previous = this.candidateResults.get(input.candidateId);

    // Dedupe — never silently overwrite evidence. We merge with the prior
    // candidate result if there is one; conflicts will surface explicitly.
    const mergedEnvelopes = this.mergeCandidateEnvelopes(
      input.candidateId,
      input.envelopes,
    );

    const result = this.candidatePipeline.run({
      jobId,
      candidateId: input.candidateId,
      candidateDisplayName: input.candidateDisplayName,
      envelopes: mergedEnvelopes,
      adapters: this.adapters,
      now: input.now,
    });

    // Carry forward provenance from previous result so the chain is never lost.
    if (previous) {
      const merged: CandidatePipelineResult = {
        ...result,
        provenanceChain: [...previous.provenanceChain, ...result.provenanceChain],
      };
      this.candidateResults.set(input.candidateId, merged);
      this.resultsByJobId.set(jobId, merged);
      this.recordJob(jobId, "candidate", input, merged);
      return merged;
    }

    this.candidateResults.set(input.candidateId, result);
    this.resultsByJobId.set(jobId, result);
    this.recordJob(jobId, "candidate", input, result);
    return result;
  }

  ingestOrganization(input: IngestOrganizationInput): OrganizationPipelineResult {
    const jobId = makeJobId(
      "organization",
      input.organizationId,
      input.now,
      String(input.sources.length),
    );
    const result = this.orgPipeline.run({
      jobId,
      organizationId: input.organizationId,
      organizationName: input.organizationName,
      sources: input.sources,
      now: input.now,
    });
    this.organizationResults.set(input.organizationId, result);
    this.resultsByJobId.set(jobId, result);
    this.recordJobOrg(jobId, input, result);
    return result;
  }

  ingestTranscript(input: IngestTranscriptInput): CandidatePipelineResult {
    return this.ingestCandidate({
      candidateId: input.candidateId,
      candidateDisplayName: input.candidateId,
      envelopes: [input.envelope],
      submittedBy: input.submittedBy,
      now: input.now,
    });
  }

  // ---------------------------------------------------------------------------

  getCandidateResult(candidateId: string): CandidatePipelineResult | undefined {
    return this.candidateResults.get(candidateId);
  }

  getOrganizationResult(organizationId: string): OrganizationPipelineResult | undefined {
    return this.organizationResults.get(organizationId);
  }

  getJob(id: string): IngestionJob | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  getResultByJobId(id: string): CandidatePipelineResult | OrganizationPipelineResult | undefined {
    return this.resultsByJobId.get(id);
  }

  state(): GatewayState {
    return {
      jobs: [...this.jobs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
      candidateResults: Object.fromEntries(this.candidateResults),
      organizationResults: Object.fromEntries(this.organizationResults),
      resultsByJobId: Object.fromEntries(this.resultsByJobId),
    };
  }

  /** Aggregate ingestion events across all jobs. */
  auditFor(subjectId: string): {
    jobs: IngestionJob[];
    evidence: EvidenceItem[];
    auditEntries: Array<{
      jobId: string;
      type: string;
      occurredAt: string;
      sourceKind: string;
      detail: string;
    }>;
  } {
    const candidate = this.candidateResults.get(subjectId);
    const org = this.organizationResults.get(subjectId);
    const result = candidate ?? org;
    const jobs = this.jobs.filter((j) => j.subjectId === subjectId);
    return {
      jobs,
      evidence: result?.extractedEvidence ?? [],
      auditEntries:
        result?.audit.map((e) => ({
          jobId: e.jobId,
          type: e.type,
          occurredAt: e.occurredAt,
          sourceKind: e.sourceKind,
          detail: e.detail,
        })) ?? [],
    };
  }

  // ---------------------------------------------------------------------------

  private mergeCandidateEnvelopes(
    candidateId: string,
    incoming: RawInputEnvelope[],
  ): RawInputEnvelope[] {
    const prior = this.envelopesByCandidate.get(candidateId) ?? [];
    const byKey = new Map<string, RawInputEnvelope>();
    for (const env of prior) {
      byKey.set(`${env.sourceKind}:${env.rawId}`, env);
    }
    for (const env of incoming) {
      const key = `${env.sourceKind}:${env.rawId}`;
      const fp = fingerprint(env);
      const seen = this.envelopeFingerprints.get(key);
      if (seen && seen !== fp) {
        // Non-destructive dedup: same (sourceKind,rawId) re-submitted with a
        // different payload would be a silent overwrite. We refuse — the caller
        // must supply a new rawId so prior provenance is preserved.
        throw new Error(
          `ingestion_overwrite_refused: ${key} already ingested with a different payload`,
        );
      }
      this.envelopeFingerprints.set(key, fp);
      if (!byKey.has(key)) {
        byKey.set(key, env);
      }
    }
    const merged = Array.from(byKey.values()).sort((a, b) =>
      (a.sourceKind + a.rawId).localeCompare(b.sourceKind + b.rawId),
    );
    this.envelopesByCandidate.set(candidateId, merged);
    return merged;
  }

  private recordJob(
    jobId: string,
    kind: IngestionJobKind,
    input: IngestCandidateInput,
    result: CandidatePipelineResult,
  ): void {
    const reliabilityAvg =
      result.sourceReliability.length === 0
        ? 0
        : result.sourceReliability.reduce((s, r) => s + r.reliabilityScore, 0) /
          result.sourceReliability.length;
    const job: IngestionJob = {
      id: jobId,
      kind,
      status: "succeeded",
      subjectId: input.candidateId,
      submittedBy: input.submittedBy,
      submittedAt: input.now,
      completedAt: input.now,
      sourceKinds: Array.from(new Set(input.envelopes.map((e) => e.sourceKind))).sort(),
      evidenceCount: result.extractedEvidence.length,
      conflictCount: result.conflicts.length,
      warningCount: result.ingestionWarnings.length,
      reliabilityAverage: reliabilityAvg,
    };
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    this.jobs.push(job);
  }

  private recordJobOrg(
    jobId: string,
    input: IngestOrganizationInput,
    result: OrganizationPipelineResult,
  ): void {
    const reliabilityAvg =
      result.sourceReliability.length === 0
        ? 0
        : result.sourceReliability.reduce((s, r) => s + r.reliabilityScore, 0) /
          result.sourceReliability.length;
    const job: IngestionJob = {
      id: jobId,
      kind: "organization",
      status: "succeeded",
      subjectId: input.organizationId,
      submittedBy: input.submittedBy,
      submittedAt: input.now,
      completedAt: input.now,
      sourceKinds: ["organization_context"],
      evidenceCount: result.extractedEvidence.length,
      conflictCount: result.conflicts.length,
      warningCount: result.ingestionWarnings.length,
      reliabilityAverage: reliabilityAvg,
    };
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    this.jobs.push(job);
  }
}
