import React from "react";
import { useListAgents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit } from "lucide-react";

export function Agents() {
  const { data: agents, isLoading } = useListAgents();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Querying registry...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">Autonomous entities operating within the framework.</p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
          {agents?.length || 0} CONFIGURED
        </div>
      </div>

      {(!agents || agents.length === 0) ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg">
          <BrainCircuit className="size-8 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground text-sm">No agents registered.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="bg-card/50 hover:bg-card transition-colors">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <div className="text-xs font-mono text-muted-foreground mt-1">{agent.role}</div>
                  </div>
                  <StatusDot status={agent.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground line-clamp-3 h-12">
                  {agent.description}
                </p>
                
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Capabilities</div>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>

                {agent.defaultProvider && (
                  <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Default Provider</span>
                    <span className="text-xs font-mono text-primary">{agent.defaultProvider}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
