/**
 * Persistent memory abstraction.
 *
 * Memory is a first-class moat: every signal an agent produces should be
 * retrievable later, scoped to a candidate, organization, role, or globally.
 * The interface is storage-agnostic — Postgres, vector stores, or hybrid
 * adapters can all plug in.
 */

import type { Confidence, Provenance, ScopeKind } from "../shared/index.js";

export interface MemoryEntry<T = unknown> {
  id: string;
  scope: ScopeKind;
  /** Stable identifier of the entity the memory is about (candidate id, org id, etc.). */
  subjectId: string;
  key: string;
  value: T;
  summary: string;
  confidence: Confidence;
  provenance: Provenance;
  createdAt: string;
  /** Optional embedding vector for semantic retrieval. */
  embedding?: number[];
  tags?: string[];
}

export interface MemoryQuery {
  scope?: ScopeKind;
  subjectId?: string;
  key?: string;
  tags?: string[];
  /** Free-text query for semantic / lexical search backends. */
  text?: string;
  /** Minimum confidence threshold to filter low-signal noise. */
  minConfidence?: Confidence;
  limit?: number;
}

export interface MemoryStore {
  put<T>(entry: MemoryEntry<T>): Promise<void>;
  get<T = unknown>(id: string): Promise<MemoryEntry<T> | null>;
  query<T = unknown>(q: MemoryQuery): Promise<MemoryEntry<T>[]>;
  forget(id: string): Promise<void>;
}

/**
 * In-memory reference implementation. Production deployments should plug in
 * a Postgres- or vector-store-backed adapter that implements the same
 * `MemoryStore` interface.
 */
export class InMemoryStore implements MemoryStore {
  private readonly data = new Map<string, MemoryEntry>();

  async put<T>(entry: MemoryEntry<T>): Promise<void> {
    this.data.set(entry.id, entry as MemoryEntry);
  }

  async get<T = unknown>(id: string): Promise<MemoryEntry<T> | null> {
    return (this.data.get(id) as MemoryEntry<T> | undefined) ?? null;
  }

  async query<T = unknown>(q: MemoryQuery): Promise<MemoryEntry<T>[]> {
    const results: MemoryEntry[] = [];
    for (const entry of this.data.values()) {
      if (q.scope && entry.scope !== q.scope) continue;
      if (q.subjectId && entry.subjectId !== q.subjectId) continue;
      if (q.key && entry.key !== q.key) continue;
      if (q.minConfidence !== undefined && entry.confidence < q.minConfidence)
        continue;
      if (q.tags && !q.tags.every((t) => entry.tags?.includes(t))) continue;
      results.push(entry);
    }
    return (q.limit ? results.slice(0, q.limit) : results) as MemoryEntry<T>[];
  }

  async forget(id: string): Promise<void> {
    this.data.delete(id);
  }
}
