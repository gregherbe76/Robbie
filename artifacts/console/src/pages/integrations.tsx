/**
 * /console/integrations — ATS Integration Console.
 *
 * Operator-facing surface for the ATS Connection layer. Lists every
 * registered connection, surfaces credential / sync status, and lets
 * the operator trigger a sync or simulate a webhook event. This page
 * is the only console surface that uses the generated React Query
 * hooks (`useListATSConnections`, `useSyncATSConnection`,
 * `useIngestATSWebhook`) — the older /console/ats page continues to
 * use raw `getJson` for the deep replay introspection it owns.
 *
 * Read-only contract: nothing here writes back to the ATS. Sync re-
 * builds the replays deterministically from the adapter; webhook
 * ingestion acknowledges the event and re-syncs.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListATSConnections,
  useSyncATSConnection,
  useIngestATSWebhook,
  getListATSConnectionsQueryKey,
} from "@workspace/api-client-react";
import type { ATSConnection, ATSProvider } from "@workspace/api-client-react";
import { Plug, RefreshCw, Webhook, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: ATSConnection["status"] }) {
  const tone =
    status === "connected"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "unconfigured"
        ? "bg-zinc-700/40 text-zinc-300 border-zinc-600/40"
        : "bg-rose-500/15 text-rose-300 border-rose-500/30";
  const Icon =
    status === "connected"
      ? CheckCircle2
      : status === "error"
        ? AlertTriangle
        : Plug;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

function ProviderTag({ provider }: { provider: ATSProvider }) {
  return (
    <span className="rounded border border-zinc-700 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
      {provider}
    </span>
  );
}

function ConnectionCard({ conn }: { conn: ATSConnection }) {
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<string | null>(null);
  const sync = useSyncATSConnection({
    mutation: {
      onSuccess: (r) => {
        setLastResult(
          `synced ${r.result.replaysBuilt} replays, ${r.result.normalizedEvidence} evidence units in ${r.result.durationMs}ms`,
        );
        qc.invalidateQueries({ queryKey: getListATSConnectionsQueryKey() });
      },
      onError: (e) => setLastResult(`sync failed: ${String(e)}`),
    },
  });
  const webhook = useIngestATSWebhook({
    mutation: {
      onSuccess: (r) =>
        setLastResult(
          `webhook acknowledged · replayDelta=${r.replayDelta} · sync ${r.sync.replaysBuilt}/${r.sync.normalizedEvidence}`,
        ),
      onError: (e) => setLastResult(`webhook failed: ${String(e)}`),
    },
  });
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-100">{conn.label}</h3>
            <ProviderTag provider={conn.provider} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{conn.statusDetail}</p>
        </div>
        <StatusBadge status={conn.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
        <dt>Connection id</dt>
        <dd className="truncate font-mono text-zinc-300">{conn.id}</dd>
        <dt>Connected at</dt>
        <dd className="font-mono text-zinc-300">
          {new Date(conn.connectedAt).toISOString().slice(0, 10)}
        </dd>
        {conn.lastSyncedAt ? (
          <>
            <dt>Last sync</dt>
            <dd className="font-mono text-zinc-300">
              {new Date(conn.lastSyncedAt).toISOString().slice(0, 19)}Z
            </dd>
          </>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sync.isPending || conn.status !== "connected"}
          onClick={() => sync.mutate({ data: { connectionId: conn.id } })}
          className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-40"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")}
          />
          Sync
        </button>
        <button
          type="button"
          disabled={webhook.isPending || conn.status !== "connected"}
          onClick={() =>
            webhook.mutate({
              provider: conn.provider,
              data: {
                connectionId: conn.id,
                event: { kind: "scorecard.submitted" },
              },
            })
          }
          className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-40"
        >
          <Webhook className="h-3.5 w-3.5" />
          Replay webhook event
        </button>
      </div>

      {lastResult ? (
        <p className="mt-3 text-[11px] text-zinc-500">{lastResult}</p>
      ) : null}
    </div>
  );
}

export function Integrations() {
  const { data, isLoading, error } = useListATSConnections();
  const connections = data?.connections ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Read-only ATS connections. The framework ingests historical
          hiring evidence and reconstructs how the organization reasoned
          about it. Nothing on this page writes back to the ATS.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading connections…</p>
      ) : error ? (
        <p className="text-sm text-rose-300">
          Failed to load connections: {String(error)}
        </p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-zinc-500">No connections registered.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {connections.map((c) => (
            <ConnectionCard key={c.id} conn={c} />
          ))}
        </div>
      )}

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-medium text-zinc-200">Webhook endpoint</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Configure your ATS to POST signed events to:
        </p>
        <pre className="mt-2 overflow-x-auto rounded border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-[11px] text-zinc-300">
          POST /api/ats/webhook/&#123;provider&#125;
          {"\n"}
          Body: &#123; connectionId, event: &#123; kind, atsId? &#125; &#125;
        </pre>
        <p className="mt-2 text-[11px] text-zinc-500">
          The framework acknowledges and re-syncs the affected
          connection. Provider-specific signature verification is the
          adapter's responsibility before reaching the handler.
        </p>
      </section>
    </div>
  );
}
