import { Router, type IRouter } from "express";
import { ListMemoryEntriesResponse } from "@workspace/api-zod";
import { getFramework } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/memory/entries", async (_req, res) => {
  const fw = getFramework();
  const entries = await fw.memory.query({ limit: 100 });
  const data = ListMemoryEntriesResponse.parse(
    entries.map((e) => ({
      id: e.id,
      scope: e.scope,
      subjectId: e.subjectId,
      key: e.key,
      summary: e.summary,
      createdAt: e.createdAt,
      confidence: e.confidence,
      sourceAgentId: e.provenance.producedBy ?? null,
      tags: e.tags ?? [],
      provenance: {
        producedBy: e.provenance.producedBy,
        producedAt: e.provenance.producedAt,
        rationale: e.provenance.rationale ?? null,
        derivedFrom: e.provenance.derivedFrom ?? [],
      },
    })),
  );
  res.json(data);
});

export default router;
