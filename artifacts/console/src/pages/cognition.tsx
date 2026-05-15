import React, { useMemo, useState } from "react";
import { useListCognitiveSyntheses } from "@workspace/api-client-react";
import type { CognitiveSynthesis } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  GitBranch,
  Activity,
  AlertOctagon,
  Network,
  Layers,
  ScrollText,
  Database,
  ArrowRight,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const CATEGORY_TONE: Record<
  CognitiveSynthesis["uncertainty"]["certaintyCategory"],
  { label: string; tone: string; dot: string }
> = {
  "high-confidence-positive": {
    label: "High-confidence positive",
    tone: "text-primary border-primary/40 bg-primary/10",
    dot: "bg-primary",
  },
  "high-confidence-negative": {
    label: "High-confidence negative",
    tone: "text-destructive border-destructive/40 bg-destructive/10",
    dot: "bg-destructive",
  },
  "uncertain-positive": {
    label: "Uncertain positive",
    tone: "text-yellow-500 border-yellow-500/40 bg-yellow-500/10",
    dot: "bg-yellow-500",
  },
  "uncertain-negative": {
    label: "Uncertain negative",
    tone: "text-orange-500 border-orange-500/40 bg-orange-500/10",
    dot: "bg-orange-500",
  },
  ambiguous: {
    label: "Ambiguous",
    tone: "text-muted-foreground border-border bg-secondary/40",
    dot: "bg-muted-foreground",
  },
};

const RECO_TONE: Record<
  CognitiveSynthesis["reconciliation"]["recommendationCategory"],
  string
> = {
  advance: "text-primary border-primary/40",
  decline: "text-destructive border-destructive/40",
  investigate: "text-yellow-500 border-yellow-500/40",
  ambiguous: "text-muted-foreground border-border",
};

const KIND_TONE: Record<
  CognitiveSynthesis["influences"][number]["kind"],
  { stroke: string; label: string }
> = {
  "confidence-penalty": { stroke: "#f87171", label: "penalty" },
  "confidence-amplification": { stroke: "#22d3ee", label: "amplify" },
  "uncertainty-boost": { stroke: "#facc15", label: "uncertainty" },
  "evidence-reinforcement": { stroke: "#a78bfa", label: "evidence" },
  "contradiction-pressure": { stroke: "#fb923c", label: "pressure" },
};

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card/40">
      <header className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
        <Icon className="size-4 text-primary" />
        <h2 className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
          {title}
        </h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Bar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "destructive" | "warn";
}) {
  const cls =
    tone === "destructive"
      ? "bg-destructive"
      : tone === "warn"
        ? "bg-yellow-500"
        : "bg-primary";
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full", cls)}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

// --- Cognitive graph SVG (3 agent nodes + influence edges) ---
function CognitiveGraphView({ synthesis }: { synthesis: CognitiveSynthesis }) {
  const w = 640;
  const h = 320;
  const positions: Record<string, { x: number; y: number }> = {
    "bayesian-scorer": { x: 130, y: 100 },
    "contradiction-detector": { x: 510, y: 100 },
    "trajectory-modeler": { x: 320, y: 250 },
    global: { x: 320, y: 50 },
  };
  // Aggregate edges by from-to so multiple rules between the same pair
  // are shown as a single thicker arrow.
  const edgeMap = new Map<
    string,
    { from: string; to: string; kind: CognitiveSynthesis["influences"][number]["kind"]; weight: number; count: number }
  >();
  for (const e of synthesis.graph.edges) {
    const key = `${e.from}→${e.to}`;
    const cur = edgeMap.get(key);
    if (cur) {
      cur.weight = Math.max(cur.weight, e.weight);
      cur.count += 1;
    } else {
      edgeMap.set(key, {
        from: e.from,
        to: e.to,
        kind: e.kind,
        weight: e.weight,
        count: 1,
      });
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="block">
        <defs>
          {Object.entries(KIND_TONE).map(([kind, t]) => (
            <marker
              key={kind}
              id={`arrow-${kind}`}
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={t.stroke} />
            </marker>
          ))}
        </defs>
        {/* edges */}
        {Array.from(edgeMap.values()).map((e, i) => {
          const a = positions[e.from];
          const b = positions[e.to];
          if (!a || !b) return null;
          const t = KIND_TONE[e.kind];
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          // self-loop (e.g. trajectory→trajectory)
          if (e.from === e.to) {
            return (
              <g key={i}>
                <path
                  d={`M ${a.x - 30} ${a.y - 35} a 22 22 0 1 1 25 -10`}
                  stroke={t.stroke}
                  strokeWidth={1 + e.weight * 2}
                  fill="none"
                  opacity={0.7}
                  markerEnd={`url(#arrow-${e.kind})`}
                />
                <text
                  x={a.x - 70}
                  y={a.y - 55}
                  fill={t.stroke}
                  fontSize={9}
                  fontFamily="monospace"
                >
                  self · {t.label}
                </text>
              </g>
            );
          }
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={t.stroke}
                strokeWidth={1 + e.weight * 3}
                opacity={0.7}
                markerEnd={`url(#arrow-${e.kind})`}
              />
              <text
                x={midX}
                y={midY - 6}
                fill={t.stroke}
                fontSize={9}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {t.label} · w{e.weight.toFixed(2)}
                {e.count > 1 ? ` ·×${e.count}` : ""}
              </text>
            </g>
          );
        })}
        {/* global node */}
        {edgeMap.size > 0 &&
          Array.from(edgeMap.values()).some((e) => e.to === "global") && (
            <g>
              <circle
                cx={positions.global!.x}
                cy={positions.global!.y}
                r={22}
                fill="hsl(var(--muted))"
                stroke="hsl(var(--border))"
              />
              <text
                x={positions.global!.x}
                y={positions.global!.y + 3}
                textAnchor="middle"
                fontSize={10}
                fontFamily="monospace"
                fill="hsl(var(--muted-foreground))"
              >
                global
              </text>
            </g>
          )}
        {/* agent nodes */}
        {synthesis.graph.nodes.map((n) => {
          const p = positions[n.id]!;
          const delta = n.adjustedConfidence - n.initialConfidence;
          const deltaColor =
            delta > 0.01
              ? "#22d3ee"
              : delta < -0.01
                ? "#f87171"
                : "hsl(var(--muted-foreground))";
          return (
            <g key={n.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={36}
                fill="hsl(var(--card))"
                stroke="hsl(var(--primary))"
                strokeOpacity={0.5}
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y - 4}
                textAnchor="middle"
                fontSize={10}
                fontFamily="monospace"
                fill="hsl(var(--foreground))"
              >
                {n.name.split(" ")[0]}
              </text>
              <text
                x={p.x}
                y={p.y + 9}
                textAnchor="middle"
                fontSize={9}
                fontFamily="monospace"
                fill="hsl(var(--muted-foreground))"
              >
                c={n.adjustedConfidence.toFixed(2)}
              </text>
              <text
                x={p.x}
                y={p.y + 50}
                textAnchor="middle"
                fontSize={9}
                fontFamily="monospace"
                fill={deltaColor}
              >
                Δ {delta >= 0 ? "+" : ""}
                {delta.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono text-muted-foreground">
        {Object.entries(KIND_TONE).map(([k, t]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-0.5"
              style={{ backgroundColor: t.stroke }}
            />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Influence propagation trace ---
function InfluenceTrace({
  influences,
}: {
  influences: CognitiveSynthesis["influences"];
}) {
  if (influences.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No influence rules fired for this candidate — agents acted independently.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {influences.map((inf) => {
        const Icon = inf.adjustment >= 0 ? ArrowUp : ArrowDown;
        const tone = inf.adjustment >= 0 ? "text-primary" : "text-destructive";
        return (
          <li
            key={inf.id}
            className="rounded border border-border/60 bg-secondary/30 p-3"
          >
            <div className="flex items-start gap-3">
              <Icon className={cn("size-4 mt-0.5 shrink-0", tone)} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono">
                  <span className="text-foreground">{inf.sourceAgent}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="text-foreground">{inf.targetAgent}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] border"
                    style={{
                      color: KIND_TONE[inf.kind].stroke,
                      borderColor: KIND_TONE[inf.kind].stroke,
                    }}
                  >
                    {inf.kind}
                  </span>
                  <span className="text-muted-foreground">
                    {inf.before.toFixed(2)} → {inf.after.toFixed(2)} (
                    <span className={tone}>
                      {inf.adjustment >= 0 ? "+" : ""}
                      {inf.adjustment.toFixed(2)}
                    </span>
                    )
                  </span>
                </div>
                <p className="text-xs text-foreground/85 mt-1 leading-snug">
                  {inf.reason}
                </p>
                {inf.derivedFrom.length > 0 && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    derived from: {inf.derivedFrom.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- Disagreement heatmap ---
function DisagreementHeatmap({
  disagreement,
}: {
  disagreement: CognitiveSynthesis["disagreement"];
}) {
  const cellTone = (score: number) => {
    if (score >= 0.4) return "bg-destructive/40 text-destructive-foreground";
    if (score >= 0.25) return "bg-yellow-500/30 text-yellow-200";
    if (score >= 0.1) return "bg-primary/20 text-primary";
    return "bg-secondary text-muted-foreground";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs font-mono">
        <span className="text-muted-foreground">disagreementScore</span>
        <span className="text-foreground">
          {disagreement.disagreementScore.toFixed(2)}
        </span>
        <span className="text-muted-foreground">ambiguity</span>
        <span className="text-foreground">
          {disagreement.ambiguityLevel.toFixed(2)}
        </span>
        <span className="text-muted-foreground">confidenceTension</span>
        <span className="text-foreground">
          {disagreement.confidenceTension.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {disagreement.disagreements.map((d) => (
          <div
            key={d.id}
            className="rounded border border-border/60 p-3 bg-card/40"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-14 h-14 rounded flex items-center justify-center font-mono text-sm font-semibold border border-border/60",
                  cellTone(d.score),
                )}
              >
                {d.score.toFixed(2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-foreground">
                  {d.agentA} ↔ {d.agentB}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {d.metricA.name}={d.metricA.value.toFixed(2)} ·{" "}
                  {d.metricB.name}={d.metricB.value.toFixed(2)}
                </div>
                <p className="text-xs text-foreground/85 mt-1 leading-snug">
                  {d.rationale}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {disagreement.unresolvedQuestions.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
            Unresolved questions
          </div>
          <ul className="space-y-1 text-xs text-foreground/85">
            {disagreement.unresolvedQuestions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">?</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- Uncertainty map (the 5 categories with this candidate's position) ---
function UncertaintyMap({
  uncertainty,
}: {
  uncertainty: CognitiveSynthesis["uncertainty"];
}) {
  const cat = uncertainty.certaintyCategory;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
        {(
          [
            "high-confidence-negative",
            "ambiguous",
            "high-confidence-positive",
            "uncertain-negative",
            "ambiguous",
            "uncertain-positive",
          ] as const
        ).map((c, i) => {
          const tone = CATEGORY_TONE[c];
          const active = c === cat && i < 3 === (cat.startsWith("high"));
          // simpler: highlight any cell matching cat (ambiguous appears twice, both highlight)
          const isActive = c === cat;
          return (
            <div
              key={i}
              className={cn(
                "border rounded px-2 py-3 text-center transition-colors",
                isActive ? tone.tone : "border-border/60 text-muted-foreground/70 bg-card/20",
              )}
            >
              <div className="leading-tight">{tone.label}</div>
              {isActive && <div className="mt-1 text-[10px]">← here</div>}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Uncertainty
          </div>
          <Bar value={uncertainty.uncertaintyLevel} tone="warn" />
          <div className="text-right text-muted-foreground mt-0.5">
            {pct(uncertainty.uncertaintyLevel)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Ambiguity
          </div>
          <Bar value={uncertainty.ambiguityScore} tone="warn" />
          <div className="text-right text-muted-foreground mt-0.5">
            {pct(uncertainty.ambiguityScore)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Evidence reliability
          </div>
          <Bar value={uncertainty.evidenceReliability} />
          <div className="text-right text-muted-foreground mt-0.5">
            {pct(uncertainty.evidenceReliability)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Per-agent confidence
          </div>
          <div className="space-y-1">
            {Object.entries(uncertainty.confidenceDistribution).map(
              ([agent, v]) => (
                <div key={agent} className="flex items-center gap-2 text-[10px]">
                  <span className="w-32 truncate text-muted-foreground">
                    {agent}
                  </span>
                  <div className="flex-1">
                    <Bar value={v} />
                  </div>
                  <span className="text-foreground w-8 text-right">
                    {pct(v)}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Reconciliation panel ---
function ReconciliationPanel({
  reconciliation,
}: {
  reconciliation: CognitiveSynthesis["reconciliation"];
}) {
  const tone = RECO_TONE[reconciliation.recommendationCategory];
  return (
    <div className="space-y-4">
      <div className={cn("border rounded p-4", tone)}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wider font-mono">
            Recommendation
          </span>
          <span className="font-mono text-xs uppercase">
            · {reconciliation.recommendationCategory}
          </span>
        </div>
        <p className="text-sm leading-snug">{reconciliation.recommendation}</p>
      </div>

      {reconciliation.majorTensions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">
            Major tensions
          </div>
          <ul className="space-y-1 text-xs text-foreground/85">
            {reconciliation.majorTensions.map((t, i) => (
              <li key={i} className="font-mono">
                · {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reconciliation.strongestEvidence.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">
            Strongest evidence
          </div>
          <ul className="space-y-1">
            {reconciliation.strongestEvidence.map((e) => (
              <li
                key={e.id}
                className="flex gap-3 text-xs font-mono py-1 border-b border-border/30 last:border-0"
              >
                <span className="text-primary w-20 shrink-0">{e.id}</span>
                <span className="flex-1 text-foreground/85">{e.summary}</span>
                <span className="text-muted-foreground">
                  w={e.weight.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reconciliation.unresolvedConcerns.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">
            Unresolved concerns
          </div>
          <ul className="space-y-1 text-xs text-foreground/85">
            {reconciliation.unresolvedConcerns.map((c, i) => (
              <li key={i}>· {c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
            Trajectory outlook
          </div>
          <p className="text-xs text-foreground/85 leading-snug">
            {reconciliation.trajectoryOutlook}
          </p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
            Confidence narrative
          </div>
          <p className="text-xs text-foreground/85 leading-snug font-mono">
            {reconciliation.confidenceNarrative}
          </p>
        </div>
      </div>

      {reconciliation.nextInvestigations.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">
            Next investigations
          </div>
          <ul className="space-y-1 text-xs text-foreground/85">
            {reconciliation.nextInvestigations.map((n, i) => (
              <li key={i}>→ {n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- Cross-agent memory archetypes ---
function MemoryPanel({
  memory,
}: {
  memory: CognitiveSynthesis["memory"];
}) {
  return (
    <div className="space-y-4">
      {memory.matchedArchetypes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No archetypes matched this candidate.
        </p>
      ) : (
        <div className="space-y-2">
          {memory.matchedArchetypes.map((m) => (
            <div
              key={m.archetypeId}
              className="border border-border/60 rounded p-3 bg-card/40"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Layers className="size-3.5 text-primary" />
                  <span className="text-sm font-medium">{m.archetypeName}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {m.archetypeId}
                  </span>
                </div>
                <span className="font-mono text-xs text-foreground">
                  {pct(m.matchScore)}
                </span>
              </div>
              <Bar value={m.matchScore} />
              <p className="text-xs text-foreground/85 mt-2 leading-snug">
                {m.rationale}
              </p>
              {m.signals.length > 0 && (
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  signals: {m.signals.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {memory.recurringPatterns.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">
            Longitudinal patterns
          </div>
          <ul className="space-y-1 text-xs text-foreground/85">
            {memory.recurringPatterns.map((p, i) => (
              <li key={i}>· {p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  synthesis,
  active,
  onClick,
}: {
  synthesis: CognitiveSynthesis;
  active: boolean;
  onClick: () => void;
}) {
  const tone = CATEGORY_TONE[synthesis.uncertainty.certaintyCategory];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded border px-3 py-2.5 transition-colors",
        active
          ? "border-primary/60 bg-primary/5"
          : "border-border/50 hover:border-border bg-card/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">
          {synthesis.candidateId}
        </span>
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            tone.dot,
          )}
        />
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
        {tone.label} · global {synthesis.confidence.globalConfidence.toFixed(2)}
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
        disagree {synthesis.disagreement.disagreementScore.toFixed(2)} ·{" "}
        {synthesis.influences.length} influence(s)
      </div>
    </button>
  );
}

export function Cognition() {
  const { data: syntheses, isLoading } = useListCognitiveSyntheses();
  const list = useMemo(() => syntheses ?? [], [syntheses]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (!list.length) return null;
    return list.find((s) => s.candidateId === selectedId) ?? list[0]!;
  }, [list, selectedId]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground font-mono">
        Loading cognitive syntheses…
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="text-sm text-muted-foreground font-mono">
        No cognitive syntheses available.
      </div>
    );
  }

  const tone = CATEGORY_TONE[selected.uncertainty.certaintyCategory];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cognition</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive cross-agent synthesis. Agents influence each other through
          deterministic propagation rules; disagreement, uncertainty, and
          archetype memory are surfaced — never collapsed.
        </p>
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-2">
          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider px-1 mb-1">
            Candidates · {list.length}
          </div>
          {list.map((s) => (
            <CandidateRow
              key={s.candidateId}
              synthesis={s}
              active={s.candidateId === selected.candidateId}
              onClick={() => setSelectedId(s.candidateId)}
            />
          ))}
        </aside>

        <div className="space-y-6">
          {/* Header: category + global confidence */}
          <div
            className={cn(
              "rounded-lg border p-5 flex flex-wrap items-center gap-6",
              tone.tone,
            )}
          >
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider opacity-70">
                Certainty category
              </div>
              <div className="text-xl font-bold mt-0.5">{tone.label}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider opacity-70">
                Global confidence
              </div>
              <div className="text-xl font-mono mt-0.5">
                {selected.confidence.globalConfidence.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider opacity-70">
                Disagreement
              </div>
              <div className="text-xl font-mono mt-0.5">
                {selected.disagreement.disagreementScore.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider opacity-70">
                Recommendation
              </div>
              <div className="text-xl font-mono uppercase mt-0.5">
                {selected.reconciliation.recommendationCategory}
              </div>
            </div>
            {selected.confidence.saturationApplied && (
              <div className="ml-auto flex items-center gap-1.5 text-[11px] font-mono">
                <AlertOctagon className="size-4" />
                saturation applied
              </div>
            )}
          </div>

          <Section title="Cognitive graph" icon={Network}>
            <CognitiveGraphView synthesis={selected} />
          </Section>

          <Section title="Influence propagation trace" icon={GitBranch}>
            <InfluenceTrace influences={selected.influences} />
          </Section>

          <Section title="Disagreement heatmap" icon={Activity}>
            <DisagreementHeatmap disagreement={selected.disagreement} />
          </Section>

          <Section title="Uncertainty map" icon={Layers}>
            <UncertaintyMap uncertainty={selected.uncertainty} />
          </Section>

          <Section title="Reconciliation synthesis" icon={ScrollText}>
            <ReconciliationPanel reconciliation={selected.reconciliation} />
          </Section>

          <Section title="Cross-agent memory" icon={Database}>
            <MemoryPanel memory={selected.memory} />
          </Section>
        </div>
      </div>
    </div>
  );
}
