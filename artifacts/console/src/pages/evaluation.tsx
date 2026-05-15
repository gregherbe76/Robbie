import React, { useMemo, useState } from "react";
import {
  useGetEvaluationReport,
  useListEvaluationOutcomes,
  useListEvaluationPredictions,
} from "@workspace/api-client-react";
import type {
  EvaluationReport,
  CalibrationCurve,
  CalibrationBucket,
  PredictionEvaluation,
  ArchetypePerformance,
  DriftSignal,
  TrajectoryObservation,
  OrganizationalLearningSignal,
  BenchmarkResult,
  OutcomeEvent,
  PredictionRecord,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Activity,
  Target,
  TrendingUp,
  AlertTriangle,
  Gauge,
  Microscope,
  ScrollText,
  ListChecks,
  GitCompareArrows,
  Flame,
  Beaker,
  HelpCircle,
} from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function Section({
  title,
  icon: Icon,
  children,
  hint,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card/40">
      <header className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h2 className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </h2>
        </div>
        {hint && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/70">
            <HelpCircle className="size-3" />
            {hint}
          </div>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-primary"
      : tone === "warn"
        ? "text-yellow-500"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-mono", toneCls)}>{value}</div>
      {sub && (
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground border-border bg-secondary/30",
    good: "text-primary border-primary/40 bg-primary/10",
    warn: "text-yellow-500 border-yellow-500/40 bg-yellow-500/10",
    bad: "text-destructive border-destructive/40 bg-destructive/10",
    muted: "text-muted-foreground border-border bg-secondary/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// -------------------------------------------------------------------------
// Reliability diagram: perfect calibration is the diagonal; each bucket is
// a point at (midpoint, observedPositiveRate) sized by population.
// -------------------------------------------------------------------------

function ReliabilityDiagram({ curve }: { curve: CalibrationCurve }) {
  const W = 360;
  const H = 200;
  const PAD = 28;
  const toX = (v: number) => PAD + v * (W - PAD * 2);
  const toY = (v: number) => H - PAD - v * (H - PAD * 2);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-md border border-border/40 rounded-md bg-background/30"
    >
      {/* Axes */}
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke="hsl(var(--muted-foreground))"
        strokeOpacity="0.4"
      />
      <line
        x1={PAD}
        y1={PAD}
        x2={PAD}
        y2={H - PAD}
        stroke="hsl(var(--muted-foreground))"
        strokeOpacity="0.4"
      />
      {/* Perfect-calibration diagonal */}
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(1)}
        y2={toY(1)}
        stroke="hsl(var(--muted-foreground))"
        strokeDasharray="4 3"
        strokeOpacity="0.5"
      />
      {/* Bucket polyline + points */}
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        points={curve.buckets
          .filter((b) => b.predictions > 0)
          .map((b) => `${toX(b.midpoint)},${toY(b.observedPositiveRate)}`)
          .join(" ")}
      />
      {curve.buckets.map((b, i) => {
        if (b.predictions === 0) return null;
        const r = 4 + Math.min(10, b.predictions);
        const overConfident = b.gap < -0.05;
        const underConfident = b.gap > 0.05;
        const fill = overConfident
          ? "hsl(var(--destructive))"
          : underConfident
            ? "#eab308"
            : "hsl(var(--primary))";
        return (
          <g key={i}>
            <circle
              cx={toX(b.midpoint)}
              cy={toY(b.observedPositiveRate)}
              r={r}
              fill={fill}
              fillOpacity={0.6}
              stroke={fill}
              strokeWidth={1}
            />
            <text
              x={toX(b.midpoint)}
              y={toY(b.observedPositiveRate) - r - 4}
              textAnchor="middle"
              fontSize="9"
              fill="hsl(var(--muted-foreground))"
              fontFamily="monospace"
            >
              n={b.predictions}
            </text>
          </g>
        );
      })}
      {/* Axis labels */}
      <text
        x={W / 2}
        y={H - 6}
        textAnchor="middle"
        fontSize="10"
        fill="hsl(var(--muted-foreground))"
        fontFamily="monospace"
      >
        claimed confidence
      </text>
      <text
        x={10}
        y={H / 2}
        textAnchor="middle"
        fontSize="10"
        fill="hsl(var(--muted-foreground))"
        fontFamily="monospace"
        transform={`rotate(-90 10 ${H / 2})`}
      >
        observed success
      </text>
    </svg>
  );
}

// -------------------------------------------------------------------------
// Calibration bucket table — the reliability map.
// -------------------------------------------------------------------------

function BucketTable({
  curve,
  classifications,
}: {
  curve: CalibrationCurve;
  classifications: EvaluationReport["reliability"]["bucketClassifications"];
}) {
  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-muted-foreground border-b border-border/60">
          <th className="text-left py-1 font-normal">bucket</th>
          <th className="text-right py-1 font-normal">n</th>
          <th className="text-right py-1 font-normal">expected</th>
          <th className="text-right py-1 font-normal">observed</th>
          <th className="text-right py-1 font-normal">gap</th>
          <th className="text-left py-1 font-normal pl-3">classification</th>
        </tr>
      </thead>
      <tbody>
        {curve.buckets.map((b, i) => {
          const cls = classifications[i];
          const tone =
            cls?.classification === "overconfident"
              ? "bad"
              : cls?.classification === "underconfident"
                ? "warn"
                : cls?.classification === "justified"
                  ? "good"
                  : "muted";
          return (
            <tr key={i} className="border-b border-border/30 last:border-0">
              <td className="py-1">
                {b.lower.toFixed(2)}–{b.upper.toFixed(2)}
              </td>
              <td className="text-right py-1">{b.predictions}</td>
              <td className="text-right py-1">{pct(b.expectedPositiveRate)}</td>
              <td className="text-right py-1">
                {b.predictions === 0 ? "—" : pct(b.observedPositiveRate)}
              </td>
              <td
                className={cn(
                  "text-right py-1",
                  b.gap < -0.05 && "text-destructive",
                  b.gap > 0.05 && "text-yellow-500",
                )}
              >
                {b.predictions === 0 ? "—" : (b.gap >= 0 ? "+" : "") + fmt(b.gap)}
              </td>
              <td className="pl-3 py-1">
                <Pill tone={tone}>{cls?.classification ?? "unstable"}</Pill>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// -------------------------------------------------------------------------
// Per-kind prediction-vs-outcome bars.
// -------------------------------------------------------------------------

function PredictionKindRow({ k }: { k: PredictionEvaluation }) {
  return (
    <div className="border-b border-border/40 last:border-0 py-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-sm">{k.predictionKind}</div>
        <div className="flex items-center gap-2">
          <Pill tone={k.f1 >= 0.6 ? "good" : k.evaluated === 0 ? "muted" : "bad"}>
            F1 {fmt(k.f1)}
          </Pill>
          <Pill tone={Math.abs(k.calibrationGap) <= 0.1 ? "good" : "bad"}>
            gap {k.calibrationGap >= 0 ? "+" : ""}
            {fmt(k.calibrationGap)}
          </Pill>
          <Pill tone="muted">n={k.evaluated}</Pill>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-3 text-[11px] font-mono text-muted-foreground">
        <div>
          precision <span className="text-foreground">{fmt(k.precision)}</span>
        </div>
        <div>
          recall <span className="text-foreground">{fmt(k.recall)}</span>
        </div>
        <div>
          brier <span className="text-foreground">{fmt(k.brierScore)}</span>
        </div>
        <div>
          conf <span className="text-foreground">{fmt(k.averageConfidence)}</span>
          {" vs obs "}
          <span className="text-foreground">{fmt(k.observedAccuracy)}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] font-mono">
        <div className="rounded bg-primary/10 border border-primary/30 px-2 py-0.5 text-center">
          TP {k.truePositives}
        </div>
        <div className="rounded bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-center">
          FP {k.falsePositives}
        </div>
        <div className="rounded bg-secondary/40 border border-border px-2 py-0.5 text-center">
          TN {k.trueNegatives}
        </div>
        <div className="rounded bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 text-center">
          FN {k.falseNegatives}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Archetype performance matrix.
// -------------------------------------------------------------------------

function ArchetypeMatrix({ rows }: { rows: ArchetypePerformance[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground font-mono">
        No archetypes have resolved outcomes in the current corpus.
      </div>
    );
  }
  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-muted-foreground border-b border-border/60">
          <th className="text-left py-1 font-normal">archetype</th>
          <th className="text-right py-1 font-normal">n</th>
          <th className="text-right py-1 font-normal">success</th>
          <th className="text-right py-1 font-normal">retention</th>
          <th className="text-right py-1 font-normal">promotion</th>
          <th className="text-right py-1 font-normal">claimed</th>
          <th className="text-right py-1 font-normal">realised</th>
          <th className="text-left py-1 font-normal pl-3">failure modes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const gap = a.averagePredictedConfidence - a.realisedAccuracy;
          const tone = a.sampleSize === 0 ? "muted" : gap > 0.15 ? "bad" : "good";
          return (
            <tr key={a.archetype} className="border-b border-border/30 last:border-0">
              <td className="py-2">
                <div className="font-medium text-foreground">{a.archetype}</div>
                <div className="text-[10px] text-muted-foreground">
                  env-sensitivity {fmt(a.environmentSensitivity)} · conf{" "}
                  {fmt(a.confidence)}
                </div>
              </td>
              <td className="text-right py-2">{a.sampleSize}</td>
              <td className="text-right py-2">{pct(a.successRate)}</td>
              <td className="text-right py-2">{pct(a.retentionRate)}</td>
              <td className="text-right py-2">{pct(a.promotionRate)}</td>
              <td className="text-right py-2">
                {pct(a.averagePredictedConfidence)}
              </td>
              <td className="text-right py-2">
                <Pill tone={tone}>{pct(a.realisedAccuracy)}</Pill>
              </td>
              <td className="pl-3 py-2 text-muted-foreground">
                {a.failurePatterns.length === 0
                  ? "—"
                  : a.failurePatterns.join(", ")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// -------------------------------------------------------------------------
// Drift detection timeline.
// -------------------------------------------------------------------------

function DriftTimeline({
  drifts,
  driftScore,
}: {
  drifts: DriftSignal[];
  driftScore: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          drift score
        </div>
        <div className="flex-1 h-2 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className={cn(
              "h-full",
              driftScore < 0.34
                ? "bg-primary"
                : driftScore < 0.67
                  ? "bg-yellow-500"
                  : "bg-destructive",
            )}
            style={{ width: `${Math.round(driftScore * 100)}%` }}
          />
        </div>
        <div className="text-xs font-mono">{fmt(driftScore)}</div>
      </div>
      {drifts.length === 0 ? (
        <div className="text-xs text-muted-foreground font-mono">
          No drift detected.
        </div>
      ) : (
        <ol className="relative border-l border-border/60 ml-2 space-y-3">
          {drifts.map((d, i) => {
            const tone =
              d.severity === "high"
                ? "bad"
                : d.severity === "medium"
                  ? "warn"
                  : "muted";
            return (
              <li key={i} className="pl-4 relative">
                <span
                  className={cn(
                    "absolute -left-[5px] top-1 size-2 rounded-full",
                    d.severity === "high"
                      ? "bg-destructive"
                      : d.severity === "medium"
                        ? "bg-yellow-500"
                        : "bg-muted-foreground",
                  )}
                />
                <div className="flex items-center gap-2">
                  <Pill tone={tone}>{d.driftType}</Pill>
                  <Pill tone={tone}>{d.severity}</Pill>
                  <Pill tone="muted">conf {fmt(d.confidence)}</Pill>
                </div>
                <div className="mt-1 text-sm">{d.detail}</div>
                <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                  impacted: {d.impactedAgents.join(", ") || "—"}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground italic">
                  → {d.recommendedRecalibration}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Longitudinal trajectory explorer.
// -------------------------------------------------------------------------

function TrajectoryExplorer({
  rows,
  outcomes,
}: {
  rows: TrajectoryObservation[];
  outcomes: OutcomeEvent[];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground font-mono">
        No trajectory predictions resolved against outcomes yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((t) => {
        const events = outcomes
          .filter(
            (o) =>
              o.organizationId === t.organizationId &&
              o.candidateId === t.candidateId,
          )
          .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
        return (
          <div
            key={`${t.organizationId}:${t.candidateId}`}
            className="rounded-md border border-border/60 bg-background/40 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm">
                {t.candidateId} @ {t.organizationId}
              </div>
              <div className="flex items-center gap-2">
                <Pill tone="muted">role {t.roleEvolution}</Pill>
                <Pill tone={t.matchesPrediction ? "good" : "bad"}>
                  {t.matchesPrediction ? "matched" : "diverged"}
                </Pill>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-[11px] font-mono">
              <div>
                predicted{" "}
                <span className="text-foreground">{fmt(t.predictedTrajectory)}</span>
              </div>
              <div>
                realised{" "}
                <span className="text-foreground">{fmt(t.realisedVelocity)}</span>
              </div>
              <div>
                ownership{" "}
                <span className="text-foreground">{fmt(t.ownershipGrowth)}</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                outcome events
              </div>
              <div className="flex flex-wrap gap-1">
                {events.map((e) => {
                  const positive = [
                    "successful_hire",
                    "promotion",
                    "retention",
                    "founder_success",
                    "exceptional_growth",
                  ].includes(e.outcomeType);
                  const negative = [
                    "poor_performance",
                    "rapid_exit",
                    "org_mismatch",
                    "team_failure",
                  ].includes(e.outcomeType);
                  return (
                    <span
                      key={e.id}
                      className={cn(
                        "rounded border px-2 py-0.5 text-[10px] font-mono",
                        positive
                          ? "border-primary/40 text-primary bg-primary/10"
                          : negative
                            ? "border-destructive/40 text-destructive bg-destructive/10"
                            : "border-border text-muted-foreground bg-secondary/30",
                      )}
                      title={`${e.timestamp}\n${e.provenance.rationale}`}
                    >
                      {e.outcomeType}@{e.timestamp.slice(0, 10)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------------
// Organizational learning panel.
// -------------------------------------------------------------------------

function OrgLearningPanel({
  signals,
}: {
  signals: OrganizationalLearningSignal[];
}) {
  if (signals.length === 0) {
    return (
      <div className="text-xs text-muted-foreground font-mono">
        No organizational learning signals yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {signals.map((sig) => (
        <div
          key={sig.organizationId}
          className="rounded-md border border-border/60 bg-background/40 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm">{sig.organizationId}</div>
            <div className="flex items-center gap-2">
              <Pill tone="muted">conf {fmt(sig.confidence)}</Pill>
              <Pill tone={Math.abs(sig.hiringBarShift) < 0.05 ? "good" : "warn"}>
                bar shift {sig.hiringBarShift >= 0 ? "+" : ""}
                {fmt(sig.hiringBarShift)}
              </Pill>
              <Pill tone="good">founder stability {fmt(sig.founderStyleStability)}</Pill>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                success correlates
              </div>
              {sig.successCorrelates.length === 0 ? (
                <div className="text-[11px] text-muted-foreground font-mono">
                  —
                </div>
              ) : (
                <ul className="space-y-1">
                  {sig.successCorrelates.map((c, i) => (
                    <li key={i} className="text-[11px] font-mono">
                      <span className="text-primary">+{fmt(c.weight)}</span>{" "}
                      <span className="text-foreground">{c.attribute}</span>{" "}
                      <span className="text-muted-foreground">
                        (n={c.sampleSize})
                      </span>
                      <div className="text-[10px] text-muted-foreground pl-3">
                        {c.rationale}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                failure correlates
              </div>
              {sig.failureCorrelates.length === 0 ? (
                <div className="text-[11px] text-muted-foreground font-mono">
                  —
                </div>
              ) : (
                <ul className="space-y-1">
                  {sig.failureCorrelates.map((c, i) => (
                    <li key={i} className="text-[11px] font-mono">
                      <span className="text-destructive">−{fmt(c.weight)}</span>{" "}
                      <span className="text-foreground">{c.attribute}</span>{" "}
                      <span className="text-muted-foreground">
                        (n={c.sampleSize})
                      </span>
                      <div className="text-[10px] text-muted-foreground pl-3">
                        {c.rationale}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-3 border-t border-border/40 pt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              recommended adjustments (bounded ±0.15, inspectable)
            </div>
            {sig.recommendedWeightAdjustments.length === 0 ? (
              <div className="text-[11px] text-muted-foreground font-mono">
                None — system within tolerance for this org.
              </div>
            ) : (
              <ul className="space-y-1">
                {sig.recommendedWeightAdjustments.map((adj, i) => (
                  <li
                    key={i}
                    className="text-[11px] font-mono flex items-start gap-2"
                  >
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 border text-[10px]",
                        adj.adjustment >= 0
                          ? "text-primary border-primary/40 bg-primary/10"
                          : "text-destructive border-destructive/40 bg-destructive/10",
                      )}
                    >
                      {adj.adjustment >= 0 ? "+" : ""}
                      {fmt(adj.adjustment)}
                    </span>
                    <div>
                      <span className="text-foreground">{adj.agent}</span>
                      <div className="text-[10px] text-muted-foreground">
                        {adj.rationale}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------------
// Replayable benchmark scenarios.
// -------------------------------------------------------------------------

function BenchmarkPanel({ rows }: { rows: BenchmarkResult[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.scenarioId}
          className="rounded-md border border-border/60 bg-background/40 p-3"
        >
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs">{r.scenarioId}</div>
            <Pill tone={r.passed ? "good" : "bad"}>
              {r.passed ? "passed" : "failed"}
            </Pill>
          </div>
          <ul className="mt-2 space-y-1">
            {r.assertionResults.map((a, i) => (
              <li key={i} className="text-[11px] font-mono flex justify-between">
                <span className="text-muted-foreground">
                  {a.path}{" "}
                  <span className="text-foreground/70">
                    {a.comparator} {fmt(a.expected)}
                  </span>
                </span>
                <span
                  className={cn(
                    a.passed ? "text-primary" : "text-destructive",
                  )}
                >
                  actual {fmt(a.actual)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------------
// Per-agent / per-org / per-archetype calibration slicer.
// -------------------------------------------------------------------------

function CalibrationSlicer({
  perAgent,
  perOrg,
  perArchetype,
}: {
  perAgent: CalibrationCurve[];
  perOrg: CalibrationCurve[];
  perArchetype: CalibrationCurve[];
}) {
  type Slice = "per-agent" | "per-organization" | "per-archetype";
  const [slice, setSlice] = useState<Slice>("per-agent");
  const data =
    slice === "per-agent"
      ? perAgent
      : slice === "per-organization"
        ? perOrg
        : perArchetype;
  return (
    <div>
      <div className="flex gap-1 mb-3">
        {(["per-agent", "per-organization", "per-archetype"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setSlice(s)}
              className={cn(
                "rounded-md border px-3 py-1 text-[11px] font-mono transition-colors",
                s === slice
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary/40",
              )}
            >
              {s}
            </button>
          ),
        )}
      </div>
      {data.length === 0 ? (
        <div className="text-xs text-muted-foreground font-mono">
          No {slice} slices available.
        </div>
      ) : (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-muted-foreground border-b border-border/60">
              <th className="text-left py-1 font-normal">scope</th>
              <th className="text-right py-1 font-normal">n</th>
              <th className="text-right py-1 font-normal">ece</th>
              <th className="text-right py-1 font-normal">bias</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr
                key={`${c.scope}:${c.scopeKey}`}
                className="border-b border-border/30 last:border-0"
              >
                <td className="py-1 text-foreground">{c.scopeKey}</td>
                <td className="text-right py-1">{c.predictionsEvaluated}</td>
                <td
                  className={cn(
                    "text-right py-1",
                    c.expectedCalibrationError > 0.2 && "text-destructive",
                  )}
                >
                  {fmt(c.expectedCalibrationError)}
                </td>
                <td
                  className={cn(
                    "text-right py-1",
                    c.systematicBias > 0.05 && "text-destructive",
                    c.systematicBias < -0.05 && "text-yellow-500",
                  )}
                >
                  {(c.systematicBias >= 0 ? "+" : "") + fmt(c.systematicBias)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Prediction-vs-outcome detail (per candidate-prediction).
// -------------------------------------------------------------------------

function PredictionVsOutcome({
  predictions,
  outcomes,
}: {
  predictions: PredictionRecord[];
  outcomes: OutcomeEvent[];
}) {
  const rows = useMemo(() => {
    return predictions.map((p) => {
      const resolved = outcomes
        .filter(
          (o) =>
            o.organizationId === p.organizationId &&
            o.candidateId === p.candidateId &&
            !["hired", "rejected", "withdrew", "failed_process"].includes(
              o.outcomeType,
            ),
        )
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
      const last = resolved[resolved.length - 1] ?? null;
      return { p, outcome: last };
    });
  }, [predictions, outcomes]);
  return (
    <div className="max-h-[480px] overflow-y-auto">
      <table className="w-full text-xs font-mono">
        <thead className="sticky top-0 bg-card">
          <tr className="text-muted-foreground border-b border-border/60">
            <th className="text-left py-1 font-normal">prediction</th>
            <th className="text-left py-1 font-normal">candidate</th>
            <th className="text-right py-1 font-normal">score</th>
            <th className="text-right py-1 font-normal">conf</th>
            <th className="text-left py-1 font-normal pl-3">resolved outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, outcome }) => {
            const positivePol = [
              "candidate-fit",
              "trajectory",
              "chaos-fit",
              "org-fit",
              "retention",
            ].includes(p.predictionKind);
            const outcomePositive = outcome
              ? [
                  "successful_hire",
                  "promotion",
                  "retention",
                  "founder_success",
                  "exceptional_growth",
                ].includes(outcome.outcomeType)
              : null;
            const aligned = outcome
              ? (positivePol
                  ? outcomePositive
                  : !outcomePositive) ===
                (p.score >= 0.5)
              : null;
            return (
              <tr key={p.id} className="border-b border-border/30 last:border-0">
                <td className="py-1">{p.predictionKind}</td>
                <td className="py-1">{p.candidateId}</td>
                <td className="text-right py-1">{fmt(p.score)}</td>
                <td className="text-right py-1">{fmt(p.confidence)}</td>
                <td className="pl-3 py-1">
                  {outcome ? (
                    <Pill tone={aligned ? "good" : "bad"}>
                      {outcome.outcomeType}
                    </Pill>
                  ) : (
                    <Pill tone="muted">unresolved</Pill>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// =========================================================================
// Page
// =========================================================================

export function Evaluation() {
  const reportQ = useGetEvaluationReport();
  const outcomesQ = useListEvaluationOutcomes();
  const predictionsQ = useListEvaluationPredictions();

  if (reportQ.isLoading || outcomesQ.isLoading || predictionsQ.isLoading) {
    return (
      <div className="text-sm text-muted-foreground font-mono p-6">
        Loading evaluation layer…
      </div>
    );
  }
  if (!reportQ.data || !outcomesQ.data || !predictionsQ.data) {
    return (
      <div className="text-sm text-destructive font-mono p-6">
        Evaluation layer unavailable.
      </div>
    );
  }
  const report = reportQ.data;
  const outcomes = outcomesQ.data;
  const predictions = predictionsQ.data;

  const reliabilityTone =
    report.reliability.overconfidenceRisk === "high"
      ? "bad"
      : report.reliability.overconfidenceRisk === "medium"
        ? "warn"
        : "good";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Evaluation, Calibration & Longitudinal Learning
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
          The framework runs deterministically over the seeded corpus, compares
          every prediction against append-only outcome events, and surfaces
          calibration error, drift, archetype performance, and bounded learning
          adjustments. No hidden weights, no opaque RL — every recommendation is
          provenance-backed and reviewable.
        </p>
        <div className="mt-2 text-[11px] font-mono text-muted-foreground">
          generated by {report.generatedBy} · at{" "}
          {new Date(report.generatedAt).toISOString()}
        </div>
      </header>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric
          label="predictions"
          value={String(report.predictionsEvaluated)}
          sub={`${report.outcomesObserved} outcome events`}
        />
        <Metric
          label="ECE"
          value={fmt(report.systemCalibration.expectedCalibrationError)}
          sub={`bias ${report.systemCalibration.systematicBias >= 0 ? "+" : ""}${fmt(report.systemCalibration.systematicBias)}`}
          tone={
            report.systemCalibration.expectedCalibrationError > 0.2
              ? "bad"
              : report.systemCalibration.expectedCalibrationError > 0.1
                ? "warn"
                : "good"
          }
        />
        <Metric
          label="reliability"
          value={fmt(report.reliability.reliabilityScore)}
          sub={`overconfidence: ${report.reliability.overconfidenceRisk}`}
          tone={reliabilityTone}
        />
        <Metric
          label="prediction quality"
          value={fmt(report.predictionEvaluation.predictionQuality)}
          sub="weighted F1 across kinds"
        />
        <Metric
          label="drift score"
          value={fmt(report.drift.driftScore)}
          sub={`${report.drift.detectedDrifts.length} signal(s)`}
          tone={
            report.drift.driftScore > 0.5
              ? "bad"
              : report.drift.driftScore > 0.2
                ? "warn"
                : "good"
          }
        />
      </div>

      {/* Calibration */}
      <Section
        title="System calibration"
        icon={Gauge}
        hint="diagonal = perfect calibration"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ReliabilityDiagram curve={report.systemCalibration} />
            <p className="mt-3 text-[11px] text-muted-foreground italic max-w-md">
              {report.reliability.calibrationNarrative}
            </p>
          </div>
          <div>
            <BucketTable
              curve={report.systemCalibration}
              classifications={report.reliability.bucketClassifications}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Calibration by slice"
        icon={GitCompareArrows}
        hint="per-agent · per-organization · per-archetype"
      >
        <CalibrationSlicer
          perAgent={report.perAgentCalibration}
          perOrg={report.perOrgCalibration}
          perArchetype={report.perArchetypeCalibration}
        />
      </Section>

      {/* Confidence reliability map */}
      <Section
        title="Confidence reliability map"
        icon={Microscope}
        hint="justified · fragile · over · under · unstable"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Metric
            label="uncertainty accuracy"
            value={fmt(report.reliability.uncertaintyAccuracy)}
            sub="agreement on high-confidence buckets"
          />
          <Metric
            label="disagreement signal"
            value={fmt(report.reliability.disagreementPredictiveness)}
            sub="F1 of contradiction signals"
          />
          <Metric
            label="overconfidence risk"
            value={report.reliability.overconfidenceRisk}
            tone={reliabilityTone}
          />
        </div>
      </Section>

      {/* Prediction-vs-outcome */}
      <Section
        title="Prediction vs outcome"
        icon={Target}
        hint="per-kind precision · recall · F1 · brier"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              by prediction kind
            </h3>
            {report.predictionEvaluation.kindReports.map((k) => (
              <PredictionKindRow key={k.predictionKind} k={k} />
            ))}
            {report.predictionEvaluation.recurringFailureModes.length > 0 && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  recurring failure modes
                </div>
                <ul className="text-[11px] font-mono text-foreground space-y-1">
                  {report.predictionEvaluation.recurringFailureModes.map(
                    (f, i) => (
                      <li key={i}>· {f}</li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              every prediction · resolved outcome
            </h3>
            <PredictionVsOutcome predictions={predictions} outcomes={outcomes} />
          </div>
        </div>
      </Section>

      {/* Archetype performance */}
      <Section title="Archetype performance matrix" icon={ListChecks}>
        <ArchetypeMatrix rows={report.archetypePerformance} />
      </Section>

      {/* Organizational learning */}
      <Section title="Organizational learning" icon={TrendingUp}>
        <OrgLearningPanel signals={report.organizationalLearning} />
      </Section>

      {/* Drift */}
      <Section
        title="Drift detection"
        icon={Flame}
        hint="calibration · hiring-bar · confidence-inflation"
      >
        <DriftTimeline
          drifts={report.drift.detectedDrifts}
          driftScore={report.drift.driftScore}
        />
      </Section>

      {/* Trajectory */}
      <Section title="Longitudinal trajectory" icon={Activity}>
        <TrajectoryExplorer
          rows={report.trajectory}
          outcomes={outcomes}
        />
      </Section>

      {/* Benchmarks */}
      <Section
        title="Replayable benchmark scenarios"
        icon={Beaker}
        hint="deterministic regression suite"
      >
        <BenchmarkPanel rows={report.benchmarks} />
      </Section>

      {/* Insights + recommendations */}
      <Section title="Longitudinal insights & recommendations" icon={ScrollText}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              insights
            </h3>
            <ul className="text-[12px] font-mono text-foreground space-y-1">
              {report.longitudinalInsights.map((i, idx) => (
                <li key={idx}>· {i}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              recommendations
            </h3>
            <ul className="text-[12px] font-mono text-foreground space-y-1">
              {report.recommendations.map((r, idx) => (
                <li key={idx}>· {r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
