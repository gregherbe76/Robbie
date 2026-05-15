import { Router, type IRouter } from "express";
import {
  GetEvaluationReportResponse,
  ListEvaluationOutcomesResponse,
  ListEvaluationPredictionsResponse,
} from "@workspace/api-zod";
import {
  getEvaluationReport,
  getEvaluationOutcomes,
  getEvaluationPredictions,
} from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/evaluation/report", async (_req, res) => {
  const report = getEvaluationReport();
  if (!report) {
    res.status(503).json({ error: "evaluation_layer_not_ready" });
    return;
  }
  const data = GetEvaluationReportResponse.parse(report);
  res.json(data);
});

router.get("/evaluation/outcomes", async (_req, res) => {
  const data = ListEvaluationOutcomesResponse.parse(getEvaluationOutcomes());
  res.json(data);
});

router.get("/evaluation/predictions", async (_req, res) => {
  const data = ListEvaluationPredictionsResponse.parse(getEvaluationPredictions());
  res.json(data);
});

export default router;
