/**
 * Public demo routes.
 *
 * `GET /demo/cases` lists the 5 deterministic hero cases.
 * `GET /demo/replay/:caseId` runs the real framework pipeline live and
 * returns a deterministic replay trace. The trace shape is documented
 * by `ReplayTrace` in `@robbie/framework/replay`.
 *
 * These endpoints have no side effects, are safe to call publicly, and
 * return identical bytes for the same caseId across requests.
 */

import { Router, type IRouter } from "express";
import {
  listCaseSummaries,
  runReplayTrace,
  findCase,
  type ReplayCaseId,
} from "@robbie/framework/replay";

const router: IRouter = Router();

router.get("/demo/cases", (_req, res) => {
  res.json(listCaseSummaries());
});

router.get("/demo/replay/:caseId", (req, res) => {
  const caseId = req.params.caseId;
  if (!findCase(caseId)) {
    res.status(404).json({ error: "unknown_case", caseId });
    return;
  }
  const trace = runReplayTrace(caseId as ReplayCaseId);
  res.json(trace);
});

export default router;
