/**
 * Bootstraps an in-process `FrameworkRegistry` and seeds:
 *  - the three flagship intelligence agents (Bayesian, Contradiction, Trajectory)
 *  - reference skills, providers, and workflows
 *  - reference memory entries, graph snapshots, and reports
 *  - pre-computed candidate analyses (running all 3 flagship agents on the
 *    sample dossiers, deterministically, so the introspection UI is populated).
 *
 * Real plugins replace these seeds.
 */

import {
  createFrameworkRegistry,
  type FrameworkRegistry,
} from "@workspace/framework/registry";
import type { Skill } from "@workspace/framework/skills";
import type { LLMProvider } from "@workspace/framework/providers";
import type { Workflow } from "@workspace/framework/workflows";
import {
  BayesianScoringAgent,
  ContradictionAgent,
  TrajectoryAgent,
  SAMPLE_DOSSIERS,
  type AgentReasoning,
  type BayesianFitResult,
  type ContradictionResult,
  type TrajectoryResult,
  type CandidateDossier,
} from "@workspace/framework/agents/flagship";

const startedAt = Date.now();

export interface CandidateAnalysis {
  candidateId: string;
  candidateName: string;
  targetRole: string;
  createdAt: string;
  bayesian: AgentReasoning<BayesianFitResult>;
  contradiction: AgentReasoning<ContradictionResult>;
  trajectory: AgentReasoning<TrajectoryResult>;
}

const bayesian = new BayesianScoringAgent();
const contradiction = new ContradictionAgent();
const trajectory = new TrajectoryAgent();

const analyses = new Map<string, CandidateAnalysis>();
const dossiers = new Map<string, CandidateDossier>();

function seedAgents(registry: FrameworkRegistry): void {
  registry.agents.register(bayesian);
  registry.agents.register(contradiction);
  registry.agents.register(trajectory);
}

function seedSkills(registry: FrameworkRegistry): void {
  const skills: Skill[] = [
    {
      manifest: {
        id: "weight-evidence",
        name: "Weight Evidence",
        category: "scoring",
        description:
          "Apply per-source credibility and per-domain importance to raw evidence weights.",
        inputs: ["evidence", "organizationContext"],
        outputs: ["weightedEvidence"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "compute-posterior",
        name: "Compute Posterior",
        category: "scoring",
        description:
          "Combine prior with weighted evidence via Bayesian log-odds to produce a posterior fit probability.",
        inputs: ["prior", "weightedEvidence"],
        outputs: ["fitScore", "uncertainty"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "extract-claims",
        name: "Extract Claims",
        category: "extraction",
        description:
          "Parse CV and interview transcripts into normalised, domain-tagged claims.",
        inputs: ["candidateProfile"],
        outputs: ["claims"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "cross-source-compare",
        name: "Cross-Source Compare",
        category: "verification",
        description:
          "Compare claims against evidence drawn from independent sources and flag disagreement patterns.",
        inputs: ["claims", "evidence"],
        outputs: ["contradictions", "verifiedSignals"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "model-trajectory",
        name: "Model Trajectory",
        category: "synthesis",
        description:
          "Compute velocity, acceleration, and momentum across a chronological role history.",
        inputs: ["roleHistory", "githubSnapshot"],
        outputs: ["trajectoryScore", "trajectorySignals"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "calibrate-confidence",
        name: "Calibrate Confidence",
        category: "reasoning",
        description:
          "Calibrate an agent's confidence from evidence strength, source diversity, and average weight.",
        inputs: ["signals"],
        outputs: ["confidence"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "synthesize-report",
        name: "Synthesize Report",
        category: "synthesis",
        description:
          "Produce an auditable report with full evidence chain from a set of signals.",
        inputs: ["signals"],
        outputs: ["report"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
  ];
  for (const s of skills) registry.skills.register(s);
}

function seedProviders(registry: FrameworkRegistry): void {
  const providers: LLMProvider[] = [
    {
      id: "openai",
      kind: "openai",
      models: ["gpt-4o", "gpt-4o-mini"],
      isConfigured: () => Boolean(process.env["OPENAI_API_KEY"]),
      async complete() {
        throw new Error("OpenAI adapter not implemented in skeleton");
      },
    },
    {
      id: "anthropic",
      kind: "anthropic",
      models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
      isConfigured: () => Boolean(process.env["ANTHROPIC_API_KEY"]),
      async complete() {
        throw new Error("Anthropic adapter not implemented in skeleton");
      },
    },
  ];
  for (const p of providers) registry.providers.register(p);
}

function seedWorkflows(registry: FrameworkRegistry): void {
  const workflows: Workflow[] = [
    {
      manifest: {
        id: "candidate-analysis",
        name: "Candidate Analysis",
        description:
          "On dossier ingestion, run trajectory modeling, contradiction detection, and Bayesian scoring, then synthesize a report.",
        trigger: "dossier.ingested",
        steps: [
          {
            id: "trajectory",
            agentId: "trajectory-modeler",
            skillId: "model-trajectory",
            description: "Model trajectory and momentum from role history.",
          },
          {
            id: "contradictions",
            agentId: "contradiction-detector",
            skillId: "cross-source-compare",
            description: "Cross-check claims against multi-source evidence.",
          },
          {
            id: "bayesian",
            agentId: "bayesian-scorer",
            skillId: "compute-posterior",
            description: "Compute posterior fit probability with calibrated confidence.",
          },
          {
            id: "synthesize",
            agentId: "bayesian-scorer",
            skillId: "synthesize-report",
            description: "Synthesize an auditable report with full evidence chain.",
          },
        ],
      },
      async run() {
        /* skeleton */
      },
    },
    {
      manifest: {
        id: "role-opened",
        name: "Role Opened",
        description:
          "On role opening, materialize the organization-graph slice and pre-compute calibration baseline.",
        trigger: "role.opened",
        steps: [
          {
            id: "calibrate",
            agentId: "bayesian-scorer",
            skillId: "calibrate-confidence",
            description: "Pre-compute confidence calibration baseline.",
          },
        ],
      },
      async run() {
        /* skeleton */
      },
    },
  ];
  for (const w of workflows) registry.workflows.register(w);
}

async function seedGraphs(registry: FrameworkRegistry): Promise<void> {
  await registry.candidateGraph.upsertNode({
    id: "cand-001",
    type: "candidate",
    label: "Avery Park",
  });
  await registry.candidateGraph.upsertNode({
    id: "role-staff",
    type: "role",
    label: "Staff Platform Engineer",
  });
  await registry.candidateGraph.upsertNode({
    id: "skill-dist",
    type: "skill",
    label: "Distributed Systems",
    weight: 0.85,
  });
  await registry.candidateGraph.upsertNode({
    id: "skill-rel",
    type: "skill",
    label: "Reliability",
    weight: 0.65,
  });
  await registry.candidateGraph.upsertEdge({
    from: "cand-001",
    to: "role-staff",
    relation: "held_role",
    weight: 1,
  });
  await registry.candidateGraph.upsertEdge({
    from: "cand-001",
    to: "skill-dist",
    relation: "demonstrates",
    weight: 0.85,
  });
  await registry.candidateGraph.upsertEdge({
    from: "cand-001",
    to: "skill-rel",
    relation: "demonstrates",
    weight: 0.65,
  });

  await registry.organizationGraph.upsertNode({
    id: "org-001",
    type: "organization",
    label: "Northwind",
  });
  await registry.organizationGraph.upsertNode({
    id: "team-platform",
    type: "team",
    label: "Platform Engineering",
  });
  await registry.organizationGraph.upsertNode({
    id: "role-014",
    type: "role",
    label: "Senior Platform Engineer",
  });
  await registry.organizationGraph.upsertNode({
    id: "comp-rigour",
    type: "competency",
    label: "Operational Rigour",
    weight: 0.9,
  });
  await registry.organizationGraph.upsertEdge({
    from: "org-001",
    to: "team-platform",
    relation: "owns",
    weight: 1,
  });
  await registry.organizationGraph.upsertEdge({
    from: "team-platform",
    to: "role-014",
    relation: "owns",
    weight: 1,
  });
  await registry.organizationGraph.upsertEdge({
    from: "role-014",
    to: "comp-rigour",
    relation: "requires",
    weight: 0.9,
  });
}

async function seedAnalyses(registry: FrameworkRegistry): Promise<void> {
  const now = new Date().toISOString();
  for (const dossier of SAMPLE_DOSSIERS) {
    dossiers.set(dossier.candidateId, dossier);
    const b = bayesian.run(dossier);
    const c = contradiction.run(dossier);
    const t = trajectory.run(dossier);

    const analysis: CandidateAnalysis = {
      candidateId: dossier.candidateId,
      candidateName: dossier.name,
      targetRole: dossier.targetRole,
      createdAt: now,
      bayesian: b,
      contradiction: c,
      trajectory: t,
    };
    analyses.set(dossier.candidateId, analysis);

    // Persist summary memory entries (one per agent output) so the
    // memory introspection page reflects real reasoning artefacts.
    await registry.memory.put({
      id: `mem:${dossier.candidateId}:bayesian`,
      scope: "candidate",
      subjectId: dossier.candidateId,
      key: "bayesian.fit",
      value: b.result,
      summary: `P(hire)=${b.result.fitScore} for ${dossier.targetRole}; uncertainty ${b.result.uncertaintyLevel}.`,
      confidence: b.confidence,
      provenance: b.provenance,
      createdAt: now,
      tags: ["bayesian", "fit"],
    });
    await registry.memory.put({
      id: `mem:${dossier.candidateId}:contradiction`,
      scope: "candidate",
      subjectId: dossier.candidateId,
      key: "contradiction.summary",
      value: c.result,
      summary: `${c.result.contradictions.length} contradiction(s), ${c.result.unsupportedClaims.length} unsupported claim(s).`,
      confidence: c.confidence,
      provenance: c.provenance,
      createdAt: now,
      tags: ["contradictions"],
    });
    await registry.memory.put({
      id: `mem:${dossier.candidateId}:trajectory`,
      scope: "candidate",
      subjectId: dossier.candidateId,
      key: "trajectory.summary",
      value: t.result,
      summary: `Trajectory ${t.result.trajectoryScore}; momentum ${t.result.momentum}; ${t.result.trajectorySignals.length} signal(s).`,
      confidence: t.confidence,
      provenance: t.provenance,
      createdAt: now,
      tags: ["trajectory"],
    });

    // Persist an audit-friendly report per candidate.
    await registry.reports.put({
      id: `rep:${dossier.candidateId}`,
      title: `${dossier.name} — Intelligence Synthesis`,
      kind: "candidate",
      createdAt: now,
      summary: `Bayesian fit ${b.result.fitScore} (conf ${b.confidence.toFixed(2)}); ${c.result.contradictions.length} contradiction(s); trajectory ${t.result.trajectoryScore}.`,
      confidence: Math.min(b.confidence, c.confidence, t.confidence),
      sections: [
        {
          heading: "Fit",
          body: b.provenance.rationale ?? "",
        },
        {
          heading: "Contradictions",
          body:
            c.result.contradictions.length === 0
              ? "No contradictions detected; all strong claims have corroborating evidence."
              : c.result.contradictions
                  .map((x) => `[${x.severity}] ${x.summary}`)
                  .join("\n"),
        },
        {
          heading: "Trajectory",
          body: t.provenance.rationale ?? "",
        },
      ],
      evidence: [
        {
          id: `sig:${dossier.candidateId}:fit`,
          kind: "bayesian-fit",
          value: b.result.fitScore,
          confidence: b.confidence,
          provenance: b.provenance,
        },
        {
          id: `sig:${dossier.candidateId}:contradictions`,
          kind: "contradiction-score",
          value: c.result.contradictionScore,
          confidence: c.confidence,
          provenance: c.provenance,
        },
        {
          id: `sig:${dossier.candidateId}:trajectory`,
          kind: "trajectory-score",
          value: t.result.trajectoryScore,
          confidence: t.confidence,
          provenance: t.provenance,
        },
      ],
    });
  }
}

let cached: FrameworkRegistry | null = null;
let initPromise: Promise<FrameworkRegistry> | null = null;

export function initFramework(): Promise<FrameworkRegistry> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const registry = createFrameworkRegistry();
    seedAgents(registry);
    seedSkills(registry);
    seedProviders(registry);
    seedWorkflows(registry);
    await seedGraphs(registry);
    await seedAnalyses(registry);
    cached = registry;
    return registry;
  })();
  return initPromise;
}

export function getFramework(): FrameworkRegistry {
  if (!cached) {
    throw new Error(
      "Framework registry accessed before initFramework() resolved.",
    );
  }
  return cached;
}

export function getAnalyses(): CandidateAnalysis[] {
  return Array.from(analyses.values());
}

export function getAnalysis(candidateId: string): CandidateAnalysis | null {
  return analyses.get(candidateId) ?? null;
}

export function getDossier(candidateId: string): CandidateDossier | null {
  return dossiers.get(candidateId) ?? null;
}

export function getUptimeSeconds(): number {
  return (Date.now() - startedAt) / 1000;
}
