import React, { useMemo, useState } from "react";
import {
  useGetSecuritySnapshot,
  useGetSecurityReviewer,
} from "@workspace/api-client-react";
import type {
  SecuritySnapshot,
  SecurityReviewerIdentity,
  SecurityVisibilityRecord,
  SecurityAccessDecision,
  SecurityAuditEntry,
  SecuritySensitiveEvidence,
  SecurityBenchmarkResult,
  SecurityCapability,
  SecurityVisibilityLevel,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Shield,
  Building2,
  Users,
  KeyRound,
  Eye,
  Gavel,
  Lock,
  History,
  Beaker,
} from "lucide-react";

const PRIMARY_ORG_ID = "org_e31ded07";

function fmtTime(s: string): string {
  return s.replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "err" | "info" | "founder";
}) {
  const styles = {
    default: "border-border text-muted-foreground",
    ok: "border-emerald-500/40 text-emerald-400",
    warn: "border-amber-500/40 text-amber-400",
    err: "border-red-500/40 text-red-400",
    info: "border-sky-500/40 text-sky-400",
    founder: "border-violet-500/40 text-violet-400",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider",
        styles,
      )}
    >
      {children}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-lg bg-card">
      <header className="px-4 py-3 border-b border-border flex items-start gap-3">
        <Icon className="size-4 mt-0.5 text-primary" />
        <div className="flex-1">
          <h2 className="font-mono text-sm font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function visibilityTone(level: SecurityVisibilityLevel): "ok" | "warn" | "err" | "info" | "default" {
  switch (level) {
    case "demo_public":
    case "benchmark_public":
      return "info";
    case "organization_private":
      return "ok";
    case "investigation_private":
    case "reviewer_private":
      return "warn";
    case "escalation_only":
      return "err";
    default:
      return "default";
  }
}

function OrgBoundariesSection({ snap }: { snap: SecuritySnapshot }) {
  return (
    <Section
      icon={Building2}
      title="Organization boundaries"
      subtitle="Hard tenant isolation. Cross-org reads are refused unless the resource lives in a global_demo or global_benchmark carve-out."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {snap.organizations.map((o) => (
          <div
            key={o.organizationId}
            className="border border-border rounded p-3 bg-secondary/20"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm text-foreground">{o.displayName}</span>
              <Pill tone={o.tier === "founder" ? "founder" : "info"}>{o.tier}</Pill>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono space-y-0.5">
              <div>id: {o.organizationId}</div>
              <div>calibration: {o.calibrationNamespace}</div>
              <div>created: {fmtTime(o.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReviewersSection({ reviewers, onSelect }: {
  reviewers: readonly SecurityReviewerIdentity[];
  onSelect: (id: string) => void;
}) {
  return (
    <Section
      icon={Users}
      title="Reviewer identities"
      subtitle="Deterministic identity + capability bundle per reviewer. Click to inspect recent decisions."
    >
      <div className="space-y-2">
        {reviewers.map((r) => (
          <button
            key={r.reviewerId}
            onClick={() => onSelect(r.reviewerId)}
            className="w-full text-left border border-border rounded p-3 bg-secondary/10 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm text-foreground">{r.displayName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {r.reviewerId} · fp:{r.fingerprint}
                  {r.scopedToInvestigationId
                    ? ` · scoped:${r.scopedToInvestigationId}`
                    : ""}
                </div>
              </div>
              <Pill tone={r.reviewerType === "founder" ? "founder" : "info"}>
                {r.reviewerType}
              </Pill>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {r.capabilities.map((c) => (
                <Pill key={c} tone="default">{c}</Pill>
              ))}
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}

function CapabilitiesSection({
  capabilities,
  reviewers,
}: {
  capabilities: readonly SecurityCapability[];
  reviewers: readonly SecurityReviewerIdentity[];
}) {
  return (
    <Section
      icon={KeyRound}
      title="Capability explorer"
      subtitle="Capability-based access (not role-based). Each capability is a token; the access engine asks for the specific capability required by an action."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {capabilities.map((c) => {
          const holders = reviewers.filter((r) => r.capabilities.includes(c));
          return (
            <div key={c} className="border border-border rounded p-3 bg-secondary/10">
              <div className="font-mono text-xs text-foreground mb-1">{c}</div>
              <div className="text-[11px] text-muted-foreground">
                {holders.length === 0
                  ? "no holders"
                  : `held by: ${holders.map((h) => h.displayName).join(", ")}`}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function VisibilitySection({ visibility }: { visibility: readonly SecurityVisibilityRecord[] }) {
  return (
    <Section
      icon={Eye}
      title="Intelligence visibility graph"
      subtitle="Per-resource visibility level. History is append-only — every change is auditable."
    >
      <div className="space-y-2">
        {visibility.length === 0 && (
          <p className="text-xs text-muted-foreground">No resources visible.</p>
        )}
        {visibility.map((v) => (
          <div
            key={v.resourceId}
            className="border border-border rounded p-2 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="font-mono text-xs text-foreground truncate">
                {v.resourceId}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {v.resourceKind} · changed by {v.changedBy} @ {fmtTime(v.changedAt)}
                {v.previousLevel ? ` · was ${v.previousLevel}` : ""}
              </div>
              <div className="text-[10px] text-muted-foreground italic mt-0.5">
                reason: {v.reason}
              </div>
            </div>
            <Pill tone={visibilityTone(v.level)}>{v.level}</Pill>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DecisionInspector({ decisions }: { decisions: readonly SecurityAccessDecision[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    decisions[decisions.length - 1]?.decisionId ?? null,
  );
  const selected = useMemo(
    () => decisions.find((d) => d.decisionId === selectedId) ?? null,
    [decisions, selectedId],
  );
  return (
    <Section
      icon={Gavel}
      title="Access decision inspector"
      subtitle="Every decision through the central AccessDecisionEngine — rules evaluated in order, every rule passes or fails."
    >
      {decisions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No decisions yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {decisions.map((d) => (
              <button
                key={d.decisionId}
                onClick={() => setSelectedId(d.decisionId)}
                className={cn(
                  "w-full text-left border rounded p-2 transition-colors",
                  d.decisionId === selectedId
                    ? "border-primary/60 bg-primary/5"
                    : "border-border bg-secondary/10 hover:bg-secondary/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground truncate">
                    {d.action} → {d.targetResource}
                  </span>
                  <Pill tone={d.allowed ? "ok" : "err"}>
                    {d.allowed ? "allowed" : "denied"}
                  </Pill>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {d.reviewerId} · {fmtTime(d.timestamp)}
                </div>
              </button>
            ))}
          </div>
          <div className="border border-border rounded p-3 bg-secondary/10">
            {selected ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-foreground">
                    {selected.decisionId}
                  </span>
                  <Pill tone={selected.allowed ? "ok" : "err"}>
                    {selected.allowed ? "allowed" : "denied"}
                  </Pill>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mb-3">
                  reason: {selected.reason}
                </div>
                <div className="space-y-1">
                  {selected.evaluatedRules.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-[11px] font-mono"
                    >
                      <Pill tone={r.passed ? "ok" : "err"}>{r.passed ? "✓" : "✗"}</Pill>
                      <span className="text-foreground">{r.rule}</span>
                      <span className="text-muted-foreground">— {r.detail}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Select a decision.</p>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

function SensitiveSection({ sensitive }: { sensitive: readonly SecuritySensitiveEvidence[] }) {
  return (
    <Section
      icon={Lock}
      title="Sensitive evidence viewer"
      subtitle="All callers see the redacted view here. Full views are gated by view_sensitive_evidence and produce an audit entry."
    >
      <div className="space-y-2">
        {sensitive.length === 0 && (
          <p className="text-xs text-muted-foreground">No sensitive evidence registered.</p>
        )}
        {sensitive.map((s) => (
          <div key={s.evidenceId} className="border border-border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-foreground">{s.evidenceId}</span>
              <Pill tone="err">{s.sensitivity}</Pill>
            </div>
            <div className="text-[12px] text-foreground">{s.redactedSummary}</div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              provenance: {s.provenance.sourceKind}/{s.provenance.sourceId}
              {" · "}
              audited reads: {s.accessAuditIds.length}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AuditSection({ entries }: { entries: readonly SecurityAuditEntry[] }) {
  return (
    <Section
      icon={History}
      title="Audit timeline"
      subtitle="Append-only. Per-org monotonic sequence. Holes or rewrites are detectable."
    >
      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {entries.map((e) => (
          <div
            key={e.entryId}
            className="border border-border rounded p-2 flex items-start gap-2"
          >
            <span className="font-mono text-[10px] text-muted-foreground w-8 text-right shrink-0">
              #{e.sequence}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Pill tone={e.kind.includes("denied") ? "err" : "info"}>{e.kind}</Pill>
                <span className="font-mono text-[11px] text-foreground truncate">
                  {e.targetResource}
                </span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {e.reviewerId ?? "system"} · {fmtTime(e.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BenchmarksSection({ results }: { results: readonly SecurityBenchmarkResult[] }) {
  const passed = results.filter((r) => r.passed).length;
  return (
    <Section
      icon={Beaker}
      title="Security benchmark panel"
      subtitle={`Deterministic scenarios that probe the access engine. ${passed}/${results.length} expected outcomes confirmed.`}
    >
      <div className="space-y-2">
        {results.map((r) => (
          <div key={r.scenarioId} className="border border-border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm text-foreground">{r.displayName}</span>
              <Pill tone={r.passed ? "ok" : "err"}>
                {r.passed ? "pass" : "fail"} · {r.actualOutcome}
              </Pill>
            </div>
            <div className="text-[11px] text-muted-foreground">{r.description}</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              decision: {r.decision.decisionId} · reason: {r.decision.reason}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReviewerDetailPanel({ reviewerId, onClose }: {
  reviewerId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useGetSecurityReviewer(reviewerId);
  return (
    <div className="border border-primary/60 rounded-lg bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm text-foreground">
          Reviewer detail · {reviewerId}
        </span>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          close ×
        </button>
      </div>
      {isLoading || !data ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3 text-xs">
          <div>
            <span className="font-mono text-muted-foreground">capabilities: </span>
            <span className="font-mono text-foreground">
              {data.reviewer.capabilities.join(", ")}
            </span>
          </div>
          <div>
            <div className="font-mono text-muted-foreground mb-1">
              recent decisions ({data.recentDecisions.length})
            </div>
            <div className="space-y-1">
              {data.recentDecisions.map((d) => (
                <div
                  key={d.decisionId}
                  className="font-mono text-[11px] flex items-center gap-2"
                >
                  <Pill tone={d.allowed ? "ok" : "err"}>
                    {d.allowed ? "allow" : "deny"}
                  </Pill>
                  <span>{d.action}</span>
                  <span className="text-muted-foreground">→ {d.targetResource}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-mono text-muted-foreground mb-1">
              recent audit ({data.recentAudit.length})
            </div>
            <div className="space-y-1">
              {data.recentAudit.slice(-10).map((e) => (
                <div key={e.entryId} className="font-mono text-[11px]">
                  #{e.sequence} {e.kind} → {e.targetResource}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Security() {
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
  const { data, isLoading, error } = useGetSecuritySnapshot(PRIMARY_ORG_ID);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading security snapshot…</div>;
  }
  if (error || !data) {
    return (
      <div className="text-sm text-red-400">
        Failed to load security snapshot.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="size-10 rounded bg-primary/10 border border-primary/40 flex items-center justify-center text-primary">
          <Shield className="size-5" />
        </div>
        <div>
          <h1 className="font-mono text-xl font-bold text-foreground tracking-tight">
            Identity & multi-tenant security
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provenance-first, audit-first, deterministic. No silent cross-org access.
          </p>
        </div>
      </header>

      <OrgBoundariesSection snap={data} />
      <ReviewersSection reviewers={data.reviewers} onSelect={setSelectedReviewer} />
      {selectedReviewer && (
        <ReviewerDetailPanel
          reviewerId={selectedReviewer}
          onClose={() => setSelectedReviewer(null)}
        />
      )}
      <CapabilitiesSection capabilities={data.capabilities} reviewers={data.reviewers} />
      <VisibilitySection visibility={data.visibility} />
      <DecisionInspector decisions={data.recentDecisions} />
      <SensitiveSection sensitive={data.sensitive} />
      <AuditSection entries={data.recentAudit} />
      <BenchmarksSection results={data.benchmarkResults} />
    </div>
  );
}
