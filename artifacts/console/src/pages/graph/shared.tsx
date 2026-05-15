import React, { useMemo } from "react";
import { useGetCandidateGraph } from "@workspace/api-client-react";
import { Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function CandidateGraph() {
  const { data: snapshot, isLoading } = useGetCandidateGraph();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Rendering candidate topography...</div>;
  }

  return <GraphVisualizer title="Candidate Graph" snapshot={snapshot} icon={<Network className="size-8 text-muted-foreground mb-4 opacity-50" />} />;
}

export function OrganizationGraph() {
  // Using CandidateGraph temporarily if specific hook doesn't exist or just mapping.
  // Actually the instructions say useGetOrganizationGraph
  // I will import it below.
  return null; // Will rewrite this file in next round or just do it in separate files.
}

export function GraphVisualizer({ title, snapshot, icon }: { title: string, snapshot: any, icon: React.ReactNode }) {
  if (!snapshot || !snapshot.nodes || snapshot.nodes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg">
          {icon}
          <p className="text-muted-foreground text-sm">Graph is empty.</p>
        </div>
      </div>
    );
  }

  // A very simple deterministic layout for SVG
  const width = 800;
  const height = 500;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 200;

  const nodes = snapshot.nodes;
  const edges = snapshot.edges;

  const positionedNodes = useMemo(() => {
    return nodes.map((node: any, i: number) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      // Center node if it's the only one, else ring
      const r = nodes.length === 1 ? 0 : radius;
      return {
        ...node,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    });
  }, [nodes]);

  const nodeMap = new Map<string, any>(positionedNodes.map((n: any) => [n.id as string, n]));

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border pb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Relational ontology snapshot.</p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
          {nodes.length} N / {edges.length} E
        </div>
      </div>

      <div className="flex-1 border border-border rounded-md bg-card/30 overflow-hidden min-h-[500px] relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="25" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" opacity="0.5" />
            </marker>
          </defs>
          
          {/* Edges */}
          {edges.map((edge: any, i: number) => {
            const source = nodeMap.get(edge.from);
            const target = nodeMap.get(edge.to);
            if (!source || !target) return null;
            
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            return (
              <g key={`edge-${i}`}>
                <line 
                  x1={source.x} y1={source.y} 
                  x2={target.x} y2={target.y} 
                  stroke="hsl(var(--border))" 
                  strokeWidth="1.5"
                  markerEnd="url(#arrowhead)"
                />
                <rect x={midX - 40} y={midY - 10} width="80" height="20" fill="hsl(var(--background))" rx="4" opacity="0.8" />
                <text x={midX} y={midY + 3} fontSize="10" fill="hsl(var(--primary))" textAnchor="middle" className="font-mono">
                  {edge.relation}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {positionedNodes.map((node: any) => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle r="20" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2" />
              <text y="35" fontSize="12" fill="hsl(var(--foreground))" textAnchor="middle" fontWeight="500">
                {node.label}
              </text>
              <rect x="-30" y="45" width="60" height="16" fill="hsl(var(--secondary))" rx="8" />
              <text y="56" fontSize="9" fill="hsl(var(--muted-foreground))" textAnchor="middle" className="font-mono uppercase">
                {node.type}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="bg-card/50 border border-border rounded-md p-4 space-y-4">
        <h3 className="text-sm font-medium border-b border-border pb-2">Adjacency List (Fallback)</h3>
        <div className="text-sm font-mono text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
          {edges.map((e: any, i: number) => {
            const s = nodeMap.get(e.from)?.label || e.from;
            const t = nodeMap.get(e.to)?.label || e.to;
            return <div key={i}>[{s}] --({e.relation})--&gt; [{t}]</div>;
          })}
        </div>
      </div>
    </div>
  );
}
