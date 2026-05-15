import { Router, type IRouter } from "express";
import { ListReportsResponse } from "@workspace/api-zod";
import { getFramework } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/reports", async (_req, res) => {
  const fw = getFramework();
  const reports = await fw.reports.list();
  const data = ListReportsResponse.parse(
    reports.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      createdAt: r.createdAt,
      summary: r.summary,
      confidence: r.confidence ?? null,
      sections: r.sections,
      evidence: r.evidence.map((s) => ({
        id: s.id,
        kind: s.kind,
        summary:
          typeof s.value === "string" ? s.value : JSON.stringify(s.value),
        confidence: s.confidence,
        producedBy: s.provenance.producedBy,
      })),
    })),
  );
  res.json(data);
});

export default router;
