import {
  pgTable,
  text,
  bigserial,
  timestamp,
  jsonb,
  index,
  bigint,
} from "drizzle-orm/pg-core";

/**
 * Append-only event store.
 *
 * Every cognition output, evidence ingestion, investigation transition,
 * reviewer action, escalation, override, calibration event, benchmark
 * run, and audit entry is recorded here as a typed event.
 *
 * Critical guarantees:
 *  - append-only: rows are never updated or deleted
 *  - deterministic ordering: monotonic `sequence` per (orgId)
 *  - provenance-preserving: payload carries the producing agent/skill
 *  - replayable: (orgId, sequence) is a stable cursor for replay
 *
 * The `signature` column stores the sha256 of the canonicalised
 * payload — replay-after-restart compares signatures to verify
 * persistence integrity.
 */
export const eventsTable = pgTable(
  "om_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orgId: text("org_id").notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    /** sha256 of canonicalised payload — first 16 chars. */
    signature: text("signature").notNull(),
    /** When the event logically occurred (framework clock). */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /** When the event was persisted (wall clock). */
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Producing agent / skill / module, if any. */
    sourceAgentId: text("source_agent_id"),
    sourceSkillId: text("source_skill_id"),
    /** For tracing related events across a single cognition run. */
    correlationId: text("correlation_id"),
  },
  (t) => ({
    orgSeqIdx: index("om_events_org_seq_idx").on(t.orgId, t.sequence),
    orgKindIdx: index("om_events_org_kind_idx").on(t.orgId, t.kind),
    occurredIdx: index("om_events_occurred_idx").on(t.occurredAt),
    correlationIdx: index("om_events_correlation_idx").on(t.correlationId),
  }),
);

export type EventRow = typeof eventsTable.$inferSelect;
export type InsertEvent = typeof eventsTable.$inferInsert;
