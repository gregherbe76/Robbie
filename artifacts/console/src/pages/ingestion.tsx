import React, { useMemo, useState } from "react";
import { useGetIngestionState } from "@workspace/api-client-react";
import type {
  IngestionStateResponse,
  CandidatePipelineResult,
  OrganizationPipelineResult,
  IngestionJob,
  IngestionEvidenceItem,
  IngestionSourceReliability,
  IngestionEvidenceConflict,
  IngestionAuditEntry,
  IngestionProvenance,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Inbox,
  FileStack,
  Network,
  Scale,
  AlertTriangle,
  Fingerprint,
  GitBranch,
  MessageSquare,
  Code2,
  CheckCircle2,
  Activity,
} from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function f3(n: number): string {
  return n.toFixed(3);
}

function ConfBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "warn" | "ok" }) {
  const w = Math.max(2, Math.round(value * 100));
  const color =
    tone === "ok"
      ? "bg-emerald-500/70"
      : tone === "warn"
        ? "bg-amber-500/70"
        : "bg-primary/70";
  return (
    <div className="inline-flex items-center gap-1.5 align-middle">
      <div className="w-16 h-1.5 rounded bg-secondary/60 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${w}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
        {f3(value)}
      </span>
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "err" | "info";
}) {
  const styles = {
    default: "border-border text-muted-foreground",
    ok: "border-emerald-500/40 text-emerald-400",
    warn: "border-amber-500/40 text-amber-400",
    err: "border-red-500/40 text-red-400",
    info: "border-sky-500/40 text-sky-400",
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
  title,
  icon: Icon,
  hint,
  count,
  children,
}: {
  title: string;
  icon: React.ElementType;
  hint?: string;
  count?: number;
  children: React.ReactNode;
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
          <div className="text-[10px] font-mono text-muted-foreground/70">{hint}</div>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// =============================================================================
// Sections
// =============================================================================

function JobsSection({ jobs }: { jobs: IngestionJob[] }) {
  return (
    <Section
      title="Ingestion jobs"
      icon={Inbox}
      count={jobs.length}
      hint="deterministic · replayable"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead className="text-muted-foreground/70 text-[10px] uppercase tracking-wider">
            <tr className="border-b border-border/40">
              <th className="text-left py-2 pr-3">Job</th>
              <th className="text-left py-2 pr-3">Kind</th>
              <th className="text-left py-2 pr-3">Subject</th>
              <th className="text-left py-2 pr-3">Sources</th>
              <th className="text-right py-2 pr-3">Evidence</th>
              <th className="text-right py-2 pr-3">Conflicts</th>
              <th className="text-right py-2 pr-3">Warnings</th>
              <th className="text-left py-2 pr-3">Reliability</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-border/20 last:border-0">
                <td className="py-2 pr-3 text-foreground/80 truncate max-w-[160px]" title={j.id}>
                  {j.id.slice(0, 14)}…
                </td>
                <td className="py-2 pr-3"><Pill tone="info">{j.kind}</Pill></td>
                <td className="py-2 pr-3 text-foreground/80">{j.subjectId}</td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {j.sourceKinds.join(", ")}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{j.evidenceCount}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {j.conflictCount > 0 ? (
                    <span className="text-amber-400">{j.conflictCount}</span>
                  ) : (
                    j.conflictCount
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{j.warningCount}</td>
                <td className="py-2 pr-3">
                  <ConfBar value={j.reliabilityAverage} />
                </td>
                <td className="py-2">
                  <Pill tone={j.status === "succeeded" ? "ok" : "warn"}>{j.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function RawEvidenceSection({ evidence }: { evidence: IngestionEvidenceItem[] }) {
  return (
    <Section
      title="Raw evidence explorer"
      icon={FileStack}
      count={evidence.length}
      hint="claim · confidence · reliability · ambiguity"
    >
      <ul className="flex flex-col gap-2">
        {evidence.map((ev) => (
          <li
            key={ev.id}
            className="rounded border border-border/60 bg-background/40 p-3 text-xs"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Pill tone="info">{ev.kind}</Pill>
                <span className="font-mono text-foreground/90">{ev.claim}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 font-mono">
                via {ev.provenance.producedBy}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono">
              <span className="text-muted-foreground">
                conf <ConfBar value={ev.confidence} />
              </span>
              <span className="text-muted-foreground">
                rel <ConfBar value={ev.reliability} tone="ok" />
              </span>
              {ev.ambiguity.length > 0 && (
                <span className="text-amber-400">
                  ambig: {ev.ambiguity.join(" · ")}
                </span>
              )}
              <span className="text-muted-foreground/70 truncate max-w-[260px]" title={ev.rawReference.locator}>
                {ev.rawReference.locator}
              </span>
            </div>
            {ev.rawReference.excerpt && (
              <blockquote className="mt-2 border-l-2 border-border/60 pl-2 text-muted-foreground italic">
                “{ev.rawReference.excerpt}”
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function NormalizedGraphSection({ candidate }: { candidate: CandidatePipelineResult }) {
  const c = candidate.normalizedCandidate;
  return (
    <Section
      title="Normalized evidence graph"
      icon={Network}
      hint={c.displayName}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            Roles
          </div>
          <ul className="flex flex-col gap-1.5">
            {c.roles.map((r, i) => (
              <li key={i} className="rounded border border-border/60 bg-background/40 px-2 py-1.5">
                <div className="font-mono text-foreground/90">
                  {r.title} <span className="text-muted-foreground">@ {r.organization}</span>
                </div>
                <div className="text-[10px] text-muted-foreground/80 font-mono flex items-center justify-between">
                  <span>
                    {r.startedAt ?? "?"} → {r.endedAt ?? "present"}
                  </span>
                  <ConfBar value={r.confidence} />
                </div>
                {r.ambiguity.length > 0 && (
                  <div className="mt-1 text-[10px] text-amber-400 font-mono">
                    {r.ambiguity.join(" · ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            Skills
          </div>
          <ul className="flex flex-col gap-1">
            {c.skills.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs font-mono">
                <span className="text-foreground/90">{s.name}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/70">
                    {s.sources.join("·")}
                  </span>
                  <ConfBar value={s.confidence} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            Unknowns (never interpolated)
          </div>
          {c.unknowns.length === 0 ? (
            <div className="text-[10px] text-muted-foreground/70 font-mono">
              none recorded
            </div>
          ) : (
            <ul className="flex flex-col gap-1 text-xs font-mono">
              {c.unknowns.map((u, i) => (
                <li key={i} className="text-amber-400">· {u}</li>
              ))}
            </ul>
          )}
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mt-4 mb-2">
            Education
          </div>
          <ul className="flex flex-col gap-1 text-xs font-mono">
            {c.education.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-foreground/90">
                  {e.credential ?? "—"} · {e.institution}
                </span>
                <ConfBar value={e.confidence} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function ReliabilitySection({ items }: { items: IngestionSourceReliability[] }) {
  return (
    <Section
      title="Source reliability"
      icon={Scale}
      count={items.length}
      hint="factor deltas · explainable"
    >
      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.rawId} className="rounded border border-border/60 bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Pill tone="info">{r.sourceKind}</Pill>
                <span className="font-mono text-xs text-foreground/80">{r.rawId}</span>
              </div>
              <ConfBar value={r.reliabilityScore} tone="ok" />
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mb-2">
              {r.rationale}
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {r.reliabilityFactors.map((f, i) => (
                <li
                  key={i}
                  className={cn(
                    "px-1.5 py-0.5 rounded border text-[10px] font-mono",
                    f.delta >= 0
                      ? "border-emerald-500/30 text-emerald-400"
                      : "border-red-500/30 text-red-400",
                  )}
                  title={f.rationale}
                >
                  {f.factor}{" "}
                  <span className="tabular-nums">
                    {f.delta >= 0 ? "+" : ""}
                    {f3(f.delta)}
                  </span>
                </li>
              ))}
            </ul>
            {r.uncertainty.length > 0 && (
              <div className="mt-2 text-[10px] text-amber-400 font-mono">
                uncertainty: {r.uncertainty.join(" · ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ConflictsSection({ conflicts }: { conflicts: IngestionEvidenceConflict[] }) {
  return (
    <Section
      title="Conflicts"
      icon={AlertTriangle}
      count={conflicts.length}
      hint="never silently resolved"
    >
      {conflicts.length === 0 ? (
        <div className="text-xs text-muted-foreground font-mono">
          No contradictions detected across current evidence.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {conflicts.map((c) => (
            <li key={c.id} className="rounded border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-xs text-foreground/90">{c.description}</span>
                <Pill tone={c.severity === "high" ? "err" : c.severity === "medium" ? "warn" : "info"}>
                  {c.severity}
                </Pill>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                impacted: {c.impactedEvidenceIds.length} evidence ·{" "}
                {c.recommendedInvestigation}
              </div>
              {c.unresolvedQuestions.length > 0 && (
                <ul className="mt-1 text-[10px] text-amber-400 font-mono">
                  {c.unresolvedQuestions.map((q, i) => (
                    <li key={i}>? {q}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ProvenanceSection({ chain }: { chain: IngestionProvenance[] }) {
  return (
    <Section
      title="Provenance chain"
      icon={Fingerprint}
      count={chain.length}
      hint="who produced what · derivedFrom"
    >
      <ol className="flex flex-col gap-1.5">
        {chain.map((p, i) => (
          <li
            key={i}
            className="flex items-center gap-2 text-xs font-mono border border-border/40 rounded px-2 py-1.5 bg-background/30"
          >
            <span className="text-muted-foreground/70 tabular-nums w-6 text-right">
              {i + 1}.
            </span>
            <span className="text-foreground/90">{p.producedBy}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-[10px] text-muted-foreground">{p.producedAt}</span>
            {p.rationale && (
              <span className="text-[10px] text-muted-foreground/70 truncate">
                — {p.rationale}
              </span>
            )}
            {p.derivedFrom && p.derivedFrom.length > 0 && (
              <span className="ml-auto text-[10px] text-sky-400">
                ← {p.derivedFrom.length} src
              </span>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function LineageSection({
  evidence,
  audit,
}: {
  evidence: IngestionEvidenceItem[];
  audit: IngestionAuditEntry[];
}) {
  const byId = useMemo(() => {
    const m = new Map<string, IngestionEvidenceItem>();
    for (const ev of evidence) m.set(ev.id, ev);
    return m;
  }, [evidence]);

  return (
    <Section
      title="Lineage & audit"
      icon={GitBranch}
      count={audit.length}
      hint="append-only · replayable"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            Evidence lineage
          </div>
          <ul className="flex flex-col gap-1 text-xs font-mono">
            {evidence.map((ev) => {
              const parents = (ev.derivedFromEvidenceIds ?? [])
                .map((id) => byId.get(id)?.claim ?? id)
                .filter(Boolean);
              return (
                <li
                  key={ev.id}
                  className="border border-border/40 rounded px-2 py-1 bg-background/30"
                >
                  <div className="text-foreground/90 truncate">{ev.claim}</div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {parents.length === 0 ? (
                      <span>root · {ev.provenance.producedBy}</span>
                    ) : (
                      <>← {parents.join(" · ")}</>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            Audit stream
          </div>
          <ol className="flex flex-col gap-1 text-[11px] font-mono max-h-[420px] overflow-y-auto pr-1">
            {audit.map((a) => (
              <li
                key={a.id}
                className="border border-border/30 rounded px-2 py-1 bg-background/20"
              >
                <div className="flex items-center gap-2">
                  <Pill tone="info">{a.type}</Pill>
                  <span className="text-muted-foreground/70 text-[10px]">
                    {a.sourceKind}
                  </span>
                </div>
                <div className="text-foreground/80 truncate">{a.detail}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}

function TranscriptSection({ evidence }: { evidence: IngestionEvidenceItem[] }) {
  const transcriptEv = evidence.filter(
    (e) => e.provenance.producedBy === "ingestion.transcript",
  );
  return (
    <Section
      title="Transcript explorer"
      icon={MessageSquare}
      count={transcriptEv.length}
      hint="reasoning · uncertainty · ownership · contradictions"
    >
      {transcriptEv.length === 0 ? (
        <div className="text-xs text-muted-foreground font-mono">
          No interview transcripts ingested yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {transcriptEv.map((ev) => (
            <li
              key={ev.id}
              className="rounded border border-border/60 bg-background/40 p-2.5 text-xs"
            >
              <div className="flex items-center gap-2 mb-1">
                <Pill tone="info">{ev.kind}</Pill>
                <span className="font-mono text-foreground/90">{ev.claim}</span>
              </div>
              {ev.rawReference.excerpt && (
                <blockquote className="border-l-2 border-border/60 pl-2 text-muted-foreground italic">
                  “{ev.rawReference.excerpt}”
                </blockquote>
              )}
              <div className="mt-1 flex items-center gap-3 text-[10px] font-mono">
                <span>conf <ConfBar value={ev.confidence} /></span>
                {ev.ambiguity.length > 0 && (
                  <span className="text-amber-400">
                    {ev.ambiguity.join(" · ")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function GitHubSection({ evidence }: { evidence: IngestionEvidenceItem[] }) {
  const ghEv = evidence.filter((e) => e.provenance.producedBy === "ingestion.github");
  return (
    <Section
      title="GitHub explorer"
      icon={Code2}
      count={ghEv.length}
      hint="ownership · complexity · architecture (never vanity)"
    >
      {ghEv.length === 0 ? (
        <div className="text-xs text-muted-foreground font-mono">
          No GitHub evidence ingested yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ghEv.map((ev) => {
            const attrs = ev.attributes as Record<string, unknown>;
            return (
              <li
                key={ev.id}
                className="rounded border border-border/60 bg-background/40 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-foreground/90 truncate">
                    {ev.claim}
                  </span>
                  <Pill tone="info">{ev.kind}</Pill>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {Object.entries(attrs)
                    .filter(([k]) => k !== "source")
                    .slice(0, 6)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join(" · ")}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] font-mono">
                  <span>conf <ConfBar value={ev.confidence} /></span>
                  {ev.ambiguity.length > 0 && (
                    <span className="text-amber-400">{ev.ambiguity.join(" · ")}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// =============================================================================

export function Ingestion() {
  const { data, isLoading, error } = useGetIngestionState();
  const state = data as IngestionStateResponse | undefined;
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const selectedCandidate: CandidatePipelineResult | null = useMemo(() => {
    if (!state?.candidates?.length) return null;
    const id = selectedCandidateId ?? state.candidates[0].candidateId;
    return state.candidates.find((c) => c.candidateId === id) ?? state.candidates[0];
  }, [state, selectedCandidateId]);

  const selectedOrg: OrganizationPipelineResult | null = useMemo(() => {
    return state?.organizations?.[0] ?? null;
  }, [state]);

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground font-mono">
        Loading ingestion state…
      </div>
    );
  }
  if (error || !state) {
    return (
      <div className="text-xs text-red-400 font-mono">
        Failed to load ingestion state.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-mono tracking-tight text-foreground">
            Real-world ingestion
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1 max-w-2xl">
            The boundary between the outside world and the cognition layer. Every
            envelope here carries explicit provenance, reliability, and
            uncertainty. No hidden inference, no hallucinated enrichment, no
            silent overwrites.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <Pill tone="ok">
            <CheckCircle2 className="size-3" /> {state.jobs.length} jobs
          </Pill>
          <Pill tone="info">
            <Activity className="size-3" /> {state.supportedSourceKinds.length} adapters
          </Pill>
        </div>
      </header>

      <JobsSection jobs={state.jobs} />

      {state.candidates.length > 1 && (
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted-foreground">candidate:</span>
          {state.candidates.map((c) => (
            <button
              key={c.candidateId}
              onClick={() => setSelectedCandidateId(c.candidateId)}
              className={cn(
                "px-2 py-1 rounded border",
                selectedCandidate?.candidateId === c.candidateId
                  ? "border-primary/60 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.normalizedCandidate.displayName}
            </button>
          ))}
        </div>
      )}

      {selectedCandidate && (
        <>
          <NormalizedGraphSection candidate={selectedCandidate} />
          <RawEvidenceSection evidence={selectedCandidate.extractedEvidence} />
          <ReliabilitySection items={selectedCandidate.sourceReliability} />
          <ConflictsSection conflicts={selectedCandidate.conflicts} />
          <ProvenanceSection chain={selectedCandidate.provenanceChain} />
          <LineageSection
            evidence={selectedCandidate.extractedEvidence}
            audit={selectedCandidate.audit}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TranscriptSection evidence={selectedCandidate.extractedEvidence} />
            <GitHubSection evidence={selectedCandidate.extractedEvidence} />
          </div>
        </>
      )}

      {selectedOrg && (
        <Section
          title="Organization context"
          icon={Network}
          hint={selectedOrg.normalizedOrganization.displayName}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                Fields
              </div>
              <ul className="flex flex-col gap-1">
                {selectedOrg.normalizedOrganization.fields.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 border border-border/40 rounded px-2 py-1 font-mono"
                  >
                    <span>
                      <span className="text-muted-foreground">{f.field}</span>{" "}
                      <span className="text-foreground/90">= {f.value}</span>
                    </span>
                    <ConfBar value={f.confidence} />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                Unknowns (never interpolated)
              </div>
              {selectedOrg.normalizedOrganization.unknowns.length === 0 ? (
                <div className="text-[10px] text-muted-foreground/70 font-mono">
                  none recorded
                </div>
              ) : (
                <ul className="flex flex-col gap-1 font-mono">
                  {selectedOrg.normalizedOrganization.unknowns.map((u, i) => (
                    <li key={i} className="text-amber-400">· {u}</li>
                  ))}
                </ul>
              )}
              {selectedOrg.conflicts.length > 0 && (
                <div className="mt-3 text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                  Organization conflicts ({selectedOrg.conflicts.length})
                </div>
              )}
              <ul className="flex flex-col gap-1 font-mono">
                {selectedOrg.conflicts.map((c) => (
                  <li key={c.id} className="text-amber-400 text-[11px]">
                    · {c.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
