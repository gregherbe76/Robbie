import {
  pgTable,
  text,
  bigserial,
  timestamp,
  jsonb,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";

/**
 * Temporal memory snapshots — point-in-time projections of the
 * framework's persistent memory.
 *
 * Memory entries are *never* mutated in place; each change appends
 * a new row with a new `validFrom`. The previous row's `validTo`
 * is set to the new row's `validFrom`. This allows time-travel
 * queries: "what did the framework believe about X at time T?"
 *
 * The combination (orgId, scope, key, validFrom) is the natural
 * temporal key. `validTo = null` means "currently active".
 */
export const memorySnapshotsTable = pgTable(
  "om_memory_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orgId: text("org_id").notNull(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    summary: text("summary").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    payload: jsonb("payload").notNull(),
    sourceAgentId: text("source_agent_id"),
    /** sha256 of canonicalised payload — stable identity across restarts. */
    signature: text("signature").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    /** null = currently active. */
    validTo: timestamp("valid_to", { withTimezone: true }),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgScopeKeyIdx: index("om_mem_org_scope_key_idx").on(
      t.orgId,
      t.scope,
      t.key,
    ),
    activeIdx: index("om_mem_active_idx").on(t.orgId, t.validTo),
    validFromIdx: index("om_mem_validfrom_idx").on(t.validFrom),
  }),
);

export type MemorySnapshotRow = typeof memorySnapshotsTable.$inferSelect;
export type InsertMemorySnapshot = typeof memorySnapshotsTable.$inferInsert;
