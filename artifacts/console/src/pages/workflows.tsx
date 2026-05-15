import React from "react";
import { useListWorkflows } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Workflow as WorkflowIcon, ChevronDown } from "lucide-react";

export function Workflows() {
  const { data: workflows, isLoading } = useListWorkflows();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Loading workflows...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground">Automated sequences of agent-skill interactions.</p>
        </div>
      </div>

      {(!workflows || workflows.length === 0) ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg">
          <WorkflowIcon className="size-8 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground text-sm">No workflows defined.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {workflows.map((wf) => (
            <Card key={wf.id} className="bg-card/30 border-border/50">
              <CardHeader className="pb-3 border-b border-border/50 bg-secondary/20">
                <CardTitle className="text-lg">{wf.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{wf.description}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Trigger</span>
                  <span className="px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-xs font-mono">
                    {wf.trigger}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-0 relative">
                  {/* Vertical connector line */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border z-0" />
                  
                  {wf.steps.map((step, idx) => (
                    <div key={step.id} className="relative z-10 flex items-start gap-4 pb-6 last:pb-0">
                      <div className="size-8 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-xs font-mono text-muted-foreground">{idx + 1}</span>
                      </div>
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-blue-400">{step.agentId}</span>
                          <span className="text-muted-foreground text-xs font-mono">·</span>
                          <span className="font-mono text-sm text-emerald-400">{step.skillId}</span>
                        </div>
                        {step.description && (
                          <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
