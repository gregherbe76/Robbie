/**
 * Organization graph.
 *
 * Models the hiring organization side: teams, roles, hiring managers,
 * culture vectors, calibration history, and the implicit signals an org
 * uses to evaluate candidates. Pairing this with the candidate graph
 * powers fit reasoning that is bidirectional rather than one-sided.
 */

import type { Confidence } from "../shared/index.js";

export type OrganizationNodeType =
  | "organization"
  | "team"
  | "role"
  | "hiring_manager"
  | "competency"
  | "calibration";

export interface OrganizationNode {
  id: string;
  type: OrganizationNodeType;
  label: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export type OrganizationRelation =
  | "owns"
  | "reports_to"
  | "requires"
  | "values"
  | "calibrated_against";

export interface OrganizationEdge {
  from: string;
  to: string;
  relation: OrganizationRelation;
  weight?: Confidence;
  metadata?: Record<string, unknown>;
}

export interface OrganizationGraph {
  upsertNode(node: OrganizationNode): Promise<void>;
  upsertEdge(edge: OrganizationEdge): Promise<void>;
  snapshot(): Promise<{
    nodes: OrganizationNode[];
    edges: OrganizationEdge[];
  }>;
}

export class InMemoryOrganizationGraph implements OrganizationGraph {
  private readonly nodes = new Map<string, OrganizationNode>();
  private readonly edges: OrganizationEdge[] = [];

  async upsertNode(node: OrganizationNode): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async upsertEdge(edge: OrganizationEdge): Promise<void> {
    this.edges.push(edge);
  }

  async snapshot(): Promise<{
    nodes: OrganizationNode[];
    edges: OrganizationEdge[];
  }> {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: [...this.edges],
    };
  }
}
