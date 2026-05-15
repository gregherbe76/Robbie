/**
 * CandidateEvidenceIngestionPipeline.
 *
 * Stages, in order:
 *   1. raw_received          — record envelopes
 *   2. parsed                — adapter parses each envelope
 *   3. normalized            — dedupe + merge across adapter outputs
 *   4. evidence_extracted    — finalize evidence set
 *   5. provenance_attached   — validate every item carries provenance
 *   6. contradiction_precheck— scan for ingestion-layer conflicts
 *   7. evidence_graph_inserted — finalize normalized candidate snapshot
 *
 * Every stage emits an audit entry.
 */

import type {
  AdapterContext,
  CandidatePipelineResult,
  EvidenceAdapter,
  EvidenceItem,
  IngestionWarning,
  NormalizedCandidate,
  RawInputEnvelope,
  SourceReliabilityAssessment,
} from "./types.js";
import { ProvenanceCaptureEngine } from "./provenance.js";
import { EvidenceNormalizationEngine } from "./normalization.js";
import { EvidenceConflictDetector } from "./conflicts.js";
import { IngestionAuditEngine } from "./audit.js";
import { makeId } from "./hash.js";

export interface CandidatePipelineInputs {
  jobId: string;
  candidateId: string;
  candidateDisplayName: string;
  envelopes: RawInputEnvelope[];
  adapters: EvidenceAdapter[];
  now: string;
}

export class CandidateEvidenceIngestionPipeline {
  private normalizer = new EvidenceNormalizationEngine();
  private conflictDetector = new EvidenceConflictDetector();
  private provenance = new ProvenanceCaptureEngine();

  run(inputs: CandidatePipelineInputs): CandidatePipelineResult {
    const audit = new IngestionAuditEngine();
    const allEvidence: EvidenceItem[] = [];
    const reliability: SourceReliabilityAssessment[] = [];
    const warnings: IngestionWarning[] = [];

    const ctx: AdapterContext = {
      subjectId: inputs.candidateId,
      now: inputs.now,
      jobId: inputs.jobId,
    };

    // 1. raw_received
    for (const env of inputs.envelopes) {
      audit.record({
        jobId: inputs.jobId,
        type: "raw_received",
        occurredAt: inputs.now,
        sourceKind: env.sourceKind,
        rawId: env.rawId,
        detail: `received ${env.sourceKind} payload from ${env.submittedBy}`,
      });
    }

    // 2. parsed + extracted (per adapter)
    for (const env of inputs.envelopes) {
      const adapter = inputs.adapters.find((a) => a.sourceKind === env.sourceKind);
      if (!adapter) {
        warnings.push({
          code: "no_adapter",
          severity: "warn",
          detail: `no adapter registered for source kind ${env.sourceKind}`,
        });
        audit.record({
          jobId: inputs.jobId,
          type: "warning_emitted",
          occurredAt: inputs.now,
          sourceKind: env.sourceKind,
          rawId: env.rawId,
          detail: `no adapter for ${env.sourceKind}`,
        });
        continue;
      }
      const out = adapter.ingest(env, ctx);
      allEvidence.push(...out.evidence);
      reliability.push(out.reliability);
      warnings.push(...out.warnings);
      audit.record({
        jobId: inputs.jobId,
        type: "parsed",
        occurredAt: inputs.now,
        sourceKind: env.sourceKind,
        rawId: env.rawId,
        detail: `${adapter.sourceKind} adapter produced ${out.evidence.length} evidence item(s)`,
        data: { evidenceCount: out.evidence.length, reliability: out.reliability.reliabilityScore },
      });
      audit.record({
        jobId: inputs.jobId,
        type: "reliability_assessed",
        occurredAt: inputs.now,
        sourceKind: env.sourceKind,
        rawId: env.rawId,
        detail: `reliability=${out.reliability.reliabilityScore.toFixed(2)}`,
        data: { factors: out.reliability.reliabilityFactors.length },
      });
    }

    // 3. normalized
    const normalized = this.normalizer.normalize(allEvidence);
    audit.record({
      jobId: inputs.jobId,
      type: "normalized",
      occurredAt: inputs.now,
      sourceKind: "external_evidence",
      rawId: inputs.jobId,
      detail: `normalized ${allEvidence.length} → ${normalized.length} evidence item(s)`,
    });

    // 4. evidence_extracted
    audit.record({
      jobId: inputs.jobId,
      type: "evidence_extracted",
      occurredAt: inputs.now,
      sourceKind: "external_evidence",
      rawId: inputs.jobId,
      detail: `final evidence set size = ${normalized.length}`,
    });

    // 5. provenance_attached — validate
    const provCheck = this.provenance.validate(normalized);
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
      sourceKind: "external_evidence",
      rawId: inputs.jobId,
      detail: `provenance ${provCheck.ok ? "ok" : `${provCheck.violations.length} violation(s)`}`,
    });

    // 6. contradiction_precheck — ingestion-layer conflicts
    const conflicts = this.conflictDetector.detect({ evidence: normalized, now: inputs.now });
    audit.record({
      jobId: inputs.jobId,
      type: "contradiction_precheck",
      occurredAt: inputs.now,
      sourceKind: "external_evidence",
      rawId: inputs.jobId,
      detail: `${conflicts.length} conflict(s) detected`,
    });
    for (const c of conflicts) {
      audit.record({
        jobId: inputs.jobId,
        type: "conflict_detected",
        occurredAt: inputs.now,
        sourceKind: "external_evidence",
        rawId: inputs.jobId,
        detail: c.description,
        data: { severity: c.severity, conflictId: c.id },
      });
    }

    // 7. evidence_graph_inserted — build normalized candidate snapshot
    const normalizedCandidate = this.buildSnapshot(
      inputs.candidateId,
      inputs.candidateDisplayName,
      normalized,
    );
    audit.record({
      jobId: inputs.jobId,
      type: "evidence_graph_inserted",
      occurredAt: inputs.now,
      sourceKind: "external_evidence",
      rawId: inputs.jobId,
      detail: `candidate snapshot built with ${normalizedCandidate.roles.length} role(s), ${normalizedCandidate.skills.length} skill(s)`,
    });

    return {
      jobId: inputs.jobId,
      candidateId: inputs.candidateId,
      normalizedCandidate,
      extractedEvidence: normalized,
      sourceReliability: reliability,
      conflicts,
      ingestionWarnings: warnings,
      provenanceChain: this.provenance.chain(normalized),
      audit: audit.entriesFor(inputs.jobId),
    };
  }

  private buildSnapshot(
    candidateId: string,
    displayName: string,
    evidence: EvidenceItem[],
  ): NormalizedCandidate {
    const roleEvidence = evidence.filter(
      (e) => e.kind === "explicit_claim" && e.attributes["fieldType"] === "role",
    );
    const roles = roleEvidence
      .map((e) => ({
        title: String(e.attributes["title"] ?? ""),
        organization: String(e.attributes["company"] ?? ""),
        startedAt: (e.attributes["startedAt"] as string) || undefined,
        endedAt: (e.attributes["endedAt"] as string) || undefined,
        confidence: e.confidence,
        ambiguity: e.ambiguity,
      }))
      .filter((r) => r.title && r.organization);

    const skillMap = new Map<
      string,
      { confidence: number; sources: Set<string> }
    >();
    for (const e of evidence) {
      if (e.kind === "explicit_claim" && e.attributes["fieldType"] === "skill") {
        const key = String(e.attributes["skill"]);
        const sourceKind = (e.provenance.derivedFrom ?? [])[0]?.split(":")[0];
        const entry = skillMap.get(key) ?? { confidence: 0, sources: new Set<string>() };
        entry.confidence = Math.max(entry.confidence, e.confidence);
        if (sourceKind) entry.sources.add(sourceKind);
        skillMap.set(key, entry);
      }
    }
    const skills = Array.from(skillMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, { confidence, sources }]) => ({
        name,
        confidence,
        sources: Array.from(sources).sort() as NormalizedCandidate["skills"][number]["sources"],
      }));

    const education = evidence
      .filter((e) => e.kind === "explicit_claim" && e.attributes["fieldType"] === "education")
      .map((e) => ({
        institution: String(e.attributes["entry"] ?? "").split(",")[0]?.trim() ?? "",
        confidence: e.confidence,
      }))
      .filter((e) => e.institution.length > 0);

    const headlineEv = evidence.find((e) => e.attributes["fieldType"] === "headline");
    const headline = headlineEv ? String(headlineEv.attributes["headline"]) : undefined;

    const unknowns: string[] = [];
    if (roles.length === 0) unknowns.push("role_history_unknown");
    if (skills.length === 0) unknowns.push("skill_set_unknown");
    if (education.length === 0) unknowns.push("education_unknown");

    return {
      candidateId,
      displayName,
      headline,
      roles,
      skills,
      education,
      unknowns,
    };
  }
}

/** Deterministic helper that callers can use to mint stable job ids. */
export function makeJobId(...parts: string[]): string {
  return makeId("ingjob", ...parts);
}
