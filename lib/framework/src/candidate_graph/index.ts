/**
 * Candidate graph.
 *
 * Trajectory matters more than static pedigree, so candidates are modelled
 * as a graph of roles, companies, projects, skills, mentors, and signals
 * with confidence-weighted edges. Graph queries answer questions like
 * "what is this candidate's signal density in distributed systems over
 * the last 5 years?" rather than flat keyword matching.
 */

import type { Confidence } from "../shared/index.js";

export type CandidateNodeType =
  | "candidate"
  | "role"
  | "company"
  | "project"
  | "skill"
  | "credential"
  | "signal";

export interface CandidateNode {
  id: string;
  type: CandidateNodeType;
  label: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export type CandidateRelation =
  | "held_role"
  | "worked_at"
  | "shipped"
  | "demonstrates"
  | "endorsed_by"
  | "mentored_by"
  | "evidences";

export interface CandidateEdge {
  from: string;
  to: string;
  relation: CandidateRelation;
  weight?: Confidence;
  metadata?: Record<string, unknown>;
}

export interface CandidateGraph {
  upsertNode(node: CandidateNode): Promise<void>;
  upsertEdge(edge: CandidateEdge): Promise<void>;
  neighbors(id: string, relation?: CandidateRelation): Promise<CandidateNode[]>;
  snapshot(): Promise<{ nodes: CandidateNode[]; edges: CandidateEdge[] }>;
}

export class InMemoryCandidateGraph implements CandidateGraph {
  private readonly nodes = new Map<string, CandidateNode>();
  private readonly edges: CandidateEdge[] = [];

  async upsertNode(node: CandidateNode): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async upsertEdge(edge: CandidateEdge): Promise<void> {
    this.edges.push(edge);
  }

  async neighbors(
    id: string,
    relation?: CandidateRelation,
  ): Promise<CandidateNode[]> {
    const out: CandidateNode[] = [];
    for (const edge of this.edges) {
      if (edge.from !== id) continue;
      if (relation && edge.relation !== relation) continue;
      const node = this.nodes.get(edge.to);
      if (node) out.push(node);
    }
    return out;
  }

  async snapshot(): Promise<{
    nodes: CandidateNode[];
    edges: CandidateEdge[];
  }> {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: [...this.edges],
    };
  }
}
