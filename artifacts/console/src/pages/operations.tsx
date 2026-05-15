import React, { useMemo, useState } from "react";
import {
  useGetOperationsReport,
  useListOperationsAudit,
} from "@workspace/api-client-react";
import type {
  OperationsReport,
  IntelligenceCase,
  Investigation,
  EvidenceRequest,
  Hypothesis,
  AdversarialReview,
  Escalation,
  HumanAnnotation,
  ConsensusReport,
  AuditEvent,
  DecisionReviewWorkflowState,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Crosshair,
  AlertTriangle,
  Microscope,
  HelpCircle,
  FlaskConical,
  Scale,
  Siren,
  UserCheck,
  Users,
  ScrollText,
  Gauge,
  Activity,
  GitBranch,
  ShieldAlert,
} from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmt(n: number, d = 2): string {
  return n.toFixed(d);
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

function SeverityPill({
  severity,
}: {
  severity: "low" | "medium" | "high" | "critical" | string;
}) {
  const map: Record<string, string> = {
    low: "border-muted text-muted-foreground",
    medium: "border-amber-500/40 text-amber-400",
    high: "border-orange-500/50 text-orange-400",
    critical: "border-red-500/50 text-red-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
        map[severity] ?? map.low,
      )}
    >
      {severity}
    </span>
  );
}

function StatePill({ state }: { state: string }) {
  const danger = ["unresolved", "escalated", "investigation_required"];
  const warn = [
    "evidence_pending",
    "evidence_requested",
    "under_review",
    "adversarial_review",
    "human_review",
    "calibration_warning",
    "competing",
    "open",
    "in_progress",
  ];
  const good = [
    "decision_ready",
    "supported",
    "resolved",
    "satisfied",
    "advance",
  ];
  const tone = danger.includes(state)
    ? "border-red-500/40 text-red-400"
    : good.includes(state)
      ? "border-emerald-500/40 text-emerald-400"
      : warn.includes(state)
        ? "border-amber-500/40 text-amber-400"
        : "border-border text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
        tone,
      )}
    >
      {state.replaceAll("_", " ")}
    </span>
  );
}

function ConfBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-1.5 w-24 bg-secondary/60 rounded overflow-hidden">
      <div
        className={cn(
          "h-full",
          v >= 0.7
            ? "bg-emerald-500/70"
            : v >= 0.45
              ? "bg-amber-500/70"
              : "bg-red-500/70",
        )}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

function CaseHeader({
  c,
  active,
  onClick,
}: {
  c: IntelligenceCase;
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
        <div className="font-mono text-sm text-foreground truncate">
          {c.candidateName}
        </div>
        <StatePill state={c.decisionState} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate">
        {c.targetRole}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ConfBar value={c.effectiveConfidence} />
        <span className="text-[10px] font-mono text-muted-foreground">
          {pct(c.effectiveConfidence)}
        </span>
        {c.escalationSeverityMax && (
          <SeverityPill severity={c.escalationSeverityMax} />
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono text-muted-foreground/80">
        <span>inv {c.openInvestigationCount}</span>
        <span>evd {c.openEvidenceRequestCount}</span>
        <span>?q {c.unresolvedQuestionCount}</span>
        <span>hyp± {c.competingHypothesisCount}</span>
      </div>
    </button>
  );
}

function WorkflowPanel({ wf }: { wf: DecisionReviewWorkflowState }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <StatePill state={wf.state} />
        <span
          className={cn(
            "text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border",
            wf.uncertaintyPreserved
              ? "border-emerald-500/40 text-emerald-400"
              : "border-amber-500/40 text-amber-400",
          )}
        >
          uncertainty{" "}
          {wf.uncertaintyPreserved ? "preserved" : "compressed"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {wf.stateRationale}
      </p>
      {wf.prematureCertaintyGuard.triggered && (
        <div className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-400">
            <ShieldAlert className="size-3" />
            premature-certainty guard
          </div>
          <div className="mt-1 text-[11px] text-amber-200/80 font-mono">
            {wf.prematureCertaintyGuard.reason}
          </div>
        </div>
      )}
      {wf.blockingFactors.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
            Blocking
          </div>
          <ul className="space-y-1">
            {wf.blockingFactors.map((b, i) => (
              <li key={i} className="text-[11px] font-mono text-foreground/80">
                · {b}
              </li>
            ))}
          </ul>
        </div>
      )}
      {wf.transitions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
            Transitions
          </div>
          <ul className="space-y-1">
            {wf.transitions.map((t) => (
              <li
                key={t.id}
                className="text-[11px] font-mono text-foreground/80 flex items-center gap-1"
              >
                <span className="text-muted-foreground">{t.from}</span>
                <GitBranch className="size-3 text-muted-foreground/60" />
                <span>{t.to}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground/80 truncate">
                  {t.rationale}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InvestigationsList({ items }: { items: Investigation[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono">
        No open investigations.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li
          key={i.id}
          className="rounded border border-border/60 bg-background/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm text-foreground">{i.title}</div>
            <StatePill state={i.state} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground font-mono">
            {i.rationale}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <span>
              conf {fmt(i.confidenceState.current)}
              <span className="text-muted-foreground/60">
                {" "}
                (Δ {i.confidenceState.delta >= 0 ? "+" : ""}
                {fmt(i.confidenceState.delta)})
              </span>
            </span>
            <span>· triggers {i.triggers.length}</span>
          </div>
          {i.triggers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {i.triggers.map((t, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground"
                >
                  {t.kind} · {fmt(t.metric)}/{fmt(t.threshold)}
                </span>
              ))}
            </div>
          )}
          {i.unresolvedQuestions.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
                Unresolved questions
              </div>
              <ul className="space-y-0.5">
                {i.unresolvedQuestions.map((q, idx) => (
                  <li
                    key={idx}
                    className="text-[11px] font-mono text-foreground/80"
                  >
                    ? {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function EvidenceList({ items }: { items: EvidenceRequest[] }) {
  if (items.length === 0)
    return (
      <p className="text-xs text-muted-foreground font-mono">
        No outstanding evidence requests.
      </p>
    );
  return (
    <ul className="space-y-3">
      {items.map((e) => (
        <li
          key={e.id}
          className="rounded border border-border/60 bg-background/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm text-foreground">
              {e.requestedEvidence}
            </div>
            <div className="flex items-center gap-1">
              <SeverityPill severity={e.priority} />
              <StatePill state={e.state} />
            </div>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground font-mono">
            {e.rationale}
          </div>
          <div className="mt-1 text-[10px] font-mono text-muted-foreground/80">
            method: {e.recommendedValidationMethod} · confidence impact{" "}
            {e.confidenceImpact >= 0 ? "+" : ""}
            {fmt(e.confidenceImpact)}
          </div>
          {e.recommendedQuestions.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {e.recommendedQuestions.map((q, idx) => (
                <li
                  key={idx}
                  className="text-[11px] font-mono text-foreground/70"
                >
                  → {q}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function HypothesesList({ items }: { items: Hypothesis[] }) {
  if (items.length === 0)
    return (
      <p className="text-xs text-muted-foreground font-mono">No hypotheses.</p>
    );
  return (
    <ul className="space-y-3">
      {items.map((h) => (
        <li
          key={h.id}
          className="rounded border border-border/60 bg-background/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm text-foreground">
              {h.statement}
            </div>
            <StatePill state={h.status} />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <ConfBar value={h.confidence} />
            <span className="text-[10px] font-mono text-muted-foreground">
              conf {pct(h.confidence)} · uncertainty {pct(h.uncertaintyLevel)}
            </span>
          </div>
          {(h.supportingEvidence.length > 0 ||
            h.refutingEvidence.length > 0) && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 mb-0.5">
                  Supports
                </div>
                {h.supportingEvidence.map((s, idx) => (
                  <div key={idx} className="text-foreground/80">
                    + {s}
                  </div>
                ))}
                {h.supportingEvidence.length === 0 && (
                  <div className="text-muted-foreground/60">—</div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-red-500/70 mb-0.5">
                  Refutes
                </div>
                {h.refutingEvidence.map((s, idx) => (
                  <div key={idx} className="text-foreground/80">
                    − {s}
                  </div>
                ))}
                {h.refutingEvidence.length === 0 && (
                  <div className="text-muted-foreground/60">—</div>
                )}
              </div>
            </div>
          )}
          {h.competingWith.length > 0 && (
            <div className="mt-2 text-[10px] font-mono text-amber-400/80">
              competing with: {h.competingWith.join(", ")}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function AdversarialList({ items }: { items: AdversarialReview[] }) {
  if (items.length === 0)
    return (
      <p className="text-xs text-muted-foreground font-mono">
        No adversarial reviews.
      </p>
    );
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li
          key={r.id}
          className="rounded border border-border/60 bg-background/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm text-foreground">{r.topic}</div>
            <span className="text-[10px] font-mono text-muted-foreground">
              net Δ {r.netConfidenceImpact >= 0 ? "+" : ""}
              {fmt(r.netConfidenceImpact)}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {r.chains.map((ch) => (
              <div
                key={ch.id}
                className={cn(
                  "rounded border p-2 text-[11px] font-mono",
                  ch.unresolved
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/60 bg-background/30",
                )}
              >
                <div className="text-foreground/80">
                  <span className="text-red-400">challenge:</span>{" "}
                  {ch.challenge.claim}
                </div>
                {ch.rebuttal ? (
                  <div className="mt-1 text-foreground/80">
                    <span className="text-emerald-400">rebuttal:</span>{" "}
                    {ch.rebuttal.claim}
                  </div>
                ) : (
                  <div className="mt-1 text-amber-400">
                    no rebuttal — tension preserved
                  </div>
                )}
              </div>
            ))}
          </div>
          {r.unresolvedTensions.length > 0 && (
            <div className="mt-2 text-[11px] font-mono text-amber-300/80">
              unresolved: {r.unresolvedTensions.join(" · ")}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function EscalationsList({ items }: { items: Escalation[] }) {
  if (items.length === 0)
    return (
      <p className="text-xs text-muted-foreground font-mono">No escalations.</p>
    );
  return (
    <ul className="space-y-2">
      {items.map((e) => (
        <li
          key={e.id}
          className="rounded border border-border/60 bg-background/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm text-foreground">
              {e.escalationReason}
            </div>
            <div className="flex items-center gap-1">
              <SeverityPill severity={e.severity} />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground uppercase tracking-wider">
                {e.recommendedReviewType.replaceAll("-", " ")}
              </span>
            </div>
          </div>
          {e.triggeringSignals.length > 0 && (
            <div className="mt-1 text-[11px] font-mono text-muted-foreground">
              signals: {e.triggeringSignals.join(" · ")}
            </div>
          )}
          {e.blockingQuestions.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {e.blockingQuestions.map((q, idx) => (
                <li
                  key={idx}
                  className="text-[11px] font-mono text-foreground/80"
                >
                  ? {q}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function HumanList({ items }: { items: HumanAnnotation[] }) {
  if (items.length === 0)
    return (
      <p className="text-xs text-muted-foreground font-mono">
        No human annotations.
      </p>
    );
  return (
    <ul className="space-y-2">
      {items.map((h) => (
        <li
          key={h.id}
          className="rounded border border-border/60 bg-background/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-sm text-foreground">
              {h.reviewer}
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground uppercase tracking-wider">
              {h.kind.replaceAll("-", " ")}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            {h.rationale}
          </div>
          <div className="mt-1 text-[10px] font-mono text-muted-foreground/70">
            confidence impact {h.confidenceImpact >= 0 ? "+" : ""}
            {fmt(h.confidenceImpact)}
            {h.targetAgent && <> · target {h.targetAgent}</>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ConsensusPanel({ c }: { c: ConsensusReport }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {c.reviewers.map((r) => (
          <div
            key={r.id}
            className="rounded border border-border/60 bg-background/30 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-foreground">
                {r.name}
              </span>
              <StatePill state={r.recommendation} />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <ConfBar value={r.confidence} />
              <span className="text-[10px] font-mono text-muted-foreground">
                {pct(r.confidence)}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground/80">
              {r.rationale}
            </div>
          </div>
        ))}
      </div>
      {c.reasoningClusters.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">
            Reasoning clusters
          </div>
          <ul className="space-y-1">
            {c.reasoningClusters.map((cl) => (
              <li
                key={cl.id}
                className="text-[11px] font-mono text-foreground/80"
              >
                · <span className="text-primary/80">{cl.label}</span> —{" "}
                {cl.sharedClaim}
                <span className="text-muted-foreground/60">
                  {" "}
                  ({cl.reviewers.length} reviewers, w {fmt(cl.weight)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 mb-0.5">
            Consensus
          </div>
          {c.consensusAreas.length === 0 ? (
            <div className="text-muted-foreground/60">—</div>
          ) : (
            c.consensusAreas.map((a, i) => (
              <div key={i} className="text-foreground/80">
                · {a}
              </div>
            ))
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-red-500/70 mb-0.5">
            Disagreement
          </div>
          {c.disagreementAreas.length === 0 ? (
            <div className="text-muted-foreground/60">—</div>
          ) : (
            c.disagreementAreas.map((a, i) => (
              <div key={i} className="text-foreground/80">
                · {a}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AuditTimeline({
  items,
  caseId,
}: {
  items: AuditEvent[];
  caseId?: string;
}) {
  const filtered = caseId ? items.filter((e) => e.caseId === caseId) : items;
  if (filtered.length === 0)
    return (
      <p className="text-xs text-muted-foreground font-mono">No audit events.</p>
    );
  return (
    <ul className="space-y-1.5">
      {filtered.map((e) => (
        <li
          key={e.id}
          className="grid grid-cols-[10rem_8rem_1fr] gap-2 text-[11px] font-mono"
        >
          <span className="text-muted-foreground/80 truncate">
            {e.at.replace("T", " ").replace(/\..+$/, "")}
          </span>
          <span className="text-primary/80 truncate">{e.kind}</span>
          <span className="text-foreground/80">
            <span className="text-muted-foreground/70">{e.actor}</span> ·{" "}
            {e.summary}
            {typeof e.confidenceBefore === "number" &&
              typeof e.confidenceAfter === "number" && (
                <span className="text-muted-foreground/60">
                  {" "}
                  ({fmt(e.confidenceBefore)} → {fmt(e.confidenceAfter)})
                </span>
              )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Operations() {
  const reportQ = useGetOperationsReport();
  const auditQ = useListOperationsAudit();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const report = reportQ.data as OperationsReport | undefined;
  const audit = (auditQ.data ?? []) as AuditEvent[];

  const cases = useMemo<IntelligenceCase[]>(
    () => report?.cases ?? [],
    [report],
  );
  const selected: IntelligenceCase | null = useMemo(() => {
    if (cases.length === 0) return null;
    if (!selectedId) return cases[0];
    return cases.find((c) => c.id === selectedId) ?? cases[0];
  }, [cases, selectedId]);

  if (reportQ.isLoading || auditQ.isLoading) {
    return (
      <div className="p-2 text-sm font-mono text-muted-foreground">
        Loading intelligence operations…
      </div>
    );
  }
  if (!report) {
    return (
      <div className="p-2 text-sm font-mono text-muted-foreground">
        Operations layer not ready.
      </div>
    );
  }

  const m = report.metrics;

  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Crosshair className="size-5" />
          <h1 className="text-lg font-mono font-semibold tracking-tight">
            Intelligence Operations
          </h1>
        </div>
        <p className="text-xs text-muted-foreground font-mono leading-relaxed max-w-3xl">
          Operationalized uncertainty. Every case keeps disagreement,
          unresolved questions, missing evidence, and competing hypotheses
          first-class. This is not a pipeline — it is the operations layer
          that prevents the system from compressing uncertainty into a
          premature verdict.
        </p>
      </header>

      <Section
        title="Operations metrics"
        icon={Gauge}
        hint="Aggregates across every open case"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Metric label="Cases" value={m.totalCases} />
          <Metric
            label="Open investigations"
            value={m.openInvestigations}
            tone={m.openInvestigations > 0 ? "warn" : "default"}
          />
          <Metric
            label="Pending evidence"
            value={m.pendingEvidenceRequests}
            tone={m.pendingEvidenceRequests > 0 ? "warn" : "default"}
          />
          <Metric
            label="Active escalations"
            value={m.activeEscalations}
            tone={m.activeEscalations > 0 ? "danger" : "default"}
          />
          <Metric
            label="Unresolved hypotheses"
            value={m.unresolvedHypotheses}
          />
          <Metric
            label="Competing pairs"
            value={m.competingHypothesisPairs}
            tone={m.competingHypothesisPairs > 0 ? "warn" : "default"}
          />
          <Metric
            label="Human interventions"
            value={m.humanInterventions}
          />
          <Metric
            label="Avg effective conf."
            value={pct(m.averageEffectiveConfidence)}
            tone={
              m.averageEffectiveConfidence >= 0.6
                ? "good"
                : m.averageEffectiveConfidence >= 0.4
                  ? "warn"
                  : "danger"
            }
          />
        </div>
        {m.prematureCertaintyGuardsTriggered > 0 && (
          <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] font-mono text-amber-300">
            <ShieldAlert className="inline size-3 mr-1" />
            premature-certainty guard triggered on{" "}
            {m.prematureCertaintyGuardsTriggered} case(s) — the system refused
            to declare a confident decision while material uncertainty
            remained.
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(m.casesByDecisionState).map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between rounded border border-border/60 bg-background/30 px-2 py-1"
            >
              <StatePill state={k} />
              <span className="text-[11px] font-mono text-foreground">
                {v}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4">
        <Section
          title="Active cases"
          icon={Activity}
          count={cases.length}
          hint="Ordered by effective confidence"
        >
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {cases.map((c) => (
              <CaseHeader
                key={c.id}
                c={c}
                active={selected?.id === c.id}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
        </Section>

        <div className="space-y-4">
          {selected && (
            <>
              <Section
                title={`Workflow · ${selected.candidateName}`}
                icon={GitBranch}
                hint={selected.targetRole}
              >
                <WorkflowPanel wf={selected.workflow} />
              </Section>

              {(selected.calibrationWarnings.length > 0 ||
                selected.longitudinalUpdates.length > 0) && (
                <Section title="Calibration & longitudinal" icon={AlertTriangle}>
                  {selected.calibrationWarnings.length > 0 && (
                    <div className="space-y-1">
                      {selected.calibrationWarnings.map((w, i) => (
                        <div
                          key={i}
                          className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px] font-mono text-amber-200/90"
                        >
                          ⚠ {w}
                        </div>
                      ))}
                    </div>
                  )}
                  {selected.longitudinalUpdates.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {selected.longitudinalUpdates.map((u, i) => (
                        <li
                          key={i}
                          className="text-[11px] font-mono text-foreground/80"
                        >
                          ↻ {u}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              <Section
                title="Investigations"
                icon={Microscope}
                count={selected.investigations.length}
              >
                <InvestigationsList items={selected.investigations} />
              </Section>

              <Section
                title="Evidence requests"
                icon={FlaskConical}
                count={selected.evidenceRequests.length}
              >
                <EvidenceList items={selected.evidenceRequests} />
              </Section>

              <Section
                title="Hypothesis tracker"
                icon={GitBranch}
                count={selected.hypotheses.length}
                hint="Disagreement preserved"
              >
                <HypothesesList items={selected.hypotheses} />
              </Section>

              <Section
                title="Adversarial review"
                icon={Scale}
                count={selected.adversarialReviews.length}
              >
                <AdversarialList items={selected.adversarialReviews} />
              </Section>

              <Section
                title="Escalations"
                icon={Siren}
                count={selected.escalations.length}
              >
                <EscalationsList items={selected.escalations} />
              </Section>

              <Section
                title="Human oversight"
                icon={UserCheck}
                count={selected.humanAnnotations.length}
              >
                <HumanList items={selected.humanAnnotations} />
              </Section>

              <Section title="Multi-reviewer consensus" icon={Users}>
                <ConsensusPanel c={selected.consensus} />
              </Section>

              <Section
                title="Case audit timeline"
                icon={ScrollText}
                hint="Append-only · provenance complete"
              >
                <AuditTimeline items={audit} caseId={selected.id} />
              </Section>
            </>
          )}
        </div>
      </div>

      <Section
        title="Global operations audit"
        icon={ScrollText}
        count={audit.length}
        hint="Every state change across every case"
      >
        <div className="max-h-[420px] overflow-y-auto pr-1">
          <AuditTimeline items={audit} />
        </div>
      </Section>
    </div>
  );
}
