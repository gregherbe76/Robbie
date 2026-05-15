import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useGetDemoReplay } from "@workspace/api-client-react";
import type { ReplayTrace, ReplayStep } from "@workspace/framework/replay";
import { findNarrative } from "@workspace/framework/replay/narrative";
import { NarrativePanel } from "@/components/narrative-panel";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CaseId =
  | "founder-builder"
  | "inflated-senior"
  | "ambiguous-generalist"
  | "chaos-thriver"
  | "org-mismatch";

const LAYER_TONE: Record<ReplayStep["layer"], string> = {
  ingestion: "text-sky-400 border-sky-400/40 bg-sky-400/10",
  agents: "text-violet-400 border-violet-400/40 bg-violet-400/10",
  cognition: "text-primary border-primary/40 bg-primary/10",
  propagation: "text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10",
  disagreement: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  "org-fit": "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  escalation: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  calibration: "text-pink-400 border-pink-400/40 bg-pink-400/10",
  recommendation: "text-primary border-primary/60 bg-primary/15",
};

const REC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  advance: CheckCircle2,
  decline: XCircle,
  investigate: AlertTriangle,
  ambiguous: HelpCircle,
};

const PLAY_INTERVAL_MS = 900;

function pct(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

function Section({
  id,
  title,
  subtitle,
  children,
  tone = "default",
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-lg border bg-card p-6 space-y-4",
        tone === "warn" ? "border-yellow-500/30" : "border-border",
      )}
    >
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-mono font-semibold tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <a
          href={`#${id}`}
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          #{id}
        </a>
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Timeline w/ play/pause/step
// ---------------------------------------------------------------------------

function Timeline({
  trace,
  currentOrd,
  setCurrentOrd,
}: {
  trace: ReplayTrace;
  currentOrd: number;
  setCurrentOrd: (n: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const total = trace.steps.length;
  const lastOrd = total - 1;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCurrentOrd(
        currentOrd >= lastOrd ? lastOrd : currentOrd + 1,
      );
      if (currentOrd >= lastOrd) setPlaying(false);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, currentOrd, lastOrd, setCurrentOrd]);

  const current = trace.steps[currentOrd];

  return (
    <Section
      id="timeline"
      title="1 · Timeline"
      subtitle="Every reasoning step the framework took, in deterministic order."
    >
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setPlaying((p) => !p)}
          data-testid="replay-play-pause"
          className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-mono text-primary hover-elevate active-elevate-2"
        >
          {playing ? (
            <>
              <Pause className="size-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="size-3.5" /> Play
            </>
          )}
        </button>
        <button
          onClick={() => setCurrentOrd(Math.max(0, currentOrd - 1))}
          data-testid="replay-prev"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover-elevate active-elevate-2"
        >
          <ChevronLeft className="size-3.5" /> Step
        </button>
        <button
          onClick={() => setCurrentOrd(Math.min(lastOrd, currentOrd + 1))}
          data-testid="replay-next"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover-elevate active-elevate-2"
        >
          Step <ChevronRight className="size-3.5" />
        </button>
        <button
          onClick={() => {
            setCurrentOrd(0);
            setPlaying(false);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover-elevate active-elevate-2"
        >
          <RotateCcw className="size-3.5" /> Restart
        </button>
        <div className="ml-auto text-xs font-mono text-muted-foreground">
          step {currentOrd + 1} / {total}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {trace.steps.map((step) => {
          const isCurrent = step.ord === currentOrd;
          const isPast = step.ord < currentOrd;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentOrd(step.ord)}
              data-testid={`timeline-step-${step.ord}`}
              className={cn(
                "w-full text-left rounded-md border px-3 py-2 transition-all flex items-start gap-3",
                isCurrent
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                  : isPast
                    ? "border-border bg-card hover-elevate"
                    : "border-border/50 bg-card/40 opacity-60 hover-elevate",
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground w-8 pt-0.5">
                {String(step.ord + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap",
                  LAYER_TONE[step.layer],
                )}
              >
                {step.layer}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium block truncate">
                  {step.title}
                </span>
                <span className="text-xs text-muted-foreground block truncate">
                  {step.summary}
                </span>
              </span>
              {step.confidence !== undefined && (
                <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                  conf {pct(step.confidence)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {current && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 mt-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">
            current step rationale
          </div>
          <div className="text-sm leading-relaxed text-foreground/90">
            {current.rationale}
          </div>
          {current.agentId && (
            <div className="mt-2 text-xs text-muted-foreground font-mono">
              produced by · {current.agentId}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Disagreement Heatmap
// ---------------------------------------------------------------------------

function DisagreementHeatmap({ trace }: { trace: ReplayTrace }) {
  const agents = trace.cognition.graph.nodes;
  return (
    <Section
      id="disagreement"
      title="2 · Disagreement heatmap"
      subtitle="Where the agents read the same evidence in different ways. Disagreements are preserved, not averaged."
    >
      {trace.disagreements.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          No preserved disagreement. Agents converged.
        </div>
      ) : (
        <div className="space-y-3">
          {trace.disagreements.map((d) => (
            <div
              key={d.id}
              className="rounded-md border border-orange-400/30 bg-orange-400/5 p-3"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-foreground/90">{d.agentA}</span>
                  <span className="text-orange-400">⇌</span>
                  <span className="text-foreground/90">{d.agentB}</span>
                </div>
                <div className="text-xs font-mono text-orange-400">
                  Δ {pct(d.score)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="text-xs">
                  <div className="text-muted-foreground/70 font-mono">
                    {d.metricA.name}
                  </div>
                  <div className="font-mono text-foreground">
                    {d.metricA.value.toFixed(2)}
                  </div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground/70 font-mono">
                    {d.metricB.name}
                  </div>
                  <div className="font-mono text-foreground">
                    {d.metricB.value.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {d.rationale}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
        {agents.map((a) => (
          <div
            key={a.id}
            className="rounded border border-border bg-card/40 p-2 text-xs"
          >
            <div className="font-mono truncate">{a.name}</div>
            <div className="text-muted-foreground font-mono">
              {a.metric.name}: {a.metric.value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Confidence Propagation
// ---------------------------------------------------------------------------

function ConfidencePropagation({ trace }: { trace: ReplayTrace }) {
  return (
    <Section
      id="propagation"
      title="3 · Confidence propagation"
      subtitle="How each agent's confidence shifted under cross-agent pressure. Pivotal propagations marked in pink."
    >
      <div className="space-y-3">
        {trace.cognition.graph.nodes.map((node) => {
          const before = node.initialConfidence;
          const after = node.adjustedConfidence;
          const delta = after - before;
          return (
            <div
              key={node.id}
              className="rounded-md border border-border bg-card/40 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-sm">{node.name}</div>
                <div
                  className={cn(
                    "text-xs font-mono",
                    delta < -0.02
                      ? "text-destructive"
                      : delta > 0.02
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {delta >= 0 ? "+" : ""}
                  {(delta * 100).toFixed(1)}pp
                </div>
              </div>
              <div className="relative h-2 rounded-full bg-secondary/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-muted-foreground/50"
                  style={{ width: `${before * 100}%` }}
                />
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 border-r-2",
                    delta < 0
                      ? "border-destructive bg-destructive/30"
                      : "border-primary bg-primary/30",
                  )}
                  style={{ width: `${after * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                <span>before {pct(before)}</span>
                <span>after {pct(after)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          propagations
        </div>
        {trace.propagations.length === 0 && (
          <div className="text-xs text-muted-foreground italic">
            No propagations fired.
          </div>
        )}
        {trace.propagations.map((p) => (
          <div
            key={p.id}
            className={cn(
              "rounded border p-2.5 text-xs",
              p.pivotal
                ? "border-fuchsia-400/40 bg-fuchsia-400/5"
                : "border-border bg-card/30",
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono">
                {p.sourceAgent} → {p.targetAgent}
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                  p.pivotal
                    ? "border-fuchsia-400/40 text-fuchsia-400"
                    : "border-border text-muted-foreground",
                )}
              >
                {p.kind}
              </span>
            </div>
            <div className="text-muted-foreground leading-relaxed">
              {p.reason}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/80 mt-1">
              {p.before.toFixed(2)} → {p.after.toFixed(2)} (Δ
              {p.adjustment >= 0 ? "+" : ""}
              {p.adjustment.toFixed(2)})
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Provenance Explorer
// ---------------------------------------------------------------------------

function ProvenanceExplorer({ trace }: { trace: ReplayTrace }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const node =
    trace.provenance.nodes.find((n) => n.id === selectedId) ?? null;
  const incoming = node
    ? trace.provenance.edges.filter((e) => e.to === node.id)
    : [];
  const outgoing = node
    ? trace.provenance.edges.filter((e) => e.from === node.id)
    : [];

  const grouped = useMemo(() => {
    const g: Record<string, typeof trace.provenance.nodes> = {};
    for (const n of trace.provenance.nodes) {
      (g[n.kind] = g[n.kind] ?? []).push(n);
    }
    return g;
  }, [trace.provenance.nodes]);

  return (
    <Section
      id="provenance"
      title="4 · Provenance explorer"
      subtitle="Every signal traces back to the evidence that produced it. Click any node to walk the chain."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
          {Object.entries(grouped).map(([kind, nodes]) => (
            <div key={kind}>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                {kind} · {nodes.length}
              </div>
              <div className="space-y-1">
                {nodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    data-testid={`prov-node-${n.id}`}
                    className={cn(
                      "w-full text-left rounded border px-2 py-1.5 text-xs hover-elevate",
                      selectedId === n.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/30",
                    )}
                  >
                    <div className="font-mono truncate">{n.label}</div>
                    <div className="text-muted-foreground/70 truncate text-[10px]">
                      {n.id}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-border bg-card/40 p-4 min-h-[320px]">
          {!node && (
            <div className="text-sm text-muted-foreground italic">
              Select a node to inspect its provenance chain.
            </div>
          )}
          {node && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {node.kind}
                </div>
                <div className="font-semibold text-sm">{node.label}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {node.id}
                </div>
              </div>
              <div className="text-sm text-foreground/90 leading-relaxed">
                {node.detail}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                produced by {node.producedBy}
              </div>
              {incoming.length > 0 && (
                <div className="border-t border-border pt-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                    derived from ({incoming.length})
                  </div>
                  <div className="space-y-1">
                    {incoming.map((e, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedId(e.from)}
                        className="w-full text-left rounded border border-border bg-card/30 px-2 py-1 text-xs font-mono hover-elevate"
                      >
                        ← [{e.relation}] {e.from}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {outgoing.length > 0 && (
                <div className="border-t border-border pt-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                    flows into ({outgoing.length})
                  </div>
                  <div className="space-y-1">
                    {outgoing.map((e, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedId(e.to)}
                        className="w-full text-left rounded border border-border bg-card/30 px-2 py-1 text-xs font-mono hover-elevate"
                      >
                        → [{e.relation}] {e.to}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 5 — Organization Fit
// ---------------------------------------------------------------------------

function OrgFitView({ trace }: { trace: ReplayTrace }) {
  const o = trace.orgFit;
  return (
    <Section
      id="org-fit"
      title="5 · Organization fit"
      subtitle={`Candidate × ${trace.organization.name}. Capability fit ≠ environment fit.`}
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-border p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            recommendation
          </div>
          <div className="font-mono text-sm mt-1">{o.fitRecommendation}</div>
        </div>
        <div className="rounded border border-border p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            chaos fit
          </div>
          <div className="font-mono text-sm mt-1">{pct(o.chaosFitScore)}</div>
        </div>
        <div className="rounded border border-border p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            confidence
          </div>
          <div className="font-mono text-sm mt-1">{pct(o.fitConfidence)}</div>
        </div>
      </div>

      {o.tensions.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            role-environment tensions
          </div>
          {o.tensions.map((t, i) => (
            <div
              key={i}
              className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2.5 text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono">{t.field}</span>
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] uppercase font-mono",
                    t.severity === "high"
                      ? "border-destructive/40 text-destructive"
                      : t.severity === "medium"
                        ? "border-yellow-500/40 text-yellow-400"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {t.severity}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground/70">candidate · </span>
                  {t.candidateSignal}
                </div>
                <div>
                  <span className="text-muted-foreground/70">role · </span>
                  {t.orgSignal}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
            success conditions
          </div>
          {o.successConditions.slice(0, 4).map((s, i) => (
            <div
              key={i}
              className="text-foreground/80 leading-snug border-l border-emerald-400/40 pl-2"
            >
              {s}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-destructive">
            failure modes
          </div>
          {o.failureModes.slice(0, 4).map((f, i) => (
            <div
              key={i}
              className="text-foreground/80 leading-snug border-l border-destructive/40 pl-2"
            >
              {f}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">
            interview focus
          </div>
          {o.interviewFocusAreas.slice(0, 4).map((f, i) => (
            <div
              key={i}
              className="text-foreground/80 leading-snug border-l border-primary/40 pl-2"
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 6 — Escalation Trace
// ---------------------------------------------------------------------------

function EscalationTrace({ trace }: { trace: ReplayTrace }) {
  return (
    <Section
      id="escalations"
      title="6 · Escalation trace"
      subtitle="When the system cannot resolve a case alone, it escalates — to evidence, adversarial review, or human override."
    >
      {trace.escalations.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          No escalation triggered. The system resolved within tolerance.
        </div>
      ) : (
        <div className="space-y-3">
          {trace.escalations.map((e) => (
            <div
              key={e.id}
              className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-mono">
                  <AlertTriangle className="size-3.5 text-yellow-400" />
                  {e.trigger}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  #{e.id}
                </div>
              </div>
              <div className="text-sm font-medium mb-1">{e.summary}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {e.detail}
              </div>
              {e.requestedEvidence.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {e.requestedEvidence.map((r, i) => (
                    <span
                      key={i}
                      className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
              {e.reviewerDisagreement && (
                <div className="mt-2 rounded border border-border bg-card/40 p-2 text-[11px]">
                  <div className="font-mono text-muted-foreground mb-0.5">
                    reviewer disagreement · {e.reviewerDisagreement.reviewerA}{" "}
                    ⇌ {e.reviewerDisagreement.reviewerB}
                  </div>
                  <div className="text-foreground/80">
                    {e.reviewerDisagreement.summary}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 7 — Calibration Snapshot
// ---------------------------------------------------------------------------

function CalibrationSnapshot({ trace }: { trace: ReplayTrace }) {
  const c = trace.calibration;
  return (
    <Section
      id="calibration"
      title="7 · Calibration snapshot"
      subtitle="The system reports on itself. At least one overconfident bucket is surfaced, not hidden."
      tone="warn"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">
          <span className="text-muted-foreground">expected calibration error · </span>
          <span className="font-mono text-foreground">
            {c.expectedCalibrationError.toFixed(2)}
          </span>
        </div>
        {c.overconfidenceWarning && (
          <div className="inline-flex items-center gap-1.5 rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-yellow-400">
            <AlertTriangle className="size-3" /> overconfidence detected
          </div>
        )}
      </div>

      <div className="rounded border border-border bg-card/40 p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
          reliability diagram · claimed vs actual
        </div>
        <div className="space-y-3">
          {c.buckets.map((b) => (
            <div key={b.range}>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span>{b.range}</span>
                <span
                  className={cn(
                    b.overconfident
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  Δ {(b.claimed - b.actual >= 0 ? "+" : "")}
                  {((b.claimed - b.actual) * 100).toFixed(0)}pp · n={b.count}
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-secondary/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-muted-foreground/40"
                  style={{ width: `${b.claimed * 100}%` }}
                  title={`claimed ${pct(b.claimed)}`}
                />
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 border-r-2",
                    b.overconfident
                      ? "border-destructive bg-destructive/40"
                      : "border-primary bg-primary/30",
                  )}
                  style={{ width: `${b.actual * 100}%` }}
                  title={`actual ${pct(b.actual)}`}
                />
              </div>
              {b.overconfident && (
                <div className="mt-1 text-[11px] text-destructive leading-snug">
                  {b.critique}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm leading-relaxed">
        <div className="text-[10px] font-mono uppercase tracking-widest text-yellow-400 mb-1">
          self-critique
        </div>
        {c.selfCritique}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 8 — Final Decision
// ---------------------------------------------------------------------------

function FinalDecision({ trace }: { trace: ReplayTrace }) {
  const r = trace.recommendation;
  const Icon = REC_ICON[r.category] ?? HelpCircle;
  return (
    <Section
      id="decision"
      title="8 · Decision support"
      subtitle="The framework's contract is to surface evidence, disagreement, and uncertainty. The decision is the reviewer's."
    >
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-5">
        <div className="flex items-start gap-4">
          <div className="size-10 rounded-md border border-primary/40 bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Icon className="size-5" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-mono uppercase tracking-wider text-primary">
                {r.category}
              </span>
              <span className="rounded border border-border bg-card px-2 py-0.5 text-xs font-mono text-muted-foreground">
                fit · {r.fitRecommendation}
              </span>
              <span className="rounded border border-border bg-card px-2 py-0.5 text-xs font-mono text-muted-foreground">
                {r.uncertaintyCategory}
              </span>
              <span className="ml-auto text-xs font-mono">
                global conf {pct(r.globalConfidence)}
              </span>
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed">
              {r.headline}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded border border-emerald-400/30 bg-emerald-400/5 p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-2">
            strongest evidence
          </div>
          <div className="space-y-2">
            {r.strongestEvidence.slice(0, 4).map((e, i) => (
              <div key={i} className="text-xs">
                <div className="text-foreground/90 leading-snug">
                  {e.summary}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  weight {e.weight.toFixed(2)} · {e.id}
                </div>
              </div>
            ))}
            {r.strongestEvidence.length === 0 && (
              <div className="text-xs text-muted-foreground italic">
                None preserved.
              </div>
            )}
          </div>
        </div>
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-destructive mb-2">
            strongest risks
          </div>
          <div className="space-y-2">
            {r.strongestRisks.slice(0, 4).map((rk, i) => (
              <div key={i} className="text-xs">
                <div className="text-foreground/90 leading-snug">
                  {rk.summary}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {rk.severity} · {rk.id}
                </div>
              </div>
            ))}
            {r.strongestRisks.length === 0 && (
              <div className="text-xs text-muted-foreground italic">None.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded border border-border bg-card/40 p-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          unresolved questions
        </div>
        {r.unresolvedQuestions.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            No open questions.
          </div>
        ) : (
          <ul className="space-y-1 text-xs">
            {r.unresolvedQuestions.map((q, i) => (
              <li key={i} className="text-foreground/80 leading-snug">
                · {q}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground leading-relaxed border-t border-border pt-3">
        <span className="font-mono uppercase tracking-wider text-muted-foreground/70">
          reviewer disagreement ·{" "}
        </span>
        {r.reviewerDisagreementSummary}
      </div>
      <div className="text-[11px] italic text-muted-foreground/80">
        {r.decisionSupportDisclaimer}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ReplayProps {
  /**
   * Optional override trace. When provided, the component skips the
   * `useGetDemoReplay` fetch and renders the given trace directly.
   * This is what the Cognition Lab uses to render its lab runs.
   */
  traceOverride?: ReplayTrace;
  /** Back link, defaults to /demo. */
  backHref?: string;
  backLabel?: string;
  /** Optional banner shown above the header (e.g. demo/synthetic warning). */
  headerBanner?: React.ReactNode;
}

export function Replay(props: ReplayProps = {}) {
  const { traceOverride, backHref = "/demo", backLabel = "all cases", headerBanner } = props;
  const [, params] = useRoute("/replay/:caseId");
  const caseId = (params?.caseId ?? "founder-builder") as CaseId;
  const fetchEnabled = !traceOverride;
  const { data, isLoading, error } = useGetDemoReplay(caseId, {
    query: { enabled: fetchEnabled } as never,
  });
  const trace = (traceOverride ?? (data as unknown as ReplayTrace | undefined));
  const [currentOrd, setCurrentOrd] = useState(0);

  // reset cursor when case changes
  const lastCaseRef = useRef(caseId);
  useEffect(() => {
    if (lastCaseRef.current !== caseId) {
      setCurrentOrd(0);
      lastCaseRef.current = caseId;
    }
  }, [caseId]);

  if (fetchEnabled && isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12">
        <Loader2 className="size-4 animate-spin" /> Running framework for{" "}
        <span className="font-mono">{caseId}</span>…
      </div>
    );
  }
  if ((fetchEnabled && error) || !trace) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 space-y-3">
        <div className="text-destructive font-mono">Failed to load replay.</div>
        <Link href={backHref} className="text-sm text-primary underline">
          ← back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {headerBanner}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-3" /> {backLabel}
          </Link>
          <h1 className="text-2xl font-mono font-semibold tracking-tight">
            {trace.summary.label}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {trace.summary.oneLiner}
          </p>
        </div>
        <div className="rounded border border-border bg-card p-3 text-xs space-y-1 min-w-[240px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">candidate</span>
            <span className="font-mono">{trace.candidate.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">role</span>
            <span className="font-mono">{trace.candidate.targetRole}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">organization</span>
            <span className="font-mono">{trace.organization.name}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 mt-1">
            <span className="text-muted-foreground">signature</span>
            <span className="font-mono text-[10px]">{trace.signature}</span>
          </div>
        </div>
      </div>

      {(() => {
        const narrative = findNarrative(caseId);
        return narrative ? (
          <NarrativePanel narrative={narrative} caseId={caseId} />
        ) : null;
      })()}

      <Timeline
        trace={trace}
        currentOrd={currentOrd}
        setCurrentOrd={setCurrentOrd}
      />
      <DisagreementHeatmap trace={trace} />
      <ConfidencePropagation trace={trace} />
      <ProvenanceExplorer trace={trace} />
      <OrgFitView trace={trace} />
      <EscalationTrace trace={trace} />
      <CalibrationSnapshot trace={trace} />
      <FinalDecision trace={trace} />

      <footer className="border-t border-border pt-4 text-[11px] font-mono text-muted-foreground flex justify-between">
        <span>generated {trace.generatedAt}</span>
        <span>
          {trace.steps.length} steps · {trace.cognition.influences.length}{" "}
          propagations · {trace.disagreements.length} disagreements
        </span>
      </footer>
    </div>
  );
}

export default Replay;
