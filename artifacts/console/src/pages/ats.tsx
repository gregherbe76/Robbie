/**
 * /console/ats — ATS Intelligence Integration Console.
 *
 * Shows connected ATS systems, ingestion status, replayable hiring
 * decisions, the disagreement / escalation / override structure of
 * a chosen replay, the reasoning reconstruction, and the calibration
 * view. Every replay carries a signature with a verify button that
 * round-trips through `GET /api/ats/replay/:id/verify`.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Workflow,
  Plug,
  Network,
  AlertTriangle,
  GitBranch,
  Crown,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Gauge,
  Users,
  RefreshCw,
  Hash,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror /api/ats payloads)
// ---------------------------------------------------------------------------

type ATSProvider = "ashby" | "greenhouse" | "synthetic";

type Connection = {
  id: string;
  provider: ATSProvider;
  label: string;
  status: "connected" | "unconfigured" | "error";
  connectedAt: string;
  statusDetail: string;
  lastSyncedAt?: string;
  lastSyncCounts?: Record<string, number>;
};

type ReplaySummary = {
  id: string;
  connectionId: string;
  provider: ATSProvider;
  candidateName: string;
  targetRole: string;
  organization: string;
  openedAt: string;
  closedAt?: string;
  outcome: "hired" | "declined" | "withdrawn" | "open";
  reviewerCount: number;
  evidenceCount: number;
  disagreementCount: number;
  escalationCount: number;
  overrideCount: number;
  signature: string;
};

type Reviewer = { id: string; displayName: string; role?: string };

type NormalizedEvidence = {
  id: string;
  kind:
    | "explicit_claim"
    | "reviewer_assessment"
    | "contradiction_signal"
    | "uncertainty_signal"
    | "escalation_signal"
    | "override_signal"
    | "calibration_signal";
  reviewer?: Reviewer;
  summary: string;
  detail?: string;
  occurredAt: string;
  payloadHash: string;
  provenanceChain: string[];
  reviewerConfidence?: number;
  assessmentScore?: number;
  topic?: string;
  sourceKind: string;
  sourceAtsId: string;
  provider: ATSProvider;
};

type Replay = {
  id: string;
  provider: ATSProvider;
  candidateAtsId: string;
  candidateName: string;
  targetRole: string;
  organization: string;
  openedAt: string;
  closedAt?: string;
  outcome: "hired" | "declined" | "withdrawn" | "open";
  reviewers: Reviewer[];
  evidence: NormalizedEvidence[];
  disagreements: Array<{
    id: string;
    topic: string;
    spread: number;
    reviewers: Reviewer[];
    high: { reviewerId: string; score: number; summary: string };
    low: { reviewerId: string; score: number; summary: string };
    resolution?: "consensus" | "override" | "unresolved";
    resolvedAt?: string;
  }>;
  escalations: Array<{
    id: string;
    occurredAt: string;
    trigger: string;
    summary: string;
    evidenceIds: string[];
  }>;
  overrides: Array<{
    id: string;
    occurredAt: string;
    byReviewerId: string;
    overrides: string;
    rationale: string;
  }>;
  confidenceTrajectory: Array<{
    occurredAt: string;
    estimate: number;
    evidenceIds: string[];
  }>;
  unresolvedTensions: string[];
  signature: string;
};

type Reasoning = {
  replayId: string;
  disagreementGraph: {
    nodes: Array<{
      reviewerId: string;
      displayName: string;
      meanScore: number;
      topics: string[];
    }>;
    edges: Array<{
      from: string;
      to: string;
      weight: number;
      topics: string[];
    }>;
  };
  escalationPatterns: Array<{
    pattern: string;
    occurredAt: string;
    evidenceIds: string[];
  }>;
  confidenceShifts: Array<{
    from: number;
    to: number;
    delta: number;
    triggerEvidenceId: string;
    summary: string;
  }>;
  overrideDynamics: Array<{
    overrideId: string;
    confidenceAtOverride: number;
    counterEvidenceCount: number;
    summary: string;
  }>;
  pressurePoints: string[];
  caveat: string;
};

type CalibrationReport = {
  orgId: string;
  expectedCalibrationError: number;
  brierScore: number;
  buckets: Array<{
    range: string;
    lower: number;
    upper: number;
    claimed: number;
    actual: number;
    count: number;
    overconfident: boolean;
  }>;
  reviewers: Array<{
    reviewerId: string;
    displayName: string;
    predictions: number;
    meanClaimed: number;
    meanRealized: number;
    expectedCalibrationError: number;
    brierScore: number;
    drift: number;
    topics: string[];
  }>;
  caveat: string;
};

type Verify = {
  replayId: string;
  storedSignature: string;
  recomputedSignature: string;
  match: boolean;
  verifiedAt: string;
};

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function getJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/api${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/api${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  children,
  hint,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
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
        <div className="flex items-center gap-3">
          {hint && (
            <div className="text-[10px] font-mono text-muted-foreground/70">
              {hint}
            </div>
          )}
          {action}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ElementType;
  tone?: "default" | "warn" | "good";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background/40 p-3",
        tone === "warn"
          ? "border-amber-500/40"
          : tone === "good"
            ? "border-emerald-500/40"
            : "border-border/60",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
        {Icon && <Icon className="size-3" />} {label}
      </div>
      <div className="mt-1 text-lg font-mono">{value}</div>
      {hint && (
        <div className="text-[10px] font-mono text-muted-foreground/70">
          {hint}
        </div>
      )}
    </div>
  );
}

function KindPill({ kind }: { kind: NormalizedEvidence["kind"] }) {
  const tone: Record<NormalizedEvidence["kind"], string> = {
    explicit_claim: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    reviewer_assessment:
      "bg-primary/15 text-primary border-primary/40",
    contradiction_signal:
      "bg-amber-500/15 text-amber-300 border-amber-500/40",
    uncertainty_signal:
      "bg-violet-500/15 text-violet-300 border-violet-500/40",
    escalation_signal:
      "bg-orange-500/15 text-orange-300 border-orange-500/40",
    override_signal: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    calibration_signal: "bg-teal-500/15 text-teal-300 border-teal-500/40",
  };
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px] font-mono",
        tone[kind],
      )}
    >
      {kind.replace("_", ".")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ATS() {
  const qc = useQueryClient();
  const connections = useQuery({
    queryKey: ["ats", "connections"],
    queryFn: () => getJson<{ connections: Connection[] }>("/ats/connections"),
  });
  const replays = useQuery({
    queryKey: ["ats", "replays"],
    queryFn: () => getJson<{ replays: ReplaySummary[] }>("/ats/replays"),
  });
  const calibration = useQuery({
    queryKey: ["ats", "calibration"],
    queryFn: () => getJson<CalibrationReport>("/ats/calibration"),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? replays.data?.replays[0]?.id ?? null;

  const replay = useQuery({
    queryKey: ["ats", "replay", activeId],
    queryFn: () => getJson<Replay>(`/ats/replay/${activeId}`),
    enabled: !!activeId,
  });
  const reasoning = useQuery({
    queryKey: ["ats", "reasoning", activeId],
    queryFn: () => getJson<Reasoning>(`/ats/replay/${activeId}/reasoning`),
    enabled: !!activeId,
  });

  const [verify, setVerify] = useState<Verify | null>(null);
  const sync = useMutation({
    mutationFn: (connectionId: string) =>
      postJson<{ result: { connectionId: string } }>("/ats/sync", {
        connectionId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ats"] });
    },
  });

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          ATS · operational evidence · replayable cognition
        </div>
        <h1 className="text-3xl font-bold font-mono tracking-tight">
          Replay how the organization actually reasoned about hiring
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          The framework reads operational evidence from your ATS — scorecards,
          notes, decisions, overrides — and reconstructs the disagreement,
          escalation, and override dynamics that produced each hire. Read-only.
          No write-back. No stage automation. Every replay is signed and
          deterministically reproducible.
        </p>
      </header>

      {/* Connections */}
      <Section
        title="Connected ATS systems"
        icon={Plug}
        hint="read-only · provenance-first"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {connections.data?.connections.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-md border bg-background/40 p-3",
                c.status === "connected"
                  ? "border-emerald-500/40"
                  : c.status === "unconfigured"
                    ? "border-border/60"
                    : "border-rose-500/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm">{c.label}</div>
                <span
                  className={cn(
                    "text-[10px] font-mono uppercase",
                    c.status === "connected"
                      ? "text-emerald-400"
                      : c.status === "unconfigured"
                        ? "text-muted-foreground"
                        : "text-rose-400",
                  )}
                >
                  {c.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.statusDetail}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-muted-foreground/80">
                {c.lastSyncedAt ? (
                  <>
                    <Clock className="size-3" /> last sync{" "}
                    {new Date(c.lastSyncedAt).toLocaleString()}
                  </>
                ) : (
                  <>not synced</>
                )}
              </div>
              <button
                onClick={() => sync.mutate(c.id)}
                disabled={
                  c.status !== "connected" || sync.isPending
                }
                className={cn(
                  "mt-3 inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border",
                  c.status === "connected"
                    ? "border-primary/40 text-primary hover:bg-primary/10"
                    : "border-border/40 text-muted-foreground/50 cursor-not-allowed",
                )}
              >
                <RefreshCw className="size-3" /> Sync
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Replays index */}
      <Section
        title="Replayable hiring decisions"
        icon={GitBranch}
        hint={`${replays.data?.replays.length ?? 0} indexed`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/80">
              <tr>
                <th className="text-left py-2 pr-3">Candidate</th>
                <th className="text-left py-2 pr-3">Role · Org</th>
                <th className="text-left py-2 pr-3">Outcome</th>
                <th className="text-left py-2 pr-3">Reviewers</th>
                <th className="text-left py-2 pr-3">Disagreements</th>
                <th className="text-left py-2 pr-3">Escalations</th>
                <th className="text-left py-2 pr-3">Overrides</th>
                <th className="text-left py-2 pr-3">Signature</th>
              </tr>
            </thead>
            <tbody>
              {replays.data?.replays.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => {
                    setSelectedId(r.id);
                    setVerify(null);
                  }}
                  className={cn(
                    "border-t border-border/40 cursor-pointer hover:bg-primary/5",
                    activeId === r.id && "bg-primary/10",
                  )}
                >
                  <td className="py-2 pr-3 font-mono">{r.candidateName}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.targetRole} · {r.organization}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-mono uppercase border",
                        r.outcome === "hired"
                          ? "border-emerald-500/40 text-emerald-300"
                          : r.outcome === "declined"
                            ? "border-rose-500/40 text-rose-300"
                            : "border-border/60 text-muted-foreground",
                      )}
                    >
                      {r.outcome}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono">{r.reviewerCount}</td>
                  <td
                    className={cn(
                      "py-2 pr-3 font-mono",
                      r.disagreementCount > 0 && "text-amber-300",
                    )}
                  >
                    {r.disagreementCount}
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 font-mono",
                      r.escalationCount > 0 && "text-orange-300",
                    )}
                  >
                    {r.escalationCount}
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 font-mono",
                      r.overrideCount > 0 && "text-rose-300",
                    )}
                  >
                    {r.overrideCount}
                  </td>
                  <td className="py-2 pr-3 font-mono text-muted-foreground text-xs">
                    {r.signature}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Active replay detail */}
      {replay.data && (
        <ReplayDetail
          replay={replay.data}
          reasoning={reasoning.data}
          verify={verify}
          onVerify={async () => {
            const v = await getJson<Verify>(
              `/ats/replay/${replay.data.id}/verify`,
            );
            setVerify(v);
          }}
        />
      )}

      {/* Calibration */}
      {calibration.data && <CalibrationPanel report={calibration.data} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Replay detail
// ---------------------------------------------------------------------------

function ReplayDetail({
  replay,
  reasoning,
  verify,
  onVerify,
}: {
  replay: Replay;
  reasoning?: Reasoning;
  verify: Verify | null;
  onVerify: () => void;
}) {
  const reviewerName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of replay.reviewers) m.set(r.id, r.displayName);
    return (id: string) => m.get(id) ?? id;
  }, [replay.reviewers]);

  return (
    <Section
      title={`Replay · ${replay.candidateName}`}
      icon={GitBranch}
      hint={`${replay.evidence.length} evidence units`}
      action={
        <button
          onClick={onVerify}
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
          Verify signature
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Outcome" value={replay.outcome} />
        <Stat
          label="Reviewers"
          value={replay.reviewers.length}
          icon={Users}
        />
        <Stat
          label="Disagreements"
          value={replay.disagreements.length}
          icon={AlertTriangle}
          tone={replay.disagreements.length > 0 ? "warn" : "default"}
        />
        <Stat
          label="Overrides"
          value={replay.overrides.length}
          icon={Crown}
          tone={replay.overrides.length > 0 ? "warn" : "default"}
        />
      </div>

      {verify && (
        <div
          className={cn(
            "mb-4 rounded border p-3 text-xs font-mono",
            verify.match
              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/5 text-rose-300",
          )}
        >
          {verify.match
            ? `signature verified: ${verify.storedSignature}`
            : `MISMATCH — stored ${verify.storedSignature}, recomputed ${verify.recomputedSignature}`}
          <span className="text-muted-foreground/80 ml-2">
            ({new Date(verify.verifiedAt).toLocaleTimeString()})
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            Evidence timeline
          </div>
          <ol className="space-y-2">
            {replay.evidence.map((e) => (
              <li
                key={e.id}
                className="rounded border border-border/60 bg-background/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <KindPill kind={e.kind} />
                  <div className="text-[10px] font-mono text-muted-foreground/80">
                    {new Date(e.occurredAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-1.5 text-sm">{e.summary}</div>
                {e.detail && (
                  <div className="mt-1 text-xs text-muted-foreground">
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
        </div>

        {/* Dynamics */}
        <div className="space-y-4">
          {/* Disagreements */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="size-3" /> Reviewer disagreement
            </div>
            {replay.disagreements.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No reviewer disagreement detected above the 0.2 spread
                threshold.
              </div>
            )}
            <div className="space-y-2">
              {replay.disagreements.map((d) => (
                <div
                  key={d.id}
                  className="rounded border border-amber-500/40 bg-amber-500/5 p-3"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-amber-300">
                      {d.topic} · spread {d.spread.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">
                      resolution: {d.resolution ?? "unresolved"}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm">
                    <span className="text-emerald-300 font-mono">
                      {reviewerName(d.high.reviewerId)}
                    </span>{" "}
                    {d.high.summary} ({d.high.score.toFixed(2)})
                  </div>
                  <div className="text-sm">
                    <span className="text-rose-300 font-mono">
                      {reviewerName(d.low.reviewerId)}
                    </span>{" "}
                    {d.low.summary} ({d.low.score.toFixed(2)})
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Escalations */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2 flex items-center gap-1">
              <Activity className="size-3" /> Escalations
            </div>
            <div className="space-y-2">
              {replay.escalations.map((e) => (
                <div
                  key={e.id}
                  className="rounded border border-orange-500/40 bg-orange-500/5 p-3 text-sm"
                >
                  <div className="text-xs font-mono text-orange-300">
                    {e.trigger} · {new Date(e.occurredAt).toLocaleString()}
                  </div>
                  <div className="mt-1">{e.summary}</div>
                </div>
              ))}
              {replay.escalations.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No escalations.
                </div>
              )}
            </div>
          </div>

          {/* Overrides */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2 flex items-center gap-1">
              <Crown className="size-3" /> Overrides
            </div>
            <div className="space-y-2">
              {replay.overrides.map((o) => (
                <div
                  key={o.id}
                  className="rounded border border-rose-500/40 bg-rose-500/5 p-3 text-sm"
                >
                  <div className="text-xs font-mono text-rose-300">
                    by {reviewerName(o.byReviewerId)} ·{" "}
                    {new Date(o.occurredAt).toLocaleString()}
                  </div>
                  <div className="mt-1">{o.rationale}</div>
                </div>
              ))}
              {replay.overrides.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No overrides recorded.
                </div>
              )}
            </div>
          </div>

          {/* Confidence trajectory */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2 flex items-center gap-1">
              <Gauge className="size-3" /> Rolling P(hire) estimate
            </div>
            <div className="space-y-1">
              {replay.confidenceTrajectory.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-mono"
                >
                  <span className="text-muted-foreground w-32 shrink-0">
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
          </div>
        </div>
      </div>

      {/* Reasoning reconstruction */}
      {reasoning && (
        <div className="mt-6 border-t border-border/40 pt-4">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-3 flex items-center gap-1">
            <Network className="size-3" /> Reasoning reconstruction
          </div>
          <p className="text-xs text-muted-foreground italic mb-3">
            {reasoning.caveat}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground/80 mb-1">
                Disagreement edges
              </div>
              {reasoning.disagreementGraph.edges.length === 0 ? (
                <div className="text-xs text-muted-foreground">none</div>
              ) : (
                <ul className="space-y-1 text-xs font-mono">
                  {reasoning.disagreementGraph.edges.map((e) => (
                    <li
                      key={`${e.from}__${e.to}`}
                      className="rounded border border-border/60 bg-background/40 px-2 py-1.5"
                    >
                      <span className="text-amber-300">
                        {reviewerName(e.from)} ↔ {reviewerName(e.to)}
                      </span>{" "}
                      · weight {e.weight.toFixed(2)} · topics{" "}
                      {e.topics.join(", ")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground/80 mb-1">
                Pressure points
              </div>
              <ul className="space-y-1 text-xs">
                {reasoning.pressurePoints.map((p, i) => (
                  <li
                    key={i}
                    className="rounded border border-border/60 bg-background/40 px-2 py-1.5"
                  >
                    {p}
                  </li>
                ))}
                {reasoning.pressurePoints.length === 0 && (
                  <li className="text-muted-foreground">none</li>
                )}
              </ul>
              <div className="text-[10px] font-mono uppercase text-muted-foreground/80 mt-3 mb-1">
                Override dynamics
              </div>
              <ul className="space-y-1 text-xs font-mono">
                {reasoning.overrideDynamics.map((o) => (
                  <li
                    key={o.overrideId}
                    className="rounded border border-border/60 bg-background/40 px-2 py-1.5"
                  >
                    {o.summary}
                  </li>
                ))}
                {reasoning.overrideDynamics.length === 0 && (
                  <li className="text-muted-foreground">none</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {replay.unresolvedTensions.length > 0 && (
        <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <div className="font-mono uppercase tracking-wider text-amber-300 mb-1">
            Unresolved tensions
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {replay.unresolvedTensions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

function CalibrationPanel({ report }: { report: CalibrationReport }) {
  return (
    <Section
      title="Calibration · reviewer reliability"
      icon={Gauge}
      hint="based on linked replays + outcomes"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Stat
          label="Org ECE"
          value={report.expectedCalibrationError.toFixed(3)}
          tone={
            report.expectedCalibrationError > 0.2 ? "warn" : "default"
          }
        />
        <Stat label="Brier score" value={report.brierScore.toFixed(3)} />
        <Stat
          label="Reviewers tracked"
          value={report.reviewers.length}
          icon={Users}
        />
      </div>
      <p className="text-xs text-muted-foreground italic mb-3">
        {report.caveat}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/80">
            <tr>
              <th className="text-left py-2 pr-3">Reviewer</th>
              <th className="text-left py-2 pr-3">Predictions</th>
              <th className="text-left py-2 pr-3">Mean claimed</th>
              <th className="text-left py-2 pr-3">Mean realised</th>
              <th className="text-left py-2 pr-3">Drift</th>
              <th className="text-left py-2 pr-3">ECE</th>
              <th className="text-left py-2 pr-3">Brier</th>
            </tr>
          </thead>
          <tbody>
            {report.reviewers.map((r) => (
              <tr key={r.reviewerId} className="border-t border-border/40">
                <td className="py-2 pr-3 font-mono">{r.displayName}</td>
                <td className="py-2 pr-3 font-mono">{r.predictions}</td>
                <td className="py-2 pr-3 font-mono">
                  {r.meanClaimed.toFixed(2)}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {r.meanRealized.toFixed(2)}
                </td>
                <td
                  className={cn(
                    "py-2 pr-3 font-mono",
                    Math.abs(r.drift) > 0.3 && "text-rose-300",
                  )}
                >
                  {r.drift > 0 ? "+" : ""}
                  {r.drift.toFixed(2)}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {r.expectedCalibrationError.toFixed(2)}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {r.brierScore.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export default ATS;
