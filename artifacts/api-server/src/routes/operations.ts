import { Router, type IRouter } from "express";
import {
  GetOperationsReportResponse,
  ListIntelligenceCasesResponse,
  ListOperationsAuditResponse,
} from "@workspace/api-zod";
import { getOperationsReport } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/operations/report", async (_req, res) => {
  const report = getOperationsReport();
  if (!report) {
    res.status(503).json({ error: "operations_layer_not_ready" });
    return;
  }
  const data = GetOperationsReportResponse.parse(report);
  res.json(data);
});

router.get("/operations/cases", async (_req, res) => {
  const report = getOperationsReport();
  if (!report) {
    res.status(503).json({ error: "operations_layer_not_ready" });
    return;
  }
  const data = ListIntelligenceCasesResponse.parse(report.cases);
  res.json(data);
});

router.get("/operations/audit", async (_req, res) => {
  const report = getOperationsReport();
  if (!report) {
    res.status(503).json({ error: "operations_layer_not_ready" });
    return;
  }
  const data = ListOperationsAuditResponse.parse(report.audit);
  res.json(data);
});

export default router;
