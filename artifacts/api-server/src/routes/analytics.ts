/**
 * Lightweight, privacy-safe adoption analytics.
 *
 * Stores aggregate counters in memory. No identifiers, no IP addresses,
 * no candidate data, no organization data. Counter names are
 * client-provided strings that we sanitise to `[a-z0-9:_/-]+` and cap
 * at 80 chars, so this endpoint cannot be turned into a free-form
 * KV store.
 *
 * Reset on every server restart. Intended for "do people actually use
 * /demo and /benchmarks-public?" — nothing else.
 */

import { Router, type IRouter } from "express";

const MAX_NAME_LEN = 80;
const MAX_DISTINCT_NAMES = 256;
const ALLOWED = /^[a-z0-9:_/-]+$/i;

interface AnalyticsState {
  counters: Map<string, number>;
  startedAt: string;
}

const state: AnalyticsState = {
  counters: new Map(),
  startedAt: new Date().toISOString(),
};

function sanitise(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().toLowerCase().slice(0, MAX_NAME_LEN);
  if (!trimmed || !ALLOWED.test(trimmed)) return null;
  return trimmed;
}

const router: IRouter = Router();

router.post("/analytics/event", (req, res) => {
  const body = (req.body ?? {}) as { name?: unknown };
  const name = sanitise(body.name);
  if (!name) {
    res.status(400).json({ error: "invalid event name" });
    return;
  }
  // Cap how many distinct event names we will track so a noisy
  // client can't OOM the process by spamming new names.
  if (
    !state.counters.has(name) &&
    state.counters.size >= MAX_DISTINCT_NAMES
  ) {
    res.status(429).json({ error: "event name budget exceeded" });
    return;
  }
  state.counters.set(name, (state.counters.get(name) ?? 0) + 1);
  res.json({ ok: true });
});

router.get("/analytics/summary", (_req, res) => {
  const entries = Array.from(state.counters.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  res.json({
    startedAt: state.startedAt,
    totalEvents: entries.reduce((s, [, n]) => s + n, 0),
    distinctNames: entries.length,
    counters: Object.fromEntries(entries),
  });
});

export default router;
