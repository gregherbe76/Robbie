import {
  pgTable,
  text,
  bigserial,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Durable audit log — every operator-visible action that mutates
 * framework state. Distinct from the event store: the event store
 * records *what the framework reasoned*; the audit log records
 * *what humans did*.
 *
 * Append-only. Never updated, never deleted.
 */
export const auditLogTable = pgTable(
  "om_audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orgId: text("org_id").notNull(),
    actorId: text("actor_id").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    details: jsonb("details").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdx: index("om_audit_org_idx").on(t.orgId, t.occurredAt),
    actorIdx: index("om_audit_actor_idx").on(t.actorId),
  }),
);

export type AuditLogRow = typeof auditLogTable.$inferSelect;
export type InsertAuditLog = typeof auditLogTable.$inferInsert;
