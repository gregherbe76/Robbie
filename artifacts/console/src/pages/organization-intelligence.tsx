import React, { useMemo, useState } from "react";
import {
  useListOrganizationContexts,
  useGetCandidateOrganizationFit,
  useGetOrganizationIntelligenceReport,
  useListIntelligenceAnalyses,
  useListMemoryEntries,
  getCandidateOrganizationFit,
} from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import type {
  OrganizationContext,
  CandidateOrganizationFitResult,
  OrganizationIntelligenceReport,
  OrgReasoningEnvelope,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  AlertTriangle,
  ShieldAlert,
  Zap,
  Crosshair,
  ScrollText,
  HelpCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const FIT_TONE: Record<
  CandidateOrganizationFitResult["fitRecommendation"],
  { label: string; tone: string; dot: string }
> = {
  strong_fit: {
    label: "Strong fit",
    tone: "text-primary border-primary/40 bg-primary/10",
    dot: "bg-primary",
  },
  conditional_fit: {
    label: "Conditional fit",
    tone: "text-yellow-500 border-yellow-500/40 bg-yellow-500/10",
    dot: "bg-yellow-500",
  },
  high_upside_high_risk: {
    label: "High upside, high risk",
    tone: "text-orange-500 border-orange-500/40 bg-orange-500/10",
    dot: "bg-orange-500",
  },
  poor_context_fit: {
    label: "Poor context fit",
    tone: "text-destructive border-destructive/40 bg-destructive/10",
    dot: "bg-destructive",
  },
  insufficient_context: {
    label: "Insufficient context",
    tone: "text-muted-foreground border-border bg-secondary/40",
    dot: "bg-muted-foreground",
  },
};

function ProvenanceLine({ env }: { env: OrgReasoningEnvelope }) {
  const p = env.provenance;
  return (
    <div className="mt-3 border-t border-border/40 pt-2 text-[10px] font-mono text-muted-foreground space-y-0.5">
      <div>
        <span className="text-foreground/70">producedBy</span> {p.producedBy} ·{" "}
        <span className="text-foreground/70">at</span>{" "}
        {new Date(p.producedAt).toISOString()}
      </div>
      <div>
        <span className="text-foreground/70">rationale</span> {p.rationale}
      </div>
      <div className="break-all">
        <span className="text-foreground/70">derivedFrom</span>{" "}
        {p.derivedFrom.join(", ")}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card/40">
      <header className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
        <Icon className="size-4 text-primary" />
        <h2 className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
          {title}
        </h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Bar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "destructive" | "warn";
}) {
  const cls =
    tone === "destructive"
      ? "bg-destructive"
      : tone === "warn"
        ? "bg-yellow-500"
        : "bg-primary";
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full", cls)}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function ContextFieldRow({
  k,
  field,
}: {
  k: string;
  field: { value: string; confidence: number; derivedFrom: string[]; note?: string };
}) {
  const unknown = field.value === "unknown";
  return (
    <div className="grid grid-cols-12 gap-3 items-center py-1.5 border-b border-border/30 last:border-0">
      <div className="col-span-4 text-xs font-mono text-muted-foreground">
        {k}
      </div>
      <div className="col-span-3">
        {unknown ? (
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
            unknown
          </span>
        ) : (
          <span className="font-mono text-xs text-foreground">{field.value}</span>
        )}
      </div>
      <div className="col-span-3">
        <Bar value={field.confidence} tone={unknown ? "warn" : "primary"} />
      </div>
      <div className="col-span-2 text-right text-[10px] font-mono text-muted-foreground">
        {unknown ? "—" : pct(field.confidence)}
      </div>
      {field.note ? (
        <div className="col-span-12 text-[11px] text-muted-foreground italic pl-1">
          {field.note}
        </div>
      ) : null}
    </div>
  );
}

function OrgContextPanel({ org }: { org: OrganizationContext }) {
  const fields = Object.entries(org.fields) as Array<
    [string, OrganizationContext["fields"][keyof OrganizationContext["fields"]]]
  >;
  return (
    <Section title="Organization Context" icon={Building2}>
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{org.name}</div>
        <div className="text-xs text-muted-foreground mb-3">
          {org.description}
        </div>
        <div className="rounded border border-border/60 bg-background/40 p-3">
          {fields.map(([k, v]) => (
            <ContextFieldRow key={k} k={k} field={v} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
              Founder evidence ({org.founderEvidence.length})
            </div>
            <ul className="text-xs space-y-1">
              {org.founderEvidence.map((e) => (
                <li key={e.id} className="text-muted-foreground">
                  <span className="font-mono text-foreground/70">{e.id}</span>
                  <span className="text-foreground/80"> · {e.summary}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
              Team evidence ({org.teamEvidence.length})
            </div>
            <ul className="text-xs space-y-1">
              {org.teamEvidence.map((e) => (
                <li key={e.id} className="text-muted-foreground">
                  <span className="font-mono text-foreground/70">{e.id}</span>
                  <span className="text-foreground/80"> · {e.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FitMatrix({
  fits,
  selected,
  onSelect,
}: {
  fits: Array<{ candidateId: string; fit: CandidateOrganizationFitResult | null }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Section title="Candidate × Organization Fit Matrix" icon={Crosshair}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {fits.map(({ candidateId, fit }) => {
          const tone = fit
            ? FIT_TONE[fit.fitRecommendation]
            : FIT_TONE.insufficient_context;
          return (
            <button
              key={candidateId}
              onClick={() => onSelect(candidateId)}
              className={cn(
                "text-left p-3 rounded border transition-colors",
                selected === candidateId
                  ? "border-primary ring-1 ring-primary/40"
                  : "border-border hover:border-border/80",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm text-foreground">
                  {candidateId}
                </span>
                <span className={cn("size-2 rounded-full", tone.dot)} />
              </div>
              <div className={cn("text-xs", tone.tone.split(" ")[0])}>
                {tone.label}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <span>fit {fit ? pct(fit.fitConfidence) : "—"}</span>
                <span>·</span>
                <span>
                  ctx {fit ? pct(fit.contextCompleteness) : "—"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function FinalRecommendation({
  fit,
  report,
}: {
  fit: CandidateOrganizationFitResult;
  report: OrganizationIntelligenceReport;
}) {
  const tone = FIT_TONE[fit.fitRecommendation];
  return (
    <div
      className={cn(
        "rounded-lg border p-5 flex items-start gap-4",
        tone.tone,
      )}
    >
      <div className={cn("size-3 rounded-full mt-1.5", tone.dot)} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">
              Final recommendation
            </div>
            <div className="text-lg font-semibold">{tone.label}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">
              Confidence
            </div>
            <div className="font-mono text-foreground">
              {pct(fit.fitConfidence)}
            </div>
          </div>
        </div>
        <div className="text-sm text-foreground/90 leading-relaxed">
          {report.fitSummary.headline}
        </div>
        <div className="mt-2 text-xs font-mono text-muted-foreground">
          {fit.finalRationale}
        </div>
      </div>
    </div>
  );
}

function FounderCard({
  report,
}: {
  report: OrganizationIntelligenceReport;
}) {
  const f = report.founderFit.result as {
    founderStyle: string;
    communicationStyle: string;
    strengthsForCandidateTypes: string[];
    risksForCandidateTypes: string[];
    communicationImplications: string[];
  };
  return (
    <Section title="Founder / Leadership Fit" icon={Zap}>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-sm text-foreground">
          {f.founderStyle}
        </span>
        <span className="text-[10px] font-mono uppercase text-muted-foreground">
          comms
        </span>
        <span className="font-mono text-xs text-foreground/80">
          {f.communicationStyle}
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          conf {pct(report.founderFit.confidence)}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[10px] font-mono uppercase text-primary mb-1">
            Strengths for
          </div>
          <ul className="space-y-1 text-foreground/80">
            {f.strengthsForCandidateTypes.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-destructive mb-1">
            Risks for
          </div>
          <ul className="space-y-1 text-foreground/80">
            {f.risksForCandidateTypes.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-yellow-500 mb-1">
            Comms implications
          </div>
          <ul className="space-y-1 text-foreground/80">
            {f.communicationImplications.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
      </div>
      <ProvenanceLine env={report.founderFit} />
    </Section>
  );
}

function TeamChemistryCard({
  report,
}: {
  report: OrganizationIntelligenceReport;
}) {
  const t = report.teamChemistry.result as {
    chemistryScore: number;
    complementaritySignals: Array<{ id: string; summary: string; weight: number }>;
    collisionRisks: Array<{ id: string; severity: string; summary: string }>;
    missingTeamContext: string[];
  };
  return (
    <Section title="Team Chemistry" icon={Users}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-mono uppercase text-muted-foreground">
          chemistryScore
        </span>
        <span className="font-mono text-sm text-foreground">
          {t.chemistryScore.toFixed(2)}
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          conf {pct(report.teamChemistry.confidence)}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-[10px] font-mono uppercase text-primary mb-1">
            Complementarity ({t.complementaritySignals.length})
          </div>
          {t.complementaritySignals.length === 0 ? (
            <div className="text-muted-foreground italic">none detected</div>
          ) : (
            <ul className="space-y-1.5">
              {t.complementaritySignals.map((s) => (
                <li key={s.id}>
                  <div className="font-mono text-[10px] text-foreground/60">
                    {s.id} · w={s.weight.toFixed(2)}
                  </div>
                  <div className="text-foreground/85">{s.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-destructive mb-1">
            Collision risks ({t.collisionRisks.length})
          </div>
          {t.collisionRisks.length === 0 ? (
            <div className="text-muted-foreground italic">none detected</div>
          ) : (
            <ul className="space-y-1.5">
              {t.collisionRisks.map((c) => (
                <li key={c.id}>
                  <div className="font-mono text-[10px] text-foreground/60">
                    {c.id} · {c.severity}
                  </div>
                  <div className="text-foreground/85">{c.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {t.missingTeamContext.length > 0 && (
        <div className="mt-3 text-[11px] text-yellow-500/90">
          Missing team context: {t.missingTeamContext.join(", ")}
        </div>
      )}
      <ProvenanceLine env={report.teamChemistry} />
    </Section>
  );
}

function ChaosCard({
  report,
}: {
  report: OrganizationIntelligenceReport;
}) {
  const c = report.chaosFit.result as {
    chaosFitScore: number;
    toleranceLevel: string;
    riskLevel: string;
    strongestEvidence: Array<{ id: string; summary: string }>;
    missingEvidence: string[];
  };
  const riskTone =
    c.riskLevel === "high"
      ? "text-destructive"
      : c.riskLevel === "medium"
        ? "text-yellow-500"
        : "text-primary";
  return (
    <Section title="Chaos & Ambiguity Fit" icon={AlertTriangle}>
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">
            chaosFitScore
          </div>
          <div className="font-mono text-foreground">
            {c.chaosFitScore.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">
            Tolerance
          </div>
          <div className="font-mono text-foreground">{c.toleranceLevel}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">
            Risk
          </div>
          <div className={cn("font-mono uppercase", riskTone)}>
            {c.riskLevel}
          </div>
        </div>
      </div>
      <div className="text-[10px] font-mono uppercase text-primary mb-1">
        Strongest evidence
      </div>
      <ul className="space-y-1 text-xs text-foreground/85 mb-3">
        {c.strongestEvidence.map((e) => (
          <li key={e.id}>
            <span className="font-mono text-[10px] text-foreground/60">
              {e.id}
            </span>{" "}
            {e.summary}
          </li>
        ))}
        {c.strongestEvidence.length === 0 && (
          <li className="text-muted-foreground italic">no strong evidence</li>
        )}
      </ul>
      {c.missingEvidence.length > 0 && (
        <div className="text-[11px] text-yellow-500/90">
          Missing evidence: {c.missingEvidence.join(", ")}
        </div>
      )}
      <ProvenanceLine env={report.chaosFit} />
    </Section>
  );
}

function RoleEnvironmentCard({
  report,
}: {
  report: OrganizationIntelligenceReport;
}) {
  const r = report.roleEnvironment.result as {
    roleEnvironmentProfile: Record<
      string,
      { value: string; confidence: number }
    >;
    candidateFitAgainstRoleEnvironment: number;
    mismatchAreas: Array<{
      field: string;
      candidateSignal: string;
      roleRequirement: string;
      severity: string;
    }>;
    investigationAreas: string[];
  };
  return (
    <Section title="Role Environment Fit" icon={Crosshair}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-mono uppercase text-muted-foreground">
          roleEnvFit
        </span>
        <span className="font-mono text-sm text-foreground">
          {r.candidateFitAgainstRoleEnvironment.toFixed(2)}
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          conf {pct(report.roleEnvironment.confidence)}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {Object.entries(r.roleEnvironmentProfile).map(([k, v]) => (
          <div
            key={k}
            className="rounded border border-border/60 p-2 bg-background/30"
          >
            <div className="text-[9px] font-mono uppercase text-muted-foreground">
              {k}
            </div>
            <div className="text-xs font-mono text-foreground">
              {v.value === "unknown" ? (
                <span className="text-muted-foreground">unknown</span>
              ) : (
                v.value
              )}
            </div>
          </div>
        ))}
      </div>
      {r.mismatchAreas.length > 0 && (
        <>
          <div className="text-[10px] font-mono uppercase text-destructive mb-1">
            Mismatch areas
          </div>
          <ul className="space-y-1 text-xs">
            {r.mismatchAreas.map((m, i) => (
              <li key={i} className="text-foreground/85">
                <span className="font-mono text-[10px] text-foreground/60">
                  {m.field}·{m.severity}
                </span>{" "}
                {m.candidateSignal} vs {m.roleRequirement}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.investigationAreas.length > 0 && (
        <div className="mt-2 text-[11px] text-yellow-500/90">
          Investigate: {r.investigationAreas.join(" · ")}
        </div>
      )}
      <ProvenanceLine env={report.roleEnvironment} />
    </Section>
  );
}

const RISK_LABELS: Record<string, string> = {
  execution: "Execution",
  autonomy: "Autonomy",
  culture: "Culture",
  managerFit: "Manager fit",
  ramp: "Ramp",
  retention: "Retention",
  communication: "Communication",
  seniorityCalibration: "Seniority calibration",
};

function HiringRiskCard({
  report,
}: {
  report: OrganizationIntelligenceReport;
}) {
  const r = report.hiringRisk.result as {
    overallHiringRisk: number;
    riskBreakdown: Record<string, number>;
    strongestRiskDrivers: Array<{
      category: string;
      severity: string;
      summary: string;
    }>;
    mitigatingFactors: string[];
    nextInvestigations: string[];
  };
  return (
    <Section title="Hiring Risk Breakdown" icon={ShieldAlert}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-mono uppercase text-muted-foreground">
          overallHiringRisk
        </span>
        <span
          className={cn(
            "font-mono text-sm",
            r.overallHiringRisk > 0.6
              ? "text-destructive"
              : r.overallHiringRisk > 0.4
                ? "text-yellow-500"
                : "text-primary",
          )}
        >
          {r.overallHiringRisk.toFixed(2)}
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          conf {pct(report.hiringRisk.confidence)}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-3">
        {Object.entries(r.riskBreakdown).map(([k, v]) => (
          <div key={k}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {RISK_LABELS[k] ?? k}
              </span>
              <span className="font-mono text-foreground">{v.toFixed(2)}</span>
            </div>
            <Bar
              value={v}
              tone={v > 0.6 ? "destructive" : v > 0.4 ? "warn" : "primary"}
            />
          </div>
        ))}
      </div>
      {r.strongestRiskDrivers.length > 0 && (
        <>
          <div className="text-[10px] font-mono uppercase text-destructive mb-1">
            Strongest risk drivers
          </div>
          <ul className="space-y-1 text-xs text-foreground/85 mb-3">
            {r.strongestRiskDrivers.map((d, i) => (
              <li key={i}>
                <span className="font-mono text-[10px] text-foreground/60">
                  {d.category}·{d.severity}
                </span>{" "}
                {d.summary}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.mitigatingFactors.length > 0 && (
        <>
          <div className="text-[10px] font-mono uppercase text-primary mb-1">
            Mitigating factors
          </div>
          <ul className="space-y-1 text-xs text-foreground/85">
            {r.mitigatingFactors.map((m, i) => (
              <li key={i}>· {m}</li>
            ))}
          </ul>
        </>
      )}
      <ProvenanceLine env={report.hiringRisk} />
    </Section>
  );
}

function ConditionsCard({
  fit,
}: {
  fit: CandidateOrganizationFitResult;
}) {
  return (
    <Section title="Success Conditions / Failure Modes" icon={ScrollText}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-[10px] font-mono uppercase text-primary mb-1 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Success conditions
          </div>
          {fit.successConditions.length === 0 ? (
            <div className="text-muted-foreground italic">none specified</div>
          ) : (
            <ul className="space-y-1 text-foreground/85">
              {fit.successConditions.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-destructive mb-1 flex items-center gap-1">
            <XCircle className="size-3" /> Failure modes
          </div>
          {fit.failureModes.length === 0 ? (
            <div className="text-muted-foreground italic">none identified</div>
          ) : (
            <ul className="space-y-1 text-foreground/85">
              {fit.failureModes.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-yellow-500 mb-1">
            Onboarding risks
          </div>
          {fit.onboardingRisks.length === 0 ? (
            <div className="text-muted-foreground italic">none</div>
          ) : (
            <ul className="space-y-1 text-foreground/85">
              {fit.onboardingRisks.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
            Management implications
          </div>
          {fit.managementImplications.length === 0 ? (
            <div className="text-muted-foreground italic">none</div>
          ) : (
            <ul className="space-y-1 text-foreground/85">
              {fit.managementImplications.map((s, i) => (
                <li key={i}>· {s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {fit.interviewFocusAreas.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="text-[10px] font-mono uppercase text-primary mb-1 flex items-center gap-1">
            <HelpCircle className="size-3" /> Interview focus areas
          </div>
          <ul className="space-y-1 text-xs text-foreground/85">
            {fit.interviewFocusAreas.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function OrgMemoryTimeline({ organizationId }: { organizationId: string }) {
  const { data: memory } = useListMemoryEntries();
  const items = useMemo(() => {
    if (!memory) return [];
    return memory
      .filter(
        (m) =>
          (m.scope === "organization" && m.subjectId === organizationId) ||
          m.tags?.includes(`org:${organizationId}`),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [memory, organizationId]);
  return (
    <Section title="Organization Memory Timeline" icon={ScrollText}>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          No memory entries yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <li
              key={m.id}
              className="rounded border border-border/40 bg-background/30 p-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-foreground/70">
                  {m.id}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  conf {pct(m.confidence)}
                </span>
              </div>
              <div className="text-xs text-foreground/85">{m.summary}</div>
              <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                {m.provenance.producedBy} · {m.tags?.join(", ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function OrganizationIntelligence() {
  const { data: contexts, isLoading: ctxLoading } =
    useListOrganizationContexts();
  const { data: analyses } = useListIntelligenceAnalyses();

  const org = contexts?.[0];
  const candidateIds = useMemo(
    () => (analyses ?? []).map((a) => a.candidateId).sort(),
    [analyses],
  );
  const [selected, setSelected] = useState<string>("");
  const activeId = selected || candidateIds[0] || "";

  const enabled = !!org && !!activeId;
  const { data: fit } = useGetCandidateOrganizationFit(
    org?.id ?? "",
    activeId,
    {
      query: {
        enabled,
        queryKey: ["org-fit", org?.id ?? "", activeId],
      },
    },
  );
  const { data: report } = useGetOrganizationIntelligenceReport(
    org?.id ?? "",
    activeId,
    {
      query: {
        enabled,
        queryKey: ["org-report", org?.id ?? "", activeId],
      },
    },
  );

  // Fetch every candidate's fit so the matrix is honest, not just placeholders.
  const fitQueries = useQueries({
    queries: candidateIds.map((cid) => ({
      queryKey: ["org-fit-matrix", org?.id ?? "", cid],
      queryFn: () => getCandidateOrganizationFit(org?.id ?? "", cid),
      enabled: !!org,
    })),
  });
  const allFits = useMemo(() => {
    return candidateIds.map((cid, i) => ({
      candidateId: cid,
      fit: (fitQueries[i]?.data as CandidateOrganizationFitResult | undefined) ?? null,
    }));
  }, [candidateIds, fitQueries]);

  if (ctxLoading || !org) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading organization intelligence…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Organization Intelligence
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Candidate × organization fit. Five agents (FounderStyle,
          TeamChemistry, ChaosTolerance, RoleEnvironment, HiringRisk) run
          deterministically over the organization context and the candidate's
          cross-agent cognition. Unknown organisation fields stay unknown — no
          silent inference.
        </p>
      </header>

      <OrgContextPanel org={org} />

      <FitMatrix
        fits={allFits}
        selected={activeId}
        onSelect={setSelected}
      />

      {fit && report && (
        <>
          <FinalRecommendation fit={fit} report={report} />
          <FounderCard report={report} />
          <TeamChemistryCard report={report} />
          <ChaosCard report={report} />
          <RoleEnvironmentCard report={report} />
          <HiringRiskCard report={report} />
          <ConditionsCard fit={fit} />
        </>
      )}

      <OrgMemoryTimeline organizationId={org.id} />
    </div>
  );
}
