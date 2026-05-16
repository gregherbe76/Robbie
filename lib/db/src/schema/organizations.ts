import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Organizations table. The framework is multi-tenant: every persisted
 * event, memory snapshot, calibration record, and audit entry is
 * scoped to an organization. Demo / public surfaces use the "demo" org.
 */
export const organizationsTable = pgTable("om_organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("demo"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OrganizationRow = typeof organizationsTable.$inferSelect;
export type InsertOrganization = typeof organizationsTable.$inferInsert;
