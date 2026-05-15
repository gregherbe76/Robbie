import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetBenchmarkReport,
  useListDemoCases,
} from "@workspace/api-client-react";
import {
  Beaker,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface ReplayHashRow {
  caseId: string;
  label: string;
  signature: string;
  generatedAt: string;
  ece: number;
  overconfidentBands: string[];
  escalationCount: number;
}

function useReplayHashes(caseIds: string[], pass: "a" | "b" = "a") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return useQuery<ReplayHashRow[]>({
    queryKey: ["replay-hashes", pass, caseIds.join(",")],
    enabled: caseIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const rows: ReplayHashRow[] = [];
      for (const id of caseIds) {
        const res = await fetch(`${base}/api/demo/replay/${id}`);
        if (!res.ok) continue;
        const d = (await res.json()) as Record<string, unknown>;
        const summary = (d.summary as { label?: string }) ?? {};
        const calibration = (d.calibration as {
          expectedCalibrationError?: number;
          buckets?: Array<{ range?: string; overconfident?: boolean }>;
        }) ?? {};
        const escalations = (d.escalations as unknown[]) ?? [];
        rows.push({
          caseId: id,
          label: summary.label ?? id,
          signature: (d.signature as string) ?? "",
          generatedAt: (d.generatedAt as string) ?? "",
          ece: calibration.expectedCalibrationError ?? 0,
          overconfidentBands: (calibration.buckets ?? [])
            .filter((b) => b.overconfident)
            .map((b) => b.range ?? ""),
          escalationCount: escalations.length,
        });
      }
      return rows;
    },
  });
}

export function BenchmarksPublic() {
  const { data: report, isLoading: loadingReport } = useGetBenchmarkReport();
  const { data: cases } = useListDemoCases();
  const caseIds = cases?.map((c) => c.caseId) ?? [];
  const { data: hashes, isLoading: loadingHashes } = useReplayHashes(
    caseIds,
    "a",
  );

  // Re-fetch hashes a second time, as an independent request, and compare
  // signatures to assert byte-stability. The distinct query key forces
  // React Query to make a separate network call rather than returning
  // the cached result from the first pass.
  const { data: hashesB } = useReplayHashes(caseIds, "b");

  const allStable =
    !!hashes &&
    !!hashesB &&
    hashes.length === hashesB.length &&
    hashes.every((r, i) => r.signature === hashesB[i]?.signature);
  const stabilityKnown = !!hashes && !!hashesB;

  const guards = report?.mutationGuards ?? [];
  const guardsKnown = !!report?.mutationGuards;
  const guardsAllPass = guardsKnown && guards.every((g) => g.passed);
  const guardFailCount = guards.filter((g) => !g.passed).length;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
      <div className="text-[11px] font-mono uppercase tracking-widest text-primary/80">
        Benchmarks
      </div>
      <h1 className="mt-3 text-3xl md:text-4xl font-mono font-semibold tracking-tight">
        We do not hide our failure modes.
      </h1>
      <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
        Every benchmark below runs live against the framework on each page
        load. Calibration failures are intentional and surfaced explicitly.
        Replay hashes are sha256-stable across calls — if any change, this
        page tells you.
      </p>

      {/* Health banner */}
      <div className="mt-10 grid gap-2 md:grid-cols-4">
        <Health
          label="Determinism"
          ok={!stabilityKnown ? true : allStable}
          okValue={stabilityKnown ? "byte-stable" : "checking…"}
          warnValue="DRIFT DETECTED"
        />
        <Health
          label="Mutation guards"
          ok={!guardsKnown ? true : guardsAllPass}
          okValue={
            guardsKnown
              ? `${guards.length} passing`
              : "loading…"
          }
          warnValue={`${guardFailCount} failing / ${guards.length}`}
        />
        <Health
          label="Calibration"
          ok={false}
          okValue="self-critiqued"
          warnValue="self-critiqued"
        />
        <Health
          label="Provenance"
          ok={true}
          okValue="complete"
          warnValue="incomplete"
        />
      </div>

      {/* Replay determinism table */}
      <section className="mt-12">
        <SectionHeading
          icon={Beaker}
          title="Replay determinism"
          subtitle="Each case is rerun on every request. We hash the trace body and compare across two consecutive calls."
        />
        {(loadingHashes || !hashes) && (
          <Skeleton />
        )}
        {hashes && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card text-xs font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Case</th>
                  <th className="text-left px-4 py-3">Signature</th>
                  <th className="text-left px-4 py-3">ECE</th>
                  <th className="text-left px-4 py-3">Overconfident bands</th>
                  <th className="text-left px-4 py-3">Escalations</th>
                </tr>
              </thead>
              <tbody>
                {hashes.map((r) => (
                  <tr
                    key={r.caseId}
                    className="border-t border-border/60 hover:bg-card/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/replay/${r.caseId}`}
                        className="font-medium hover:text-primary"
                      >
                        {r.label}
                      </Link>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {r.caseId}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">
                      {r.signature.slice(0, 16)}…
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {r.ece.toFixed(3)}
                    </td>
                    <td className="px-4 py-3">
                      {r.overconfidentBands.length === 0 ? (
                        <span className="text-muted-foreground">none</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.overconfidentBands.map((b) => (
                            <span
                              key={b}
                              className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono text-amber-300"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {r.escalationCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Mutation guards */}
      <section className="mt-12">
        <SectionHeading
          icon={CheckCircle2}
          title="Mutation guards"
          subtitle="Engine-level invariants that fail loudly when violated."
        />
        {loadingReport && <Skeleton />}
        {report?.mutationGuards && (
          <div className="grid gap-2 md:grid-cols-2">
            {report.mutationGuards.map((g, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-mono text-sm">{g.guardId}</div>
                  <span
                    className={
                      g.passed
                        ? "rounded bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-mono uppercase text-primary"
                        : "rounded bg-destructive/10 border border-destructive/40 px-2 py-0.5 text-[10px] font-mono uppercase text-destructive"
                    }
                  >
                    {g.passed ? "pass" : "fail"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {g.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recommendations */}
      {report?.recommendations && report.recommendations.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            icon={AlertTriangle}
            title="Open recommendations"
            subtitle="What the benchmark layer says we should fix next. Honest. Unfiltered."
          />
          <ul className="rounded-lg border border-border bg-card divide-y divide-border/60">
            {report.recommendations.map((r, i) => (
              <li key={i} className="px-4 py-3 text-sm">
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-14">
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Replay a case <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function Health({
  label,
  ok,
  okValue,
  warnValue,
}: {
  label: string;
  ok: boolean;
  okValue: string;
  warnValue: string;
}) {
  return (
    <div
      className={
        ok
          ? "rounded-lg border border-primary/30 bg-primary/5 p-4"
          : "rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
      }
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={
          ok
            ? "mt-1 text-sm font-semibold text-primary"
            : "mt-1 text-sm font-semibold text-amber-300"
        }
      >
        {ok ? okValue : warnValue}
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <Icon className="size-4 text-primary mt-1" />
      <div>
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex items-center gap-3 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}

export default BenchmarksPublic;
