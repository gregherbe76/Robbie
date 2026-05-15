import { Router, type IRouter } from "express";
import {
  ListIntelligenceAnalysesResponse,
  GetIntelligenceAnalysisResponse,
} from "@workspace/api-zod";
import { getAnalyses, getAnalysis } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/intelligence/analyses", async (_req, res) => {
  const items = getAnalyses();
  const data = ListIntelligenceAnalysesResponse.parse(items);
  res.json(data);
});

router.get("/intelligence/analyses/:candidateId", async (req, res) => {
  const analysis = getAnalysis(req.params.candidateId);
  if (!analysis) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const data = GetIntelligenceAnalysisResponse.parse(analysis);
  res.json(data);
});

export default router;
