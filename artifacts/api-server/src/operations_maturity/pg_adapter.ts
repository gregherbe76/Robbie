/**
 * Postgres-backed implementations of the framework's persistence
 * contracts. The contracts themselves live in
 * `@robbie/framework/operations-maturity` and downstream code
 * (routes, bootstrap, the rest of the framework) reaches only through
 * those contracts — never into Drizzle directly.
 */

import { and, asc, count, desc, eq, gt, gte, isNull, lte, sql } from "drizzle-orm";
import {
  auditLogTable,
  calibrationHistoryTable,
  db,
  eventsTable,
  memorySnapshotsTable,
  organizationsTable,
  type EventRow,
  type MemorySnapshotRow,
  type CalibrationHistoryRow,
} from "@workspace/db";
import {
  shortSignature,
  type AppendEventInput,
  type CalibrationHistoryPoint,
  type CalibrationHistoryQuery,
  type CalibrationHistoryStore,
  type EventStore,
  type EventStoreStats,
  type ListEventsQuery,
  type LongitudinalMemoryStore,
  type MemoryAsOfQuery,
  type MemoryHistoryQuery,
  type MemorySnapshot,
  type PersistedEvent,
  type PersistedEventKind,
  type PersistenceHealth,
  type PersistenceLayer,
  type WriteCalibrationPointInput,
  type WriteMemoryInput,
} from "@robbie/framework/operations-maturity";

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapEventRow(row: EventRow): PersistedEvent {
  return {
    id: row.id,
    orgId: row.orgId,
    sequence: row.sequence,
    kind: row.kind as PersistedEventKind,
    payload: row.payload,
    signature: row.signature,
    occurredAt: row.occurredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
    sourceAgentId: row.sourceAgentId,
    sourceSkillId: row.sourceSkillId,
    correlationId: row.correlationId,
  };
}

function mapMemoryRow(row: MemorySnapshotRow): MemorySnapshot {
  return {
    id: row.id,
    orgId: row.orgId,
    scope: row.scope,
    key: row.key,
    summary: row.summary,
    confidence: row.confidence,
    payload: row.payload,
    sourceAgentId: row.sourceAgentId,
    signature: row.signature,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo ? row.validTo.toISOString() : null,
    recordedAt: row.recordedAt.toISOString(),
  };
}

function mapCalibrationRow(
  row: CalibrationHistoryRow,
): CalibrationHistoryPoint {
  return {
    id: row.id,
    orgId: row.orgId,
    scope: row.scope,
    expectedCalibrationError: row.expectedCalibrationError,
    brierScore: row.brierScore,
    overconfidentBuckets: row.overconfidentBuckets,
    underconfidentBuckets: row.underconfidentBuckets,
    sampleSize: row.sampleSize,
    measuredAt: row.measuredAt.toISOString(),
    recordedAt: row.recordedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// PgEventStore
// ---------------------------------------------------------------------------

export class PgEventStore implements EventStore {
  async append<T>(input: AppendEventInput<T>): Promise<PersistedEvent<T>> {
    const [event] = await this.appendMany([
      input as unknown as AppendEventInput,
    ]);
    return event as PersistedEvent<T>;
  }

  async appendMany(inputs: AppendEventInput[]): Promise<PersistedEvent[]> {
    if (inputs.length === 0) return [];
    // Atomic: lock the org row, get max sequence, insert N rows
    // with sequence = max+1..max+N. Postgres MVCC handles concurrent
    // inserts to different orgs without contention.
    return await db.transaction(async (tx) => {
      const out: PersistedEvent[] = [];
      // Group inputs by orgId so we only do one max-sequence query per org.
      const byOrg = new Map<string, AppendEventInput[]>();
      for (const i of inputs) {
        const list = byOrg.get(i.orgId) ?? [];
        list.push(i);
        byOrg.set(i.orgId, list);
      }
      for (const [orgId, items] of byOrg) {
        // Idempotently ensure the org row exists, then take a
        // transaction-scoped advisory lock keyed by orgId. The lock
        // serialises sequence allocation per-org without blocking
        // unrelated orgs; it is released automatically at COMMIT/
        // ROLLBACK. Combined with the UNIQUE(org_id, sequence) index
        // on om_events, duplicate sequences are impossible — the
        // lock makes the happy path conflict-free, the unique index
        // is the belt-and-braces backstop.
        await tx
          .insert(organizationsTable)
          .values({ id: orgId, name: orgId, tier: "demo" })
          .onConflictDoNothing();
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"om_events:" + orgId}, 0))`,
        );
        const [{ value: maxSeq }] = await tx
          .select({
            value: sql<number>`coalesce(max(${eventsTable.sequence}), 0)::int`,
          })
          .from(eventsTable)
          .where(eq(eventsTable.orgId, orgId));
        const rows = items.map((input, i) => ({
          orgId: input.orgId,
          sequence: maxSeq + i + 1,
          kind: input.kind,
          payload: input.payload as object,
          signature: shortSignature(input.payload),
          occurredAt: new Date(input.occurredAt),
          sourceAgentId: input.sourceAgentId ?? null,
          sourceSkillId: input.sourceSkillId ?? null,
          correlationId: input.correlationId ?? null,
        }));
        const inserted = await tx
          .insert(eventsTable)
          .values(rows)
          .returning();
        for (const r of inserted) out.push(mapEventRow(r));
      }
      out.sort((a, b) => a.sequence - b.sequence);
      return out;
    });
  }

  async list(query: ListEventsQuery): Promise<PersistedEvent[]> {
    const conds = [eq(eventsTable.orgId, query.orgId)];
    if (query.kind) conds.push(eq(eventsTable.kind, query.kind));
    if (query.correlationId)
      conds.push(eq(eventsTable.correlationId, query.correlationId));
    if (query.since)
      conds.push(gte(eventsTable.occurredAt, new Date(query.since)));
    if (query.until)
      conds.push(lte(eventsTable.occurredAt, new Date(query.until)));
    if (query.afterSequence !== undefined)
      conds.push(gt(eventsTable.sequence, query.afterSequence));
    const rows = await db
      .select()
      .from(eventsTable)
      .where(and(...conds))
      .orderBy(asc(eventsTable.sequence))
      .limit(query.limit ?? 200);
    return rows.map(mapEventRow);
  }

  async get(id: number): Promise<PersistedEvent | null> {
    const rows = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, id))
      .limit(1);
    return rows[0] ? mapEventRow(rows[0]) : null;
  }

  async stats(orgId: string): Promise<EventStoreStats> {
    const [aggRow] = await db
      .select({
        total: count(eventsTable.id),
        latestSeq: sql<number>`coalesce(max(${eventsTable.sequence}), 0)::int`,
        latestOccurred: sql<Date | null>`max(${eventsTable.occurredAt})`,
      })
      .from(eventsTable)
      .where(eq(eventsTable.orgId, orgId));
    const byKind = await db
      .select({
        kind: eventsTable.kind,
        n: count(eventsTable.id),
      })
      .from(eventsTable)
      .where(eq(eventsTable.orgId, orgId))
      .groupBy(eventsTable.kind);
    const countsByKind: Record<string, number> = {};
    for (const r of byKind) countsByKind[r.kind] = Number(r.n);
    return {
      orgId,
      totalEvents: Number(aggRow?.total ?? 0),
      latestSequence: Number(aggRow?.latestSeq ?? 0),
      latestOccurredAt: aggRow?.latestOccurred
        ? new Date(aggRow.latestOccurred).toISOString()
        : null,
      countsByKind,
    };
  }

  async listOrgIds(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ orgId: eventsTable.orgId })
      .from(eventsTable)
      .orderBy(asc(eventsTable.orgId));
    return rows.map((r) => r.orgId);
  }
}

// ---------------------------------------------------------------------------
// PgLongitudinalMemory
// ---------------------------------------------------------------------------

export class PgLongitudinalMemory implements LongitudinalMemoryStore {
  async write(input: WriteMemoryInput): Promise<MemorySnapshot> {
    const validFrom = new Date(input.validFrom);
    const signature = shortSignature({
      scope: input.scope,
      key: input.key,
      payload: input.payload,
    });
    return await db.transaction(async (tx) => {
      // Serialise concurrent writes against the same (org, scope, key)
      // so the "close prior active, then insert new active" sequence
      // is atomic. The partial unique index on
      // (org_id, scope, key) WHERE valid_to IS NULL is the DB-side
      // safety net.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"om_mem:" + input.orgId + ":" + input.scope + ":" + input.key}, 0))`,
      );
      // Close the prior active snapshot, if any.
      await tx
        .update(memorySnapshotsTable)
        .set({ validTo: validFrom })
        .where(
          and(
            eq(memorySnapshotsTable.orgId, input.orgId),
            eq(memorySnapshotsTable.scope, input.scope),
            eq(memorySnapshotsTable.key, input.key),
            isNull(memorySnapshotsTable.validTo),
          ),
        );
      const [row] = await tx
        .insert(memorySnapshotsTable)
        .values({
          orgId: input.orgId,
          scope: input.scope,
          key: input.key,
          summary: input.summary,
          confidence: input.confidence,
          payload: input.payload as object,
          sourceAgentId: input.sourceAgentId ?? null,
          signature,
          validFrom,
          validTo: null,
        })
        .returning();
      return mapMemoryRow(row);
    });
  }

  async asOf(query: MemoryAsOfQuery): Promise<MemorySnapshot[]> {
    const t = new Date(query.asOf ?? new Date().toISOString());
    const conds = [
      eq(memorySnapshotsTable.orgId, query.orgId),
      lte(memorySnapshotsTable.validFrom, t),
    ];
    if (query.scope) conds.push(eq(memorySnapshotsTable.scope, query.scope));
    if (query.key) conds.push(eq(memorySnapshotsTable.key, query.key));
    const rows = await db
      .select()
      .from(memorySnapshotsTable)
      .where(
        and(
          ...conds,
          sql`(${memorySnapshotsTable.validTo} IS NULL OR ${memorySnapshotsTable.validTo} > ${t})`,
        ),
      )
      .orderBy(
        asc(memorySnapshotsTable.scope),
        asc(memorySnapshotsTable.key),
      );
    return rows.map(mapMemoryRow);
  }

  async history(query: MemoryHistoryQuery): Promise<MemorySnapshot[]> {
    const rows = await db
      .select()
      .from(memorySnapshotsTable)
      .where(
        and(
          eq(memorySnapshotsTable.orgId, query.orgId),
          eq(memorySnapshotsTable.scope, query.scope),
          eq(memorySnapshotsTable.key, query.key),
        ),
      )
      .orderBy(asc(memorySnapshotsTable.validFrom));
    return rows.map(mapMemoryRow);
  }

  async active(orgId: string): Promise<MemorySnapshot[]> {
    const rows = await db
      .select()
      .from(memorySnapshotsTable)
      .where(
        and(
          eq(memorySnapshotsTable.orgId, orgId),
          isNull(memorySnapshotsTable.validTo),
        ),
      )
      .orderBy(
        asc(memorySnapshotsTable.scope),
        asc(memorySnapshotsTable.key),
      );
    return rows.map(mapMemoryRow);
  }
}

// ---------------------------------------------------------------------------
// PgCalibrationHistory
// ---------------------------------------------------------------------------

export class PgCalibrationHistory implements CalibrationHistoryStore {
  async write(
    input: WriteCalibrationPointInput,
  ): Promise<CalibrationHistoryPoint> {
    const [row] = await db
      .insert(calibrationHistoryTable)
      .values({
        orgId: input.orgId,
        scope: input.scope ?? null,
        expectedCalibrationError: input.expectedCalibrationError,
        brierScore: input.brierScore,
        overconfidentBuckets: input.overconfidentBuckets,
        underconfidentBuckets: input.underconfidentBuckets,
        sampleSize: input.sampleSize,
        measuredAt: new Date(input.measuredAt),
      })
      .returning();
    return mapCalibrationRow(row);
  }

  async list(
    query: CalibrationHistoryQuery,
  ): Promise<CalibrationHistoryPoint[]> {
    const conds = [eq(calibrationHistoryTable.orgId, query.orgId)];
    if (query.scope !== undefined && query.scope !== null) {
      conds.push(eq(calibrationHistoryTable.scope, query.scope));
    }
    if (query.since)
      conds.push(
        gte(calibrationHistoryTable.measuredAt, new Date(query.since)),
      );
    if (query.until)
      conds.push(
        lte(calibrationHistoryTable.measuredAt, new Date(query.until)),
      );
    const rows = await db
      .select()
      .from(calibrationHistoryTable)
      .where(and(...conds))
      .orderBy(asc(calibrationHistoryTable.measuredAt))
      .limit(query.limit ?? 500);
    return rows.map(mapCalibrationRow);
  }
}

// ---------------------------------------------------------------------------
// PgPersistenceLayer
// ---------------------------------------------------------------------------

export class PgPersistenceLayer implements PersistenceLayer {
  readonly events = new PgEventStore();
  readonly memory = new PgLongitudinalMemory();
  readonly calibration = new PgCalibrationHistory();

  async health(): Promise<PersistenceHealth> {
    const checkedAt = new Date().toISOString();
    try {
      await db.execute(sql`select 1`);
      return {
        driver: "postgres",
        ready: true,
        message: "postgres reachable",
        checkedAt,
      };
    } catch (err) {
      return {
        driver: "postgres",
        ready: false,
        message:
          err instanceof Error ? err.message : "postgres connectivity error",
        checkedAt,
      };
    }
  }
}

// Re-export the audit log table for convenience.
export { auditLogTable, desc };
