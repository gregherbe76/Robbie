import { Link } from "wouter";
import {
  ArrowRight,
  GitBranch,
  Layers,
  Network,
  ShieldCheck,
  Sparkles,
  Activity,
  Eye,
  Scale,
} from "lucide-react";

export function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 0%, hsl(var(--primary)/0.15), transparent 40%), radial-gradient(circle at 80% 100%, hsl(var(--primary)/0.08), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-primary">
            <span className="size-1.5 rounded-full bg-primary" /> Open-source
            framework
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl md:text-6xl font-mono font-bold tracking-tight leading-[1.05]">
            Deterministic recruiting
            <br />
            <span className="text-primary">intelligence infrastructure.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            Recruiting is organizational reasoning. This is the framework — not
            another ATS, not an &ldquo;AI recruiter,&rdquo; not a CV matcher.
            Open-source agents with persistent memory, probabilistic reasoning,
            calibration-aware decisions, and provenance you can replay byte for
            byte.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Open the Cognition Lab <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:border-primary/50 transition-colors"
            >
              Replay a hero case
            </Link>
            <Link
              href="/architecture"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:border-primary/50 transition-colors"
            >
              How it works
            </Link>
            <Link
              href="/benchmarks-public"
              className="inline-flex items-center gap-2 rounded-md border border-border/60 px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              Benchmarks
            </Link>
          </div>

          {/* Tiny live-status strip */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px rounded-lg overflow-hidden border border-border/60 bg-border/60 text-xs">
            <StatusCell label="Determinism" value="Verified" tone="ok" />
            <StatusCell label="Provenance" value="Complete" tone="ok" />
            <StatusCell label="Calibration" value="Self-critiqued" tone="warn" />
            <StatusCell label="Disagreement" value="Preserved" tone="ok" />
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <SectionEyebrow>Four pillars</SectionEyebrow>
          <h2 className="mt-2 text-2xl md:text-3xl font-mono font-semibold tracking-tight">
            The framework refuses to flatten what real hiring decisions
            actually look like.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Pillar
              icon={GitBranch}
              title="Deterministic by design"
              body="Same dossier in, same trace out. Every replay is byte-stable, signed with a sha256 hash. No floating clocks, no random seeds, no surprises."
            />
            <Pillar
              icon={Eye}
              title="Provenance is data"
              body="Every claim, every signal, every escalation carries who-produced-what. The provenance graph is a first-class artefact, not a logging side-effect."
            />
            <Pillar
              icon={Scale}
              title="Disagreement preserved"
              body="When the contradiction agent and the trajectory agent read the same dossier in incompatible ways, the framework surfaces the tension instead of collapsing it into a number."
            />
            <Pillar
              icon={Activity}
              title="Calibration-aware"
              body="The evaluation engine critiques its own confidence. Overconfident bands are flagged automatically, with the gap between claimed and observed reported per band."
            />
          </div>
        </div>
      </section>

      {/* Demo strip */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionEyebrow>Live replay</SectionEyebrow>
              <h2 className="mt-2 text-2xl md:text-3xl font-mono font-semibold tracking-tight">
                Watch the system disagree with itself.
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Five deterministic cases run end-to-end through the real
                framework engines on every request — ingestion, flagship
                agents, cognition synthesis, organization fit, the real
                escalation engine, and a calibration view produced live by the
                evaluation engine.
              </p>
            </div>
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 text-sm font-mono text-primary hover:underline"
            >
              All five cases <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <CaseTile
              caseId="inflated-senior"
              label="Inflated senior"
              tagline="Cross-source evidence refutes the claims. The contradiction layer pulls back."
            />
            <CaseTile
              caseId="org-mismatch"
              label="Org mismatch"
              tagline="Capability is real; environment is wrong. The biggest open calibration failure."
            />
            <CaseTile
              caseId="founder-builder"
              label="Founder builder"
              tagline="High upside, high risk. Escalation flags an asymmetric outcome distribution."
            />
          </div>
        </div>
      </section>

      {/* Anti-positioning */}
      <section className="border-b border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 grid gap-10 md:grid-cols-2">
          <div>
            <SectionEyebrow>What this is not</SectionEyebrow>
            <h2 className="mt-2 text-2xl md:text-3xl font-mono font-semibold tracking-tight">
              No kanban. No matcher. No AI recruiter.
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              The framework is decision-support infrastructure, not autonomous
              hiring. It produces a trace, surfaces what it does not know, and
              refuses to advance cases it cannot justify. Humans remain
              first-class participants. Escalations are explicit. Uncertainty
              is preserved.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <NotChip>ATS pipelines</NotChip>
            <NotChip>CV similarity scores</NotChip>
            <NotChip>AI auto-rejects</NotChip>
            <NotChip>Chatbot interviewers</NotChip>
            <NotChip>Black-box ranking</NotChip>
            <NotChip>Silent fallbacks</NotChip>
          </div>
        </div>
      </section>

      {/* For who */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
          <SectionEyebrow>Who this is for</SectionEyebrow>
          <h2 className="mt-2 text-2xl md:text-3xl font-mono font-semibold tracking-tight">
            Founders, governance teams, and infra-curious engineers.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <AudienceCard
              icon={Sparkles}
              title="Founders building hiring discipline"
              body="See where confidence is justified, where the system is guessing, and which decisions need a human override. Replay your own cases against the framework."
            />
            <AudienceCard
              icon={ShieldCheck}
              title="Governance & risk teams"
              body="Every decision is replayable. Every escalation is provenance-attached. The calibration layer self-critiques. Auditability is a property of the data model, not a bolt-on."
            />
            <AudienceCard
              icon={Layers}
              title="Infrastructure engineers"
              body="Composable agents. Registry-backed providers. OpenAPI codegen. Deterministic replay. No hidden state. Read the code, run the benchmarks, contribute a module."
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-mono font-bold tracking-tight">
            See the system reason in public.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Five cases. Eight layers. Bit-for-bit identical traces. Decide for
            yourself whether the cognition holds up.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Open the replay <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold"
            >
              First 30 minutes
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-mono uppercase tracking-widest text-primary/80">
      {children}
    </div>
  );
}

function StatusCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn";
}) {
  return (
    <div className="bg-card px-4 py-3 flex flex-col">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={
          tone === "ok"
            ? "mt-1 text-sm font-semibold text-primary"
            : "mt-1 text-sm font-semibold text-amber-400"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="size-4" />
        <span className="text-[11px] font-mono uppercase tracking-widest">
          {title.split(" ")[0]}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function CaseTile({
  caseId,
  label,
  tagline,
}: {
  caseId: string;
  label: string;
  tagline: string;
}) {
  return (
    <Link
      href={`/replay/${caseId}`}
      className="group block rounded-lg border border-border bg-card p-5 hover:border-primary/50 transition-colors"
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {caseId}
      </div>
      <div className="mt-1 text-lg font-semibold">{label}</div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {tagline}
      </p>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-mono text-primary group-hover:underline">
        Replay <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}

function NotChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/30 px-3 py-2 text-muted-foreground line-through decoration-destructive/60">
      {children}
    </div>
  );
}

function AudienceCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Icon className="size-5 text-primary" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
    </div>
  );
}

export default Landing;
