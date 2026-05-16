import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Database,
  HardDrive,
  Hash,
  Clock,
  GitCommit,
  Layers,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror of /api/operations-maturity payloads)
// ---------------------------------------------------------------------------

type PersistedEvent = {
  id: number;
  orgId: string;
  sequence: number;
  kind: string;
  payload: unknown;
  signature: string;
  occurredAt: string;
  recordedAt: string;
  sourceAgentId: string | null;
  sourceSkillId: string | null;
  correlationId: string | null;
};

type MemorySnapshot = {
  id: number;
  orgId: string;
  scope: string;
  key: string;
  summary: string;
  confidence: number;
  payload: unknown;
  sourceAgentId: string | null;
  signature: string;
  validFrom: string;
  validTo: string | null;
};

type CalibrationPoint = {
  id: number;
  expectedCalibrationError: number;
  brierScore: number;
  overconfidentBuckets: number;
  underconfidentBuckets: number;
  sampleSize: number;
  measuredAt: string;
};

type EventStats = {
  orgId: string;
  totalEvents: number;
  latestSequence: number;
  latestOccurredAt: string | null;
  countsByKind: Record<string, number>;
};

type Health = {
  driver: "postgres" | "in-memory";
  ready: boolean;
  message: string;
  checkedAt: string;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.replace(/\/$/, "")}/api${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

const ORG_ID = "demo";

// ---------------------------------------------------------------------------
// Shared atoms
// ---------------------------------------------------------------------------

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
          <div className="text-[10px] font-mono text-muted-foreground/70">
            {hint}
          </div>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
        <div
          className="h-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function ts(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

// ---------------------------------------------------------------------------
// Header: persistence health + counters
// ---------------------------------------------------------------------------

function PersistenceHeader({
  health,
  stats,
}: {
  health: Health | undefined;
  stats: EventStats | undefined;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          <HardDrive className="size-3" /> Driver
        </div>
        <div className="mt-2 flex items-center gap-2">
          {health?.ready ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <AlertCircle className="size-4 text-amber-500" />
          )}
          <span className="font-mono text-sm">
            {health?.driver ?? "…"}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
          {health?.message ?? "checking…"}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          <GitCommit className="size-3" /> Total events
        </div>
        <div className="mt-2 font-mono text-2xl tabular-nums">
          {stats?.totalEvents ?? "…"}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          append-only · org <code>{ORG_ID}</code>
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          <Hash className="size-3" /> Latest sequence
        </div>
        <div className="mt-2 font-mono text-2xl tabular-nums">
          {stats?.latestSequence ?? "…"}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          monotonic per-org cursor
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          <Clock className="size-3" /> Last event
        </div>
        <div className="mt-2 font-mono text-sm tabular-nums">
          {stats?.latestOccurredAt ? ts(stats.latestOccurredAt) : "—"}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          occurred-at (framework clock)
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Event explorer
// ---------------------------------------------------------------------------

const EVENT_KINDS = [
  "all",
  "evidence.ingested",
  "cognition.run.completed",
  "cognition.synthesis.recorded",
  "investigation.opened",
  "investigation.updated",
  "investigation.closed",
  "reviewer.action",
  "escalation.raised",
  "escalation.resolved",
  "override.applied",
  "calibration.snapshot",
  "benchmark.run",
  "memory.written",
  "audit.logged",
] as const;

function EventExplorer({
  events,
  stats,
}: {
  events: PersistedEvent[];
  stats: EventStats | undefined;
}) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [selected, setSelected] = useState<PersistedEvent | null>(null);

  const filtered = useMemo(
    () =>
      kindFilter === "all"
        ? events
        : events.filter((e) => e.kind === kindFilter),
    [events, kindFilter],
  );

  return (
    <Section
      title="Event store"
      icon={Layers}
      hint={`${filtered.length} shown · click an event to verify its signature`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {EVENT_KINDS.map((k) => {
          const count =
            k === "all"
              ? stats?.totalEvents ?? 0
              : stats?.countsByKind?.[k] ?? 0;
          if (k !== "all" && count === 0) return null;
          return (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-mono rounded-md border transition-colors",
                kindFilter === k
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
              <span className="ml-1.5 text-muted-foreground/70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,420px)] gap-4">
        <div className="rounded-md border border-border/60 overflow-hidden">
          <table className="w-full text-[12px] font-mono">
            <thead className="bg-secondary/30 text-muted-foreground text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 w-12">#</th>
                <th className="text-left px-3 py-2">kind</th>
                <th className="text-left px-3 py-2">source</th>
                <th className="text-left px-3 py-2">occurred</th>
                <th className="text-left px-3 py-2 w-28">signature</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className={cn(
                    "border-t border-border/40 cursor-pointer hover:bg-secondary/30",
                    selected?.id === e.id && "bg-primary/5",
                  )}
                >
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                    {e.sequence}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-primary">{e.kind}</span>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {e.sourceAgentId ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                    {ts(e.occurredAt)}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground/70">
                    {e.signature}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No events match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <EventDetailPanel selected={selected} />
      </div>
    </Section>
  );
}

type VerifyResult = {
  storedSignature: string;
  recomputedSignature: string;
  match: boolean;
  verifiedAt: string;
};

function EventDetailPanel({ selected }: { selected: PersistedEvent | null }) {
  const verify = useMutation({
    mutationFn: (id: number) =>
      getJson<VerifyResult>(`/operations-maturity/events/${id}/verify`),
  });

  return (
    <aside className="rounded-md border border-border/60 bg-secondary/10 p-4 text-[12px] font-mono overflow-hidden">
      {selected ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-primary">{selected.kind}</span>
            <span className="text-muted-foreground/70">
              #{selected.sequence}
            </span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] mb-3">
            <dt className="text-muted-foreground">org</dt>
            <dd>{selected.orgId}</dd>
            <dt className="text-muted-foreground">occurred</dt>
            <dd className="tabular-nums">{ts(selected.occurredAt)}</dd>
            <dt className="text-muted-foreground">recorded</dt>
            <dd className="tabular-nums">{ts(selected.recordedAt)}</dd>
            <dt className="text-muted-foreground">agent</dt>
            <dd>{selected.sourceAgentId ?? "—"}</dd>
            <dt className="text-muted-foreground">correlation</dt>
            <dd className="truncate">{selected.correlationId ?? "—"}</dd>
            <dt className="text-muted-foreground">signature</dt>
            <dd className="text-primary/80">{selected.signature}</dd>
          </dl>
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => verify.mutate(selected.id)}
              disabled={verify.isPending}
              className="px-2 py-1 text-[11px] font-mono rounded border border-border/60 hover:bg-secondary/40 disabled:opacity-50"
            >
              {verify.isPending ? "verifying…" : "verify signature"}
            </button>
            {verify.data && verify.variables === selected.id && (
              <span
                className={cn(
                  "text-[11px] inline-flex items-center gap-1.5",
                  verify.data.match
                    ? "text-emerald-500"
                    : "text-red-500",
                )}
              >
                {verify.data.match ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <AlertCircle className="size-3" />
                )}
                {verify.data.match
                  ? `sha256(payload) == ${verify.data.storedSignature}`
                  : `mismatch: got ${verify.data.recomputedSignature}`}
              </span>
            )}
          </div>
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words text-foreground/80 bg-background/60 p-3 rounded border border-border/40 max-h-80 overflow-auto">
            {JSON.stringify(selected.payload, null, 2)}
          </pre>
        </>
      ) : (
        <p className="text-muted-foreground text-[11px]">
          Click an event to inspect its payload, provenance and
          re-verify its signature against the canonical payload.
        </p>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Longitudinal memory — time-travel
// ---------------------------------------------------------------------------

function TimeTravelMemory({ events }: { events: PersistedEvent[] }) {
  const earliest = events[0]?.occurredAt ?? null;
  const latest = events[events.length - 1]?.occurredAt ?? null;
  const [asOf, setAsOf] = useState<string | null>(null);

  const effectiveAsOf = asOf ?? latest ?? new Date().toISOString();

  const snapshots = useQuery({
    queryKey: ["memory-as-of", effectiveAsOf],
    queryFn: () =>
      getJson<{ snapshots: MemorySnapshot[]; asOf: string }>(
        `/operations-maturity/memory/as-of?orgId=${ORG_ID}&asOf=${encodeURIComponent(effectiveAsOf)}`,
      ),
  });

  const hint =
    earliest && latest
      ? `${ts(earliest).slice(0, 10)} → ${ts(latest).slice(0, 10)} · ${snapshots.data?.snapshots.length ?? 0} active`
      : "";

  return (
    <Section title="Longitudinal memory · time-travel" icon={Clock} hint={hint}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-mono text-muted-foreground">
          as-of
        </label>
        <input
          type="datetime-local"
          value={
            asOf
              ? new Date(asOf).toISOString().slice(0, 16)
              : latest
                ? new Date(latest).toISOString().slice(0, 16)
                : ""
          }
          onChange={(e) =>
            setAsOf(
              e.target.value
                ? new Date(e.target.value).toISOString()
                : null,
            )
          }
          className="bg-background border border-border/60 rounded px-2 py-1 text-[12px] font-mono"
        />
        <button
          onClick={() => setAsOf(earliest)}
          className="px-2 py-1 text-[11px] font-mono rounded border border-border/60 hover:bg-secondary/40"
        >
          earliest
        </button>
        <button
          onClick={() => setAsOf(latest)}
          className="px-2 py-1 text-[11px] font-mono rounded border border-border/60 hover:bg-secondary/40"
        >
          latest
        </button>
        <button
          onClick={() => setAsOf(null)}
          className="px-2 py-1 text-[11px] font-mono rounded border border-border/60 hover:bg-secondary/40"
        >
          now
        </button>
        <code className="ml-auto text-[10px] text-muted-foreground/70">
          {ts(effectiveAsOf)}
        </code>
      </div>

      <div className="rounded-md border border-border/60 overflow-hidden">
        <table className="w-full text-[12px] font-mono">
          <thead className="bg-secondary/30 text-muted-foreground text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">scope</th>
              <th className="text-left px-3 py-2">key</th>
              <th className="text-left px-3 py-2">summary</th>
              <th className="text-left px-3 py-2 w-44">confidence</th>
              <th className="text-left px-3 py-2 w-28">source</th>
            </tr>
          </thead>
          <tbody>
            {(snapshots.data?.snapshots ?? []).map((s) => (
              <tr key={s.id} className="border-t border-border/40">
                <td className="px-3 py-2 text-muted-foreground">{s.scope}</td>
                <td className="px-3 py-2 text-primary">{s.key}</td>
                <td className="px-3 py-2 text-foreground/90 max-w-md">
                  {s.summary}
                </td>
                <td className="px-3 py-2">
                  <ConfidenceBar value={s.confidence} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {s.sourceAgentId ?? "—"}
                </td>
              </tr>
            ))}
            {(!snapshots.data || snapshots.data.snapshots.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No memory snapshots are active at this moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Memory is never mutated in place. Each write closes the prior
        snapshot's <code>validTo</code> and appends a new active row, so
        you can reconstruct what the framework believed at any point in
        the past.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Calibration evolution
// ---------------------------------------------------------------------------

function CalibrationEvolution({ points }: { points: CalibrationPoint[] }) {
  if (points.length === 0) {
    return (
      <Section title="Calibration evolution" icon={TrendingDown}>
        <p className="text-[12px] text-muted-foreground">
          No calibration snapshots yet.
        </p>
      </Section>
    );
  }
  const maxEce = Math.max(...points.map((p) => p.expectedCalibrationError));
  const maxBrier = Math.max(...points.map((p) => p.brierScore));
  const yMax = Math.max(maxEce, maxBrier) * 1.1 || 0.2;
  const width = 720;
  const height = 200;
  const padX = 40;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const xFor = (i: number) =>
    padX + (i / Math.max(points.length - 1, 1)) * innerW;
  const yFor = (v: number) => padY + (1 - v / yMax) * innerH;
  const pathFor = (key: "expectedCalibrationError" | "brierScore") =>
    points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p[key]).toFixed(1)}`,
      )
      .join(" ");
  const latest = points[points.length - 1];
  const first = points[0];
  const eceDelta = latest.expectedCalibrationError - first.expectedCalibrationError;
  const brierDelta = latest.brierScore - first.brierScore;

  return (
    <Section
      title="Calibration evolution"
      icon={TrendingDown}
      hint={`${points.length} snapshots · ΔECE ${(eceDelta * 100).toFixed(1)}pp · ΔBrier ${brierDelta.toFixed(3)}`}
    >
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          role="img"
          aria-label="Calibration error and Brier score over time"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = padY + f * innerH;
            return (
              <g key={f}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                />
                <text
                  x={padX - 6}
                  y={y + 3}
                  fontSize="9"
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                >
                  {((1 - f) * yMax).toFixed(2)}
                </text>
              </g>
            );
          })}
          <path
            d={pathFor("expectedCalibrationError")}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          <path
            d={pathFor("brierScore")}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          {points.map((p, i) => (
            <g key={p.id}>
              <circle
                cx={xFor(i)}
                cy={yFor(p.expectedCalibrationError)}
                r="3"
                className="fill-primary"
              />
              <text
                x={xFor(i)}
                y={height - 6}
                fontSize="9"
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
              >
                {ts(p.measuredAt).slice(5, 10)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-0.5 bg-primary" /> ECE
          <span className="text-muted-foreground">
            ({latest.expectedCalibrationError.toFixed(3)})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-0 border-t-2 border-dashed border-muted-foreground/60" />{" "}
          Brier
          <span className="text-muted-foreground">
            ({latest.brierScore.toFixed(3)})
          </span>
        </div>
        <div className="text-muted-foreground ml-auto">
          n={latest.sampleSize} · over={latest.overconfidentBuckets} ·
          under={latest.underconfidentBuckets}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function OperationsMaturity() {
  const health = useQuery({
    queryKey: ["om-health"],
    queryFn: () => getJson<Health>("/operations-maturity/health"),
  });
  const stats = useQuery({
    queryKey: ["om-stats"],
    queryFn: () =>
      getJson<EventStats>(`/operations-maturity/events/stats?orgId=${ORG_ID}`),
  });
  const events = useQuery({
    queryKey: ["om-events"],
    queryFn: () =>
      getJson<{ events: PersistedEvent[] }>(
        `/operations-maturity/events?orgId=${ORG_ID}&limit=500`,
      ),
  });
  const calibration = useQuery({
    queryKey: ["om-calibration"],
    queryFn: () =>
      getJson<{ points: CalibrationPoint[] }>(
        `/operations-maturity/calibration/history?orgId=${ORG_ID}`,
      ),
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          <Database className="size-3" /> operational maturity · persistence
        </div>
        <h1 className="text-2xl font-mono font-bold tracking-tight">
          Event store · longitudinal memory · calibration history
        </h1>
        <p className="text-[13px] text-muted-foreground max-w-3xl">
          Append-only, organization-scoped persistence. Every cognition
          run, evidence ingestion, investigation transition, reviewer
          action, override, calibration measurement and benchmark run
          is recorded as a typed event with a deterministic signature
          and a monotonic per-org sequence — replayable, provenance-
          preserving, never mutated.
        </p>
      </header>

      <PersistenceHeader health={health.data} stats={stats.data} />

      <EventExplorer events={events.data?.events ?? []} stats={stats.data} />

      <TimeTravelMemory events={events.data?.events ?? []} />

      <CalibrationEvolution points={calibration.data?.points ?? []} />
    </div>
  );
}

export default OperationsMaturity;
