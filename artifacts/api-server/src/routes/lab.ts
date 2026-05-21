/**
 * Public Cognition Lab routes.
 *
 * POST   /lab/run                      — synthesise + run a lab trace
 * GET    /lab/run/:runId               — fetch the compact summary
 * GET    /lab/run/:runId/trace         — fetch the full replay trace
 * GET    /lab/run/:runId/signature     — fetch the sha256 signature only
 *
 * All four endpoints are public and operate on an in-memory store with
 * a short TTL. The runId is content-derived (sha256 of canonicalised
 * input) so identical inputs always produce the same runId — and any
 * single run is replayable bit-for-bit against the deterministic clock.
 *
 * NOT an ATS. NOT a resume uploader. NOT an AI recruiter. This is a
 * sandbox for deterministic hiring cognition replay.
 */

import { Router, type IRouter, type Request } from "express";
import { CreateLabRunBody } from "@workspace/api-zod";
import {
  LabSafetyValidationError,
  runLabTrace,
  type LabRunInput,
  type LabRunResult,
} from "@robbie/framework/lab";

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const LAB_RUN_TTL_MS = 60 * 60 * 1000; // 1 hour
const LAB_RUN_MAX_ENTRIES = 200;

interface StoredRun {
  result: LabRunResult;
  expiresAt: number;
}

const store = new Map<string, StoredRun>();

function pruneStore(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
  // LRU-ish cap: drop oldest until under the limit.
  if (store.size > LAB_RUN_MAX_ENTRIES) {
    const overflow = store.size - LAB_RUN_MAX_ENTRIES;
    let dropped = 0;
    for (const k of store.keys()) {
      if (dropped >= overflow) break;
      store.delete(k);
      dropped++;
    }
  }
}

function getRun(runId: string): LabRunResult | null {
  const entry = store.get(runId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(runId);
    return null;
  }
  return entry.result;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

// The generated zod schema is permissive (single object, all fields optional).
// We do mode-specific structural validation in the handler below.
const LabRunInputSchema = CreateLabRunBody;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router: IRouter = Router();

router.post("/lab/run", (req: Request, res) => {
  pruneStore();
  const parsed = LabRunInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "invalid_input", detail: parsed.error.message });
    return;
  }
  const data = parsed.data;
  let input: LabRunInput;
  if (data.mode === "scenario") {
    if (!data.scenarioId) {
      res
        .status(400)
        .json({ error: "invalid_input", detail: "scenarioId is required for mode=scenario" });
      return;
    }
    input = {
      mode: "scenario",
      scenarioId: data.scenarioId,
      organizationOverride: data.organizationOverride ?? undefined,
      resumeText: data.resumeText ?? undefined,
      transcriptText: data.transcriptText ?? undefined,
    } as unknown as LabRunInput;
  } else {
    if (!data.dossier || !data.organization) {
      res.status(400).json({
        error: "invalid_input",
        detail: "dossier and organization are required for mode=synthetic",
      });
      return;
    }
    input = {
      mode: "synthetic",
      label: data.label ?? undefined,
      dossier: data.dossier,
      organization: data.organization,
      resumeText: data.resumeText ?? undefined,
      transcriptText: data.transcriptText ?? undefined,
    } as unknown as LabRunInput;
  }
  try {
    const result = runLabTrace(input, {
      ttlMs: LAB_RUN_TTL_MS,
    });
    store.set(result.runId, {
      result,
      expiresAt: Date.now() + LAB_RUN_TTL_MS,
    });
    pruneStore();
    res.status(201).json(result.summary);
  } catch (err) {
    if (err instanceof LabSafetyValidationError) {
      res.status(422).json({ error: err.code, detail: err.detail });
      return;
    }
    req.log.error({ err }, "lab: run failed");
    res.status(500).json({ error: "lab_run_failed" });
  }
});

router.get("/lab/run/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "unknown_run", runId: req.params.runId });
    return;
  }
  res.json(run.summary);
});

router.get("/lab/run/:runId/trace", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "unknown_run", runId: req.params.runId });
    return;
  }
  res.json(run.trace);
});

router.get("/lab/run/:runId/signature", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "unknown_run", runId: req.params.runId });
    return;
  }
  res.json({ runId: run.runId, signature: run.trace.signature });
});

export default router;
