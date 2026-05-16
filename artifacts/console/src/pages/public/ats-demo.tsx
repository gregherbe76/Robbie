/**
 * /ats-demo — public-safe ATS hiring decision replay.
 *
 * Renders the synthetic Atlas Robotics / Marcus Vega replay end to
 * end: timeline, reviewer disagreement, escalation, founder
 * override, calibration, signature verification. No console nav,
 * no auth — this is the canonical operational demo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
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
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Guided story mode — 7 narrative beats
// ---------------------------------------------------------------------------

type Beat = {
  id: string;
  title: string;
  narration: string;
  anchor: string;
};

const STORY_BEATS: Beat[] = [
  {
    id: "candidate",
    title: "1 · Candidate appears strong",
    narration:
      "Marcus Vega — nine years in distributed systems, referral, senior engineer at Quaternion. Alice does the phone screen and writes an enthusiastic advance. The opening confidence is high.",
    anchor: "panel-reviewers",
  },
  {
    id: "disagreement",
    title: "2 · Reviewer disagreement emerges",
    narration:
      "Bob does the technical deep dive and writes a strong decline on system design. Carol lands at lean-advance. The panel has now disagreed by 0.4 on the overall recommendation — and the framework preserves both rationales verbatim instead of averaging them away.",
    anchor: "panel-disagreement",
  },
  {
    id: "confidence",
    title: "3 · Confidence collapses",
    narration:
      "Watch the rolling P(hire) estimate. The team's confidence in this hire does not stabilize — it drifts down and oscillates as the loop produces conflicting signal. The framework reports the trajectory as data, not as a single summary number.",
    anchor: "panel-trajectory",
  },
  {
    id: "escalation",
    title: "4 · Escalation triggers",
    narration:
      "Carol opens a second technical loop, explicitly to resolve the system-design disagreement. The framework records this as an escalation signal with a verbatim rationale and a parent link back to the first technical interview.",
    anchor: "panel-escalation",
  },
  {
    id: "override",
    title: "5 · Founder override",
    narration:
      "The second technical comes back weak again. Carol — founder/CTO — writes a note about founder energy and pairing-with-Alice, and approves the hire over Bob's dissent. The framework attributes the override and preserves the rationale verbatim.",
    anchor: "panel-override",
  },
  {
    id: "calibration",
    title: "6 · Calibration critique appears",
    narration:
      "Six months later the hire is regretted. The calibration layer now has a data point: the team's expressed confidence at decision time did not align with the realized outcome. None of this is punitive — it's descriptive, and only meaningful across many decisions.",
    anchor: "panel-tensions",
  },
  {
    id: "verify",
    title: "7 · Organizational reasoning is now visible",
    narration:
      "The replay is signed. The signature is deterministic — same evidence in, same signature out. Hit Verify; the server recomputes from stored evidence. This is what organizational memory looks like: read-only, provenance-first, replayable byte for byte.",
    anchor: "panel-signature",
  },
];

const STORY_DURATION_MS = 12000;

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

  // --- guided story state ---
  const [storyActive, setStoryActive] = useState(false);
  const [beatIdx, setBeatIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBeat = STORY_BEATS[beatIdx]!;

  useEffect(() => {
    if (!storyActive) return;
    const el = document.getElementById(activeBeat.anchor);
    if (el)
      el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [beatIdx, storyActive, activeBeat.anchor]);

  useEffect(() => {
    if (!playing || !storyActive) return;
    timerRef.current = setTimeout(() => {
      setBeatIdx((i) => {
        if (i + 1 >= STORY_BEATS.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, STORY_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [beatIdx, playing, storyActive]);

  const startStory = () => {
    setStoryActive(true);
    setBeatIdx(0);
    setPlaying(true);
  };
  const stopStory = () => {
    setStoryActive(false);
    setPlaying(false);
  };

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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            public demo · synthetic ATS evidence · byte-stable replay
          </div>
          {!storyActive && (
            <button
              onClick={startStory}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-mono font-semibold text-primary-foreground hover:opacity-90"
            >
              <Play className="size-3.5" /> Play guided story (≈ 90s)
            </button>
          )}
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
          one disagreement, two escalations, one founder override, one regretted
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
      <div id="panel-signature">
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

      </div>

      {/* Reviewers */}
      <div id="panel-reviewers">
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

      </div>

      {/* Timeline */}
      <div id="panel-timeline">
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

      </div>

      {/* Disagreement / escalation / override */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div id="panel-disagreement">
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
        </div>
        <div id="panel-escalation">
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
        </div>
        <div id="panel-override">
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
      </div>

      {/* Confidence trajectory */}
      <div id="panel-trajectory">
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

      </div>

      <div id="panel-tensions">
      {r.unresolvedTensions.length > 0 && (
        <Panel title="Unresolved tensions" icon={AlertTriangle} tone="warn">
          <ul className="list-disc list-inside text-sm space-y-1">
            {r.unresolvedTensions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Panel>
      )}

      </div>

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
            href="/ats-compare"
            className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
          >
            Compare with a calibrated decline <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/console/ats"
            className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
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

      {/* Story overlay */}
      {storyActive && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pointer-events-none">
          <div className="mx-auto max-w-3xl pointer-events-auto rounded-lg border border-primary/50 bg-card/95 backdrop-blur shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-mono text-primary">
                  guided story · step {beatIdx + 1} of {STORY_BEATS.length}
                </div>
                <div className="mt-1 font-mono font-semibold text-sm">
                  {activeBeat.title}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {activeBeat.narration}
                </p>
              </div>
              <button
                onClick={stopStory}
                className="text-muted-foreground hover:text-foreground p-1 -m-1 shrink-0"
                aria-label="Close story"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  disabled={beatIdx === 0}
                  onClick={() => setBeatIdx((i) => Math.max(0, i - 1))}
                  className="rounded border border-border/60 p-1.5 hover:bg-primary/10 disabled:opacity-40"
                  aria-label="Previous"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="rounded border border-primary/40 px-2 py-1.5 text-xs font-mono text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                >
                  {playing ? (
                    <>
                      <Pause className="size-3" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-3" /> Play
                    </>
                  )}
                </button>
                <button
                  disabled={beatIdx === STORY_BEATS.length - 1}
                  onClick={() =>
                    setBeatIdx((i) =>
                      Math.min(STORY_BEATS.length - 1, i + 1),
                    )
                  }
                  className="rounded border border-border/60 p-1.5 hover:bg-primary/10 disabled:opacity-40"
                  aria-label="Next"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {STORY_BEATS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setBeatIdx(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === beatIdx
                        ? "bg-primary w-6"
                        : i < beatIdx
                          ? "bg-primary/40 w-2"
                          : "bg-muted-foreground/30 w-2",
                    )}
                    aria-label={`Step ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
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
