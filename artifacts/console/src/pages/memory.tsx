import React, { useState } from "react";
import { useListMemoryEntries } from "@workspace/api-client-react";
import { ScopeBadge, Confidence } from "@/components/primitives";
import { Database, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function Memory() {
  const { data: entries, isLoading } = useListMemoryEntries();
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Scanning persistent memory...</div>;
  }

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border pb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memory</h1>
          <p className="text-sm text-muted-foreground">
            Persistent contextual traces. Every entry carries provenance for audit.
          </p>
        </div>
      </div>

      {(!entries || entries.length === 0) ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg flex-1">
          <Database className="size-8 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground text-sm">Memory bank is empty.</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-x-auto bg-card/30 flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 font-mono text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Produced By</th>
                <th className="px-4 py-3 font-medium text-right">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {entries.map((entry) => {
                const isOpen = openId === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setOpenId(isOpen ? null : entry.id)}
                    >
                      <td className="px-4 py-3 align-top">
                        <ChevronRight
                          className={cn(
                            "size-3 text-muted-foreground transition-transform",
                            isOpen && "rotate-90",
                          )}
                        />
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <ScopeBadge scope={entry.scope} />
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {entry.subjectId}
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-primary max-w-[200px] truncate" title={entry.key}>
                        {entry.key}
                      </td>
                      <td className="px-4 py-3 align-top max-w-md">
                        <div className="line-clamp-2" title={entry.summary}>{entry.summary}</div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <Confidence value={entry.confidence} />
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {entry.provenance.producedBy}
                      </td>
                      <td className="px-4 py-3 align-top text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-secondary/20">
                        <td></td>
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                            <div>
                              <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Produced At</div>
                              <div className="font-mono">
                                {new Date(entry.provenance.producedAt).toISOString()}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Rationale</div>
                              <div className="text-foreground/90">
                                {entry.provenance.rationale ?? <span className="text-muted-foreground italic">No rationale recorded.</span>}
                              </div>
                            </div>
                            {entry.provenance.derivedFrom && entry.provenance.derivedFrom.length > 0 && (
                              <div className="md:col-span-3">
                                <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Derived From</div>
                                <div className="flex flex-wrap gap-1">
                                  {entry.provenance.derivedFrom.map((d) => (
                                    <span key={d} className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary border border-border">{d}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="md:col-span-3">
                                <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Tags</div>
                                <div className="flex flex-wrap gap-1">
                                  {entry.tags.map((t) => (
                                    <span key={t} className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
