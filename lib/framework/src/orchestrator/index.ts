/**
 * Orchestrator.
 *
 * Brokers `FrameworkEvent`s between agents and workflows. Event-driven by
 * design so the framework can scale horizontally and so every routing
 * decision is observable. The reference implementation is in-process; an
 * adapter for an external queue (NATS, Kafka, Postgres LISTEN/NOTIFY) can
 * be slotted in without touching agents or skills.
 */

import type { AgentRegistry } from "../agents/index.js";
import type { MemoryStore } from "../memory/index.js";
import type { ProviderRegistry } from "../providers/index.js";
import type { SkillRegistry } from "../skills/index.js";
import type { FrameworkEvent } from "../shared/index.js";

export type EventHandler = (event: FrameworkEvent) => Promise<void> | void;

export interface OrchestratorOptions {
  agents: AgentRegistry;
  skills: SkillRegistry;
  providers: ProviderRegistry;
  memory: MemoryStore;
}

export class Orchestrator {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly subscribers = new Set<EventHandler>();

  constructor(private readonly opts: OrchestratorOptions) {}

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  subscribe(handler: EventHandler): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  async dispatch(event: FrameworkEvent): Promise<void> {
    const typed = this.handlers.get(event.type) ?? new Set();
    await Promise.all([
      ...Array.from(typed).map((h) => h(event)),
      ...Array.from(this.subscribers).map((h) => h(event)),
    ]);
  }

  get registries(): OrchestratorOptions {
    return this.opts;
  }
}
