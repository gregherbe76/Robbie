/**
 * In-memory implementations of the persistence contracts.
 *
 * These exist so the framework remains runnable without a database —
 * the public demo, the cognition lab, and the test harness all use
 * this. The Postgres-backed implementation lives in the api-server
 * (which is where the Drizzle handle and schemas are wired).
 */

import { shortSignature } from "./signature.js";
import type {
  AppendEventInput,
  CalibrationHistoryPoint,
  CalibrationHistoryQuery,
  CalibrationHistoryStore,
  EventStore,
  EventStoreStats,
  ListEventsQuery,
  LongitudinalMemoryStore,
  MemoryAsOfQuery,
  MemoryHistoryQuery,
  MemorySnapshot,
  PersistedEvent,
  PersistenceHealth,
  PersistenceLayer,
  WriteCalibrationPointInput,
  WriteMemoryInput,
} from "./types.js";

// ---------------------------------------------------------------------------
// Event store
// ---------------------------------------------------------------------------

export class InMemoryEventStore implements EventStore {
  private events: PersistedEvent[] = [];
  private nextId = 1;
  private nextSequenceByOrg = new Map<string, number>();

  private allocate<T>(input: AppendEventInput<T>): PersistedEvent<T> {
    const seq = (this.nextSequenceByOrg.get(input.orgId) ?? 0) + 1;
    this.nextSequenceByOrg.set(input.orgId, seq);
    const event: PersistedEvent<T> = {
      id: this.nextId++,
      orgId: input.orgId,
      sequence: seq,
      kind: input.kind,
      payload: input.payload,
      signature: shortSignature(input.payload),
      occurredAt: input.occurredAt,
      recordedAt: new Date().toISOString(),
      sourceAgentId: input.sourceAgentId ?? null,
      sourceSkillId: input.sourceSkillId ?? null,
      correlationId: input.correlationId ?? null,
    };
    return event;
  }

  async append<T>(input: AppendEventInput<T>): Promise<PersistedEvent<T>> {
    const event = this.allocate(input);
    this.events.push(event as PersistedEvent);
    return event;
  }

  async appendMany(inputs: AppendEventInput[]): Promise<PersistedEvent[]> {
    const out: PersistedEvent[] = [];
    for (const input of inputs) {
      const event = this.allocate(input);
      this.events.push(event);
      out.push(event);
    }
    return out;
  }

  async list(query: ListEventsQuery): Promise<PersistedEvent[]> {
    const since = query.since ? Date.parse(query.since) : null;
    const until = query.until ? Date.parse(query.until) : null;
    const filtered = this.events.filter((e) => {
      if (e.orgId !== query.orgId) return false;
      if (query.kind && e.kind !== query.kind) return false;
      if (query.correlationId && e.correlationId !== query.correlationId)
        return false;
      if (since !== null && Date.parse(e.occurredAt) < since) return false;
      if (until !== null && Date.parse(e.occurredAt) > until) return false;
      if (
        query.afterSequence !== undefined &&
        e.sequence <= query.afterSequence
      )
        return false;
      return true;
    });
    filtered.sort((a, b) => a.sequence - b.sequence);
    return filtered.slice(0, query.limit ?? 200);
  }

  async get(id: number): Promise<PersistedEvent | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }

  async stats(orgId: string): Promise<EventStoreStats> {
    const subset = this.events.filter((e) => e.orgId === orgId);
    const counts: Record<string, number> = {};
    for (const e of subset) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    const latest = subset[subset.length - 1];
    return {
      orgId,
      totalEvents: subset.length,
      latestSequence: this.nextSequenceByOrg.get(orgId) ?? 0,
      latestOccurredAt: latest?.occurredAt ?? null,
      countsByKind: counts,
    };
  }

  async listOrgIds(): Promise<string[]> {
    return Array.from(this.nextSequenceByOrg.keys()).sort();
  }
}

// ---------------------------------------------------------------------------
// Longitudinal memory
// ---------------------------------------------------------------------------

export class InMemoryLongitudinalMemory implements LongitudinalMemoryStore {
  private snapshots: MemorySnapshot[] = [];
  private nextId = 1;

  async write(input: WriteMemoryInput): Promise<MemorySnapshot> {
    // Close the prior active snapshot for (org, scope, key).
    for (const s of this.snapshots) {
      if (
        s.orgId === input.orgId &&
        s.scope === input.scope &&
        s.key === input.key &&
        s.validTo === null
      ) {
        s.validTo = input.validFrom;
      }
    }
    const snap: MemorySnapshot = {
      id: this.nextId++,
      orgId: input.orgId,
      scope: input.scope,
      key: input.key,
      summary: input.summary,
      confidence: input.confidence,
      payload: input.payload,
      sourceAgentId: input.sourceAgentId ?? null,
      signature: shortSignature({
        scope: input.scope,
        key: input.key,
        payload: input.payload,
      }),
      validFrom: input.validFrom,
      validTo: null,
      recordedAt: new Date().toISOString(),
    };
    this.snapshots.push(snap);
    return snap;
  }

  async asOf(query: MemoryAsOfQuery): Promise<MemorySnapshot[]> {
    const t = query.asOf ? Date.parse(query.asOf) : Date.now();
    const matches = this.snapshots.filter((s) => {
      if (s.orgId !== query.orgId) return false;
      if (query.scope && s.scope !== query.scope) return false;
      if (query.key && s.key !== query.key) return false;
      const from = Date.parse(s.validFrom);
      const to = s.validTo ? Date.parse(s.validTo) : Infinity;
      return from <= t && t < to;
    });
    matches.sort((a, b) =>
      `${a.scope}/${a.key}`.localeCompare(`${b.scope}/${b.key}`),
    );
    return matches;
  }

  async history(query: MemoryHistoryQuery): Promise<MemorySnapshot[]> {
    return this.snapshots
      .filter(
        (s) =>
          s.orgId === query.orgId &&
          s.scope === query.scope &&
          s.key === query.key,
      )
      .sort((a, b) => Date.parse(a.validFrom) - Date.parse(b.validFrom));
  }

  async active(orgId: string): Promise<MemorySnapshot[]> {
    return this.snapshots
      .filter((s) => s.orgId === orgId && s.validTo === null)
      .sort((a, b) =>
        `${a.scope}/${a.key}`.localeCompare(`${b.scope}/${b.key}`),
      );
  }
}

// ---------------------------------------------------------------------------
// Calibration history
// ---------------------------------------------------------------------------

export class InMemoryCalibrationHistory implements CalibrationHistoryStore {
  private points: CalibrationHistoryPoint[] = [];
  private nextId = 1;

  async write(
    input: WriteCalibrationPointInput,
  ): Promise<CalibrationHistoryPoint> {
    const p: CalibrationHistoryPoint = {
      id: this.nextId++,
      orgId: input.orgId,
      scope: input.scope ?? null,
      expectedCalibrationError: input.expectedCalibrationError,
      brierScore: input.brierScore,
      overconfidentBuckets: input.overconfidentBuckets,
      underconfidentBuckets: input.underconfidentBuckets,
      sampleSize: input.sampleSize,
      measuredAt: input.measuredAt,
      recordedAt: new Date().toISOString(),
    };
    this.points.push(p);
    return p;
  }

  async list(
    query: CalibrationHistoryQuery,
  ): Promise<CalibrationHistoryPoint[]> {
    const since = query.since ? Date.parse(query.since) : null;
    const until = query.until ? Date.parse(query.until) : null;
    const filtered = this.points.filter((p) => {
      if (p.orgId !== query.orgId) return false;
      if (query.scope !== undefined && p.scope !== query.scope) return false;
      if (since !== null && Date.parse(p.measuredAt) < since) return false;
      if (until !== null && Date.parse(p.measuredAt) > until) return false;
      return true;
    });
    filtered.sort(
      (a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt),
    );
    return filtered.slice(0, query.limit ?? 500);
  }
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export class InMemoryPersistenceLayer implements PersistenceLayer {
  readonly events = new InMemoryEventStore();
  readonly memory = new InMemoryLongitudinalMemory();
  readonly calibration = new InMemoryCalibrationHistory();

  async health(): Promise<PersistenceHealth> {
    return {
      driver: "in-memory",
      ready: true,
      message: "in-memory persistence layer is always ready",
      checkedAt: new Date().toISOString(),
    };
  }
}
