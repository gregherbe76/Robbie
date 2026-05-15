/**
 * BaseAgent — abstract base class for production intelligence agents.
 *
 * Wraps subclass-specific `analyze()` logic with deterministic provenance,
 * reasoning capture, and evidence attribution. Subclasses implement two
 * methods: `analyze(dossier)` to produce the typed result, and the static
 * `manifest` to declare metadata.
 *
 * Adapts the framework's generic `Agent` interface (event-driven `handle`)
 * to a strongly-typed dossier-driven workflow without losing compatibility.
 */

import type { Agent, AgentInvocation, AgentResult } from "../index.js";
import type { AgentManifest, AgentStatus } from "../index.js";
import type { Signal } from "../../shared/index.js";
import {
  type AgentReasoning,
  type CandidateDossier,
  type ReasoningStep,
} from "./types.js";

export interface BaseAgentDeps {
  /** Optional clock injection for deterministic tests. */
  now?: () => Date;
}

export abstract class BaseAgent<TResult> implements Agent {
  public abstract readonly manifest: AgentManifest;
  public status: AgentStatus = "active";

  protected readonly now: () => Date;

  constructor(deps: BaseAgentDeps = {}) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Subclasses implement the agent-specific reasoning. They must also
   * populate the reasoning trace and evidence chain via the helpers
   * provided in this base class.
   */
  protected abstract analyzeDossier(dossier: CandidateDossier): {
    result: TResult;
    reasoning: ReasoningStep[];
    evidenceChain: string[];
    /** 0..1 — agent's confidence in its own output. */
    confidence: number;
    /** Optional plain-language summary line for the rationale field. */
    rationaleSummary?: string;
  };

  /**
   * Public, deterministic entry point. Runs `analyzeDossier`, attaches
   * provenance, and returns an `AgentReasoning` envelope.
   */
  public run(dossier: CandidateDossier): AgentReasoning<TResult> {
    const { result, reasoning, evidenceChain, confidence, rationaleSummary } =
      this.analyzeDossier(dossier);

    return {
      agentId: this.manifest.id,
      candidateId: dossier.candidateId,
      result,
      confidence,
      reasoning,
      evidenceChain,
      provenance: {
        producedBy: this.manifest.id,
        producedAt: this.now().toISOString(),
        rationale:
          rationaleSummary ??
          `${this.manifest.name} executed against dossier ${dossier.candidateId}.`,
        derivedFrom: evidenceChain,
      },
    };
  }

  /**
   * Bridge into the existing event-driven `Agent` contract. The orchestrator
   * passes a dossier on `event.payload`; we lift the typed result into a
   * generic `Signal[]` so downstream consumers can subscribe uniformly.
   */
  async handle<T>(invocation: AgentInvocation<T>): Promise<AgentResult> {
    const dossier = invocation.event.payload as unknown as CandidateDossier;
    if (!dossier || typeof dossier !== "object" || !("candidateId" in dossier)) {
      return {
        signals: [],
        rationale: `${this.manifest.id} received non-dossier payload; skipped.`,
      };
    }
    const out = this.run(dossier);
    const signal: Signal<TResult> = {
      id: `${out.agentId}:${out.candidateId}:${invocation.ctx.traceId}`,
      kind: this.manifest.id,
      value: out.result,
      confidence: out.confidence,
      provenance: out.provenance,
    };
    return {
      signals: [signal as Signal],
      rationale: out.provenance.rationale ?? this.manifest.name,
    };
  }
}
