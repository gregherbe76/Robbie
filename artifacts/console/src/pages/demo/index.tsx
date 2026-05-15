import { Link } from "wouter";
import { useListDemoCases } from "@workspace/api-client-react";
import {
  ArrowRight,
  Loader2,
  Sparkles,
  AlertOctagon,
  Layers,
  Compass,
  Building2,
} from "lucide-react";

const CASE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "founder-builder": Sparkles,
  "inflated-senior": AlertOctagon,
  "ambiguous-generalist": Layers,
  "chaos-thriver": Compass,
  "org-mismatch": Building2,
};

export function DemoIndex() {
  const { data: cases, isLoading, error } = useListDemoCases();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-primary">
          <span className="size-1.5 rounded-full bg-primary" /> Public demo
        </div>
        <h1 className="text-3xl font-mono font-semibold tracking-tight">
          Recruiting cognition, live.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
          Five deterministic cases run through the real framework — ingestion,
          flagship agents, cross-agent cognition, organization fit, escalation,
          calibration, decision support. No chatbot. No kanban. Just the trace.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading cases…
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive text-sm">
          Failed to load cases.
        </div>
      )}

      {cases && (
        <div className="grid gap-4 md:grid-cols-2">
          {cases.map((c) => {
            const Icon = CASE_ICON[c.caseId] ?? Sparkles;
            return (
              <Link
                key={c.caseId}
                href={`/replay/${c.caseId}`}
                className="group block rounded-lg border border-border bg-card hover:border-primary/50 transition-all p-6 hover-elevate active-elevate-2"
              >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                            {c.caseId}
                          </div>
                          <div className="text-lg font-semibold leading-tight">
                            {c.label}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {c.oneLiner}
                      </p>
                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                        <div>
                          <div className="text-muted-foreground/70 uppercase tracking-wider text-[10px] mb-1">
                            Candidate
                          </div>
                          <div className="font-mono">{c.candidateName}</div>
                          <div className="text-muted-foreground">
                            {c.targetRole}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground/70 uppercase tracking-wider text-[10px] mb-1">
                            Organization
                          </div>
                          <div className="font-mono">{c.organizationName}</div>
                          <div className="text-muted-foreground">
                            expects: {c.expectedRecommendation}
                          </div>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
              </Link>
            );
          })}
        </div>
      )}

      <footer className="border-t border-border pt-6 text-xs text-muted-foreground font-mono">
        Traces are deterministic. Same input → same bytes, every time. Replay
        runs against the real framework — no pre-recordings.
      </footer>
    </div>
  );
}

export default DemoIndex;
