/**
 * /ats-demo — public-safe ATS hiring decision replay.
 *
 * Renders the synthetic Atlas Robotics / Marcus Vega replay end to
 * end: timeline, reviewer disagreement, escalation, founder
 * override, calibration, signature verification. No console nav,
 * no auth — this is the canonical operational demo.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  GitBranch,
  AlertTriangle,
  Crown,
  Gauge,
  ShieldCheck,
  ShieldAlert,
  Activity,
  ArrowRight,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

const REPLAY_ID = "replay_synthetic_cand_marcus_vega";

type Reviewer = { id: string; displayName: string; role?: string };
type Evidence = {
  id: string;
  kind: string;
  summary: string;
  detail?: string;
  occurredAt: string;
  topic?: string;
  assessmentScore?: number;
  reviewer?: Reviewer;
  payloadHash: string;
  sourceKind: string;
};
type Replay = {
  id: string;
  candidateName: string;
  targetRole: string;
  organization: string;
  outcome: string;
  signature: string;
  openedAt: string;
  closedAt?: string;
  reviewers: Reviewer[];
  evidence: Evidence[];
  disagreements: Array<{
    id: string;
    topic: string;
    spread: number;
    resolution?: string;
    high: { reviewerId: string; score: number; summary: string };
    low: { reviewerId: string; score: number; summary: string };
  }>;
  escalations: Array<{
    id: string;
    occurredAt: string;
    trigger: string;
    summary: string;
  }>;
  overrides: Array<{
    id: string;
    occurredAt: string;
    byReviewerId: string;
    rationale: string;
  }>;
  confidenceTrajectory: Array<{ occurredAt: string; estimate: number }>;
  unresolvedTensions: string[];
};
type Verify = {
  storedSignature: string;
  recomputedSignature: string;
  match: boolean;
  verifiedAt: string;
};

async function getJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/api${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function ATSDemo() {
  const replay = useQuery({
    queryKey: ["public-ats-replay"],
    queryFn: () => getJson<Replay>(`/ats/replay/${REPLAY_ID}`),
  });
  const [verify, setVerify] = useState<Verify | null>(null);

  const reviewerName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of replay.data?.reviewers ?? []) m.set(r.id, r.displayName);
    return (id: string) => m.get(id) ?? id;
  }, [replay.data]);

  if (!replay.data) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-muted-foreground">
        Loading synthetic ATS replay…
      </div>
    );
  }
  const r = replay.data;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
      <header>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          public demo · synthetic ATS evidence · byte-stable replay
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold font-mono tracking-tight">
          Replay this hiring decision
        </h1>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          The framework pulls operational evidence — scorecards, notes,
          interview kits, decisions — out of an ATS shape, normalizes it
          into a closed evidence union, and reconstructs how the
          organization actually reasoned. Below is{" "}
          <span className="font-mono text-foreground">{r.candidateName}</span>,
          a {r.targetRole} candidate at {r.organization}. Three reviewers,
          one disagreement, one escalation, one founder override, one regretted
          hire.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono">
          <Badge>{r.evidence.length} evidence units</Badge>
          <Badge>{r.reviewers.length} reviewers</Badge>
          <Badge tone="warn">{r.disagreements.length} disagreement</Badge>
          <Badge tone="warn">{r.escalations.length} escalation</Badge>
          <Badge tone="bad">{r.overrides.length} override</Badge>
          <Badge tone="good">outcome: {r.outcome}</Badge>
        </div>
      </header>

      {/* Signature */}
      <Panel
        title="Signed and verifiable"
        icon={Hash}
        action={
          <button
            onClick={async () => {
              setVerify(await getJson<Verify>(`/ats/replay/${REPLAY_ID}/verify`));
            }}
            className="text-[10px] font-mono rounded border border-primary/40 px-2 py-1 text-primary hover:bg-primary/10 flex items-center gap-1"
          >
            {verify ? (
              verify.match ? (
                <ShieldCheck className="size-3 text-emerald-400" />
              ) : (
                <ShieldAlert className="size-3 text-rose-400" />
              )
            ) : (
              <Hash className="size-3" />
            )}
            Verify
          </button>
        }
      >
        <div className="text-sm">
          <div className="font-mono text-xs">
            replay id: <span className="text-foreground">{r.id}</span>
          </div>
          <div className="font-mono text-xs">
            signature:{" "}
            <span className="text-foreground">{r.signature}</span>
          </div>
          {verify && (
            <div
              className={cn(
                "mt-3 rounded border p-2 text-xs font-mono",
                verify.match
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/5 text-rose-300",
              )}
            >
              {verify.match
                ? `signature verified: ${verify.storedSignature}`
                : `MISMATCH — stored ${verify.storedSignature}, recomputed ${verify.recomputedSignature}`}
            </div>
          )}
        </div>
      </Panel>

      {/* Reviewers */}
      <Panel title="Reviewer panel" icon={GitBranch}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {r.reviewers.map((rv) => (
            <div
              key={rv.id}
              className="rounded border border-border/60 bg-background/40 p-3"
            >
              <div className="font-mono text-sm">{rv.displayName}</div>
              {rv.role && (
                <div className="text-xs text-muted-foreground">{rv.role}</div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Timeline */}
      <Panel title="Evidence timeline" icon={Activity}>
        <ol className="space-y-2">
          {r.evidence.map((e) => (
            <li
              key={e.id}
              className="rounded border border-border/60 bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                <span className="text-primary">
                  {e.kind.replace("_", ".")}
                </span>
                <span className="text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 text-sm">{e.summary}</div>
              {e.detail && (
                <div className="text-xs text-muted-foreground mt-1">
                  {e.detail}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground/70">
                <span>src: {e.sourceKind}</span>
                {e.topic && <span>topic: {e.topic}</span>}
                {typeof e.assessmentScore === "number" && (
                  <span>score: {e.assessmentScore.toFixed(2)}</span>
                )}
                <span>hash: {e.payloadHash}</span>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      {/* Disagreement / escalation / override */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Disagreement" icon={AlertTriangle} dense>
          {r.disagreements.map((d) => (
            <div key={d.id} className="text-sm">
              <div className="text-xs font-mono text-amber-300">
                {d.topic} · spread {d.spread.toFixed(2)} · {d.resolution}
              </div>
              <div className="mt-1">
                <span className="text-emerald-300 font-mono">
                  {reviewerName(d.high.reviewerId)}
                </span>{" "}
                {d.high.summary}
              </div>
              <div>
                <span className="text-rose-300 font-mono">
                  {reviewerName(d.low.reviewerId)}
                </span>{" "}
                {d.low.summary}
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="Escalation" icon={Activity} dense>
          {r.escalations.map((e) => (
            <div key={e.id} className="text-sm">
              <div className="text-xs font-mono text-orange-300">
                {e.trigger}
              </div>
              <div className="mt-1">{e.summary}</div>
            </div>
          ))}
        </Panel>
        <Panel title="Override" icon={Crown} dense>
          {r.overrides.map((o) => (
            <div key={o.id} className="text-sm">
              <div className="text-xs font-mono text-rose-300">
                by {reviewerName(o.byReviewerId)}
              </div>
              <div className="mt-1">{o.rationale}</div>
            </div>
          ))}
        </Panel>
      </div>

      {/* Confidence trajectory */}
      <Panel title="Rolling P(hire) estimate" icon={Gauge}>
        <div className="space-y-1">
          {r.confidenceTrajectory.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted-foreground w-40 shrink-0">
                {new Date(p.occurredAt).toLocaleString()}
              </span>
              <div className="flex-1 h-2 bg-background/60 rounded overflow-hidden">
                <div
                  className="h-full bg-primary/60"
                  style={{ width: `${p.estimate * 100}%` }}
                />
              </div>
              <span className="w-12 text-right">
                {p.estimate.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {r.unresolvedTensions.length > 0 && (
        <Panel title="Unresolved tensions" icon={AlertTriangle} tone="warn">
          <ul className="list-disc list-inside text-sm space-y-1">
            {r.unresolvedTensions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="rounded-lg border border-primary/40 bg-primary/5 p-5 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-wider text-primary">
          What this demo shows
        </div>
        <p className="mt-2 text-foreground">
          The framework is not an ATS. It does not move stages, ping reviewers,
          or write back to Ashby or Greenhouse. It reads what is already there
          and replays how the organization reasoned — disagreement preserved,
          escalation explicit, override attributed, calibration honest.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/console/ats"
            className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
          >
            Open the operator console <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/architecture"
            className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
          >
            Read the architecture <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  action,
  dense,
  tone,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
  dense?: boolean;
  tone?: "warn";
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-card/40",
        tone === "warn"
          ? "border-amber-500/40"
          : "border-border",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h2 className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </h2>
        </div>
        {action}
      </header>
      <div className={cn("p-5", dense && "p-4")}>{children}</div>
    </section>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5",
        tone === "good"
          ? "border-emerald-500/40 text-emerald-300"
          : tone === "warn"
            ? "border-amber-500/40 text-amber-300"
            : tone === "bad"
              ? "border-rose-500/40 text-rose-300"
              : "border-border/60 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export default ATSDemo;
