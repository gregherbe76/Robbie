/**
 * Wires the persistence layer for the api-server. Tries the
 * Postgres-backed implementation first and falls back to the
 * in-memory layer if the database is unreachable — this preserves
 * the framework's "runs without a database" promise.
 *
 * The first time the Postgres layer comes up with an empty events
 * table, this seeds a small set of demo events so the
 * /operations-maturity console pages render meaningful content.
 */

import { logger } from "../lib/logger";
import {
  InMemoryPersistenceLayer,
  type PersistenceLayer,
} from "@workspace/framework/operations-maturity";
import { PgPersistenceLayer } from "./pg_adapter";

const DEMO_ORG_ID = "demo";

let _layer: PersistenceLayer | null = null;
let _initPromise: Promise<PersistenceLayer> | null = null;

export async function getPersistenceLayer(): Promise<PersistenceLayer> {
  if (_layer) return _layer;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const pg = new PgPersistenceLayer();
    const health = await pg.health();
    if (health.ready) {
      _layer = pg;
      logger.info({ driver: "postgres" }, "operations_maturity: pg ready");
      try {
        await seedIfEmpty(_layer);
      } catch (err) {
        logger.warn({ err }, "operations_maturity: seed failed");
      }
      return _layer;
    }
    logger.warn(
      { reason: health.message },
      "operations_maturity: falling back to in-memory persistence",
    );
    _layer = new InMemoryPersistenceLayer();
    await seedIfEmpty(_layer);
    return _layer;
  })();
  return _initPromise;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedIfEmpty(layer: PersistenceLayer): Promise<void> {
  const stats = await layer.events.stats(DEMO_ORG_ID);
  if (stats.totalEvents > 0) return;

  // Deterministic clock for seeded data. 8am UTC, last 5 days,
  // sliding back from "now" rounded down to day boundary.
  const dayMs = 24 * 3600 * 1000;
  const todayUtc = new Date(
    Math.floor(Date.now() / dayMs) * dayMs,
  ).toISOString();
  const baseDay = Date.parse(todayUtc) - 5 * dayMs;
  const at = (dayOffset: number, hour: number) =>
    new Date(baseDay + dayOffset * dayMs + hour * 3600 * 1000).toISOString();

  const correlationFounder = "demo-corr-founder-builder";
  const correlationInflated = "demo-corr-inflated-senior";

  // Cognition run for the founder-builder case.
  await layer.events.appendMany([
    {
      orgId: DEMO_ORG_ID,
      kind: "evidence.ingested",
      occurredAt: at(0, 9),
      correlationId: correlationFounder,
      sourceAgentId: "ingestion",
      payload: {
        candidateId: "founder-builder",
        sources: ["cv", "github", "reference"],
        claimsExtracted: 7,
        evidenceItems: 11,
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "cognition.run.completed",
      occurredAt: at(0, 10),
      correlationId: correlationFounder,
      sourceAgentId: "BayesianScoringAgent",
      payload: {
        candidateId: "founder-builder",
        targetRole: "Staff Platform Engineer",
        recommendation: "uncertain-positive",
        globalConfidence: 0.62,
        disagreementScore: 0.22,
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "cognition.synthesis.recorded",
      occurredAt: at(0, 10),
      correlationId: correlationFounder,
      sourceAgentId: "synthesizeCognition",
      payload: {
        candidateId: "founder-builder",
        archetypes: ["founder-builder"],
        finalConfidence: 0.62,
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "investigation.opened",
      occurredAt: at(1, 14),
      correlationId: correlationFounder,
      sourceAgentId: "operator",
      payload: {
        candidateId: "founder-builder",
        openedBy: "reviewer-1",
        reason: "verify depth in distributed systems vs. breadth claims",
        status: "open",
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "memory.written",
      occurredAt: at(1, 15),
      correlationId: correlationFounder,
      sourceAgentId: "TrajectoryAgent",
      payload: {
        scope: "candidate",
        key: "founder-builder:trajectory",
        summary: "Strong velocity; concentration risk in distributed systems",
        confidence: 0.58,
      },
    },
    // Calibration snapshot for the org.
    {
      orgId: DEMO_ORG_ID,
      kind: "calibration.snapshot",
      occurredAt: at(2, 8),
      sourceAgentId: "evaluation",
      payload: {
        expectedCalibrationError: 0.082,
        brierScore: 0.181,
        overconfidentBuckets: 2,
        sampleSize: 28,
      },
    },
    // Cognition run for the inflated-senior case (different correlation).
    {
      orgId: DEMO_ORG_ID,
      kind: "evidence.ingested",
      occurredAt: at(3, 9),
      correlationId: correlationInflated,
      sourceAgentId: "ingestion",
      payload: {
        candidateId: "inflated-senior",
        sources: ["cv", "interview", "reference"],
        claimsExtracted: 9,
        evidenceItems: 14,
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "cognition.run.completed",
      occurredAt: at(3, 10),
      correlationId: correlationInflated,
      sourceAgentId: "ContradictionAgent",
      payload: {
        candidateId: "inflated-senior",
        targetRole: "Staff Platform Engineer",
        recommendation: "conditional_fit",
        globalConfidence: 0.37,
        disagreementScore: 0.71,
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "escalation.raised",
      occurredAt: at(3, 11),
      correlationId: correlationInflated,
      sourceAgentId: "ContradictionAgent",
      payload: {
        candidateId: "inflated-senior",
        triggers: ["contradiction", "uncertainty", "missing-evidence"],
        severity: "high",
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "override.applied",
      occurredAt: at(4, 9),
      correlationId: correlationInflated,
      sourceAgentId: "operator",
      payload: {
        candidateId: "inflated-senior",
        actor: "reviewer-1",
        from: "conditional_fit",
        to: "do_not_advance",
        rationale: "Contradictions outweigh pedigree; reference checks pending",
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "calibration.snapshot",
      occurredAt: at(4, 18),
      sourceAgentId: "evaluation",
      payload: {
        expectedCalibrationError: 0.061,
        brierScore: 0.162,
        overconfidentBuckets: 1,
        sampleSize: 31,
      },
    },
    {
      orgId: DEMO_ORG_ID,
      kind: "benchmark.run",
      occurredAt: at(5, 7),
      sourceAgentId: "benchmarks",
      payload: {
        suite: "core",
        scenarios: 5,
        passing: 5,
        replaySignaturesStable: true,
      },
    },
  ]);

  // Longitudinal memory: two snapshots over time so the time-travel
  // view shows actual evolution.
  await layer.memory.write({
    orgId: DEMO_ORG_ID,
    scope: "organization",
    key: "demo:archetype-fit",
    summary: "Series-A platform team — favours depth-over-breadth",
    confidence: 0.55,
    payload: { weighting: { depth: 0.7, breadth: 0.3 }, sampleSize: 9 },
    sourceAgentId: "organization_intelligence",
    validFrom: at(0, 8),
  });
  await layer.memory.write({
    orgId: DEMO_ORG_ID,
    scope: "organization",
    key: "demo:archetype-fit",
    summary: "Updated: still depth-favoured; tolerance for breadth narrowing",
    confidence: 0.68,
    payload: { weighting: { depth: 0.78, breadth: 0.22 }, sampleSize: 14 },
    sourceAgentId: "organization_intelligence",
    validFrom: at(3, 12),
  });
  await layer.memory.write({
    orgId: DEMO_ORG_ID,
    scope: "candidate",
    key: "founder-builder:trajectory",
    summary: "Velocity high, scope sometimes loose; concentration emerging",
    confidence: 0.58,
    payload: { velocityScore: 0.74, scopeStabilityScore: 0.41 },
    sourceAgentId: "TrajectoryAgent",
    validFrom: at(1, 15),
  });

  // Calibration history points.
  const calibration = [
    { day: 0, ece: 0.118, brier: 0.21, over: 3, under: 1, n: 21 },
    { day: 1, ece: 0.103, brier: 0.198, over: 2, under: 1, n: 24 },
    { day: 2, ece: 0.082, brier: 0.181, over: 2, under: 1, n: 28 },
    { day: 3, ece: 0.074, brier: 0.171, over: 1, under: 1, n: 29 },
    { day: 4, ece: 0.061, brier: 0.162, over: 1, under: 1, n: 31 },
    { day: 5, ece: 0.058, brier: 0.158, over: 1, under: 0, n: 33 },
  ];
  for (const p of calibration) {
    await layer.calibration.write({
      orgId: DEMO_ORG_ID,
      scope: null,
      expectedCalibrationError: p.ece,
      brierScore: p.brier,
      overconfidentBuckets: p.over,
      underconfidentBuckets: p.under,
      sampleSize: p.n,
      measuredAt: at(p.day, 18),
    });
  }

  logger.info("operations_maturity: seeded demo events");
}
