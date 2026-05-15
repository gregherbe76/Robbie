/**
 * Shared primitives used across every framework module.
 *
 * Anything that crosses module boundaries (agent <-> skill <-> memory <-> provider)
 * should be expressed in these types. The recruiting domain is probabilistic, so
 * every signal, decision, and inference carries an explicit `Confidence` and
 * `Provenance` trail for explainability and auditability.
 */

export type ScopeKind = "candidate" | "organization" | "role" | "global";

export type Confidence = number; // 0..1

export interface Provenance {
  /** Component that produced this fact (agent id, skill id, ingestion source). */
  producedBy: string;
  /** When the fact was produced. ISO-8601. */
  producedAt: string;
  /** Free-form rationale or chain-of-evidence pointer. */
  rationale?: string;
  /** Upstream facts this depends on, for graph-style audit traversal. */
  derivedFrom?: string[];
}

export interface Signal<T = unknown> {
  id: string;
  kind: string;
  value: T;
  confidence: Confidence;
  provenance: Provenance;
}

export interface FrameworkEvent<T = unknown> {
  id: string;
  type: string;
  scope: ScopeKind;
  payload: T;
  occurredAt: string;
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
