import { Router, type IRouter } from "express";
import {
  ListIntelligenceAnalysesResponse,
  GetIntelligenceAnalysisResponse,
  ListCognitiveSynthesesResponse,
  GetCognitiveSynthesisResponse,
} from "@workspace/api-zod";
import {
  getAnalyses,
  getAnalysis,
  getCognitions,
  getCognition,
} from "../framework/bootstrap";

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

router.get("/intelligence/cognition", async (_req, res) => {
  const items = getCognitions();
  const data = ListCognitiveSynthesesResponse.parse(items);
  res.json(data);
});

router.get("/intelligence/cognition/:candidateId", async (req, res) => {
  const synthesis = getCognition(req.params.candidateId);
  if (!synthesis) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const data = GetCognitiveSynthesisResponse.parse(synthesis);
  res.json(data);
});

export default router;
