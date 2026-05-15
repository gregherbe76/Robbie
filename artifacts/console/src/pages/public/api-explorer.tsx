import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Play, Loader2, ArrowRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
  group: string;
  tryable?: { params?: Record<string, string> };
}

const ENDPOINTS: Endpoint[] = [
  // Public demo + benchmarks (anyone can hit these)
  { method: "GET", path: "/api/demo/cases", summary: "List demo cases.", group: "Demo & replay", tryable: {} },
  { method: "GET", path: "/api/demo/replay/{caseId}", summary: "Run a deterministic replay for one case.", group: "Demo & replay", tryable: { params: { caseId: "inflated-senior" } } },
  { method: "GET", path: "/api/benchmarks/report", summary: "Full benchmark report.", group: "Benchmarks", tryable: {} },
  { method: "GET", path: "/api/system/overview", summary: "System health + telemetry.", group: "System", tryable: {} },
  { method: "GET", path: "/api/healthz", summary: "Liveness probe.", group: "System", tryable: {} },
  { method: "GET", path: "/api/analytics/summary", summary: "Aggregate, privacy-safe page-view counters.", group: "System", tryable: {} },

  // Registries
  { method: "GET", path: "/api/registry/agents", summary: "All registered agents.", group: "Registries", tryable: {} },
  { method: "GET", path: "/api/registry/skills", summary: "All registered skills.", group: "Registries", tryable: {} },
  { method: "GET", path: "/api/registry/providers", summary: "All LLM providers.", group: "Registries", tryable: {} },
  { method: "GET", path: "/api/registry/workflows", summary: "All declarative workflows.", group: "Registries", tryable: {} },

  // Cognition + organization intelligence
  { method: "GET", path: "/api/intelligence/cognition", summary: "All cognitive syntheses.", group: "Cognition", tryable: {} },
  { method: "GET", path: "/api/intelligence/analyses", summary: "Candidate analyses.", group: "Cognition", tryable: {} },
  { method: "GET", path: "/api/organization-intelligence/context", summary: "Organization contexts.", group: "Cognition" },

  // Memory + graphs
  { method: "GET", path: "/api/memory/entries", summary: "Persistent memory entries.", group: "Memory & graphs", tryable: {} },
  { method: "GET", path: "/api/graph/candidate", summary: "Candidate knowledge graph snapshot.", group: "Memory & graphs", tryable: {} },
  { method: "GET", path: "/api/graph/organization", summary: "Organization knowledge graph snapshot.", group: "Memory & graphs", tryable: {} },

  // Evaluation + operations
  { method: "GET", path: "/api/evaluation/report", summary: "Full evaluation + calibration report.", group: "Evaluation", tryable: {} },
  { method: "GET", path: "/api/operations/report", summary: "Intelligence operations report.", group: "Operations", tryable: {} },
  { method: "GET", path: "/api/operations/cases", summary: "Open operations cases.", group: "Operations", tryable: {} },

  // Ingestion + collaboration
  { method: "GET", path: "/api/ingestion/state", summary: "Ingestion gateway state.", group: "Ingestion", tryable: {} },
  { method: "POST", path: "/api/ingestion/candidate", summary: "Ingest a candidate dossier.", group: "Ingestion" },
  { method: "GET", path: "/api/collaboration/state", summary: "Reviewer collaboration state.", group: "Collaboration", tryable: {} },
];

const GROUPS = Array.from(new Set(ENDPOINTS.map((e) => e.group)));

export function ApiExplorer() {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const base = useMemo(
    () => import.meta.env.BASE_URL.replace(/\/$/, ""),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-16">
      <div className="text-[11px] font-mono uppercase tracking-widest text-primary/80">
        API
      </div>
      <h1 className="mt-3 text-3xl md:text-4xl font-mono font-semibold tracking-tight">
        OpenAPI-driven. Try anything safely.
      </h1>
      <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">
        Every endpoint is defined in{" "}
        <Code>lib/api-spec/openapi.yaml</Code> and code-generated into React
        Query hooks and Zod schemas. The grouped list below covers the public
        and operator-facing surface; GET requests have a <em>Try it</em>{" "}
        button that runs against this server.
      </p>

      <div className="mt-10 space-y-8">
        {GROUPS.map((g) => (
          <div key={g}>
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {g}
            </h2>
            <div className="mt-3 rounded-lg border border-border bg-card divide-y divide-border/60">
              {ENDPOINTS.filter((e) => e.group === g).map((e) => {
                const key = `${e.method} ${e.path}`;
                const isOpen = openPath === key;
                return (
                  <div key={key}>
                    <button
                      onClick={() => setOpenPath(isOpen ? null : key)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background/40 transition-colors"
                    >
                      <MethodBadge method={e.method} />
                      <span className="font-mono text-sm">{e.path}</span>
                      <span className="ml-auto text-xs text-muted-foreground hidden md:block">
                        {e.summary}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                    {isOpen && (
                      <EndpointDetail endpoint={e} base={base} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold"
        >
          Docs <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function EndpointDetail({ endpoint, base }: { endpoint: Endpoint; base: string }) {
  const [params, setParams] = useState<Record<string, string>>(
    (endpoint.tryable?.params as Record<string, string> | undefined) ?? {},
  );
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resolvedPath = useMemo(() => {
    let p = endpoint.path;
    for (const [k, v] of Object.entries(params)) {
      p = p.replace(`{${k}}`, encodeURIComponent(v));
    }
    return p;
  }, [endpoint.path, params]);

  const fullUrl = `${base}${resolvedPath}`;
  const curl = `curl -s '${fullUrl}'`;

  const runIt = async () => {
    if (endpoint.method !== "GET") return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(fullUrl);
      const ct = res.headers.get("content-type") ?? "";
      const body = ct.includes("application/json")
        ? JSON.stringify(await res.json(), null, 2)
        : await res.text();
      setResponse(`HTTP ${res.status}\n\n${body.slice(0, 4000)}${body.length > 4000 ? "\n…" : ""}`);
    } catch (e) {
      setResponse(`error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const pathParams = (endpoint.path.match(/\{(\w+)\}/g) ?? []).map((s) =>
    s.slice(1, -1),
  );

  return (
    <div className="border-t border-border/40 bg-background/40 p-4 space-y-3">
      <div className="text-sm">{endpoint.summary}</div>

      {pathParams.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {pathParams.map((p) => (
            <label key={p} className="block">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {p}
              </span>
              <input
                value={params[p] ?? ""}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, [p]: e.target.value }))
                }
                className="mt-1 w-full rounded border border-border bg-card px-3 py-1.5 font-mono text-sm focus:border-primary focus:outline-none"
              />
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigator.clipboard?.writeText(curl)}
          className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-mono hover:border-primary/50"
        >
          <Copy className="size-3" /> curl
        </button>
        {endpoint.method === "GET" && endpoint.tryable && (
          <button
            onClick={runIt}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Try it
          </button>
        )}
        <span className="ml-auto text-[11px] font-mono text-muted-foreground truncate">
          {resolvedPath}
        </span>
      </div>

      <pre className="rounded border border-border bg-background p-3 text-xs font-mono overflow-x-auto">
        <code>{curl}</code>
      </pre>

      {response && (
        <pre className="rounded border border-primary/30 bg-card p-3 text-xs font-mono overflow-x-auto max-h-96">
          <code>{response}</code>
        </pre>
      )}
    </div>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase",
        method === "GET"
          ? "bg-primary/10 text-primary border border-primary/30"
          : "bg-amber-500/10 text-amber-300 border border-amber-500/30",
      )}
    >
      {method}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
      {children}
    </code>
  );
}

export default ApiExplorer;
