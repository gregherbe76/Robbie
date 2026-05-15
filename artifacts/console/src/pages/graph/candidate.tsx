import React from "react";
import { useGetCandidateGraph } from "@workspace/api-client-react";
import { Network } from "lucide-react";
import { GraphVisualizer } from "./shared";

export function CandidateGraph() {
  const { data: snapshot, isLoading } = useGetCandidateGraph();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Rendering candidate topography...</div>;
  }

  return <GraphVisualizer title="Candidate Graph" snapshot={snapshot} icon={<Network className="size-8 text-muted-foreground mb-4 opacity-50" />} />;
}
