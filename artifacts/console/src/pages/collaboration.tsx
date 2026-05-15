import React, { useMemo, useState } from "react";
import {
  useGetCollaborationState,
  useGetCollaborationCase,
  useGetCollaborationReviewerCalibration,
} from "@workspace/api-client-react";
import type {
  CollaborationStateResponse,
  CollaborationReviewerIdentity,
  CollaborativeCase,
  CollaborationReviewerAction,
  CollaborationDisagreement,
  CollaborationDisagreementPosition,
  CollaborationEvidenceReviewEntry,
  CollaborationOverrideRecord,
  CollaborationAuditEntry,
  CollaborationDecisionTimeline,
  CollaborationReviewerCalibrationReport,
  CollaborationOrganizationalReasoningMemory,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Users,
  Gavel,
  Split,
  ShieldAlert,
  ClipboardCheck,
  Activity,
  Network,
  Brain,
  History,
} from "lucide-react";

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n * 100)}%`;
}
function f2(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}
function f3(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(3);
}
function fmtTime(s: string): string {
  return s.replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function ConfBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "warn" | "ok" | "err";
}) {
  const w = Math.max(2, Math.round(value * 100));
  const color =
    tone === "ok"
      ? "bg-emerald-500/70"
      : tone === "warn"
        ? "bg-amber-500/70"
        : tone === "err"
          ? "bg-red-500/70"
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
          {subtitle ? (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function caseStateTone(
  s: CollaborativeCase["state"],
): "default" | "ok" | "warn" | "err" | "info" {
  switch (s) {
    case "consensus_reached":
      return "ok";
    case "disagreement_active":
    case "escalation_required":
      return "warn";
    case "unresolved":
      return "err";
    case "awaiting_review":
    case "under_investigation":
      return "info";
    case "archived":
      return "default";
    default:
      return "default";
  }
}

function severityTone(
  s: CollaborationDisagreement["severity"],
): "default" | "ok" | "warn" | "err" | "info" {
  switch (s) {
    case "minor":
      return "info";
    case "moderate":
      return "warn";
    case "major":
      return "warn";
    case "blocking":
      return "err";
    default:
      return "default";
  }
}

function ReviewersSection({
  reviewers,
}: {
  reviewers: CollaborationReviewerIdentity[];
}) {
  return (
    <Section
      icon={Users}
      title="Reviewers"
      subtitle="Identity, expertise, contextual calibration, and confidence patterns — never collapsed to a score"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reviewers.map((r) => (
          <div
            key={r.reviewerId}
            className="border border-border rounded-md p-3 bg-background/40"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-mono text-sm font-semibold text-foreground">
                {r.displayName}
              </div>
              <Pill tone="info">{r.reviewerType.replace(/_/g, " ")}</Pill>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {r.reviewerId}
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {r.expertiseAreas.map((a) => (
                <span
                  key={a}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground"
                >
                  {a}
                </span>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="text-muted-foreground">mean conf</div>
              <ConfBar value={r.confidencePatterns.meanConfidence} />
              <div className="text-muted-foreground">conf variance</div>
              <span className="font-mono tabular-nums">
                {f3(r.confidencePatterns.confidenceVariance)}
              </span>
              <div className="text-muted-foreground">uncertainty expr</div>
              <ConfBar
                value={r.confidencePatterns.uncertaintyExpressionRate}
                tone="ok"
              />
              <div className="text-muted-foreground">evidence seeking</div>
              <ConfBar
                value={r.confidencePatterns.evidenceSeekingRate}
                tone="ok"
              />
            </div>

            <div className="mt-3 border-t border-border/50 pt-2">
              <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
                contextual calibration
              </div>
              <table className="w-full text-[11px]">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left font-normal">domain</th>
                    <th className="text-right font-normal">brier</th>
                    <th className="text-right font-normal">over-conf</th>
                    <th className="text-right font-normal">n</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {r.calibrationProfile.map((p) => (
                    <tr key={p.domain}>
                      <td>{p.domain}</td>
                      <td className="text-right">{f3(p.brier)}</td>
                      <td className="text-right">{f3(p.overconfidence)}</td>
                      <td className="text-right">{p.sampleSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 border-t border-border/50 pt-2 grid grid-cols-2 gap-1 text-[11px]">
              <div className="text-muted-foreground">cases</div>
              <span className="font-mono tabular-nums">
                {r.historicalDecisionStats.totalCases}
              </span>
              <div className="text-muted-foreground">agree w/ consensus</div>
              <span className="font-mono tabular-nums">
                {r.historicalDecisionStats.agreementsWithConsensus}
              </span>
              <div className="text-muted-foreground">disagree w/ consensus</div>
              <span className="font-mono tabular-nums">
                {r.historicalDecisionStats.disagreementsWithConsensus}
              </span>
              <div className="text-muted-foreground">overrides issued</div>
              <span className="font-mono tabular-nums">
                {r.historicalDecisionStats.overridesIssued}
              </span>
              <div className="text-muted-foreground">override success</div>
              <span className="font-mono tabular-nums">
                {pct(r.historicalDecisionStats.overrideSuccessRate)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CasesSection({
  cases,
  selected,
  onSelect,
}: {
  cases: CollaborativeCase[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Section
      icon={ClipboardCheck}
      title="Collaborative cases"
      subtitle="Open decisions. Click a row to load full reasoning bundle, lineage, and audit trail."
    >
      <table className="w-full text-xs">
        <thead className="text-muted-foreground border-b border-border">
          <tr>
            <th className="text-left font-medium py-2">Title</th>
            <th className="text-left font-medium">Subject</th>
            <th className="text-left font-medium">State</th>
            <th className="text-left font-medium">Anchor</th>
            <th className="text-left font-medium">Reviewers</th>
            <th className="text-left font-medium">Opened</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {cases.map((c) => (
            <tr
              key={c.caseId}
              data-testid={`case-row-${c.caseId}`}
              onClick={() => onSelect(c.caseId)}
              className={cn(
                "border-b border-border/40 cursor-pointer hover:bg-secondary/40",
                selected === c.caseId && "bg-secondary/60",
              )}
            >
              <td className="py-2 pr-2 text-foreground">{c.title}</td>
              <td className="pr-2 text-muted-foreground">
                {c.subject.subjectDisplayName}
                <div className="text-[10px]">{c.subject.subjectKind}</div>
              </td>
              <td className="pr-2">
                <Pill tone={caseStateTone(c.state)}>
                  {c.state.replace(/_/g, " ")}
                </Pill>
              </td>
              <td className="pr-2 text-muted-foreground max-w-[260px] truncate">
                {c.anchoringRecommendation?.summary ?? "—"}
                {c.anchoringRecommendation ? (
                  <ConfBar value={c.anchoringRecommendation.confidence} />
                ) : null}
              </td>
              <td className="pr-2 text-muted-foreground tabular-nums">
                {c.invitedReviewers.length}
              </td>
              <td className="pr-2 text-muted-foreground tabular-nums text-[10px]">
                {fmtTime(c.openedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function ReasoningSection({
  actions,
  reviewerName,
}: {
  actions: CollaborationReviewerAction[];
  reviewerName: (id: string) => string;
}) {
  if (actions.length === 0) {
    return (
      <Section icon={Brain} title="Reasoning trail" subtitle="No reviewer actions for this case.">
        <div className="text-xs text-muted-foreground">Select a case to view reasoning.</div>
      </Section>
    );
  }
  return (
    <Section
      icon={Brain}
      title="Reasoning trail"
      subtitle="Provenance-first: every action carries rationale, confidence, ambiguity markers, and derivedFrom."
    >
      <ol className="space-y-2">
        {actions.map((a) => (
          <li
            key={a.actionId}
            className="border border-border rounded-md p-2 bg-background/40"
          >
            <div className="flex items-start gap-2 flex-wrap">
              <Pill tone="info">{a.kind.replace(/_/g, " ")}</Pill>
              <span className="text-xs font-mono text-foreground">
                {reviewerName(a.reviewerId)}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                → {a.target.kind}:{a.target.id}
              </span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
                {fmtTime(a.timestamp)}
              </span>
            </div>
            <div className="mt-1.5 text-xs text-foreground/90">{a.rationale}</div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
                confidence
              </span>
              <ConfBar value={a.confidence} />
              {a.ambiguityMarkers.length > 0 && (
                <>
                  <span className="text-[10px] uppercase font-mono text-amber-400/80 tracking-wider ml-2">
                    ambiguity
                  </span>
                  {a.ambiguityMarkers.map((m) => (
                    <Pill key={m} tone="warn">
                      {m}
                    </Pill>
                  ))}
                </>
              )}
              {a.derivedFrom.length > 0 && (
                <>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider ml-2">
                    derivedFrom
                  </span>
                  {a.derivedFrom.map((d) => (
                    <span
                      key={d}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground"
                    >
                      {d}
                    </span>
                  ))}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function PositionRow({
  pos,
  reviewerName,
}: {
  pos: CollaborationDisagreementPosition;
  reviewerName: (id: string) => string;
}) {
  return (
    <li className="border border-border rounded p-2 bg-background/40">
      <div className="flex items-center gap-2 flex-wrap">
        <Pill tone={pos.holderKind === "agent" ? "info" : "default"}>
          {pos.holderKind}
        </Pill>
        <span className="font-mono text-xs">
          {pos.holderKind === "reviewer" ? reviewerName(pos.holderId) : pos.holderId}
        </span>
        <ConfBar value={pos.confidence} />
      </div>
      <div className="mt-1 text-xs text-foreground/90 italic">
        “{pos.stance}”
      </div>
      {pos.derivedFrom.length > 0 && (
        <div className="mt-1 flex gap-1 flex-wrap">
          {pos.derivedFrom.map((d) => (
            <span
              key={d}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground"
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function DisagreementsSection({
  disagreements,
  reviewerName,
}: {
  disagreements: CollaborationDisagreement[];
  reviewerName: (id: string) => string;
}) {
  if (disagreements.length === 0) {
    return (
      <Section
        icon={Split}
        title="Disagreements"
        subtitle="No active disagreements. All positions preserved — never collapsed to a majority vote."
      >
        <div className="text-xs text-muted-foreground">
          When disagreements arise, every holder's position is recorded with full provenance.
        </div>
      </Section>
    );
  }
  return (
    <Section
      icon={Split}
      title="Disagreements"
      subtitle="Positions are preserved across reviewers and agents. Severity reflects how far apart the positions are, not who 'wins'."
    >
      <div className="space-y-3">
        {disagreements.map((d) => (
          <div
            key={d.disagreementId}
            className="border border-border rounded-md p-3 bg-background/40"
          >
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-foreground">
                {d.topic}
              </span>
              <Pill tone={severityTone(d.severity)}>{d.severity}</Pill>
              <span className="text-[10px] font-mono text-muted-foreground">
                severity {f2(d.severityScore)}
              </span>
              {d.resolvedAt ? (
                <Pill tone="ok">resolved</Pill>
              ) : (
                <Pill tone="warn">open</Pill>
              )}
            </div>
            <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              {d.positions.map((p) => (
                <PositionRow
                  key={p.positionId}
                  pos={p}
                  reviewerName={reviewerName}
                />
              ))}
            </ul>
            {d.resolutionSummary && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-mono uppercase text-[10px] tracking-wider mr-1">
                  resolution:
                </span>
                {d.resolutionSummary}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function EvidenceReviewSection({
  entries,
  reviewerName,
}: {
  entries: CollaborationEvidenceReviewEntry[];
  reviewerName: (id: string) => string;
}) {
  return (
    <Section
      icon={ClipboardCheck}
      title="Evidence reviews"
      subtitle="Immutable, append-only annotations and reliability adjustments — the original evidence is never mutated."
    >
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          No evidence reviews for this case.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left font-medium py-2">Evidence</th>
              <th className="text-left font-medium">Kind</th>
              <th className="text-left font-medium">Reviewer</th>
              <th className="text-left font-medium">Δ reliability</th>
              <th className="text-left font-medium">Rationale</th>
              <th className="text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {entries.map((e) => (
              <tr key={e.reviewId} className="border-b border-border/40">
                <td className="py-2 pr-2">{e.evidenceId}</td>
                <td className="pr-2">
                  <Pill tone="info">{e.kind.replace(/_/g, " ")}</Pill>
                </td>
                <td className="pr-2">{reviewerName(e.reviewerId)}</td>
                <td className="pr-2 tabular-nums">
                  {e.reliabilityDelta === null || e.reliabilityDelta === undefined
                    ? "—"
                    : e.reliabilityDelta > 0
                      ? `+${f2(e.reliabilityDelta)}`
                      : f2(e.reliabilityDelta)}
                </td>
                <td className="pr-2 text-foreground/90 max-w-[360px]">
                  {e.rationale}
                </td>
                <td className="pr-2 text-muted-foreground text-[10px]">
                  {fmtTime(e.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function OverridesSection({
  overrides,
  reviewerName,
}: {
  overrides: CollaborationOverrideRecord[];
  reviewerName: (id: string) => string;
}) {
  return (
    <Section
      icon={Gavel}
      title="Overrides"
      subtitle="Every override is explicit and refuses to be issued without acknowledged risks. Outcomes feed reviewer calibration over time."
    >
      {overrides.length === 0 ? (
        <div className="text-xs text-muted-foreground">No overrides recorded.</div>
      ) : (
        <div className="space-y-2">
          {overrides.map((o) => (
            <div
              key={o.overrideId}
              className="border border-border rounded-md p-3 bg-background/40"
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <Pill
                  tone={
                    o.direction === "accept_against_recommendation"
                      ? "warn"
                      : o.direction === "reject_against_recommendation"
                        ? "err"
                        : "info"
                  }
                >
                  {o.direction.replace(/_/g, " ")}
                </Pill>
                <span className="font-mono text-xs">
                  {reviewerName(o.reviewerId)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  affects {o.affectedRecommendationId}
                </span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
                  {fmtTime(o.issuedAt)}
                </span>
              </div>
              <div className="mt-1 text-xs text-foreground/90">{o.reason}</div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
                  confidence impact
                </span>
                <ConfBar value={Math.abs(o.confidenceImpact)} tone="warn" />
                <Pill
                  tone={
                    o.outcome === "validated_correct"
                      ? "ok"
                      : o.outcome === "validated_incorrect"
                        ? "err"
                        : o.outcome === "inconclusive"
                          ? "warn"
                          : "default"
                  }
                >
                  outcome: {o.outcome.replace(/_/g, " ")}
                </Pill>
              </div>
              <div className="mt-2">
                <div className="text-[10px] uppercase font-mono text-amber-400/80 tracking-wider mb-1">
                  acknowledged risks
                </div>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {o.acknowledgedRisks.map((r) => (
                    <li key={r} className="text-foreground/80">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function CalibrationSection({
  reviewers,
  selectedId,
  setSelectedId,
  report,
}: {
  reviewers: CollaborationReviewerIdentity[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  report: CollaborationReviewerCalibrationReport | undefined;
}) {
  return (
    <Section
      icon={ShieldAlert}
      title="Reviewer calibration"
      subtitle="Contextual, per-domain — never a single score. Includes overconfidence risk, calibration drift, and the value of dissent."
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono">reviewer:</span>
        {reviewers.map((r) => (
          <button
            key={r.reviewerId}
            data-testid={`calibration-pick-${r.reviewerId}`}
            onClick={() => setSelectedId(r.reviewerId)}
            className={cn(
              "text-xs font-mono px-2 py-1 rounded border",
              selectedId === r.reviewerId
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r.displayName}
          </button>
        ))}
      </div>
      {!report ? (
        <div className="text-xs text-muted-foreground">Loading calibration…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
              per-domain calibration
            </div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-medium">domain</th>
                  <th className="text-right font-medium">brier</th>
                  <th className="text-right font-medium">over-conf</th>
                  <th className="text-right font-medium">n</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {report.reviewerCalibration.map((c) => (
                  <tr key={c.domain} className="border-b border-border/40">
                    <td>{c.domain}</td>
                    <td className="text-right">{f3(c.brier)}</td>
                    <td className="text-right">{f3(c.overconfidence)}</td>
                    <td className="text-right">{c.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between border-b border-border/40 py-1">
              <span className="text-muted-foreground">reliability</span>
              <span className="font-mono tabular-nums">{f3(report.reliability)}</span>
            </div>
            <div className="flex justify-between border-b border-border/40 py-1">
              <span className="text-muted-foreground">overconfidence risk</span>
              <span className="font-mono tabular-nums">
                {f3(report.overconfidenceRisk)}
              </span>
            </div>
            <div className="flex justify-between border-b border-border/40 py-1">
              <span className="text-muted-foreground">disagreement value</span>
              <span className="font-mono tabular-nums">
                {f3(report.disagreementValue)}
              </span>
            </div>
            <div className="flex justify-between border-b border-border/40 py-1">
              <span className="text-muted-foreground">calibration drift</span>
              <span className="font-mono tabular-nums">
                {f3(report.calibrationDrift)}
              </span>
            </div>
            {report.historicalPatterns.length > 0 && (
              <div className="pt-2">
                <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
                  historical patterns
                </div>
                <ul className="space-y-1">
                  {report.historicalPatterns.map((p) => (
                    <li
                      key={p.pattern}
                      className="border border-border rounded p-2 bg-background/40"
                    >
                      <div className="flex items-center gap-2">
                        <Pill tone="warn">{p.pattern.replace(/_/g, " ")}</Pill>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          ×{p.occurrences}
                        </span>
                      </div>
                      <div className="text-[11px] text-foreground/80 mt-1">
                        {p.note}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

function LineageSection({
  timeline,
  reviewerName,
}: {
  timeline: CollaborationDecisionTimeline | undefined;
  reviewerName: (id: string) => string;
}) {
  if (!timeline) {
    return (
      <Section icon={History} title="Decision lineage" subtitle="Select a case to view its evolution.">
        <div className="text-xs text-muted-foreground">No case selected.</div>
      </Section>
    );
  }
  return (
    <Section
      icon={History}
      title="Decision lineage"
      subtitle="How confidence and disagreement evolved across reviewer actions, evidence, and overrides."
    >
      <div className="mb-3 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
            confidence trajectory
          </div>
          <ul className="space-y-1">
            {timeline.confidenceSeries.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-mono text-[10px] tabular-nums w-32">
                  {fmtTime(p.timestamp)}
                </span>
                <ConfBar value={p.value} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
            disagreement severity
          </div>
          <ul className="space-y-1">
            {timeline.disagreementSeries.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-mono text-[10px] tabular-nums w-32">
                  {fmtTime(p.timestamp)}
                </span>
                <ConfBar value={p.value} tone="warn" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
        nodes ({timeline.nodes.length}) · edges ({timeline.edges.length})
      </div>
      <ol className="space-y-1.5">
        {timeline.nodes.map((n) => (
          <li
            key={n.nodeId}
            className="border border-border rounded px-2 py-1.5 bg-background/40 text-xs flex items-start gap-2"
          >
            <Pill tone="info">{n.kind.replace(/_/g, " ")}</Pill>
            <span className="font-mono text-[11px] text-muted-foreground">
              {n.actorId.startsWith("rev_") ? reviewerName(n.actorId) : n.actorId}
            </span>
            <span className="flex-1 text-foreground/90">{n.summary}</span>
            {n.confidenceAfter !== null && n.confidenceAfter !== undefined && (
              <ConfBar value={n.confidenceAfter} />
            )}
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {fmtTime(n.timestamp)}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function OrganizationalMemorySection({
  mem,
  reviewerName,
}: {
  mem: CollaborationOrganizationalReasoningMemory;
  reviewerName: (id: string) => string;
}) {
  return (
    <Section
      icon={Network}
      title="Organizational reasoning memory"
      subtitle="Recurring disagreements, reviewer clusters, biases, and success/failure patterns derived across cases."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
            recurring disagreements ({mem.recurringDisagreements.length})
          </div>
          {mem.recurringDisagreements.length === 0 ? (
            <div className="text-muted-foreground">none yet</div>
          ) : (
            <ul className="space-y-1">
              {mem.recurringDisagreements.map((c) => (
                <li
                  key={c.clusterId}
                  className="border border-border rounded p-2 bg-background/40"
                >
                  <span className="font-mono">{c.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    ×{c.disagreementIds.length}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mt-3 mb-1">
            organizational biases ({mem.organizationalBiases.length})
          </div>
          {mem.organizationalBiases.length === 0 ? (
            <div className="text-muted-foreground">none surfaced</div>
          ) : (
            <ul className="space-y-1">
              {mem.organizationalBiases.map((b) => (
                <li
                  key={b.biasId}
                  className="border border-border rounded p-2 bg-background/40"
                >
                  <div className="flex items-center gap-2">
                    <Pill tone="warn">{b.label}</Pill>
                    <ConfBar value={b.confidence} tone="warn" />
                  </div>
                  <div className="mt-1 text-foreground/80">{b.description}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mt-3 mb-1">
            reviewer clusters ({mem.reviewerClusters.length})
          </div>
          {mem.reviewerClusters.length === 0 ? (
            <div className="text-muted-foreground">none yet</div>
          ) : (
            <ul className="space-y-1">
              {mem.reviewerClusters.map((c) => (
                <li
                  key={c.clusterId}
                  className="border border-border rounded p-2 bg-background/40"
                >
                  <div className="font-mono">{c.label}</div>
                  <div className="text-muted-foreground mt-0.5">
                    {c.reviewerIds.map((id) => reviewerName(id)).join(" · ")}
                  </div>
                  <div className="text-foreground/80 mt-0.5">{c.rationale}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mb-1">
            success patterns ({mem.successPatterns.length})
          </div>
          {mem.successPatterns.length === 0 ? (
            <div className="text-muted-foreground">none yet</div>
          ) : (
            <ul className="space-y-1">
              {mem.successPatterns.map((p) => (
                <li
                  key={p.patternId}
                  className="border border-border rounded p-2 bg-background/40"
                >
                  <div className="flex items-center gap-2">
                    <Pill tone="ok">{p.label}</Pill>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      agreement {pct(p.agreementRate)} · predictive {pct(p.predictiveValue)}
                    </span>
                  </div>
                  <div className="mt-1 text-foreground/80">{p.description}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mt-3 mb-1">
            failure patterns ({mem.failurePatterns.length})
          </div>
          {mem.failurePatterns.length === 0 ? (
            <div className="text-muted-foreground">none yet</div>
          ) : (
            <ul className="space-y-1">
              {mem.failurePatterns.map((p) => (
                <li
                  key={p.patternId}
                  className="border border-border rounded p-2 bg-background/40"
                >
                  <Pill tone="err">{p.label}</Pill>
                  <div className="text-foreground/80 mt-1">{p.description}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mt-3 mb-1">
            escalation archetypes ({mem.escalationArchetypes.length})
          </div>
          {mem.escalationArchetypes.length === 0 ? (
            <div className="text-muted-foreground">none yet</div>
          ) : (
            <ul className="space-y-1">
              {mem.escalationArchetypes.map((a) => (
                <li
                  key={a.archetypeId}
                  className="border border-border rounded p-2 bg-background/40"
                >
                  <Pill tone="warn">{a.label}</Pill>
                  <div className="text-foreground/80 mt-1">{a.description}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider mt-3 mb-1">
            override archetypes ({mem.overrideArchetypes.length})
          </div>
          {mem.overrideArchetypes.length === 0 ? (
            <div className="text-muted-foreground">none yet</div>
          ) : (
            <ul className="space-y-1">
              {mem.overrideArchetypes.map((a) => (
                <li
                  key={a.archetypeId}
                  className="border border-border rounded p-2 bg-background/40"
                >
                  <Pill tone="info">{a.label}</Pill>
                  <div className="text-foreground/80 mt-1">{a.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

function AuditSection({
  entries,
  reviewerName,
}: {
  entries: CollaborationAuditEntry[];
  reviewerName: (id: string) => string;
}) {
  return (
    <Section
      icon={Activity}
      title="Append-only audit"
      subtitle="Every transition, action, override, and escalation. The ledger is the source of truth for reconstructing how a decision was made."
    >
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground">No audit entries.</div>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e) => (
            <li
              key={e.entryId}
              className="border border-border rounded px-2 py-1.5 bg-background/40 text-xs flex items-start gap-2"
            >
              <Pill tone="default">{e.kind.replace(/_/g, " ")}</Pill>
              <span className="font-mono text-[11px] text-muted-foreground">
                {e.actorId.startsWith("rev_") ? reviewerName(e.actorId) : e.actorId}
              </span>
              <span className="flex-1 text-foreground/90">{e.summary}</span>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {fmtTime(e.timestamp)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function Collaboration() {
  const { data: state, isLoading, error } = useGetCollaborationState();
  const reviewers: CollaborationReviewerIdentity[] = useMemo(
    () => (state as CollaborationStateResponse | undefined)?.reviewers ?? [],
    [state],
  );
  const cases: CollaborativeCase[] = useMemo(
    () => (state as CollaborationStateResponse | undefined)?.cases ?? [],
    [state],
  );
  const overridesAll: CollaborationOverrideRecord[] = useMemo(
    () => (state as CollaborationStateResponse | undefined)?.overrides ?? [],
    [state],
  );

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const effectiveCaseId = selectedCaseId ?? cases[0]?.caseId ?? null;

  const { data: caseDetail } = useGetCollaborationCase(effectiveCaseId ?? "", {
    query: {
      enabled: !!effectiveCaseId,
      queryKey: ["collaboration-case", effectiveCaseId ?? ""],
    },
  });

  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const effectiveReviewerId =
    selectedReviewerId || reviewers[0]?.reviewerId || "";

  const { data: calibration } = useGetCollaborationReviewerCalibration(
    effectiveReviewerId,
    {
      query: {
        enabled: !!effectiveReviewerId,
        queryKey: ["collaboration-calibration", effectiveReviewerId],
      },
    },
  );

  const reviewerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reviewers) map.set(r.reviewerId, r.displayName);
    return (id: string) => map.get(id) ?? id;
  }, [reviewers]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground p-8">Loading collaboration state…</div>
    );
  }
  if (error || !state) {
    return (
      <div className="text-sm text-red-400 p-8">
        Failed to load collaboration state.
      </div>
    );
  }

  const stateTyped = state as CollaborationStateResponse;

  return (
    <div className="space-y-6" data-testid="collaboration-page">
      <header>
        <h1 className="text-xl font-mono font-semibold text-foreground tracking-tight">
          Collaborative intelligence operations
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Where human judgment, agent reasoning, and evidence meet. Disagreement is preserved,
          provenance is explicit, overrides require acknowledged risks, and every step is auditable.
        </p>
      </header>

      <ReviewersSection reviewers={reviewers} />

      <CasesSection
        cases={cases}
        selected={effectiveCaseId}
        onSelect={(id) => setSelectedCaseId(id)}
      />

      <ReasoningSection
        actions={caseDetail?.actions ?? []}
        reviewerName={reviewerName}
      />

      <DisagreementsSection
        disagreements={caseDetail?.disagreements ?? []}
        reviewerName={reviewerName}
      />

      <EvidenceReviewSection
        entries={caseDetail?.evidenceReviews ?? []}
        reviewerName={reviewerName}
      />

      <OverridesSection
        overrides={caseDetail?.overrides ?? overridesAll}
        reviewerName={reviewerName}
      />

      <CalibrationSection
        reviewers={reviewers}
        selectedId={effectiveReviewerId}
        setSelectedId={setSelectedReviewerId}
        report={calibration as CollaborationReviewerCalibrationReport | undefined}
      />

      <LineageSection timeline={caseDetail?.timeline} reviewerName={reviewerName} />

      <OrganizationalMemorySection
        mem={stateTyped.organizationalMemory}
        reviewerName={reviewerName}
      />

      <AuditSection
        entries={caseDetail?.audit ?? stateTyped.audit}
        reviewerName={reviewerName}
      />
    </div>
  );
}
