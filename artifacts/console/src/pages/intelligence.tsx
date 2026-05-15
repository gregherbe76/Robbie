import React, { useMemo, useState } from "react";
import { useListIntelligenceAnalyses } from "@workspace/api-client-react";
import type { CandidateAnalysis } from "@workspace/api-client-react";
import { Confidence } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Brain,
  TrendingUp,
  CheckCircle2,
  XCircle,
  GitBranch,
  Activity,
} from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function severityClass(sev: "low" | "medium" | "high"): string {
  if (sev === "high") return "bg-destructive/15 text-destructive border-destructive/30";
  if (sev === "medium") return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function Bar({ value, label, tone = "primary" }: { value: number; label: string; tone?: "primary" | "destructive" | "warn" }) {
  const toneCls =
    tone === "destructive"
      ? "bg-destructive"
      : tone === "warn"
        ? "bg-yellow-500"
        : "bg-primary";
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground mb-1 tracking-wider">
        <span>{label}</span>
        <span>{pct(value)}</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full", toneCls)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      </div>
    </div>
  );
}

function ReasoningTrace({ steps }: { steps: CandidateAnalysis["bayesian"]["reasoning"] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <li
          key={i}
          className="flex gap-3 text-xs font-mono py-1.5 px-2 rounded border border-border/40 bg-secondary/30"
        >
          <span className="text-[10px] uppercase text-primary/80 w-32 shrink-0 tracking-wider">
            {i + 1}. {s.step}
          </span>
          <span className="text-foreground/85 leading-snug flex-1">{s.detail}</span>
          {s.value != null && (
            <span className="text-[10px] text-muted-foreground shrink-0 self-center">
              = {Number(s.value).toFixed(3)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function TrajectoryChart({ curve }: { curve: CandidateAnalysis["trajectory"]["result"]["complexityCurve"] }) {
  if (curve.length < 2) {
    return <div className="text-xs text-muted-foreground">Not enough data to render curve.</div>;
  }
  const width = 480;
  const height = 140;
  const pad = 24;
  const xs = curve.map((c) => c.year);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xAt = (x: number) =>
    pad + ((x - minX) / Math.max(0.0001, maxX - minX)) * innerW;
  const yAt = (v: number) => pad + (1 - v) * innerH;

  const path = curve.map((c, i) => `${i === 0 ? "M" : "L"} ${xAt(c.year).toFixed(1)} ${yAt(c.composite).toFixed(1)}`).join(" ");
  const area = `${path} L ${xAt(maxX).toFixed(1)} ${height - pad} L ${xAt(minX).toFixed(1)} ${height - pad} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id="traj-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" className="text-primary" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-primary" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={pad}
          x2={width - pad}
          y1={yAt(g)}
          y2={yAt(g)}
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeDasharray="2 4"
          className="text-muted-foreground"
        />
      ))}
      <path d={area} fill="url(#traj-fill)" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
      {curve.map((c, i) => (
        <g key={i}>
          <circle
            cx={xAt(c.year)}
            cy={yAt(c.composite)}
            r="3.5"
            fill="currentColor"
            className="text-primary"
          />
          <text
            x={xAt(c.year)}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fill="currentColor"
            className="text-muted-foreground"
          >
            {c.year.toFixed(1)}
          </text>
          <text
            x={xAt(c.year)}
            y={yAt(c.composite) - 8}
            textAnchor="middle"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fill="currentColor"
            className="text-foreground/80"
          >
            {c.composite.toFixed(2)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function AgentCard({
  title,
  agentId,
  confidence,
  icon: Icon,
  children,
}: {
  title: string;
  agentId: string;
  confidence: number;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-md bg-card/40">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-[10px] font-mono text-muted-foreground">{agentId}</span>
        </div>
        <div className="min-w-[140px]">
          <Confidence value={confidence} />
        </div>
      </header>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function DisagreementBanner({ analysis }: { analysis: CandidateAnalysis }) {
  const fit = analysis.bayesian.result.fitScore;
  const contradiction = analysis.contradiction.result.contradictionScore;
  const trajectory = analysis.trajectory.result.trajectoryScore;

  // Compute disagreement: high fit AND high contradiction is a clash;
  // high contradiction with low trajectory amplifies risk.
  const fitVsContradiction = Math.abs(fit - (1 - contradiction));
  const fitVsTrajectory = Math.abs(fit - trajectory);
  const maxDelta = Math.max(fitVsContradiction, fitVsTrajectory);

  let tone: "ok" | "warn" | "clash" = "ok";
  let message: string;
  if (fit >= 0.5 && contradiction >= 0.5) {
    tone = "clash";
    message = `High fit (${pct(fit)}) but elevated contradiction score (${pct(contradiction)}) — Bayesian and Contradiction agents disagree.`;
  } else if (maxDelta > 0.35) {
    tone = "warn";
    message = `Agent outputs span a ${pct(maxDelta)} disagreement window — review reasoning chains before deciding.`;
  } else {
    message = `Agents are aligned within ${pct(maxDelta)} of each other.`;
  }

  const cls =
    tone === "clash"
      ? "bg-destructive/10 border-destructive/40 text-destructive"
      : tone === "warn"
        ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-600"
        : "bg-primary/10 border-primary/30 text-primary";

  return (
    <div className={cn("border rounded px-4 py-2 text-xs font-mono", cls)}>
      <span className="uppercase tracking-wider mr-2">[disagreement]</span>
      {message}
    </div>
  );
}

function AnalysisDetail({ analysis }: { analysis: CandidateAnalysis }) {
  const b = analysis.bayesian.result;
  const c = analysis.contradiction.result;
  const t = analysis.trajectory.result;

  return (
    <div className="space-y-4">
      <DisagreementBanner analysis={analysis} />

      <AgentCard
        title="Bayesian Scoring Agent"
        agentId={analysis.bayesian.agentId}
        confidence={analysis.bayesian.confidence}
        icon={Brain}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Bar value={b.fitScore} label="Fit P(hire)" />
          <Bar value={b.prior} label="Prior" />
          <Bar value={b.evidenceStrength} label="Evidence Strength" />
          <Bar value={b.uncertaintyLevel} label="Uncertainty" tone="warn" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-border/50 rounded p-3 bg-background/40">
            <div className="font-mono text-[10px] uppercase text-primary/80 tracking-wider mb-2 flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Supporting Evidence · {b.supportingEvidence.length}
            </div>
            <ul className="space-y-1">
              {b.supportingEvidence.map((e) => (
                <li key={e.id} className="text-xs flex gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground w-12 shrink-0">{e.id}</span>
                  <span className="flex-1 text-foreground/85">{e.summary}</span>
                  <span className="font-mono text-[10px] text-primary shrink-0">+{e.weight.toFixed(2)}</span>
                </li>
              ))}
              {b.supportingEvidence.length === 0 && (
                <li className="text-xs text-muted-foreground italic">None.</li>
              )}
            </ul>
          </div>
          <div className="border border-border/50 rounded p-3 bg-background/40">
            <div className="font-mono text-[10px] uppercase text-destructive tracking-wider mb-2 flex items-center gap-1">
              <XCircle className="size-3" /> Refuting Evidence · {b.refutingEvidence.length}
            </div>
            <ul className="space-y-1">
              {b.refutingEvidence.map((e) => (
                <li key={e.id} className="text-xs flex gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground w-12 shrink-0">{e.id}</span>
                  <span className="flex-1 text-foreground/85">{e.summary}</span>
                  <span className="font-mono text-[10px] text-destructive shrink-0">-{e.weight.toFixed(2)}</span>
                </li>
              ))}
              {b.refutingEvidence.length === 0 && (
                <li className="text-xs text-muted-foreground italic">None.</li>
              )}
            </ul>
          </div>
        </div>

        {b.missingEvidence.length > 0 && (
          <div className="border border-yellow-500/30 rounded p-3 bg-yellow-500/5">
            <div className="font-mono text-[10px] uppercase text-yellow-600 tracking-wider mb-1">
              Missing Critical Evidence
            </div>
            <div className="text-xs text-foreground/85">{b.missingEvidence.join(", ")}</div>
          </div>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground font-mono text-[10px] uppercase tracking-wider hover:text-foreground">
            Reasoning chain · {analysis.bayesian.reasoning.length} step(s)
          </summary>
          <div className="mt-2">
            <ReasoningTrace steps={analysis.bayesian.reasoning} />
          </div>
        </details>
      </AgentCard>

      <AgentCard
        title="Contradiction Agent"
        agentId={analysis.contradiction.agentId}
        confidence={analysis.contradiction.confidence}
        icon={AlertTriangle}
      >
        <div className="grid grid-cols-3 gap-3">
          <Bar value={c.contradictionScore} label="Contradiction Score" tone="destructive" />
          <div className="text-xs space-y-0.5">
            <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Unsupported</div>
            <div className="text-2xl font-bold">{c.unsupportedClaims.length}</div>
          </div>
          <div className="text-xs space-y-0.5">
            <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Verified</div>
            <div className="text-2xl font-bold text-primary">{c.verifiedSignals.length}</div>
          </div>
        </div>

        {c.contradictions.length > 0 ? (
          <ul className="space-y-2">
            {c.contradictions.map((x) => (
              <li
                key={x.id}
                className={cn(
                  "border rounded p-3 text-xs space-y-1",
                  severityClass(x.severity),
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("font-mono text-[10px] uppercase", severityClass(x.severity))}>
                      {x.severity}
                    </Badge>
                    <span className="font-mono text-[10px] uppercase tracking-wider">{x.kind}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">· {x.domain}</span>
                  </div>
                </div>
                <div className="text-foreground/90">{x.summary}</div>
                {x.derivedFrom.length > 0 && (
                  <div className="font-mono text-[10px] text-muted-foreground">
                    derivedFrom: {x.derivedFrom.join(", ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground italic">No contradictions detected.</div>
        )}

        {c.verifiedSignals.length > 0 && (
          <div>
            <div className="font-mono text-[10px] uppercase text-primary/80 tracking-wider mb-1">
              Verified Signals
            </div>
            <ul className="space-y-1">
              {c.verifiedSignals.map((s) => (
                <li key={s.id} className="text-xs flex gap-2">
                  <CheckCircle2 className="size-3 text-primary mt-0.5 shrink-0" />
                  <span className="text-foreground/85">{s.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground font-mono text-[10px] uppercase tracking-wider hover:text-foreground">
            Reasoning chain · {analysis.contradiction.reasoning.length} step(s)
          </summary>
          <div className="mt-2">
            <ReasoningTrace steps={analysis.contradiction.reasoning} />
          </div>
        </details>
      </AgentCard>

      <AgentCard
        title="Trajectory Agent"
        agentId={analysis.trajectory.agentId}
        confidence={analysis.trajectory.confidence}
        icon={TrendingUp}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Bar value={t.trajectoryScore} label="Trajectory" />
          <Bar value={Math.max(0, Math.min(1, t.growthVelocity * 2))} label="Velocity" />
          <Bar value={Math.max(0, Math.min(1, 0.5 + t.acceleration))} label="Acceleration" />
          <Bar value={Math.max(0, Math.min(1, t.momentum / 0.4))} label="Momentum" />
          <Bar value={t.founderPotential} label="Founder Potential" />
        </div>

        <div className="border border-border/50 rounded p-3 bg-background/40">
          <div className="font-mono text-[10px] uppercase text-primary/80 tracking-wider mb-2 flex items-center gap-1">
            <Activity className="size-3" /> Complexity Curve
          </div>
          <TrajectoryChart curve={t.complexityCurve} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            {t.complexityCurve.map((c) => (
              <div key={c.roleId} className="text-[10px] font-mono text-muted-foreground">
                <span className="text-foreground/90">{c.title}</span> · {c.composite.toFixed(2)}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase text-primary/80 tracking-wider mb-1">
              Signals · {t.trajectorySignals.length}
            </div>
            <ul className="space-y-1">
              {t.trajectorySignals.map((s) => (
                <li key={s.id} className="text-xs flex gap-2">
                  <GitBranch className="size-3 text-primary mt-0.5 shrink-0" />
                  <span>
                    <span className="font-mono text-[10px] text-primary">{s.id}</span>{" "}
                    <span className="text-foreground/85">— {s.rationale}</span>
                  </span>
                </li>
              ))}
              {t.trajectorySignals.length === 0 && (
                <li className="text-xs text-muted-foreground italic">No signals fired.</li>
              )}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase text-yellow-600 tracking-wider mb-1">
              Risks · {t.risks.length}
            </div>
            <ul className="space-y-1">
              {t.risks.map((r) => (
                <li key={r.id} className="text-xs flex gap-2">
                  <AlertTriangle className="size-3 text-yellow-500 mt-0.5 shrink-0" />
                  <span>
                    <Badge variant="outline" className={cn("font-mono text-[10px] uppercase mr-1", severityClass(r.severity))}>
                      {r.severity}
                    </Badge>
                    <span className="font-mono text-[10px] text-yellow-600">{r.id}</span>{" "}
                    <span className="text-foreground/85">— {r.rationale}</span>
                  </span>
                </li>
              ))}
              {t.risks.length === 0 && (
                <li className="text-xs text-muted-foreground italic">No risks detected.</li>
              )}
            </ul>
          </div>
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground font-mono text-[10px] uppercase tracking-wider hover:text-foreground">
            Reasoning chain · {analysis.trajectory.reasoning.length} step(s)
          </summary>
          <div className="mt-2">
            <ReasoningTrace steps={analysis.trajectory.reasoning} />
          </div>
        </details>
      </AgentCard>

      <section className="border border-border rounded-md bg-card/40 p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <GitBranch className="size-4 text-primary" /> Evidence Chain
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-mono">
          {[
            { label: "Bayesian", chain: analysis.bayesian.evidenceChain, provenance: analysis.bayesian.provenance },
            { label: "Contradiction", chain: analysis.contradiction.evidenceChain, provenance: analysis.contradiction.provenance },
            { label: "Trajectory", chain: analysis.trajectory.evidenceChain, provenance: analysis.trajectory.provenance },
          ].map((b) => (
            <div key={b.label} className="border border-border/40 rounded p-2 bg-secondary/30 space-y-1">
              <div className="text-primary/80 uppercase tracking-wider">{b.label}</div>
              <div className="text-muted-foreground">producedBy: {b.provenance.producedBy}</div>
              <div className="text-muted-foreground">producedAt: {b.provenance.producedAt}</div>
              <div className="text-muted-foreground">derivedFrom · {b.chain.length}</div>
              <div className="text-foreground/85 break-words leading-relaxed">{b.chain.join(", ") || "—"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Intelligence() {
  const { data: analyses, isLoading } = useListIntelligenceAnalyses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo<CandidateAnalysis | null>(() => {
    if (!analyses || analyses.length === 0) return null;
    return analyses.find((a) => a.candidateId === selectedId) ?? analyses[0]!;
  }, [analyses, selectedId]);

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Running flagship agents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Flagship agents: Bayesian scoring, contradiction detection, trajectory modeling — with full reasoning chains and evidence attribution.
          </p>
        </div>
      </div>

      {!analyses || analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg">
          <Brain className="size-8 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground text-sm">No analyses available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-3 space-y-2">
            <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
              Candidates · {analyses.length}
            </div>
            {analyses.map((a) => {
              const isActive = selected?.candidateId === a.candidateId;
              return (
                <button
                  key={a.candidateId}
                  type="button"
                  onClick={() => setSelectedId(a.candidateId)}
                  className={cn(
                    "w-full text-left border rounded-md p-3 transition-colors",
                    isActive
                      ? "border-primary/60 bg-primary/5"
                      : "border-border hover:border-primary/30 bg-card/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{a.candidateName}</div>
                    <span className="text-[10px] font-mono text-muted-foreground">{a.candidateId}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{a.targetRole}</div>
                  <div className="grid grid-cols-3 gap-1 mt-2">
                    <div className="text-[10px] font-mono">
                      <div className="text-muted-foreground">fit</div>
                      <div className="text-primary">{pct(a.bayesian.result.fitScore)}</div>
                    </div>
                    <div className="text-[10px] font-mono">
                      <div className="text-muted-foreground">contra</div>
                      <div className={a.contradiction.result.contradictionScore > 0.4 ? "text-destructive" : "text-foreground/80"}>
                        {pct(a.contradiction.result.contradictionScore)}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono">
                      <div className="text-muted-foreground">traj</div>
                      <div className="text-foreground/80">{pct(a.trajectory.result.trajectoryScore)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </aside>
          <div className="col-span-12 md:col-span-9">
            {selected && <AnalysisDetail analysis={selected} />}
          </div>
        </div>
      )}
    </div>
  );
}
