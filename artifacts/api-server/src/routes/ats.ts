/**
 * ATS Intelligence routes.
 *
 *   POST /ats/connect                — register/re-register a connection (no-op when env keys missing)
 *   POST /ats/sync                   — sync a connection by id
 *   POST /ats/webhook/:provider      — append-only event ingestion
 *   GET  /ats/connections            — list connections + health
 *   GET  /ats/replays                — list hiring decision replays
 *   GET  /ats/replay/:id             — fetch a single replay
 *   GET  /ats/replay/:id/verify      — recompute + compare replay signature
 *   GET  /ats/replay/:id/reasoning   — reasoning reconstruction
 *   GET  /ats/calibration            — org calibration report (uses synthetic outcomes)
 *   GET  /ats/disagreements          — flat list of reviewer disagreements
 *   GET  /ats/reviewers              — reviewer reliability rows
 *   GET  /ats/compare?a=&b=          — two replays + structured diff
 *
 * Read-only contract for the ATS itself. Sync is a server-side
 * operation against the registered adapters; it never writes back
 * to the ATS.
 */

import { Router, type IRouter } from "express";
import {
  buildCalibrationReport,
  buildReplayDiff,
  reconstructReasoning,
  verifyReplaySignature,
  SYNTHETIC_OUTCOMES,
  type DisagreementSummary,
} from "@robbie/framework/ats";
import { getATSGateway } from "../ats/bootstrap";

const router: IRouter = Router();

router.get("/ats/connections", async (_req, res) => {
  const gateway = await getATSGateway();
  const connections = gateway.listConnections();
  res.json({ connections });
});

router.post("/ats/connect", async (req, res) => {
  // The framework registers all three adapters at boot. This
  // endpoint exists to satisfy the contract and to surface
  // friendly errors when an operator tries to "connect" a provider
  // whose env var is missing. We do not accept inline credentials
  // — operators wire them via environment-secrets.
  const provider = String(req.body?.provider ?? "");
  const gateway = await getATSGateway();
  const conn = gateway
    .listConnections()
    .find((c) => c.provider === provider);
  if (!conn) {
    res.status(400).json({ error: "unknown_provider", provider });
    return;
  }
  res.json({ connection: conn });
});

router.post("/ats/sync", async (req, res) => {
  const connectionId = String(req.body?.connectionId ?? "");
  if (!connectionId) {
    res.status(400).json({ error: "missing_connectionId" });
    return;
  }
  const gateway = await getATSGateway();
  try {
    const result = await gateway.syncConnection(connectionId);
    res.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    res.status(409).json({ error: "sync_failed", message });
  }
});

router.get("/ats/replays", async (_req, res) => {
  const gateway = await getATSGateway();
  const replays = gateway.listReplays().map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    provider: r.provider,
    candidateName: r.candidateName,
    targetRole: r.targetRole,
    organization: r.organization,
    openedAt: r.openedAt,
    closedAt: r.closedAt,
    outcome: r.outcome,
    reviewerCount: r.reviewers.length,
    evidenceCount: r.evidence.length,
    disagreementCount: r.disagreements.length,
    escalationCount: r.escalations.length,
    overrideCount: r.overrides.length,
    signature: r.signature,
  }));
  res.json({ replays });
});

router.get("/ats/replay/:id/verify", async (req, res) => {
  const gateway = await getATSGateway();
  const replay = gateway.getReplay(req.params.id!);
  if (!replay) {
    res.status(404).json({ error: "unknown_replay", id: req.params.id });
    return;
  }
  res.json(verifyReplaySignature(replay));
});

router.get("/ats/replay/:id/reasoning", async (req, res) => {
  const gateway = await getATSGateway();
  const replay = gateway.getReplay(req.params.id!);
  if (!replay) {
    res.status(404).json({ error: "unknown_replay", id: req.params.id });
    return;
  }
  res.json(reconstructReasoning(replay));
});

router.get("/ats/replay/:id", async (req, res) => {
  const gateway = await getATSGateway();
  const replay = gateway.getReplay(req.params.id!);
  if (!replay) {
    res.status(404).json({ error: "unknown_replay", id: req.params.id });
    return;
  }
  res.json(replay);
});

router.get("/ats/calibration", async (_req, res) => {
  const gateway = await getATSGateway();
  const replays = gateway.listReplays();
  const report = buildCalibrationReport(replays, SYNTHETIC_OUTCOMES);
  res.json(report);
});

router.get("/ats/disagreements", async (_req, res) => {
  const gateway = await getATSGateway();
  const replays = gateway.listReplays();
  const out: DisagreementSummary[] = [];
  for (const r of replays) {
    for (const d of r.disagreements) {
      out.push({
        replayId: r.id,
        candidateName: r.candidateName,
        topic: d.topic,
        spread: d.spread,
        highReviewer: d.high.reviewerId,
        lowReviewer: d.low.reviewerId,
        resolution: d.resolution,
      });
    }
  }
  res.json({ disagreements: out });
});

router.get("/ats/reviewers", async (_req, res) => {
  const gateway = await getATSGateway();
  const replays = gateway.listReplays();
  const report = buildCalibrationReport(replays, SYNTHETIC_OUTCOMES);
  res.json({ reviewers: report.reviewers });
});

router.get("/ats/compare", async (req, res) => {
  const aId = String(req.query.a ?? "");
  const bId = String(req.query.b ?? "");
  if (!aId || !bId) {
    res.status(400).json({ error: "missing_replay_ids" });
    return;
  }
  const gateway = await getATSGateway();
  const a = gateway.getReplay(aId);
  const b = gateway.getReplay(bId);
  if (!a) {
    res.status(404).json({ error: "unknown_replay", id: aId });
    return;
  }
  if (!b) {
    res.status(404).json({ error: "unknown_replay", id: bId });
    return;
  }
  res.json({ a, b, diff: buildReplayDiff(a, b) });
});

/**
 * Webhook ingestion — append-only.
 *
 * The framework does not synthesise reasoning from the webhook
 * payload; it acknowledges the event, re-syncs the affected
 * connection (so the replay is rebuilt deterministically from the
 * ATS as the source of truth), and returns the resulting replay
 * delta. We never write back to the ATS in response to a webhook.
 *
 * Body shape:
 *   { connectionId: string, event: { kind: string, atsId?: string } }
 *
 * Auth (production): adapters MUST verify provider-specific webhook
 * signatures before reaching this handler. The skeleton accepts any
 * body so the synthetic provider can be exercised locally.
 */
router.post("/ats/webhook/:provider", async (req, res) => {
  const provider = String(req.params.provider ?? "");
  const connectionId = String(req.body?.connectionId ?? "");
  const event = (req.body?.event ?? {}) as {
    kind?: string;
    atsId?: string;
  };
  if (!connectionId) {
    res.status(400).json({ error: "missing_connectionId" });
    return;
  }
  const gateway = await getATSGateway();
  const connection = gateway.getConnection(connectionId);
  if (!connection || connection.provider !== provider) {
    res.status(404).json({ error: "unknown_connection", connectionId });
    return;
  }
  try {
    const before = gateway.listReplays().length;
    const result = await gateway.syncConnection(connectionId);
    const after = gateway.listReplays().length;
    res.json({
      acknowledged: true,
      provider,
      connectionId,
      event: { kind: event.kind ?? "unknown", atsId: event.atsId },
      replayDelta: after - before,
      sync: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    res.status(409).json({ error: "ingest_failed", message });
  }
});

export default router;
