/**
 * /ats-compare — side-by-side replay comparison.
 *
 * Renders the Marcus Vega (regretted override) replay next to the
 * Lena Park (calibrated decline) replay. The shape of the difference
 * is the point: same reviewer panel, same evidence union, two
 * radically different reasoning shapes.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  Crown,
  Activity,
  Gauge,
  GitBranch,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const REPLAY_A = "replay_synthetic_cand_marcus_vega";
const REPLAY_B = "replay_synthetic_cand_lena_park";

type Replay = {
  id: string;
  candidateName: string;
  targetRole: string;
  organization: string;
  outcome: string;
  signature: string;
  openedAt: string;
  closedAt?: string;
  reviewers: Array<{ id: string; displayName: string; role?: string }>;
  evidence: Array<{
    id: string;
    kind: string;
    summary: string;
    occurredAt: string;
    topic?: string;
    assessmentScore?: number;
  }>;
  disagreements: Array<{
    id: string;
    topic: string;
    spread: number;
    resolution?: string;
  }>;
  escalations: Array<{ id: string; trigger: string; summary: string }>;
  overrides: Array<{ id: string; byReviewerId: string; rationale: string }>;
  confidenceTrajectory: Array<{ occurredAt: string; estimate: number }>;
  unresolvedTensions: string[];
};

type Calibration = {
  expectedCalibrationError: number;
  brierScore: number;
  reviewers: Array<{
    reviewerId: string;
    displayName: string;
    predictions: number;
    meanClaimed: number;
    meanRealized: number;
    drift: number;
  }>;
  caveat: string;
};

async function getJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/api${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function ATSCompare() {
  const a = useQuery({
    queryKey: ["compare", REPLAY_A],
    queryFn: () => getJson<Replay>(`/ats/replay/${REPLAY_A}`),
  });
  const b = useQuery({
    queryKey: ["compare", REPLAY_B],
    queryFn: () => getJson<Replay>(`/ats/replay/${REPLAY_B}`),
  });
  const cal = useQuery({
    queryKey: ["compare", "cal"],
    queryFn: () => getJson<Calibration>(`/ats/calibration`),
  });

  if (!a.data || !b.data) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-muted-foreground">
        Loading comparison…
      </div>
    );
  }

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
        <Headline replay={a.data} tone="warn" tag="regretted override" />
        <Headline replay={b.data} tone="good" tag="calibrated decline" />
      </div>

      {/* Metric strip */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 text-xs">
        <CompareCell label="Outcome" left={a.data.outcome} right={b.data.outcome} />
        <CompareCell
          label="Disagreements"
          left={a.data.disagreements.length}
          right={b.data.disagreements.length}
          tone={(l, r) => (l > r ? "warn" : "good")}
        />
        <CompareCell
          label="Escalations"
          left={a.data.escalations.length}
          right={b.data.escalations.length}
          tone={(l, r) => (l > r ? "warn" : "good")}
        />
        <CompareCell
          label="Overrides"
          left={a.data.overrides.length}
          right={b.data.overrides.length}
          tone={(l, r) => (l > r ? "bad" : "good")}
        />
        <CompareCell
          label="Evidence units"
          left={a.data.evidence.length}
          right={b.data.evidence.length}
        />
      </section>

      {/* Dynamics */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Column replay={a.data} title="Marcus Vega · regretted hire" tone="warn" />
        <Column replay={b.data} title="Lena Park · calibrated decline" tone="good" />
      </section>

      {/* Confidence trajectories */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrajectoryPanel replay={a.data} />
        <TrajectoryPanel replay={b.data} />
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
  replay: Replay;
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
}: {
  label: string;
  left: string | number;
  right: string | number;
  tone?: (l: number, r: number) => "warn" | "good" | "bad";
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
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
        {label}
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
  replay: Replay;
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

function TrajectoryPanel({ replay }: { replay: Replay }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-5">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1 mb-3">
        <GitBranch className="size-3 text-primary" /> {replay.candidateName} · rolling P(hire)
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
