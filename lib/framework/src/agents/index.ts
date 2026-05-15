/**
 * Specialized agents.
 *
 * Each `Agent` owns a narrow recruiting cognition role: sourcing signals,
 * trajectory analysis, reference triangulation, bias auditing, etc. Agents
 * compose `Skills` against `Memory` through a chosen `Provider`. They never
 * communicate directly with each other — the orchestrator brokers messages
 * as `FrameworkEvent`s.
 */

import type { MemoryStore } from "../memory/index.js";
import type { ProviderRegistry } from "../providers/index.js";
import type { SkillRegistry } from "../skills/index.js";
import type { FrameworkEvent, Signal } from "../shared/index.js";

export type AgentStatus = "active" | "idle" | "disabled";

export interface AgentManifest {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: readonly string[];
  /** Skill ids this agent is allowed to invoke. */
  allowedSkills: readonly string[];
  /** Default provider id for LLM-backed reasoning. */
  defaultProvider?: string;
}

export interface AgentContext {
  memory: MemoryStore;
  providers: ProviderRegistry;
  skills: SkillRegistry;
  traceId: string;
}

export interface AgentInvocation<T = unknown> {
  event: FrameworkEvent<T>;
  ctx: AgentContext;
}

export interface AgentResult {
  signals: Signal[];
  emit?: FrameworkEvent[];
  rationale: string;
}

export interface Agent {
  readonly manifest: AgentManifest;
  status: AgentStatus;
  handle<T>(invocation: AgentInvocation<T>): Promise<AgentResult>;
}

export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  register(agent: Agent): void {
    this.agents.set(agent.manifest.id, agent);
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  list(): Agent[] {
    return Array.from(this.agents.values());
  }
}

export const globalAgentRegistry = new AgentRegistry();
