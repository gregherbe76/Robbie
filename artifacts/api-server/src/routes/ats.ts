/**
 * ATS Intelligence routes.
 *
 *   POST /ats/connect                — register/re-register a connection (no-op when env keys missing)
 *   POST /ats/sync                   — sync a connection by id
 *   GET  /ats/connections            — list connections + health
 *   GET  /ats/replays                — list hiring decision replays
 *   GET  /ats/replay/:id             — fetch a single replay
 *   GET  /ats/replay/:id/verify      — recompute + compare replay signature
 *   GET  /ats/replay/:id/reasoning   — reasoning reconstruction
 *   GET  /ats/calibration            — org calibration report (uses synthetic outcomes)
 *   GET  /ats/disagreements          — flat list of reviewer disagreements
 *   GET  /ats/reviewers              — reviewer reliability rows
 *
 * Read-only contract for the ATS itself. Sync is a server-side
 * operation against the registered adapters; it never writes back
 * to the ATS.
 */

import { Router, type IRouter } from "express";
import {
  buildCalibrationReport,
  reconstructReasoning,
  verifyReplaySignature,
  SYNTHETIC_OUTCOMES,
  type DisagreementSummary,
} from "@workspace/framework/ats";
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

export default router;
