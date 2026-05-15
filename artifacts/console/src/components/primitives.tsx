import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Confidence({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground text-xs">N/A</span>;
  
  const percentage = Math.round(value * 100);
  let colorClass = "bg-primary";
  if (value < 0.4) colorClass = "bg-destructive";
  else if (value < 0.7) colorClass = "bg-yellow-500";
  
  return (
    <div className="flex items-center gap-2" title={`Confidence: ${percentage}%`}>
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full", colorClass)} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{percentage}%</span>
    </div>
  );
}

export function ScopeBadge({ scope }: { scope: string }) {
  const scopeColors: Record<string, string> = {
    candidate: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    organization: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    role: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    global: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  };
  
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px] uppercase", scopeColors[scope.toLowerCase()] || "bg-primary/10 text-primary border-primary/20")}>
      {scope}
    </Badge>
  );
}

export function StatusDot({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    active: "bg-primary",
    idle: "bg-amber-500",
    disabled: "bg-destructive",
    configured: "bg-primary",
    unconfigured: "bg-destructive",
  };
  
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("size-2 rounded-full", statusColors[status.toLowerCase()] || "bg-muted")} />
      <span className="text-xs capitalize text-muted-foreground">{status}</span>
    </div>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <Badge variant="secondary" className="font-mono text-[10px] uppercase">
      {kind}
    </Badge>
  );
}
