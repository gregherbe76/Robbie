import {
  pgTable,
  text,
  bigserial,
  timestamp,
  doublePrecision,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Per-organization calibration evolution over time.
 *
 * Each row is a single calibration snapshot — the framework's
 * self-assessed expected calibration error, overconfidence count,
 * and Brier score at a moment in time. Plotted, this is how the
 * framework's confidence calibration drifts as it accumulates
 * evidence and overrides.
 */
export const calibrationHistoryTable = pgTable("om_calibration_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orgId: text("org_id").notNull(),
  /** Optional reviewer or agent scope; null = org-wide. */
  scope: text("scope"),
  expectedCalibrationError: doublePrecision("expected_calibration_error")
    .notNull(),
  brierScore: doublePrecision("brier_score").notNull(),
  overconfidentBuckets: integer("overconfident_buckets").notNull(),
  underconfidentBuckets: integer("underconfident_buckets").notNull(),
  sampleSize: integer("sample_size").notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CalibrationHistoryRow =
  typeof calibrationHistoryTable.$inferSelect;
export type InsertCalibrationHistory =
  typeof calibrationHistoryTable.$inferInsert;
