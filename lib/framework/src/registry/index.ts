/**
 * Composite registry.
 *
 * Single seam to wire every framework component into the runtime. The HTTP
 * control plane and the orchestrator both read from this object instead of
 * importing module singletons directly — keeps tests hermetic and makes
 * multi-tenant deployments trivial.
 */

import { AgentRegistry, globalAgentRegistry } from "../agents/index.js";
import { SkillRegistry, globalSkillRegistry } from "../skills/index.js";
import {
  ProviderRegistry,
  globalProviderRegistry,
} from "../providers/index.js";
import {
  WorkflowRegistry,
  globalWorkflowRegistry,
} from "../workflows/index.js";
import { InMemoryStore, type MemoryStore } from "../memory/index.js";
import {
  InMemoryCandidateGraph,
  type CandidateGraph,
} from "../candidate_graph/index.js";
import {
  InMemoryOrganizationGraph,
  type OrganizationGraph,
} from "../organization_graph/index.js";
import { InMemoryReportStore, type ReportStore } from "../reports/index.js";

export * from "./manifests.js";

export interface FrameworkRegistry {
  agents: AgentRegistry;
  skills: SkillRegistry;
  providers: ProviderRegistry;
  workflows: WorkflowRegistry;
  memory: MemoryStore;
  candidateGraph: CandidateGraph;
  organizationGraph: OrganizationGraph;
  reports: ReportStore;
}

export function createFrameworkRegistry(): FrameworkRegistry {
  return {
    agents: globalAgentRegistry,
    skills: globalSkillRegistry,
    providers: globalProviderRegistry,
    workflows: globalWorkflowRegistry,
    memory: new InMemoryStore(),
    candidateGraph: new InMemoryCandidateGraph(),
    organizationGraph: new InMemoryOrganizationGraph(),
    reports: new InMemoryReportStore(),
  };
}
