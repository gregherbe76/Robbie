import React from "react";
import { useListReports } from "@workspace/api-client-react";
import { KindBadge, Confidence } from "@/components/primitives";
import { FileText } from "lucide-react";
import { format } from "date-fns";

export function Reports() {
  const { data: reports, isLoading } = useListReports();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Fetching compiled reports...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Synthesised intelligence briefs with full evidence chain.
          </p>
        </div>
      </div>

      {(!reports || reports.length === 0) ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg">
          <FileText className="size-8 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground text-sm">No reports available.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article
              key={report.id}
              className="border border-border rounded-md bg-card/40 hover:border-primary/40 transition-colors"
            >
              <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border/60">
                <div className="flex items-start gap-3">
                  <KindBadge kind={report.kind} />
                  <div>
                    <h3 className="font-semibold text-base leading-tight">{report.title}</h3>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {format(new Date(report.createdAt), "yyyy-MM-dd HH:mm")} · {report.id}
                    </div>
                  </div>
                </div>
                <div className="min-w-[140px]">
                  <Confidence value={report.confidence} />
                </div>
              </header>

              <div className="px-5 py-4 space-y-4">
                <p className="text-sm text-foreground/90">{report.summary}</p>

                {report.sections.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.sections.map((s, i) => (
                      <div key={i} className="border border-border/60 rounded p-3 bg-background/40">
                        <div className="font-mono text-[10px] uppercase text-primary/80 tracking-wider mb-1">
                          {s.heading}
                        </div>
                        <div className="text-xs text-foreground/80 leading-relaxed">{s.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                {report.evidence.length > 0 ? (
                  <div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground mb-2 tracking-wider">
                      Evidence Chain · {report.evidence.length}
                    </div>
                    <div className="space-y-1">
                      {report.evidence.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center gap-3 text-xs font-mono py-1.5 px-2 rounded bg-secondary/40 border border-border/40"
                        >
                          <span className="text-[10px] uppercase text-muted-foreground w-20 shrink-0">{e.kind}</span>
                          <span className="flex-1 truncate text-foreground/90">{e.summary}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{e.producedBy}</span>
                          <div className="w-16 shrink-0">
                            <Confidence value={e.confidence} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">
                    No discrete signals attached — narrative-only synthesis.
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
