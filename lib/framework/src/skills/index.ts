/**
 * Skill engine interfaces.
 *
 * A `Skill` is a reusable, declaratively-described unit of recruiting
 * cognition (e.g. "extract trajectory signals from a profile", "score
 * culture fit", "detect inconsistencies across sources"). Skills are pure
 * functions of their input + the surrounding `SkillContext` (memory,
 * providers, graphs). They are intentionally NOT pipeline stages.
 */

import type { MemoryStore } from "../memory/index.js";
import type { ProviderRegistry } from "../providers/index.js";
import type { Signal } from "../shared/index.js";

export type SkillCategory =
  | "extraction"
  | "scoring"
  | "comparison"
  | "synthesis"
  | "verification"
  | "reasoning"
  | "ingestion";

export interface SkillManifest {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  /** Human-readable input slot names; runtime schema is enforced by `inputSchema`. */
  inputs: readonly string[];
  outputs: readonly string[];
  /** Optional JSON-schema-shaped object used by the orchestrator to validate inputs. */
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export interface SkillContext {
  memory: MemoryStore;
  providers: ProviderRegistry;
  /** Identifier of the agent currently invoking this skill, for provenance. */
  invokedBy: string;
  /** Correlation id used to stitch logs/traces together. */
  traceId: string;
}

export interface Skill<TInput = unknown, TOutput = unknown> {
  readonly manifest: SkillManifest;
  execute(input: TInput, ctx: SkillContext): Promise<SkillResult<TOutput>>;
}

export interface SkillResult<TOutput = unknown> {
  output: TOutput;
  signals: Signal[];
  /** Free-form explanation suitable for the audit log / UI. */
  rationale: string;
}

/** Registry of skills available at runtime. */
export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  register<I, O>(skill: Skill<I, O>): void {
    this.skills.set(skill.manifest.id, skill as Skill);
  }

  get<I = unknown, O = unknown>(id: string): Skill<I, O> | undefined {
    return this.skills.get(id) as Skill<I, O> | undefined;
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }
}

export const globalSkillRegistry = new SkillRegistry();
