import React from "react";
import {
  useGetSystemOverview,
  useListMemoryEntries,
  useListReports,
  useHealthCheck
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Confidence, ScopeBadge, KindBadge } from "@/components/primitives";
import { formatDistanceToNow } from "date-fns";

export function Overview() {
  const { data: overview, isLoading: isOverviewLoading } = useGetSystemOverview();
  const { data: memoryEntries, isLoading: isMemoryLoading } = useListMemoryEntries();
  const { data: reports, isLoading: isReportsLoading } = useListReports();
  const { data: health, isLoading: isHealthLoading } = useHealthCheck();

  if (isOverviewLoading || isMemoryLoading || isReportsLoading || isHealthLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Gathering telemetry...</div>;
  }

  const metrics = [
    { label: "Status", value: health?.status === "ok" ? "ONLINE" : "DEGRADED", isStatus: true },
    { label: "Uptime", value: overview?.uptimeSeconds ? `${overview.uptimeSeconds}s` : "N/A" },
    { label: "Version", value: overview?.version || "N/A" },
    { label: "Agents", value: overview?.agents ?? 0 },
    { label: "Skills", value: overview?.skills ?? 0 },
    { label: "Providers", value: overview?.providers ?? 0 },
    { label: "Workflows", value: overview?.workflows ?? 0 },
    { label: "Memory Entries", value: overview?.memoryEntries ?? 0 },
    { label: "Candidate Nodes", value: overview?.candidateNodes ?? 0 },
    { label: "Org Nodes", value: overview?.organizationNodes ?? 0 },
    { label: "Reports", value: overview?.reports ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
        <div className="text-xs font-mono text-muted-foreground">LIVE TELEMETRY</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {metrics.map((m) => (
          <Card key={m.label} className="bg-card/50 border-border/50">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[10px] uppercase font-mono text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className={`text-lg font-mono ${m.isStatus ? (m.value === 'ONLINE' ? 'text-primary' : 'text-destructive') : 'text-foreground'}`}>
                {m.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight border-b border-border pb-2">Recent Memory</h2>
          <div className="space-y-3">
            {memoryEntries?.slice(0, 6).map((entry) => (
              <Card key={entry.id} className="bg-card/30">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScopeBadge scope={entry.scope} />
                      <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">{entry.key}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2">{entry.summary}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <Confidence value={entry.confidence} />
                    {entry.sourceAgentId && (
                      <span className="text-[10px] font-mono text-muted-foreground">src: {entry.sourceAgentId.substring(0, 8)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!memoryEntries || memoryEntries.length === 0) && (
              <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                No recent memory traces.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight border-b border-border pb-2">Recent Reports</h2>
          <div className="space-y-3">
            {reports?.slice(0, 6).map((report) => (
              <Card key={report.id} className="bg-card/30">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <KindBadge kind={report.kind} />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-medium text-sm">{report.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{report.summary}</p>
                  <div className="mt-2">
                    <Confidence value={report.confidence} />
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!reports || reports.length === 0) && (
              <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                No reports compiled yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
