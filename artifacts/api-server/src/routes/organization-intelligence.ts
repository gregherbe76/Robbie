import { Router, type IRouter } from "express";
import {
  ListOrganizationContextsResponse,
  GetOrganizationContextResponse,
  GetCandidateOrganizationFitResponse,
  GetOrganizationIntelligenceReportResponse,
} from "@workspace/api-zod";
import {
  getOrganizations,
  getOrganization,
  getOrgFit,
  getOrgReport,
} from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/organization-intelligence/context", async (_req, res) => {
  const items = getOrganizations();
  const data = ListOrganizationContextsResponse.parse(items);
  res.json(data);
});

router.get(
  "/organization-intelligence/context/:organizationId",
  async (req, res) => {
    const org = getOrganization(req.params.organizationId);
    if (!org) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const data = GetOrganizationContextResponse.parse(org);
    res.json(data);
  },
);

router.get(
  "/organization-intelligence/fit/:organizationId/:candidateId",
  async (req, res) => {
    const fit = getOrgFit(req.params.organizationId, req.params.candidateId);
    if (!fit) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const data = GetCandidateOrganizationFitResponse.parse(fit);
    res.json(data);
  },
);

router.get(
  "/organization-intelligence/reports/:organizationId/:candidateId",
  async (req, res) => {
    const report = getOrgReport(
      req.params.organizationId,
      req.params.candidateId,
    );
    if (!report) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const data = GetOrganizationIntelligenceReportResponse.parse(report);
    res.json(data);
  },
);

export default router;
