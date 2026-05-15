import React from "react";
import { useGetOrganizationGraph } from "@workspace/api-client-react";
import { Shield } from "lucide-react";
import { GraphVisualizer } from "./shared";

export function OrganizationGraph() {
  const { data: snapshot, isLoading } = useGetOrganizationGraph();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Rendering organization topography...</div>;
  }

  return <GraphVisualizer title="Organization Graph" snapshot={snapshot} icon={<Shield className="size-8 text-muted-foreground mb-4 opacity-50" />} />;
}
