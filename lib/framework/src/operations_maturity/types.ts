/**
 * Operational Maturity Layer — core types.
 *
 * This module is the bridge between the framework's cognition output
 * and durable, replayable persistence. Everything here is provenance-
 * preserving, append-only, and organization-scoped.
 */

/**
 * Closed enum of every event the framework can persist. Keeping this
 * closed forces the projection layer to be explicit — silently
 * dropping unknown event kinds would defeat the purpose of an
 * append-only event log.
 */
export type PersistedEventKind =
  | "cognition.run.completed"
  | "cognition.synthesis.recorded"
  | "evidence.ingested"
  | "investigation.opened"
  | "investigation.updated"
  | "investigation.closed"
  | "reviewer.action"
  | "escalation.raised"
  | "escalation.resolved"
  | "override.applied"
  | "calibration.snapshot"
  | "benchmark.run"
  | "memory.written"
  | "audit.logged";

export interface PersistedEvent<TPayload = unknown> {
  id: number;
  orgId: string;
  /** Monotonic per-org. Stable cursor for replay. */
  sequence: number;
  kind: PersistedEventKind;
  payload: TPayload;
  /** First 16 hex chars of sha256(canonicalisedPayload). */
  signature: string;
  occurredAt: string;
  recordedAt: string;
  sourceAgentId?: string | null;
  sourceSkillId?: string | null;
  correlationId?: string | null;
}

export interface AppendEventInput<TPayload = unknown> {
  orgId: string;
  kind: PersistedEventKind;
  payload: TPayload;
  occurredAt: string;
  sourceAgentId?: string;
  sourceSkillId?: string;
  correlationId?: string;
}

export interface ListEventsQuery {
  orgId: string;
  kind?: PersistedEventKind;
  since?: string;
  until?: string;
  correlationId?: string;
  /** Sequence cursor: only return events with sequence > afterSequence. */
  afterSequence?: number;
  limit?: number;
}

export interface EventStoreStats {
  orgId: string;
  totalEvents: number;
  latestSequence: number;
  latestOccurredAt: string | null;
  countsByKind: Record<string, number>;
}

/**
 * Append-only event store contract. The in-memory and Postgres
 * implementations both satisfy this; downstream code must never
 * reach past it (no raw SQL, no Map access).
 */
export interface EventStore {
  /** Append a new event. Sequence is assigned by the store. */
  append<T>(input: AppendEventInput<T>): Promise<PersistedEvent<T>>;
  /** Bulk append (single transaction in the pg adapter). */
  appendMany(inputs: AppendEventInput[]): Promise<PersistedEvent[]>;
  /** Read events with filters; ordered by (orgId, sequence) ascending. */
  list(query: ListEventsQuery): Promise<PersistedEvent[]>;
  /** Fetch a single event by id. */
  get(id: number): Promise<PersistedEvent | null>;
  /** Aggregate counts for an org. */
  stats(orgId: string): Promise<EventStoreStats>;
  /** All distinct org ids that have at least one event. */
  listOrgIds(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Longitudinal memory
// ---------------------------------------------------------------------------

export interface MemorySnapshot {
  id: number;
  orgId: string;
  scope: string;
  key: string;
  summary: string;
  confidence: number;
  payload: unknown;
  sourceAgentId?: string | null;
  signature: string;
  validFrom: string;
  /** null = currently active. */
  validTo: string | null;
  recordedAt: string;
}

export interface WriteMemoryInput {
  orgId: string;
  scope: string;
  key: string;
  summary: string;
  confidence: number;
  payload: unknown;
  sourceAgentId?: string;
  validFrom: string;
}

export interface MemoryAsOfQuery {
  orgId: string;
  asOf?: string;
  scope?: string;
  key?: string;
}

export interface MemoryHistoryQuery {
  orgId: string;
  scope: string;
  key: string;
}

/**
 * Longitudinal memory contract. `write` is the only mutator; it
 * closes the prior active snapshot for (orgId, scope, key) by
 * setting its `validTo`, then appends a new active snapshot.
 */
export interface LongitudinalMemoryStore {
  write(input: WriteMemoryInput): Promise<MemorySnapshot>;
  asOf(query: MemoryAsOfQuery): Promise<MemorySnapshot[]>;
  history(query: MemoryHistoryQuery): Promise<MemorySnapshot[]>;
  active(orgId: string): Promise<MemorySnapshot[]>;
}

// ---------------------------------------------------------------------------
// Calibration history
// ---------------------------------------------------------------------------

export interface CalibrationHistoryPoint {
  id: number;
  orgId: string;
  scope: string | null;
  expectedCalibrationError: number;
  brierScore: number;
  overconfidentBuckets: number;
  underconfidentBuckets: number;
  sampleSize: number;
  measuredAt: string;
  recordedAt: string;
}

export interface WriteCalibrationPointInput {
  orgId: string;
  scope?: string | null;
  expectedCalibrationError: number;
  brierScore: number;
  overconfidentBuckets: number;
  underconfidentBuckets: number;
  sampleSize: number;
  measuredAt: string;
}

export interface CalibrationHistoryQuery {
  orgId: string;
  scope?: string | null;
  since?: string;
  until?: string;
  limit?: number;
}

export interface CalibrationHistoryStore {
  write(input: WriteCalibrationPointInput): Promise<CalibrationHistoryPoint>;
  list(query: CalibrationHistoryQuery): Promise<CalibrationHistoryPoint[]>;
}

// ---------------------------------------------------------------------------
// Persistence layer aggregate
// ---------------------------------------------------------------------------

export interface PersistenceHealth {
  driver: "postgres" | "in-memory";
  ready: boolean;
  message: string;
  checkedAt: string;
}

export interface PersistenceLayer {
  events: EventStore;
  memory: LongitudinalMemoryStore;
  calibration: CalibrationHistoryStore;
  health(): Promise<PersistenceHealth>;
}
