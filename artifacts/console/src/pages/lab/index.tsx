import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FlaskConical, Loader2, Play, AlertTriangle } from "lucide-react";
import { useCreateLabRun } from "@workspace/api-client-react";
import type { LabRunRequest, LabRunSummary } from "@workspace/api-client-react";

const SCENARIOS: ReadonlyArray<{
  id:
    | "founder-builder"
    | "inflated-senior"
    | "ambiguous-generalist"
    | "chaos-thriver"
    | "org-mismatch";
  label: string;
  oneLiner: string;
}> = [
  {
    id: "founder-builder",
    label: "The Founder-Builder",
    oneLiner: "Generalist with breadth vs. a specialist role.",
  },
  {
    id: "inflated-senior",
    label: "The Inflated Senior",
    oneLiner: "Pedigree on paper, contradictions in evidence.",
  },
  {
    id: "ambiguous-generalist",
    label: "The Ambiguous Generalist",
    oneLiner: "Strong everywhere, exceptional nowhere.",
  },
  {
    id: "chaos-thriver",
    label: "The Chaos-Thriver",
    oneLiner: "Thrives in ambiguity; flatlines in structure.",
  },
  {
    id: "org-mismatch",
    label: "The Org Mismatch",
    oneLiner: "Genuinely strong, wrong company stage.",
  },
];

type Mode = "scenario" | "synthetic";

export function LabIndex() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("scenario");

  // scenario state
  const [scenarioId, setScenarioId] = useState<(typeof SCENARIOS)[number]["id"]>(
    "founder-builder",
  );

  // synthetic state
  const [label, setLabel] = useState("");
  const [dossierJson, setDossierJson] = useState("");
  const [organizationJson, setOrganizationJson] = useState("");

  // shared
  const [resumeText, setResumeText] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const createRun = useCreateLabRun({
    mutation: {
      onSuccess: (data: LabRunSummary) => {
        setLocation(`/lab/run/${data.runId}`);
      },
    },
  });

  function runScenario() {
    setJsonError(null);
    const body: LabRunRequest = {
      mode: "scenario",
      scenarioId,
      resumeText: resumeText || undefined,
      transcriptText: transcriptText || undefined,
    };
    createRun.mutate({ data: body });
  }

  function runSynthetic() {
    setJsonError(null);
    let dossier: unknown;
    let organization: unknown;
    try {
      dossier = JSON.parse(dossierJson);
    } catch {
      setJsonError("dossier JSON is not valid.");
      return;
    }
    try {
      organization = JSON.parse(organizationJson);
    } catch {
      setJsonError("organization JSON is not valid.");
      return;
    }
    const body: LabRunRequest = {
      mode: "synthetic",
      label: label || undefined,
      dossier: dossier as Record<string, unknown>,
      organization: organization as Record<string, unknown>,
      resumeText: resumeText || undefined,
      transcriptText: transcriptText || undefined,
    };
    createRun.mutate({ data: body });
  }

  const apiError = createRun.error as unknown as
    | { detail?: string; error?: string }
    | undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-3" /> home
        </Link>
        <div className="flex items-center gap-3">
          <div className="size-9 rounded bg-primary/15 flex items-center justify-center text-primary border border-primary/40">
            <FlaskConical className="size-5" />
          </div>
          <h1 className="text-3xl font-mono font-semibold tracking-tight">
            Cognition Lab
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
          A public sandbox for deterministic hiring cognition. Pick a canonical
          scenario or supply your own synthetic dossier — the framework's real
          ingestion, scoring, org-fit, escalation, and calibration engines run
          end-to-end with a fixed clock and a sha256 replay signature.
        </p>
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-200 max-w-2xl">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Demo only.</span> This is a public
            playground over synthetic data — no recruiting decisions, no real
            candidates, no PII. Runs are stored in memory for ~1 hour.
          </p>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="inline-flex rounded-md border border-border overflow-hidden text-xs font-mono">
        <button
          type="button"
          onClick={() => setMode("scenario")}
          className={
            "px-4 py-2 transition-colors " +
            (mode === "scenario"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Canonical scenario
        </button>
        <button
          type="button"
          onClick={() => setMode("synthetic")}
          className={
            "px-4 py-2 transition-colors border-l border-border " +
            (mode === "synthetic"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Synthetic dossier
        </button>
      </div>

      {mode === "scenario" ? (
        <section className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            1 — Pick a scenario
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {SCENARIOS.map((s) => {
              const active = s.id === scenarioId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenarioId(s.id)}
                  className={
                    "text-left rounded-md border p-3 transition-colors " +
                    (active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40")
                  }
                >
                  <div className="font-mono text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.oneLiner}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                    {s.id}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            1 — Synthetic dossier + organization
          </h2>
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground">
              Label (optional)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 120))}
              placeholder="e.g. 'Founder-Engineer vs. Series-A platform team'"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono"
              maxLength={120}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <JsonField
              label="Candidate dossier (CandidateDossier JSON)"
              value={dossierJson}
              onChange={setDossierJson}
              placeholder='{"name":"Jane","targetRole":"Staff Eng","claims":[],"evidence":[]}'
            />
            <JsonField
              label="Organization (OrganizationContext JSON)"
              value={organizationJson}
              onChange={setOrganizationJson}
              placeholder='{"name":"Acme","stage":"series-a","domains":[]}'
            />
          </div>
          {jsonError && (
            <div className="text-xs text-destructive font-mono">{jsonError}</div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
          2 — Optional synthetic evidence
        </h2>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Sentences are split and appended as resume claims (source: cv) and
          transcript evidence (source: interview). 8 KB max per field.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <TextArea
            label="Synthetic resume text"
            value={resumeText}
            onChange={setResumeText}
            placeholder="Shipped a real-time matching engine handling 5M events/day…"
          />
          <TextArea
            label="Synthetic transcript text"
            value={transcriptText}
            onChange={setTranscriptText}
            placeholder="When the staging cluster failed mid-launch I rewrote the consumer in two hours…"
          />
        </div>
      </section>

      <section className="flex items-center justify-between gap-4 border-t border-border pt-6">
        <div className="text-xs text-muted-foreground font-mono">
          Total input is capped at 64 KB. Runs are content-addressed —
          identical inputs always yield the same runId.
        </div>
        <button
          type="button"
          onClick={mode === "scenario" ? runScenario : runSynthetic}
          disabled={createRun.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {createRun.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Run cognition
        </button>
      </section>

      {apiError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs font-mono text-destructive">
          {apiError.error ?? "lab_run_failed"}
          {apiError.detail ? `: ${apiError.detail}` : ""}
        </div>
      )}
    </div>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-mono text-muted-foreground">
        {props.label}{" "}
        <span className="text-muted-foreground/60">
          ({props.value.length}/8192)
        </span>
      </label>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value.slice(0, 8192))}
        placeholder={props.placeholder}
        rows={8}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-mono leading-relaxed"
      />
    </div>
  );
}

function JsonField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-mono text-muted-foreground">
        {props.label}
      </label>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value.slice(0, 32768))}
        placeholder={props.placeholder}
        rows={10}
        spellCheck={false}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-mono leading-relaxed"
      />
    </div>
  );
}

export default LabIndex;
