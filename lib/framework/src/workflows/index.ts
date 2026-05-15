/**
 * Workflow engine skeleton.
 *
 * Workflows declaratively compose agents + skills around a trigger. They are
 * deliberately NOT recruiting pipeline stages — they are reasoning programs
 * (e.g. "when a profile arrives, trigger trajectory analysis + reference
 * triangulation + bias audit, then synthesise a report").
 */

import type { Orchestrator } from "../orchestrator/index.js";
import type { FrameworkEvent } from "../shared/index.js";

export interface WorkflowStep {
  id: string;
  agentId: string;
  skillId: string;
  /** Static input mapping or a function evaluated against the event payload. */
  input?: Record<string, unknown> | ((event: FrameworkEvent) => unknown);
  description?: string;
}

export interface WorkflowManifest {
  id: string;
  name: string;
  description: string;
  /** Event type that triggers this workflow. */
  trigger: string;
  steps: WorkflowStep[];
}

export interface Workflow {
  manifest: WorkflowManifest;
  run(event: FrameworkEvent, orchestrator: Orchestrator): Promise<void>;
}

export class WorkflowRegistry {
  private readonly workflows = new Map<string, Workflow>();

  register(wf: Workflow): void {
    this.workflows.set(wf.manifest.id, wf);
  }

  get(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  list(): Workflow[] {
    return Array.from(this.workflows.values());
  }
}

export const globalWorkflowRegistry = new WorkflowRegistry();
