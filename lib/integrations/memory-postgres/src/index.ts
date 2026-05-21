/**
 * @robbie/memory-postgres — Postgres-backed MemoryStore adapter.
 *
 * Implements the `MemoryStore` interface from `@robbie/framework/memory`
 * against a Postgres database (with optional pgvector support for
 * semantic queries).
 *
 * Usage:
 *
 *   import { Pool } from "pg";
 *   import { PostgresMemoryStore } from "@robbie/memory-postgres";
 *
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const store = new PostgresMemoryStore({ pool });
 *   await store.migrate(); // run once; idempotent
 *
 * Production deployments should keep `migrate()` out of the request path
 * and run `schema.sql` (shipped alongside this package) as part of their
 * deployment pipeline.
 *
 * The adapter is **storage-only** — it does not enforce framework
 * invariants. Callers must continue to construct provenance, confidence,
 * and ids through the framework's own engines.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  MemoryEntry,
  MemoryQuery,
  MemoryStore,
} from "@robbie/framework/memory";

/**
 * Minimal `pg`-compatible client surface. We don't import `pg` directly so
 * this package compiles without `pg` being installed and so callers can
 * pass any compatible client (Pool, PoolClient, Client, transactions).
 */
export interface PgQueryable {
  query(text: string, values?: readonly unknown[]): Promise<{
    rows: Array<Record<string, unknown>>;
    rowCount: number | null;
  }>;
}

export interface PostgresMemoryStoreOptions {
  /** A `pg` Pool, PoolClient, or any object implementing `query()`. */
  pool: PgQueryable;
  /**
   * Whether to use the pgvector `vector` column for embeddings.
   * Defaults to `true`. Set `false` if your DB does not have pgvector;
   * embeddings are then stored as JSON and semantic search is disabled.
   */
  pgvector?: boolean;
  /** Override the table name (default: `robbie_memory_entries`). */
  table?: string;
}

const DEFAULT_TABLE = "robbie_memory_entries";

export class PostgresMemoryStore implements MemoryStore {
  private readonly pool: PgQueryable;
  private readonly pgvector: boolean;
  private readonly table: string;

  constructor(opts: PostgresMemoryStoreOptions) {
    this.pool = opts.pool;
    this.pgvector = opts.pgvector ?? true;
    this.table = opts.table ?? DEFAULT_TABLE;
  }

  /**
   * Apply the schema. Idempotent — safe to call on every boot, but you
   * probably want to apply it once at deploy time instead.
   */
  async migrate(): Promise<void> {
    const here = dirname(fileURLToPath(import.meta.url));
    // From dist/index.js → up one level to package root, where schema.sql lives.
    const schemaPath = join(here, "..", "schema.sql");
    const sql = await readFile(schemaPath, "utf-8");
    await this.pool.query(sql);
  }

  async put<T>(entry: MemoryEntry<T>): Promise<void> {
    const embeddingVec = this.pgvector && entry.embedding ? toVectorLiteral(entry.embedding) : null;
    const embeddingJson = !this.pgvector && entry.embedding ? JSON.stringify(entry.embedding) : null;

    const sql = `
      INSERT INTO ${this.table}
        (id, scope, subject_id, key, value, summary, confidence, provenance,
         created_at, embedding, embedding_json, tags)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9, $10::vector, $11::jsonb, $12)
      ON CONFLICT (id) DO UPDATE SET
        scope          = EXCLUDED.scope,
        subject_id     = EXCLUDED.subject_id,
        key            = EXCLUDED.key,
        value          = EXCLUDED.value,
        summary        = EXCLUDED.summary,
        confidence     = EXCLUDED.confidence,
        provenance     = EXCLUDED.provenance,
        created_at     = EXCLUDED.created_at,
        embedding      = EXCLUDED.embedding,
        embedding_json = EXCLUDED.embedding_json,
        tags           = EXCLUDED.tags
    `;
    await this.pool.query(sql, [
      entry.id,
      entry.scope,
      entry.subjectId,
      entry.key,
      JSON.stringify(entry.value),
      entry.summary,
      entry.confidence,
      JSON.stringify(entry.provenance),
      entry.createdAt,
      embeddingVec,
      embeddingJson,
      entry.tags ?? [],
    ]);
  }

  async get<T = unknown>(id: string): Promise<MemoryEntry<T> | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${this.table} WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? rowToEntry<T>(row) : null;
  }

  async query<T = unknown>(q: MemoryQuery): Promise<MemoryEntry<T>[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    const bind = (v: unknown): string => {
      values.push(v);
      return `$${values.length}`;
    };

    if (q.scope) where.push(`scope = ${bind(q.scope)}`);
    if (q.subjectId) where.push(`subject_id = ${bind(q.subjectId)}`);
    if (q.key) where.push(`key = ${bind(q.key)}`);
    if (q.minConfidence !== undefined) where.push(`confidence >= ${bind(q.minConfidence)}`);
    if (q.tags && q.tags.length > 0) where.push(`tags @> ${bind(q.tags)}`);

    // Lexical fallback for `text` queries — semantic search requires an
    // embedding at query time, which the framework's MemoryQuery does not
    // currently model. Callers needing vector search should use querySimilar.
    if (q.text) {
      where.push(`(summary ILIKE ${bind(`%${q.text}%`)} OR value::text ILIKE ${bind(`%${q.text}%`)})`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const limitClause = q.limit ? `LIMIT ${Math.max(1, Math.floor(q.limit))}` : "";
    const sql = `SELECT * FROM ${this.table} ${whereClause} ORDER BY created_at DESC ${limitClause}`;

    const { rows } = await this.pool.query(sql, values);
    return rows.map((r) => rowToEntry<T>(r));
  }

  async forget(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  /**
   * Cosine-similarity search using pgvector. Returns the `k` most similar
   * entries to the given embedding. Throws if the adapter is configured
   * with `pgvector: false`.
   *
   * Not part of the `MemoryStore` interface — the framework does not
   * currently model embedding-based retrieval as a first-class operation.
   */
  async querySimilar<T = unknown>(
    embedding: number[],
    opts: {
      k?: number;
      scope?: MemoryQuery["scope"];
      subjectId?: string;
      minConfidence?: number;
    } = {},
  ): Promise<Array<MemoryEntry<T> & { similarity: number }>> {
    if (!this.pgvector) {
      throw new Error("PostgresMemoryStore.querySimilar requires pgvector: true");
    }

    const k = opts.k ?? 10;
    const where: string[] = ["embedding IS NOT NULL"];
    const values: unknown[] = [toVectorLiteral(embedding)];
    if (opts.scope) {
      values.push(opts.scope);
      where.push(`scope = $${values.length}`);
    }
    if (opts.subjectId) {
      values.push(opts.subjectId);
      where.push(`subject_id = $${values.length}`);
    }
    if (opts.minConfidence !== undefined) {
      values.push(opts.minConfidence);
      where.push(`confidence >= $${values.length}`);
    }
    values.push(k);

    const sql = `
      SELECT *, 1 - (embedding <=> $1::vector) AS similarity
        FROM ${this.table}
        WHERE ${where.join(" AND ")}
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $${values.length}
    `;
    const { rows } = await this.pool.query(sql, values);
    return rows.map((r) => ({
      ...rowToEntry<T>(r),
      similarity: Number(r.similarity ?? 0),
    }));
  }
}

function rowToEntry<T>(row: Record<string, unknown>): MemoryEntry<T> {
  const embedding =
    row.embedding != null
      ? parseVectorLiteral(String(row.embedding))
      : row.embedding_json != null
        ? (typeof row.embedding_json === "string"
            ? (JSON.parse(row.embedding_json) as number[])
            : (row.embedding_json as number[]))
        : undefined;

  return {
    id: String(row.id),
    scope: row.scope as MemoryEntry["scope"],
    subjectId: String(row.subject_id),
    key: String(row.key),
    value: row.value as T,
    summary: String(row.summary),
    confidence: Number(row.confidence),
    provenance: row.provenance as MemoryEntry["provenance"],
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    embedding,
    tags: (row.tags as string[] | null) ?? [],
  };
}

function toVectorLiteral(vec: number[]): string {
  // pgvector accepts the textual form '[1,2,3]' when cast to ::vector.
  return `[${vec.join(",")}]`;
}

function parseVectorLiteral(literal: string): number[] {
  const trimmed = literal.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  const inner = trimmed.slice(1, -1).trim();
  if (inner.length === 0) return [];
  return inner.split(",").map((n) => Number(n));
}
