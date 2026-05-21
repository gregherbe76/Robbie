import { useRoute, Link } from "wouter";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  useGetLabRunSummary,
  useGetLabRunTrace,
} from "@workspace/api-client-react";
import type { ReplayTrace } from "@robbie/framework/replay";
import { Replay } from "@/pages/demo/replay";

export function LabRun() {
  const [, params] = useRoute("/lab/run/:runId");
  const runId = params?.runId ?? "";

  const summaryQ = useGetLabRunSummary(runId, {
    query: { enabled: !!runId } as never,
  });
  const traceQ = useGetLabRunTrace(runId, {
    query: { enabled: !!runId } as never,
  });

  if (!runId) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 font-mono text-sm">
        Missing runId.{" "}
        <Link href="/lab" className="underline text-primary">
          ← back to the lab
        </Link>
      </div>
    );
  }

  if (summaryQ.isLoading || traceQ.isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12 font-mono">
        <Loader2 className="size-4 animate-spin" /> Loading lab run{" "}
        <span className="font-mono">{runId}</span>…
      </div>
    );
  }

  if (summaryQ.error || traceQ.error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 space-y-2">
        <div className="text-destructive font-mono">
          Lab run not found or expired.
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          Lab runs are kept in memory for ~1 hour. Run it again to regenerate
          — identical input yields the same runId.
        </p>
        <Link href="/lab" className="text-sm text-primary underline">
          ← back to the lab
        </Link>
      </div>
    );
  }

  const trace = traceQ.data as unknown as ReplayTrace | undefined;
  if (!trace) return null;

  const banner = (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-200">
      <AlertTriangle className="size-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <span className="font-semibold">Cognition Lab run · demo only.</span>{" "}
        Synthetic data, no real candidates. Run id{" "}
        <span className="font-mono">{runId}</span> · expires{" "}
        {summaryQ.data
          ? new Date(summaryQ.data.expiresAt).toLocaleTimeString()
          : "—"}
        .
      </div>
    </div>
  );

  return (
    <Replay
      traceOverride={trace}
      backHref="/lab"
      backLabel="back to the lab"
      headerBanner={banner}
    />
  );
}

export default LabRun;
