import { Link } from "wouter";
import {
  Rocket,
  GitBranch,
  Beaker,
  Eye,
  Wrench,
  Handshake,
  Megaphone,
  Puzzle,
  ArrowRight,
} from "lucide-react";

export function Docs() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-16">
      <div className="text-[11px] font-mono uppercase tracking-widest text-primary/80">
        Docs
      </div>
      <h1 className="mt-3 text-3xl md:text-4xl font-mono font-semibold tracking-tight">
        From repo to running replay in 30 minutes.
      </h1>
      <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
        These docs are written for developers who want to read the code,
        run the benchmarks, and contribute a module — not for product
        marketing. Brutally honest about current maturity.
      </p>

      <section className="mt-10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          The first 30 minutes
        </h2>
        <ol className="mt-4 space-y-3">
          <Step
            n="1"
            icon={Rocket}
            title="Clone + install (5 min)"
            body={
              <>
                <Code>pnpm install</Code>, then run the API server and
                console workflows. No <Code>DATABASE_URL</Code> is required
                — the runtime ships with in-memory seeds.
              </>
            }
          />
          <Step
            n="2"
            icon={GitBranch}
            title="Replay a case (5 min)"
            body={
              <>
                Hit{" "}
                <Code>{`GET /api/demo/replay/inflated-senior`}</Code> and
                inspect the trace. Same input → same bytes. Confirm the
                signature is stable.
              </>
            }
          />
          <Step
            n="3"
            icon={Beaker}
            title="Run the benchmarks (5 min)"
            body={
              <>
                Open <Link href="/benchmarks-public" className="text-primary hover:underline">/benchmarks-public</Link>{" "}
                — five cases run through the real engines, mutation guards
                reported, replay hashes compared across two consecutive
                requests.
              </>
            }
          />
          <Step
            n="4"
            icon={Eye}
            title="Read a trace from the inside (10 min)"
            body={
              <>
                Open the console at <Link href="/console" className="text-primary hover:underline">/console</Link>{" "}
                and walk the registries — agents, skills, providers,
                workflows, memory, candidate / organization graphs.
              </>
            }
          />
          <Step
            n="5"
            icon={Wrench}
            title="Make your first change (5 min)"
            body={
              <>
                Edit a case in{" "}
                <Code>lib/framework/src/replay/cases.ts</Code>, run{" "}
                <Code>pnpm run typecheck</Code>, refresh the replay.
                Your trace signature changes — provenance everywhere.
              </>
            }
          />
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Deeper reads
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DocCard
            icon={GitBranch}
            title="Understanding cognition replay"
            body="What a trace contains, why every step is provenance-attached, how the replay signature is computed, what determinism guarantees the runner provides."
            href="/architecture"
            cta="Read architecture"
          />
          <DocCard
            icon={Beaker}
            title="How benchmarks work"
            body="Mutation guards, intentional calibration failures, snapshot drift detection. We surface our failures instead of hiding them."
            href="/benchmarks-public"
            cta="See benchmarks"
          />
          <DocCard
            icon={Puzzle}
            title="Plugin & extension contracts"
            body="Cognition modules, ingestion adapters, benchmark packs, organization policies — the typed manifests for extending the framework."
            href="/docs/plugins"
            cta="Extension contracts"
          />
          <DocCard
            icon={Handshake}
            title="Design partner toolkit"
            body="Architecture deck, deployment expectations, known limitations, roadmap transparency. For teams considering a pilot."
            href="/docs/design-partners"
            cta="Design partner docs"
          />
        </div>
      </section>

      <section className="mt-14 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
        <div className="flex items-center gap-2 text-amber-300 text-sm font-mono uppercase tracking-widest">
          <Megaphone className="size-4" /> Honest maturity
        </div>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          The framework runtime currently uses in-memory seeds in{" "}
          <Code>bootstrap.ts</Code>. The Drizzle schema is scaffolded but the
          server does not yet persist memory to PostgreSQL by default. Provider
          adapters exist but require keys to actually call OpenAI/Anthropic;
          the skeleton runs without keys. Production hardening (rate limits,
          auth, observability) is intentionally out of scope for the framework
          layer. See the{" "}
          <Link href="/docs/design-partners" className="text-primary hover:underline">
            design partner toolkit
          </Link>{" "}
          for the full list of current limitations.
        </p>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Run the demo <ArrowRight className="size-4" />
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

function Step({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="rounded-lg border border-border bg-card p-5 flex gap-4 items-start">
      <div className="size-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-mono text-sm">
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <div className="font-semibold">{title}</div>
        </div>
        <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {body}
        </div>
      </div>
    </li>
  );
}

function DocCard({
  icon: Icon,
  title,
  body,
  href,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-card p-5 hover:border-primary/50 transition-colors"
    >
      <Icon className="size-4 text-primary" />
      <div className="mt-2 font-semibold">{title}</div>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
      <div className="mt-3 text-xs font-mono text-primary inline-flex items-center gap-1">
        {cta} <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
      {children}
    </code>
  );
}

export default Docs;
