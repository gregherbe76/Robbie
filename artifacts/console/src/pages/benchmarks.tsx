import React, { useMemo, useState } from "react";
import { useGetBenchmarkReport } from "@workspace/api-client-react";
import type {
  BenchmarkReport,
  BenchmarkScenarioResult,
  BenchmarkScenarioDigest,
  BenchmarkExpectationFailure,
  BenchmarkMutationGuard,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Activity,
  ShieldCheck,
  Beaker,
  GitBranch,
  Sigma,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hash,
  ScrollText,
  Fingerprint,
} from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function f3(n: number): string {
  return n.toFixed(3);
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
        ok
          ? "border-emerald-500/40 text-emerald-400"
          : "border-red-500/40 text-red-400",
      )}
    >
      {ok ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <XCircle className="size-3" />
      )}
      {label}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  hint,
  count,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  hint?: string;
  count?: number;
}) {
  return (
    <section className="rounded-lg border border-border bg-card/40">
      <header className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h2 className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
            {title}
          </h2>
          {typeof count === "number" && (
            <span className="ml-1 text-[10px] font-mono text-muted-foreground/70 bg-secondary/60 px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
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

function Metric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "default" | "warn" | "danger" | "good";
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-400"
      : tone === "danger"
        ? "text-red-400"
        : tone === "good"
          ? "text-emerald-400"
          : "text-foreground";
  return (
    <div className="rounded border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-xl font-mono font-semibold", toneCls)}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-muted-foreground/80 font-mono">
          {sub}
        </div>
      )}
    </div>
  );
}

function DigestRow({ digest }: { digest: BenchmarkScenarioDigest }) {
  const cells: Array<[string, string | number]> = [
    ["bayes.fit", f3(digest.bayesianFit)],
    ["bayes.conf", f3(digest.bayesianConfidence)],
    ["contra", f3(digest.contradictionScore)],
    ["c.count", digest.contradictionCount],
    ["unsupp", digest.unsupportedClaimCount],
    ["traj", f3(digest.trajectoryScore)],
    ["disagree", f3(digest.disagreementScore)],
    ["ambig", f3(digest.ambiguityLevel)],
    ["global.conf", f3(digest.globalConfidence)],
    ["certainty", digest.certaintyCategory],
    ["reco", digest.recommendationCategory],
    ["fit", digest.fitRecommendation],
    ["fit.conf", f3(digest.fitConfidence)],
    ["risk", f3(digest.overallHiringRisk)],
    ["chaos.fit", f3(digest.chaosFitScore)],
    ["evd.req", digest.evidenceRequestSignal],
    ["?q", digest.unresolvedQuestionCount],
    ["infl", digest.influenceCount],
    ["arch", digest.archetypeMatchCount],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {cells.map(([k, v]) => (
        <div
          key={k}
          className="rounded border border-border/60 bg-background/30 px-2 py-1.5"
        >
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            {k}
          </div>
          <div className="text-[12px] font-mono text-foreground/90 truncate">
            {String(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FailuresList({ items }: { items: BenchmarkExpectationFailure[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono">
        No expectation failures.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((f, idx) => (
        <li
          key={idx}
          className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2"
        >
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <XCircle className="size-3 text-red-400" />
            <span className="text-red-400 uppercase tracking-wider">
              {f.type}
            </span>
            {f.path && (
              <span className="text-muted-foreground">{f.path}</span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-mono text-foreground/80">
            {f.detail}
          </div>
          {f.rationale && (
            <div className="mt-0.5 text-[11px] text-muted-foreground/80 italic">
              {f.rationale}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ScenarioCard({
  s,
  active,
  onClick,
}: {
  s: BenchmarkScenarioResult;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded border px-3 py-2 transition-colors",
        active
          ? "border-primary/60 bg-primary/5"
          : "border-border/60 bg-background/30 hover:bg-secondary/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-foreground truncate">
          {s.scenarioId}
        </span>
        <StatusPill ok={s.passed} label={s.passed ? "pass" : "fail"} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate">
        {s.description}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-muted-foreground/80">
        <Hash className="size-3" />
        <span>{s.determinismHash}</span>
        <span className="text-muted-foreground/40">·</span>
        <span>reco {s.digest.recommendationCategory}</span>
        <span className="text-muted-foreground/40">·</span>
        <span>fit {s.digest.fitRecommendation}</span>
      </div>
    </button>
  );
}

function GuardsList({ items }: { items: BenchmarkMutationGuard[] }) {
  return (
    <ul className="space-y-2">
      {items.map((g) => (
        <li
          key={g.guardId}
          className="rounded border border-border/60 bg-background/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm text-foreground">
              {g.guardId}
            </span>
            <StatusPill ok={g.passed} label={g.passed ? "catches" : "weak"} />
          </div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            {g.description}
          </div>
          <div className="mt-1 text-[10px] font-mono text-muted-foreground/70">
            probe: {g.scenarioId} · {g.detail}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Benchmarks() {
  const { data, isLoading, error } = useGetBenchmarkReport();
  const report = data as BenchmarkReport | undefined;
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo<BenchmarkScenarioResult | null>(() => {
    if (!report) return null;
    if (activeId) {
      const found = report.scenarios.find((s) => s.scenarioId === activeId);
      if (found) return found;
    }
    return report.scenarios[0] ?? null;
  }, [report, activeId]);

  if (isLoading) {
    return (
      <p className="text-sm font-mono text-muted-foreground">
        Loading benchmark report…
      </p>
    );
  }
  if (error || !report) {
    return (
      <p className="text-sm font-mono text-red-400">
        Failed to load benchmark report.
      </p>
    );
  }

  const sum = report.summary;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-mono font-bold text-foreground">
          Cognitive Benchmarks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground font-mono">
          Deterministic regression protection for the cognition layer. Same
          fixture · same clock · same hash.
        </p>
        <p className="mt-1 text-[11px] font-mono text-muted-foreground/70">
          generated {new Date(report.generatedAt).toUTCString()} ·{" "}
          {report.generatedBy}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Metric
          label="scenarios"
          value={`${sum.passed}/${sum.totalScenarios}`}
          tone={sum.failed === 0 ? "good" : "danger"}
          sub={sum.failed === 0 ? "all passing" : `${sum.failed} failing`}
        />
        <Metric
          label="determinism"
          value={sum.determinismOk ? "ok" : "drift"}
          tone={sum.determinismOk ? "good" : "danger"}
        />
        <Metric
          label="provenance"
          value={sum.provenanceOk ? "ok" : "gap"}
          tone={sum.provenanceOk ? "good" : "danger"}
        />
        <Metric
          label="calibration"
          value={sum.calibrationOk ? "ok" : "off"}
          tone={sum.calibrationOk ? "good" : "warn"}
          sub={`ECE ${report.calibration.ece.toFixed(3)}`}
        />
        <Metric
          label="snapshot"
          value={sum.snapshotOk ? "stable" : "drift"}
          tone={sum.snapshotOk ? "good" : "warn"}
        />
        <Metric
          label="guards"
          value={
            report.mutationGuards.filter((g) => g.passed).length +
            "/" +
            report.mutationGuards.length
          }
          tone={sum.mutationGuardsOk ? "good" : "danger"}
        />
        <Metric
          label="overconf risk"
          value={report.calibration.overconfidenceRisk}
          tone={
            report.calibration.overconfidenceRisk === "low"
              ? "good"
              : report.calibration.overconfidenceRisk === "medium"
                ? "warn"
                : "danger"
          }
          sub={`${report.calibration.predictionsEvaluated} predictions`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section
          title="Scenarios"
          icon={Beaker}
          count={report.scenarios.length}
        >
          <ul className="space-y-2">
            {report.scenarios.map((s) => (
              <li key={s.scenarioId}>
                <ScenarioCard
                  s={s}
                  active={active?.scenarioId === s.scenarioId}
                  onClick={() => setActiveId(s.scenarioId)}
                />
              </li>
            ))}
          </ul>
        </Section>

        <div className="lg:col-span-2 space-y-4">
          {active && (
            <>
              <Section
                title={`Scenario · ${active.scenarioId}`}
                icon={Activity}
                hint={`hash ${active.determinismHash}`}
              >
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-mono">
                    {active.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill ok={active.passed} label="overall" />
                    <StatusPill
                      ok={active.determinism.passed}
                      label="determinism"
                    />
                    <StatusPill
                      ok={active.cognitionIntegrity.passed}
                      label="integrity"
                    />
                    <StatusPill
                      ok={active.provenance.ok}
                      label="provenance"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                      Structural digest
                    </div>
                    <DigestRow digest={active.digest} />
                  </div>
                </div>
              </Section>

              <Section
                title="Expectation failures"
                icon={AlertTriangle}
                count={active.failures.length}
              >
                <FailuresList items={active.failures} />
              </Section>

              <Section
                title="Cognition integrity"
                icon={GitBranch}
                count={active.cognitionIntegrity.findings.length}
              >
                {active.cognitionIntegrity.findings.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-mono">
                    No integrity rules configured for this scenario.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {active.cognitionIntegrity.findings.map((f, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between rounded border border-border/60 bg-background/30 px-3 py-2"
                      >
                        <div className="text-[11px] font-mono">
                          <span
                            className={cn(
                              "uppercase tracking-wider mr-2",
                              f.ok ? "text-emerald-400" : "text-red-400",
                            )}
                          >
                            {f.rule}
                          </span>
                          <span className="text-muted-foreground">
                            {f.detail}
                          </span>
                        </div>
                        {f.ok ? (
                          <CheckCircle2 className="size-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="size-3.5 text-red-400" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title="Provenance findings"
                icon={Fingerprint}
                count={active.provenance.findings.length}
              >
                <ul className="space-y-1">
                  {active.provenance.findings.slice(0, 12).map((f, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded border border-border/60 bg-background/30 px-3 py-2"
                    >
                      <div className="text-[11px] font-mono truncate">
                        <span
                          className={cn(
                            "mr-2",
                            f.ok ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {f.ok ? "✓" : "✗"}
                        </span>
                        <span className="text-foreground/80">{f.path}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground truncate ml-3">
                        {f.detail}
                      </span>
                    </li>
                  ))}
                  {active.provenance.findings.length > 12 && (
                    <li className="text-[10px] font-mono text-muted-foreground/70 px-1">
                      + {active.provenance.findings.length - 12} more
                    </li>
                  )}
                </ul>
              </Section>
            </>
          )}
        </div>
      </div>

      <Section title="Calibration smoke" icon={Sigma}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Metric
            label="ECE"
            value={report.calibration.ece.toFixed(4)}
            sub={report.calibration.detail}
            tone={report.calibration.passed ? "good" : "warn"}
          />
          <Metric
            label="predictions"
            value={report.calibration.predictionsEvaluated}
          />
          <Metric
            label="overconfidence"
            value={report.calibration.overconfidenceRisk}
            tone={
              report.calibration.overconfidenceRisk === "low"
                ? "good"
                : "warn"
            }
          />
        </div>
        {report.calibration.reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {report.calibration.reasons.map((r, idx) => (
              <li
                key={idx}
                className="text-[11px] font-mono text-amber-300/80"
              >
                · {r}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Mutation guards"
        icon={ShieldCheck}
        count={report.mutationGuards.length}
        hint="Each guard mutates the framework and asserts that protective expectations now FAIL."
      >
        <GuardsList items={report.mutationGuards} />
      </Section>

      <Section title="Snapshot drift" icon={Hash}>
        {report.snapshot.drift.length === 0 ? (
          <p className="text-xs font-mono text-emerald-400">
            No drift detected against baseline snapshot.
          </p>
        ) : (
          <ul className="space-y-1">
            {report.snapshot.drift.map((d, idx) => (
              <li
                key={idx}
                className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] font-mono"
              >
                <span className="uppercase tracking-wider text-amber-400 mr-2">
                  {d.kind}
                </span>
                <span className="text-foreground/80">{d.scenarioId}</span>
                <span className="text-muted-foreground"> — {d.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {report.recommendations.length > 0 && (
        <Section title="Recommendations" icon={ScrollText}>
          <ul className="space-y-1">
            {report.recommendations.map((r, idx) => (
              <li
                key={idx}
                className="text-[11px] font-mono text-foreground/80"
              >
                · {r}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
