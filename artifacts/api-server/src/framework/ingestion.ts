/**
 * Bootstraps the ingestion layer with deterministic sample evidence so the
 * console UI is populated on first boot. No randomness, no Date.now(), no
 * hidden inference: every envelope here is explicit data captured in code.
 */

import {
  IngestionGateway,
  type CandidatePipelineResult,
  type GatewayState,
  type OrganizationPipelineResult,
  type RawInputEnvelope,
  type IngestionJob,
  type EvidenceItem,
  type IngestionAuditEntry,
} from "@workspace/framework/ingestion";

const NOW = "2026-05-15T09:00:00.000Z";

const githubEnvelope: RawInputEnvelope = {
  rawId: "raw-gh-ada-1",
  sourceKind: "github",
  mediaType: "application/json",
  sourceUri: "https://github.com/ada-l",
  submittedBy: "intake-bot",
  submittedAt: NOW,
  payload: {
    login: "ada-l",
    profileUrl: "https://github.com/ada-l",
    fetchedAt: NOW,
    repositories: [
      {
        name: "distributed-consensus",
        url: "https://github.com/ada-l/distributed-consensus",
        primaryLanguage: "Rust",
        languages: ["Rust", "Shell"],
        fileCount: 184,
        commitCount: 412,
        recentCommitMonths: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        contributors: [
          { login: "ada-l", commits: 321 },
          { login: "sasha", commits: 64 },
          { login: "kai", commits: 27 },
        ],
        hasReadme: true,
        hasTests: true,
        hasCi: true,
        isFork: false,
        starCount: 312,
      },
      {
        name: "ml-eval-toolkit",
        url: "https://github.com/ada-l/ml-eval-toolkit",
        primaryLanguage: "Python",
        languages: ["Python"],
        fileCount: 62,
        commitCount: 88,
        recentCommitMonths: [10, 9, 8, 4, 2],
        contributors: [
          { login: "ada-l", commits: 36 },
          { login: "lin", commits: 28 },
          { login: "max", commits: 24 },
        ],
        hasReadme: true,
        hasTests: false,
        hasCi: false,
        isFork: false,
        starCount: 17,
      },
      {
        name: "rust-async-cookbook",
        url: "https://github.com/ada-l/rust-async-cookbook",
        primaryLanguage: "Rust",
        languages: ["Rust"],
        fileCount: 9,
        commitCount: 4,
        recentCommitMonths: [11],
        contributors: [{ login: "ada-l", commits: 4 }],
        hasReadme: false,
        hasTests: false,
        hasCi: false,
        isFork: true,
        starCount: 0,
      },
    ],
    externalContributions: [
      { repoUrl: "https://github.com/foundation/tokio", commits: 6 },
    ],
  },
};

const linkedinEnvelope: RawInputEnvelope = {
  rawId: "raw-li-ada-1",
  sourceKind: "linkedin",
  mediaType: "application/json",
  sourceUri: "https://linkedin.com/in/ada-l",
  submittedBy: "intake-bot",
  submittedAt: NOW,
  payload: {
    displayName: "Ada L.",
    headline: "Distributed Systems Engineer",
    roles: [
      {
        title: "Staff Engineer",
        company: "PaymentsCo",
        startedAt: "2024-01-01",
        endedAt: null,
        descriptor: "Led architecture for consensus layer",
      },
      {
        title: "Senior Engineer",
        company: "PaymentsCo",
        startedAt: "2022-06-01",
        endedAt: "2023-12-31",
        descriptor: "Built distributed transaction log",
      },
      {
        title: "Engineer",
        company: "StartupX",
        startedAt: "2019-03-01",
        endedAt: "2021-09-01",
        descriptor: "Synergized cross-functional initiatives",
      },
    ],
  },
};

const resumeEnvelope: RawInputEnvelope = {
  rawId: "raw-resume-ada-1",
  sourceKind: "resume",
  mediaType: "text/plain",
  submittedBy: "ada-l@example.com",
  submittedAt: NOW,
  payload: {
    text: [
      "Ada L. — Distributed Systems Engineer",
      "",
      "Experience",
      "Staff Engineer, PaymentsCo (2024 - Present)",
      "Architected the entire consensus layer single-handedly.",
      "Senior Engineer, PaymentsCo (2022 - 2023)",
      "Owned the distributed transaction log end-to-end.",
      "Engineer, StartupX (2019 - 2021)",
      "Drove synergies across cross-functional stakeholders.",
      "",
      "Skills",
      "Rust, Python, Distributed Systems, Raft, Kafka, PostgreSQL",
      "",
      "Education",
      "B.S. Computer Science, State University, 2018",
    ].join("\n"),
  },
};

const transcriptEnvelope: RawInputEnvelope = {
  rawId: "raw-tx-ada-1",
  sourceKind: "interview_transcript",
  mediaType: "application/json",
  submittedBy: "interviewer-mira",
  submittedAt: NOW,
  payload: {
    interviewer: "Mira",
    candidate: "Ada",
    turns: [
      { speaker: "interviewer", text: "Walk me through the consensus work." },
      {
        speaker: "candidate",
        text:
          "I led the design, though to be honest the log-compaction piece was Sasha's, I just reviewed it. I'm not certain it scales past 10k writes/sec — we never load-tested it.",
      },
      { speaker: "interviewer", text: "How did you handle conflict resolution?" },
      {
        speaker: "candidate",
        text:
          "We used last-writer-wins, which I know is a trade-off; I'd revisit it if I had more time. I built the reconciliation path myself.",
      },
    ],
  },
};

const orgSources = [
  {
    rawId: "raw-org-paymentsco-1",
    kind: "engineering_culture" as const,
    submittedBy: "intake-bot",
    fields: [
      { field: "engineeringCulture", value: "high-ownership", confidence: 0.7 },
      { field: "decisionStyle", value: "consensus-first", confidence: 0.55 },
      { field: "scalingStage", value: null, confidence: 0.0, rationale: "not stated" },
    ],
  },
  {
    rawId: "raw-org-paymentsco-2",
    kind: "operating_principles" as const,
    submittedBy: "intake-bot",
    fields: [
      { field: "engineeringCulture", value: "ship-fast", confidence: 0.6 },
      { field: "remotePolicy", value: "hybrid", confidence: 0.8 },
    ],
  },
];

let gatewaySingleton: IngestionGateway | null = null;

export function getIngestionGateway(): IngestionGateway {
  if (!gatewaySingleton) {
    gatewaySingleton = new IngestionGateway();
    seedIngestion(gatewaySingleton);
  }
  return gatewaySingleton;
}

function seedIngestion(gateway: IngestionGateway): void {
  gateway.ingestCandidate({
    candidateId: "cand-ada-l",
    candidateDisplayName: "Ada L.",
    envelopes: [githubEnvelope, linkedinEnvelope, resumeEnvelope, transcriptEnvelope],
    submittedBy: "intake-bot",
    now: NOW,
  });

  gateway.ingestOrganization({
    organizationId: "org-paymentsco",
    organizationName: "PaymentsCo",
    sources: orgSources,
    submittedBy: "intake-bot",
    now: NOW,
  });
}

export function getIngestionState(): GatewayState {
  return getIngestionGateway().state();
}

export function buildIngestionAudit(subjectId: string): {
  jobs: IngestionJob[];
  evidence: EvidenceItem[];
  lineage: Array<{
    evidenceId: string;
    kind: string;
    claim: string;
    producedBy: string;
    derivedFrom: string[];
  }>;
  auditEntries: IngestionAuditEntry[];
} {
  const gateway = getIngestionGateway();
  const result =
    gateway.getCandidateResult(subjectId) ?? gateway.getOrganizationResult(subjectId);
  const jobs = gateway.state().jobs.filter((j) => j.subjectId === subjectId);
  const evidence = result?.extractedEvidence ?? [];
  const lineage = evidence.map((ev) => ({
    evidenceId: ev.id,
    kind: ev.kind,
    claim: ev.claim,
    producedBy: ev.provenance.producedBy,
    derivedFrom: ev.derivedFromEvidenceIds ?? [],
  }));
  return {
    jobs,
    evidence,
    lineage,
    auditEntries: result?.audit ?? [],
  };
}

export type {
  CandidatePipelineResult,
  OrganizationPipelineResult,
  GatewayState,
} from "@workspace/framework/ingestion";
