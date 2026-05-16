import { Link } from "wouter";
import {
  Inbox,
  Brain,
  GitBranch,
  Building2,
  Gauge,
  Crosshair,
  Users,
  Shield,
  Network,
  Database,
  HardDrive,
  ArrowRight,
  ArrowDown,
} from "lucide-react";

const PIPELINE: Array<{
  step: string;
  module: string;
  icon: React.ComponentType<{ className?: string }>;
  body: string;
}> = [
  {
    step: "1",
    module: "ingestion",
    icon: Inbox,
    body: "Multi-source input is normalised into evidence + claims with provenance, reliability, and uncertainty. The boundary refuses to absorb data it cannot attribute.",
  },
  {
    step: "1b",
    module: "ats",
    icon: Inbox,
    body: "Operational evidence from Ashby, Greenhouse, or synthetic fixtures is normalised into a closed evidence union and replayed as disagreement, escalation, and override structure. Read-only, signed, byte-stable.",
  },
  {
    step: "2",
    module: "agents · flagship",
    icon: Brain,
    body: "Bayesian scorer, contradiction detector, and trajectory modeller each produce a typed result with their own confidence and reasoning trace.",
  },
  {
    step: "3",
    module: "cognition",
    icon: GitBranch,
    body: "Synthesizes the agents into a single reasoning surface: confidence propagation, cross-agent disagreement, uncertainty fusion, recommendation reconciliation.",
  },
  {
    step: "4",
    module: "organization_intelligence",
    icon: Building2,
    body: "Candidate fit is computed against an organization context — chaos vs. structured, role-environment mismatch, founder-style fit.",
  },
  {
    step: "5",
    module: "intelligence_operations",
    icon: Crosshair,
    body: "Real EscalationEngine, decision-review workflow, adversarial review, multi-reviewer consensus, evidence requests, human oversight.",
  },
  {
    step: "6",
    module: "evaluation",
    icon: Gauge,
    body: "Calibration curve + per-bucket reliability classifications. The engine flags overconfident bands automatically when claimed exceeds observed by ≥ 15pp.",
  },
  {
    step: "7",
    module: "collaboration",
    icon: Users,
    body: "Human annotations attach to cases with rationale and confidence impact. No silent overrides.",
  },
  {
    step: "8",
    module: "security",
    icon: Shield,
    body: "Access logs, capability gates, audit trail.",
  },
];

const SUPPORTING: Array<{
  module: string;
  icon: React.ComponentType<{ className?: string }>;
  body: string;
}> = [
  {
    module: "memory",
    icon: Database,
    body: "Persistent memory entries scoped by organization, with confidence and source attribution.",
  },
  {
    module: "candidate_graph + organization_graph",
    icon: Network,
    body: "Knowledge is exposed as node/edge snapshots, not relational rows.",
  },
  {
    module: "providers · registry · skills · workflows",
    icon: Network,
    body: "Provider abstraction (OpenAI / Anthropic / custom). Registry-backed agents, skills, workflows. Everything is introspectable.",
  },
  {
    module: "operations_maturity",
    icon: HardDrive,
    body: "Append-only, organization-scoped persistence: event store with deterministic per-org sequences, longitudinal memory with point-in-time queries, and calibration history. Postgres-backed with an in-memory fallback so the framework still runs without a database.",
  },
];

export function Architecture() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-16">
      <div className="text-[11px] font-mono uppercase tracking-widest text-primary/80">
        Architecture
      </div>
      <h1 className="mt-3 text-3xl md:text-4xl font-mono font-semibold tracking-tight">
        Eight layers, one trace, zero hidden state.
      </h1>
      <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
        The framework is a library (<code className="font-mono text-foreground">@workspace/framework</code>)
        with thin runtime surfaces. Each layer is a folder under
        <code className="font-mono text-foreground"> lib/framework/src/</code>;
        each layer exposes typed inputs and outputs that are composed by the
        replay runner you see in the live demo.
      </p>

      <section className="mt-10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          The reasoning pipeline
        </h2>
        <ol className="mt-4 space-y-3">
          {PIPELINE.map((p, i) => {
            const Icon = p.icon;
            return (
              <li key={p.module}>
                <div className="rounded-lg border border-border bg-card p-5 flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className="size-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                      {p.step}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-mono text-sm text-primary">
                      {p.module}
                    </div>
                    <div className="mt-1.5 text-sm leading-relaxed">
                      {p.body}
                    </div>
                  </div>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className="flex justify-center py-1 text-muted-foreground/40">
                    <ArrowDown className="size-4" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Supporting modules
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {SUPPORTING.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.module}
                className="rounded-lg border border-border bg-card p-4"
              >
                <Icon className="size-4 text-primary" />
                <div className="mt-2 font-mono text-xs text-primary">
                  {m.module}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {m.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Design decisions
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Decision
            title="Framework, not application"
            body="Shipped as a library with thin runtime surfaces. No pipeline stages, no kanban, no candidate workflows in the ATS sense."
          />
          <Decision
            title="Provider abstraction first"
            body="OpenAI and Anthropic are interchangeable adapters. Adding a custom provider is a registry registration."
          />
          <Decision
            title="Probabilistic by default"
            body="Memory entries and reports carry confidence ∈ [0,1]. The UI renders confidence as a visual primitive."
          />
          <Decision
            title="Determinism over magic"
            body="Fixed clocks injected into every flagship agent. Replay signatures are sha256 of the trace body."
          />
        </div>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          See it run <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/api-explorer"
          className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold"
        >
          Explore the API
        </Link>
      </div>
    </div>
  );
}

function Decision({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-semibold text-sm">{title}</div>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
    </div>
  );
}

export default Architecture;
