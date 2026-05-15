import { Router, type IRouter } from "express";
import { GetBenchmarkReportResponse } from "@workspace/api-zod";
import { getBenchmarkReport } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/benchmarks/report", async (_req, res) => {
  const report = getBenchmarkReport();
  if (!report) {
    res.status(503).json({ error: "benchmarks_not_ready" });
    return;
  }
  const data = GetBenchmarkReportResponse.parse(report);
  res.json(data);
});

export default router;
