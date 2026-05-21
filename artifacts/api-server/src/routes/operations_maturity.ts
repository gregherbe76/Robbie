/**
 * Operations Maturity routes — read-only over the persistence layer.
 *
 *  GET /operations-maturity/health
 *  GET /operations-maturity/events                  (filters + paging)
 *  GET /operations-maturity/events/:id
 *  GET /operations-maturity/events/stats
 *  GET /operations-maturity/orgs
 *  GET /operations-maturity/memory/active
 *  GET /operations-maturity/memory/as-of            (?asOf)
 *  GET /operations-maturity/memory/history          (?scope&key)
 *  GET /operations-maturity/calibration/history
 *
 * Every endpoint takes an `?orgId=` query (defaults to "demo").
 */

import { Router, type IRouter } from "express";
import { getPersistenceLayer } from "../operations_maturity/bootstrap";
import {
  shortSignature,
  type PersistedEventKind,
} from "@robbie/framework/operations-maturity";

const router: IRouter = Router();

function org(req: import("express").Request): string {
  const raw = req.query.orgId;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "demo";
}

router.get("/operations-maturity/health", async (_req, res) => {
  const layer = await getPersistenceLayer();
  res.json(await layer.health());
});

router.get("/operations-maturity/orgs", async (_req, res) => {
  const layer = await getPersistenceLayer();
  const orgIds = await layer.events.listOrgIds();
  const out = await Promise.all(
    orgIds.map(async (id) => ({ orgId: id, stats: await layer.events.stats(id) })),
  );
  res.json({ organizations: out });
});

router.get("/operations-maturity/events/stats", async (req, res) => {
  const layer = await getPersistenceLayer();
  res.json(await layer.events.stats(org(req)));
});

router.get("/operations-maturity/events/:id/verify", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const layer = await getPersistenceLayer();
  const event = await layer.events.get(id);
  if (!event) {
    res.status(404).json({ error: "unknown_event", id });
    return;
  }
  const recomputed = shortSignature(event.payload);
  res.json({
    id: event.id,
    storedSignature: event.signature,
    recomputedSignature: recomputed,
    match: recomputed === event.signature,
    verifiedAt: new Date().toISOString(),
  });
});

router.get("/operations-maturity/events/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const layer = await getPersistenceLayer();
  const event = await layer.events.get(id);
  if (!event) {
    res.status(404).json({ error: "unknown_event", id });
    return;
  }
  res.json(event);
});

router.get("/operations-maturity/events", async (req, res) => {
  const layer = await getPersistenceLayer();
  const events = await layer.events.list({
    orgId: org(req),
    kind: (req.query.kind as PersistedEventKind | undefined) ?? undefined,
    since: (req.query.since as string | undefined) ?? undefined,
    until: (req.query.until as string | undefined) ?? undefined,
    correlationId:
      (req.query.correlationId as string | undefined) ?? undefined,
    afterSequence: req.query.afterSequence
      ? Number(req.query.afterSequence)
      : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ events });
});

router.get("/operations-maturity/memory/active", async (req, res) => {
  const layer = await getPersistenceLayer();
  const snapshots = await layer.memory.active(org(req));
  res.json({ snapshots });
});

router.get("/operations-maturity/memory/as-of", async (req, res) => {
  const layer = await getPersistenceLayer();
  const snapshots = await layer.memory.asOf({
    orgId: org(req),
    asOf: (req.query.asOf as string | undefined) ?? undefined,
    scope: (req.query.scope as string | undefined) ?? undefined,
    key: (req.query.key as string | undefined) ?? undefined,
  });
  res.json({ snapshots, asOf: req.query.asOf ?? new Date().toISOString() });
});

router.get("/operations-maturity/memory/history", async (req, res) => {
  const scope = req.query.scope;
  const key = req.query.key;
  if (typeof scope !== "string" || typeof key !== "string") {
    res.status(400).json({ error: "scope and key are required" });
    return;
  }
  const layer = await getPersistenceLayer();
  const snapshots = await layer.memory.history({
    orgId: org(req),
    scope,
    key,
  });
  res.json({ snapshots });
});

router.get("/operations-maturity/calibration/history", async (req, res) => {
  const layer = await getPersistenceLayer();
  const points = await layer.calibration.list({
    orgId: org(req),
    scope:
      typeof req.query.scope === "string"
        ? req.query.scope || null
        : undefined,
    since: (req.query.since as string | undefined) ?? undefined,
    until: (req.query.until as string | undefined) ?? undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ points });
});

export default router;
