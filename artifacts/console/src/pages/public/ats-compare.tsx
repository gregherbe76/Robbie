/**
 * /ats-compare — side-by-side replay comparison.
 *
 * Renders the Marcus Vega (regretted override) replay next to the
 * Lena Park (calibrated decline) replay. The shape of the difference
 * is the point: same reviewer panel, same evidence union, two
 * radically different reasoning shapes.
 *
 * Wired to `GET /ats/compare` via the generated React Query hook so
 * the diff metrics and the descriptive headline come from the
 * framework's ReplayDiffEngine rather than being recomputed in the
 * browser.
 */

import { Link } from "wouter";
import {
  AlertTriangle,
  Crown,
  Activity,
  Gauge,
  GitBranch,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  useCompareATSReplays,
  useGetATSCalibration,
} from "@workspace/api-client-react";
import type {
  HiringDecisionReplay,
  CountDelta,
  DiffTone,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const REPLAY_A = "replay_synthetic_cand_marcus_vega";
const REPLAY_B = "replay_synthetic_cand_lena_park";

const COUNT_TONE_MAP: Partial<
  Record<string, (left: number, right: number) => "warn" | "good" | "bad">
> = {
  disagreements: (l, r) => (l > r ? "warn" : "good"),
  escalations: (l, r) => (l > r ? "warn" : "good"),
  overrides: (l, r) => (l > r ? "bad" : "good"),
};

const COUNT_LABEL_MAP: Record<string, string> = {
  evidence: "Evidence units",
  disagreements: "Disagreements",
  escalations: "Escalations",
  overrides: "Overrides",
  unresolvedTensions: "Unresolved",
};

export function ATSCompare() {
  const compare = useCompareATSReplays({ a: REPLAY_A, b: REPLAY_B });
  const cal = useGetATSCalibration();

  if (!compare.data) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-muted-foreground">
        Loading comparison…
      </div>
    );
  }

  const { a, b, diff } = compare.data;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
      <header>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          compare · two hiring decisions · same reviewer panel
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold font-mono tracking-tight">
          The shape of the trace is the shape of the difference.
        </h1>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          Same three reviewers. Same organization. Same evidence union. Two
          radically different reasoning shapes — and the framework keeps both
          visible. The case on the left ended in a regretted hire. The case on
          the right ended in a calibrated decline. The traces tell you why.
        </p>
      </header>

      {/* Headline row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Headline replay={a} tone="warn" tag="regretted override" />
        <Headline replay={b} tone="good" tag="calibrated decline" />
      </div>

      {/* Diff headline from the framework */}
      <section className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-3 flex items-start gap-3">
        <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-primary">
            framework diff · outcomeAlignment={diff.outcomeAlignment}
          </div>
          <p className="mt-1 text-sm text-foreground">{diff.headline}</p>
          <p className="mt-1 text-[11px] font-mono text-muted-foreground">
            common reviewers: {diff.commonReviewers.length} ·
            {" "}left-only: {diff.leftOnlyReviewers.length} ·
            {" "}right-only: {diff.rightOnlyReviewers.length}
          </p>
        </div>
      </section>

      {/* Metric strip — driven by diff.counts */}
      <section
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 text-xs",
          diff.counts.length >= 5 ? "md:grid-cols-5" : "md:grid-cols-4",
        )}
      >
        <CompareCell label="Outcome" left={a.outcome} right={b.outcome} />
        {diff.counts.map((c) => (
          <CompareCell
            key={c.label}
            label={COUNT_LABEL_MAP[c.label] ?? c.label}
            left={c.left}
            right={c.right}
            tone={COUNT_TONE_MAP[c.label]}
            diffTone={c.tone}
          />
        ))}
      </section>

      {/* Dynamics */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Column replay={a} title="Marcus Vega · regretted hire" tone="warn" />
        <Column replay={b} title="Lena Park · calibrated decline" tone="good" />
      </section>

      {/* Confidence trajectories */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrajectoryPanel
          replay={a}
          final={diff.trajectory.leftFinal}
          volatility={diff.trajectory.leftVolatility}
        />
        <TrajectoryPanel
          replay={b}
          final={diff.trajectory.rightFinal}
          volatility={diff.trajectory.rightVolatility}
        />
      </section>

      {/* Calibration delta */}
      {cal.data && (
        <section className="rounded-lg border border-border bg-card/40 p-5">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-2">
            <Gauge className="size-3 text-primary" /> Org calibration · combined
          </div>
          <p className="mt-2 text-sm text-muted-foreground italic">
            {cal.data.caveat}
          </p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat
              label="ECE"
              value={cal.data.expectedCalibrationError.toFixed(3)}
            />
            <Stat label="Brier" value={cal.data.brierScore.toFixed(3)} />
            {cal.data.reviewers.map((r) => (
              <Stat
                key={r.reviewerId}
                label={`${r.displayName} drift`}
                value={(r.drift > 0 ? "+" : "") + r.drift.toFixed(2)}
                tone={Math.abs(r.drift) > 0.4 ? "warn" : "good"}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Combined across the Marcus and Lena replays. The drift columns show
            each reviewer's mean claimed confidence minus the realized outcome.
            Positive drift = overconfident in the "advance" direction.
          </p>
        </section>
      )}

      <div className="rounded-lg border border-primary/40 bg-primary/5 p-5 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-wider text-primary">
          What this comparison shows
        </div>
        <p className="mt-2 text-foreground">
          The framework does not score teams. It surfaces the shape of their
          reasoning. Two cases with the same panel can look completely
          different in the replay, and the difference is operationally
          recoverable from the ATS data the team already produced.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/ats-demo"
            className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
          >
            Open the guided story <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/console/ats"
            className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
          >
            Open the operator console <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Headline({
  replay,
  tone,
  tag,
}: {
  replay: HiringDecisionReplay;
  tone: "warn" | "good";
  tag: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5",
        tone === "warn"
          ? "border-rose-500/40 bg-rose-500/5"
          : "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      <div
        className={cn(
          "text-[10px] uppercase tracking-wider font-mono",
          tone === "warn" ? "text-rose-300" : "text-emerald-300",
        )}
      >
        {tag}
      </div>
      <div className="mt-1 text-xl font-mono">{replay.candidateName}</div>
      <div className="text-sm text-muted-foreground">
        {replay.targetRole} · {replay.organization}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] font-mono">
        <ShieldCheck className="size-3 text-primary" />
        <span className="text-foreground">{replay.signature}</span>
        <span className="text-muted-foreground">
          · {replay.evidence.length} evidence units
        </span>
      </div>
    </div>
  );
}

function CompareCell({
  label,
  left,
  right,
  tone,
  diffTone,
}: {
  label: string;
  left: string | number;
  right: string | number;
  tone?: (l: number, r: number) => "warn" | "good" | "bad";
  diffTone?: DiffTone;
}) {
  const lTone =
    typeof left === "number" && typeof right === "number" && tone
      ? tone(left, right)
      : undefined;
  const rTone =
    typeof left === "number" && typeof right === "number" && tone
      ? tone(right, left)
      : undefined;
  return (
    <div className="bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1.5">
        <span>{label}</span>
        {diffTone && diffTone !== "even" && diffTone !== "neutral" ? (
          <span
            className={cn(
              "rounded px-1 py-0.5 text-[9px]",
              diffTone === "left-heavy"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-emerald-500/15 text-emerald-300",
            )}
          >
            {diffTone === "left-heavy" ? "L+" : "R+"}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center justify-between font-mono">
        <span className={toneCls(lTone)}>{left}</span>
        <span className="text-muted-foreground text-[10px]">vs</span>
        <span className={toneCls(rTone)}>{right}</span>
      </div>
    </div>
  );
}

function toneCls(t?: "warn" | "good" | "bad"): string {
  if (t === "warn") return "text-amber-300";
  if (t === "bad") return "text-rose-300";
  if (t === "good") return "text-emerald-300";
  return "";
}

function Column({
  replay,
  title,
  tone,
}: {
  replay: HiringDecisionReplay;
  title: string;
  tone: "warn" | "good";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/40",
        tone === "warn" ? "border-amber-500/40" : "border-emerald-500/40",
      )}
    >
      <header className="px-5 py-3 border-b border-border/60 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </header>
      <div className="p-5 space-y-4">
        <Block title="Disagreement" icon={AlertTriangle} empty={replay.disagreements.length === 0}>
          {replay.disagreements.map((d) => (
            <div key={d.id} className="text-sm">
              <div className="text-xs font-mono text-amber-300">
                {d.topic} · spread {d.spread.toFixed(2)} · {d.resolution ?? "—"}
              </div>
            </div>
          ))}
        </Block>
        <Block title="Escalation" icon={Activity} empty={replay.escalations.length === 0}>
          {replay.escalations.map((e) => (
            <div key={e.id} className="text-sm">
              <div className="text-xs font-mono text-orange-300">{e.trigger}</div>
              <div className="mt-0.5">{e.summary}</div>
            </div>
          ))}
        </Block>
        <Block title="Override" icon={Crown} empty={replay.overrides.length === 0}>
          {replay.overrides.map((o) => (
            <div key={o.id} className="text-sm">
              <div className="text-xs font-mono text-rose-300">
                by {o.byReviewerId}
              </div>
              <div className="mt-0.5">{o.rationale}</div>
            </div>
          ))}
        </Block>
        {replay.unresolvedTensions.length > 0 && (
          <div className="text-xs text-amber-300 font-mono">
            unresolved: {replay.unresolvedTensions.length}
          </div>
        )}
      </div>
    </div>
  );
}

function Block({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ElementType;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1 mb-1.5">
        <Icon className="size-3" /> {title}
      </div>
      {empty ? (
        <div className="text-xs text-muted-foreground">— none —</div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function TrajectoryPanel({
  replay,
  final,
  volatility,
}: {
  replay: HiringDecisionReplay;
  final: number;
  volatility: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-5">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center justify-between gap-1 mb-3">
        <span className="flex items-center gap-1">
          <GitBranch className="size-3 text-primary" />
          {replay.candidateName} · rolling P(hire)
        </span>
        <span className="text-muted-foreground/80">
          final {final.toFixed(2)} · swing {volatility.toFixed(2)}
        </span>
      </div>
      <div className="space-y-1">
        {replay.confidenceTrajectory.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground w-36 shrink-0 truncate">
              {new Date(p.occurredAt).toLocaleString()}
            </span>
            <div className="flex-1 h-2 bg-background/60 rounded overflow-hidden">
              <div
                className="h-full bg-primary/60"
                style={{ width: `${p.estimate * 100}%` }}
              />
            </div>
            <span className="w-12 text-right">{p.estimate.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "warn" | "good";
}) {
  return (
    <div
      className={cn(
        "rounded border p-3",
        tone === "warn"
          ? "border-amber-500/40"
          : tone === "good"
            ? "border-emerald-500/40"
            : "border-border/60",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono">{value}</div>
    </div>
  );
}

export default ATSCompare;
