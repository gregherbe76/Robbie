/**
 * Bootstraps an in-process `FrameworkRegistry` and seeds a small amount of
 * reference data so the control plane is never empty on first boot.
 *
 * This is intentionally light — the framework's purpose is to be a foundation
 * for higher-level recruiting intelligence products, not to ship recruiting
 * features itself. Real plugins replace these seeds.
 */

import {
  createFrameworkRegistry,
  type FrameworkRegistry,
} from "@workspace/framework/registry";
import type { Agent } from "@workspace/framework/agents";
import type { Skill } from "@workspace/framework/skills";
import type { LLMProvider } from "@workspace/framework/providers";
import type { Workflow } from "@workspace/framework/workflows";

const startedAt = Date.now();

function seedAgents(registry: FrameworkRegistry): void {
  const agents: Agent[] = [
    {
      manifest: {
        id: "trajectory-analyst",
        name: "Trajectory Analyst",
        role: "career-trajectory",
        description:
          "Reasons about a candidate's velocity, scope changes, and trajectory inflection points across roles.",
        capabilities: ["graph-walk", "temporal-reasoning", "signal-extraction"],
        allowedSkills: ["extract-trajectory", "score-velocity"],
        defaultProvider: "openai",
      },
      status: "active",
      async handle() {
        return { signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "reference-triangulator",
        name: "Reference Triangulator",
        role: "evidence-corroboration",
        description:
          "Cross-checks claims against multiple sources and flags inconsistencies with confidence scores.",
        capabilities: ["cross-source-check", "inconsistency-detection"],
        allowedSkills: ["verify-claim", "score-source-credibility"],
        defaultProvider: "anthropic",
      },
      status: "active",
      async handle() {
        return { signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "bias-auditor",
        name: "Bias Auditor",
        role: "fairness-audit",
        description:
          "Audits other agents' outputs for proxy bias, calibration drift, and decision skew.",
        capabilities: ["calibration-check", "proxy-detection"],
        allowedSkills: ["audit-decision"],
        defaultProvider: "anthropic",
      },
      status: "idle",
      async handle() {
        return { signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "fit-synthesizer",
        name: "Fit Synthesizer",
        role: "bidirectional-fit",
        description:
          "Synthesises candidate-graph and organization-graph signals into a bidirectional fit narrative.",
        capabilities: ["graph-join", "narrative-synthesis"],
        allowedSkills: ["compute-fit", "synthesize-report"],
        defaultProvider: "openai",
      },
      status: "active",
      async handle() {
        return { signals: [], rationale: "stub" };
      },
    },
  ];
  for (const a of agents) registry.agents.register(a);
}

function seedSkills(registry: FrameworkRegistry): void {
  const skills: Skill[] = [
    {
      manifest: {
        id: "extract-trajectory",
        name: "Extract Trajectory",
        category: "extraction",
        description:
          "Parses a candidate's history into a sequence of scope changes with velocity and inflection annotations.",
        inputs: ["candidateProfile"],
        outputs: ["trajectoryGraph", "velocitySignals"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "score-velocity",
        name: "Score Velocity",
        category: "scoring",
        description:
          "Produces a probabilistic velocity score for a trajectory segment.",
        inputs: ["trajectoryGraph"],
        outputs: ["velocityScore"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "verify-claim",
        name: "Verify Claim",
        category: "verification",
        description:
          "Triangulates a candidate claim against independent sources and returns confidence + evidence.",
        inputs: ["claim", "sources"],
        outputs: ["verifiedClaim"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "score-source-credibility",
        name: "Score Source Credibility",
        category: "scoring",
        description:
          "Estimates the credibility weight to apply to a given source for a given claim type.",
        inputs: ["source", "claimType"],
        outputs: ["credibility"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "audit-decision",
        name: "Audit Decision",
        category: "reasoning",
        description:
          "Reviews a decision's evidence chain and flags proxy-bias risks or calibration drift.",
        inputs: ["decision", "evidence"],
        outputs: ["auditReport"],
      },
      async execute() {
        return { output: {}, signals: [], rationale: "stub" };
      },
    },
    {
      manifest: {
        id: "compute-fit",
        name: "Compute Fit",
        category: "synthesis",
        description:
          "Joins candidate-graph and organization-graph subgraphs into a bidirectional fit estimate.",
        inputs: ["candidateGraph", "organizationGraph"],
        outputs: ["fitVector"],
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
          "Produces an auditable report with full evidence chain from a set of signals.",
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
        id: "profile-ingested",
        name: "Profile Ingested",
        description:
          "On profile ingestion, run trajectory analysis, reference triangulation, and bias audit, then synthesize a report.",
        trigger: "profile.ingested",
        steps: [
          {
            id: "extract",
            agentId: "trajectory-analyst",
            skillId: "extract-trajectory",
            description: "Build trajectory graph from profile",
          },
          {
            id: "verify",
            agentId: "reference-triangulator",
            skillId: "verify-claim",
            description: "Triangulate top claims",
          },
          {
            id: "audit",
            agentId: "bias-auditor",
            skillId: "audit-decision",
            description: "Audit pipeline outputs for proxy bias",
          },
          {
            id: "synthesize",
            agentId: "fit-synthesizer",
            skillId: "synthesize-report",
            description: "Synthesize auditable report",
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
            id: "fit",
            agentId: "fit-synthesizer",
            skillId: "compute-fit",
            description: "Pre-compute fit vector baseline",
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

async function seedMemory(registry: FrameworkRegistry): Promise<void> {
  const now = new Date().toISOString();
  await registry.memory.put({
    id: "mem-1",
    scope: "candidate",
    subjectId: "cand-001",
    key: "trajectory.inflection",
    value: { from: "IC", to: "TL", delta_months: 18 },
    summary: "Sharp scope expansion at month 18; consistent across sources.",
    confidence: 0.82,
    provenance: {
      producedBy: "trajectory-analyst",
      producedAt: now,
      rationale: "Two independent endorsements + project shipped at TL scope.",
    },
    createdAt: now,
    tags: ["trajectory"],
  });
  await registry.memory.put({
    id: "mem-2",
    scope: "organization",
    subjectId: "org-001",
    key: "calibration.platform-eng",
    value: { p50_velocity: 0.6 },
    summary:
      "Org platform-eng calibration drifted +0.1 velocity vs last quarter.",
    confidence: 0.71,
    provenance: { producedBy: "bias-auditor", producedAt: now },
    createdAt: now,
    tags: ["calibration"],
  });
  await registry.memory.put({
    id: "mem-3",
    scope: "role",
    subjectId: "role-014",
    key: "requirement.evidence-density",
    value: { distributed_systems: 0.65 },
    summary: "Role expects measurable signal density in distributed systems.",
    confidence: 0.9,
    provenance: { producedBy: "fit-synthesizer", producedAt: now },
    createdAt: now,
    tags: ["requirement"],
  });
}

async function seedGraphs(registry: FrameworkRegistry): Promise<void> {
  await registry.candidateGraph.upsertNode({
    id: "cand-001",
    type: "candidate",
    label: "Candidate 001",
  });
  await registry.candidateGraph.upsertNode({
    id: "role-eng-1",
    type: "role",
    label: "Staff Engineer",
  });
  await registry.candidateGraph.upsertNode({
    id: "comp-acme",
    type: "company",
    label: "Acme Systems",
  });
  await registry.candidateGraph.upsertNode({
    id: "skill-dist",
    type: "skill",
    label: "Distributed Systems",
    weight: 0.78,
  });
  await registry.candidateGraph.upsertEdge({
    from: "cand-001",
    to: "role-eng-1",
    relation: "held_role",
    weight: 1,
  });
  await registry.candidateGraph.upsertEdge({
    from: "role-eng-1",
    to: "comp-acme",
    relation: "worked_at",
    weight: 1,
  });
  await registry.candidateGraph.upsertEdge({
    from: "cand-001",
    to: "skill-dist",
    relation: "demonstrates",
    weight: 0.78,
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

async function seedReports(registry: FrameworkRegistry): Promise<void> {
  const now = new Date().toISOString();
  await registry.reports.put({
    id: "rep-001",
    title: "Candidate 001 — Trajectory Synthesis",
    kind: "candidate",
    createdAt: now,
    summary:
      "Trajectory analyst + reference triangulator agree on a sustained scope expansion. Confidence is bound by a single missing reference.",
    confidence: 0.74,
    sections: [
      {
        heading: "Trajectory",
        body: "Two scope inflections in 36 months; both corroborated by shipped artifacts.",
      },
      {
        heading: "Risks",
        body: "One claimed credential lacks an independent source.",
      },
    ],
    evidence: [],
  });
  await registry.reports.put({
    id: "rep-002",
    title: "Northwind — Platform Eng Calibration Drift",
    kind: "organization",
    createdAt: now,
    summary:
      "Bias auditor detected +0.1 velocity drift vs last quarter; recalibrate before next loop.",
    confidence: 0.71,
    sections: [
      {
        heading: "Drift",
        body: "Velocity expectations have crept above the calibrated p50.",
      },
    ],
    evidence: [],
  });
}

let cached: FrameworkRegistry | null = null;
let initPromise: Promise<FrameworkRegistry> | null = null;

/**
 * Eagerly initialize the framework and seed all in-memory registries.
 * The server awaits this before accepting traffic so introspection routes
 * never observe partially-seeded state.
 */
export function initFramework(): Promise<FrameworkRegistry> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const registry = createFrameworkRegistry();
    seedAgents(registry);
    seedSkills(registry);
    seedProviders(registry);
    seedWorkflows(registry);
    await seedMemory(registry);
    await seedGraphs(registry);
    await seedReports(registry);
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

export function getUptimeSeconds(): number {
  return (Date.now() - startedAt) / 1000;
}
