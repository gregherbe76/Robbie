/**
 * GitHubEvidenceAdapter.
 *
 * Does NOT reduce GitHub to stars/followers. Extracts evidence about:
 *   - repository ownership signals (sole vs. shared contributors)
 *   - project complexity (depth: file count, language count)
 *   - consistency (commits over time bucketed by month)
 *   - maintenance patterns (recent activity vs. stale)
 *   - architecture indicators (presence of README, tests, CI hints)
 *   - OSS participation (external PRs)
 *
 * The adapter is pure: same input ⇒ same output. No network calls. The
 * payload is the already-fetched GitHub snapshot.
 */

import type {
  AdapterContext,
  AdapterOutput,
  EvidenceAdapter,
  EvidenceItem,
  IngestionWarning,
  RawInputEnvelope,
} from "../types.js";
import { ProvenanceCaptureEngine } from "../provenance.js";
import { SourceReliabilityEngine } from "../reliability.js";
import { makeId } from "../hash.js";

export interface GitHubRepoSnapshot {
  name: string;
  url: string;
  primaryLanguage?: string;
  languages?: string[];
  fileCount?: number;
  commitCount?: number;
  recentCommitMonths?: number[];
  contributors?: { login: string; commits: number }[];
  hasReadme?: boolean;
  hasTests?: boolean;
  hasCi?: boolean;
  isFork?: boolean;
  starCount?: number;
}

export interface GitHubPayload {
  login: string;
  profileUrl: string;
  repositories: GitHubRepoSnapshot[];
  externalContributions?: Array<{ repoUrl: string; commits: number }>;
  fetchedAt: string;
}

export class GitHubEvidenceAdapter implements EvidenceAdapter {
  readonly sourceKind = "github" as const;
  private prov = new ProvenanceCaptureEngine();
  private reliability = new SourceReliabilityEngine();

  ingest(envelope: RawInputEnvelope, ctx: AdapterContext): AdapterOutput {
    const warnings: IngestionWarning[] = [];
    const evidence: EvidenceItem[] = [];

    if (envelope.sourceKind !== "github") {
      warnings.push({
        code: "wrong_source_kind",
        severity: "error",
        detail: `expected github, got ${envelope.sourceKind}`,
      });
      return this.empty(envelope, ctx, warnings);
    }

    const payload = envelope.payload as GitHubPayload;
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.repositories)) {
      warnings.push({
        code: "malformed_payload",
        severity: "error",
        detail: "github payload missing required 'repositories' array",
      });
      return this.empty(envelope, ctx, warnings);
    }

    const produceProv = (locator: string, rationale: string, derivedFrom: string[] = []) =>
      this.prov.build({
        producedBy: "ingestion.github",
        producedAt: ctx.now,
        sourceKind: "github",
        extractionMethod: "github_evidence_adapter_v1",
        rawId: envelope.rawId,
        rationale,
        derivedFrom: [`github:${envelope.rawId}:${locator}`, ...derivedFrom],
      });

    let unsupported = 0;
    let contradictions = 0;

    for (const repo of payload.repositories) {
      if (!repo.name) {
        warnings.push({
          code: "repo_missing_name",
          severity: "warn",
          detail: "repository entry missing name; skipped",
        });
        continue;
      }

      const repoLocator = `repo:${repo.name}`;

      // Ownership
      const contributors = repo.contributors ?? [];
      const totalCommits =
        contributors.reduce((s, c) => s + (c.commits ?? 0), 0) || repo.commitCount || 0;
      const ownerEntry = contributors.find((c) => c.login === payload.login);
      const ownerCommits = ownerEntry?.commits ?? 0;
      const ownership = totalCommits > 0 ? ownerCommits / totalCommits : 0;

      evidence.push({
        id: makeId("ev", envelope.rawId, repo.name, "ownership"),
        kind: "ownership_signal",
        subjectId: ctx.subjectId,
        claim: `owns ${(ownership * 100).toFixed(0)}% of commits in ${repo.name}`,
        attributes: {
          repo: repo.name,
          repoUrl: repo.url,
          ownership,
          totalCommits,
          ownerCommits,
        },
        confidence: totalCommits > 0 ? 0.85 : 0.4,
        reliability: 0.9,
        ambiguity: totalCommits === 0 ? ["no_commit_data"] : [],
        provenance: produceProv(repoLocator, `ownership ratio in ${repo.name}`),
        rawReference: { locator: `$.repositories[?(@.name=='${repo.name}')]` },
      });

      // Complexity
      const langs = repo.languages?.length ?? (repo.primaryLanguage ? 1 : 0);
      const fileCount = repo.fileCount ?? 0;
      const depth = Math.min(
        5,
        Math.max(1, Math.round((langs * 0.4 + Math.log10(Math.max(1, fileCount))) | 0) || 1),
      );
      evidence.push({
        id: makeId("ev", envelope.rawId, repo.name, "complexity"),
        kind: "demonstrated_behavior",
        subjectId: ctx.subjectId,
        claim: `project ${repo.name} complexity depth ≈ ${depth}`,
        attributes: {
          repo: repo.name,
          depth,
          languages: langs,
          fileCount,
        },
        confidence: fileCount > 0 ? 0.7 : 0.4,
        reliability: 0.85,
        ambiguity: fileCount === 0 ? ["unknown_file_count"] : [],
        provenance: produceProv(repoLocator, `project complexity in ${repo.name}`),
        rawReference: { locator: `$.repositories[?(@.name=='${repo.name}')].fileCount` },
      });

      // Consistency (commit cadence stddev)
      const months = repo.recentCommitMonths ?? [];
      if (months.length > 0) {
        const mean = months.reduce((a, b) => a + b, 0) / months.length;
        const variance =
          months.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, months.length);
        const stddev = Math.sqrt(variance);
        const consistency = mean > 0 ? Math.max(0, 1 - stddev / Math.max(1, mean)) : 0;
        evidence.push({
          id: makeId("ev", envelope.rawId, repo.name, "consistency"),
          kind: "trajectory_signal",
          subjectId: ctx.subjectId,
          claim: `${repo.name} commit cadence consistency ${(consistency * 100).toFixed(0)}%`,
          attributes: { repo: repo.name, consistency, months: months.length },
          confidence: 0.7,
          reliability: 0.85,
          ambiguity: months.length < 3 ? ["short_window"] : [],
          provenance: produceProv(repoLocator, `commit cadence consistency in ${repo.name}`),
          rawReference: { locator: `$.repositories[?(@.name=='${repo.name}')].recentCommitMonths` },
        });
      }

      // Architecture indicators
      const arch: string[] = [];
      if (repo.hasReadme) arch.push("readme");
      if (repo.hasTests) arch.push("tests");
      if (repo.hasCi) arch.push("ci");
      evidence.push({
        id: makeId("ev", envelope.rawId, repo.name, "architecture"),
        kind: "demonstrated_behavior",
        subjectId: ctx.subjectId,
        claim: `${repo.name} architecture indicators: ${arch.join(",") || "none"}`,
        attributes: {
          repo: repo.name,
          hasReadme: !!repo.hasReadme,
          hasTests: !!repo.hasTests,
          hasCi: !!repo.hasCi,
          score: arch.length,
        },
        confidence: 0.75,
        reliability: 0.9,
        ambiguity: [],
        provenance: produceProv(repoLocator, `architecture indicators in ${repo.name}`),
        rawReference: { locator: `$.repositories[?(@.name=='${repo.name}')]` },
      });

      // Fork penalty as an uncertainty signal (not a value judgment)
      if (repo.isFork) {
        evidence.push({
          id: makeId("ev", envelope.rawId, repo.name, "fork"),
          kind: "uncertainty_signal",
          subjectId: ctx.subjectId,
          claim: `${repo.name} is a fork; original authorship attribution ambiguous`,
          attributes: { repo: repo.name, fork: true },
          confidence: 0.95,
          reliability: 0.95,
          ambiguity: ["fork_origin"],
          provenance: produceProv(repoLocator, `${repo.name} marked as fork`),
          rawReference: { locator: `$.repositories[?(@.name=='${repo.name}')].isFork` },
        });
      }

      // Maintenance
      const recent = months.length > 0 ? months[months.length - 1]! : 0;
      if (recent === 0 && repo.commitCount && repo.commitCount > 0) {
        evidence.push({
          id: makeId("ev", envelope.rawId, repo.name, "stale"),
          kind: "uncertainty_signal",
          subjectId: ctx.subjectId,
          claim: `${repo.name} has commits but recent activity is zero`,
          attributes: { repo: repo.name, stale: true },
          confidence: 0.8,
          reliability: 0.85,
          ambiguity: ["maintenance_pause"],
          provenance: produceProv(repoLocator, `${repo.name} maintenance pause`),
          rawReference: { locator: `$.repositories[?(@.name=='${repo.name}')].recentCommitMonths` },
        });
      }
    }

    // OSS participation
    for (const ext of payload.externalContributions ?? []) {
      evidence.push({
        id: makeId("ev", envelope.rawId, "ext", ext.repoUrl),
        kind: "ownership_signal",
        subjectId: ctx.subjectId,
        claim: `external OSS contribution: ${ext.commits} commit(s) to ${ext.repoUrl}`,
        attributes: { repoUrl: ext.repoUrl, commits: ext.commits, external: true },
        confidence: 0.8,
        reliability: 0.9,
        ambiguity: ext.commits <= 1 ? ["single_commit_only"] : [],
        provenance: produceProv(
          `external:${ext.repoUrl}`,
          `external OSS contribution`,
        ),
        rawReference: { locator: `$.externalContributions[?(@.repoUrl=='${ext.repoUrl}')]` },
      });
    }

    // Cross-repo trajectory
    const repoCount = payload.repositories.length;
    evidence.push({
      id: makeId("ev", envelope.rawId, "profile_trajectory"),
      kind: "trajectory_signal",
      subjectId: ctx.subjectId,
      claim: `github profile spans ${repoCount} repositories with ${payload.externalContributions?.length ?? 0} external contribution(s)`,
      attributes: {
        repoCount,
        externalContributions: payload.externalContributions?.length ?? 0,
      },
      confidence: 0.75,
      reliability: 0.9,
      ambiguity: repoCount === 0 ? ["empty_profile"] : [],
      provenance: produceProv("profile", `profile trajectory`),
      rawReference: { locator: "$" },
    });

    if (payload.repositories.length === 0) {
      warnings.push({
        code: "empty_repo_set",
        severity: "warn",
        detail: "github payload contained no repositories",
      });
      unsupported++;
    }

    const reliability = this.reliability.assess({
      sourceKind: "github",
      rawId: envelope.rawId,
      evidence,
      contradictionCount: contradictions,
      unsupportedClaimCount: unsupported,
      structuredPayload: true,
    });

    return { evidence, reliability, warnings };
  }

  private empty(envelope: RawInputEnvelope, ctx: AdapterContext, warnings: IngestionWarning[]): AdapterOutput {
    return {
      evidence: [],
      reliability: this.reliability.assess({
        sourceKind: "github",
        rawId: envelope.rawId,
        evidence: [],
        unsupportedClaimCount: 1,
      }),
      warnings,
    };
  }
}
