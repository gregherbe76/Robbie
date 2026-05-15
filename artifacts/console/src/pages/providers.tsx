import React from "react";
import { useListProviders } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDot } from "@/components/primitives";
import { Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Providers() {
  const { data: providers, isLoading } = useListProviders();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Connecting to providers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Providers</h1>
          <p className="text-sm text-muted-foreground">LLM service integrations.</p>
        </div>
      </div>

      {(!providers || providers.length === 0) ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg">
          <Server className="size-8 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground text-sm">No providers connected.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider) => (
            <Card key={provider.id} className="bg-card/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg">{provider.name}</h3>
                    <div className="text-xs font-mono text-muted-foreground mt-1 uppercase">{provider.kind}</div>
                  </div>
                  <StatusDot status={provider.status} />
                </div>
                
                <div className="space-y-2 border-t border-border/50 pt-4">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Supported Models</span>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.models.length > 0 ? (
                      provider.models.map(m => (
                        <Badge key={m} variant="outline" className="font-mono text-xs border-primary/20 bg-primary/5 text-primary">
                          {m}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">None enumerated</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
