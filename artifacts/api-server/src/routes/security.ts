import { Router, type IRouter } from "express";
import {
  GetSecurityAccessLogParams,
  GetSecurityAccessLogResponse,
  GetSecurityReviewerParams,
  GetSecurityReviewerResponse,
  CheckSecurityAccessBody,
  CheckSecurityAccessResponse,
  GetSecurityVisibilityParams,
  GetSecurityVisibilityResponse,
  ChangeSecurityVisibilityBody,
  ChangeSecurityVisibilityResponse,
  GetSecurityAuditParams,
  GetSecurityAuditResponse,
  GetSecuritySnapshotParams,
  GetSecuritySnapshotResponse,
} from "@workspace/api-zod";
import { getSecurityEngine } from "../framework/security";

const router: IRouter = Router();

const SERVER_NOW = "2026-05-15T12:00:00.000Z";

router.get("/security/access-log/:organizationId", async (req, res) => {
  const params = GetSecurityAccessLogParams.parse(req.params);
  const engine = getSecurityEngine();
  if (!engine.getOrganization(params.organizationId)) {
    res.status(404).json({ error: "organization_not_found" });
    return;
  }
  const data = GetSecurityAccessLogResponse.parse({
    organizationId: params.organizationId,
    decisions: engine.listDecisions(params.organizationId),
  });
  res.json(data);
});

router.get("/security/reviewer/:reviewerId", async (req, res) => {
  const params = GetSecurityReviewerParams.parse(req.params);
  const engine = getSecurityEngine();
  const reviewer = engine.getReviewer(params.reviewerId);
  if (!reviewer) {
    res.status(404).json({ error: "reviewer_not_found" });
    return;
  }
  const recentDecisions = engine
    .listDecisions(reviewer.organizationId)
    .filter((d) => d.reviewerId === reviewer.reviewerId)
    .slice(-20);
  const recentAudit = engine
    .listAudit(reviewer.organizationId)
    .filter((a) => a.reviewerId === reviewer.reviewerId)
    .slice(-50);
  const data = GetSecurityReviewerResponse.parse({
    reviewer,
    recentDecisions,
    recentAudit,
  });
  res.json(data);
});

router.post("/security/check-access", async (req, res) => {
  const body = CheckSecurityAccessBody.parse(req.body);
  const engine = getSecurityEngine();
  const decision = engine.checkAccess({
    reviewerId: body.reviewerId,
    organizationId: body.organizationId,
    targetResourceId: body.targetResourceId,
    targetOrganizationId: body.targetOrganizationId,
    targetVisibility: body.targetVisibility,
    targetInvestigationId: body.targetInvestigationId ?? null,
    action: body.action,
    requiredCapability: body.requiredCapability,
    sessionId: body.sessionId ?? null,
    now:
      typeof body.now === "string"
        ? body.now
        : (body.now?.toISOString() ?? SERVER_NOW),
  });
  const data = CheckSecurityAccessResponse.parse(decision);
  res.json(data);
});

router.get("/security/visibility/:resourceId", async (req, res) => {
  const params = GetSecurityVisibilityParams.parse(req.params);
  const engine = getSecurityEngine();
  const { current, history } = engine.getVisibility(params.resourceId);
  if (!current) {
    res.status(404).json({ error: "resource_not_found" });
    return;
  }
  const data = GetSecurityVisibilityResponse.parse({
    resourceId: params.resourceId,
    current,
    history,
  });
  res.json(data);
});

router.post("/security/change-visibility", async (req, res, next) => {
  const body = ChangeSecurityVisibilityBody.parse(req.body);
  const engine = getSecurityEngine();
  try {
    const result = engine.changeVisibility({
      resourceId: body.resourceId,
      organizationId: body.organizationId,
      reviewerId: body.reviewerId,
      newLevel: body.newLevel,
      scopedInvestigationId: body.scopedInvestigationId ?? null,
      scopedReviewerId: body.scopedReviewerId ?? null,
      reason: body.reason,
      sessionId: body.sessionId,
      now:
        typeof body.now === "string"
          ? body.now
          : (body.now?.toISOString() ?? SERVER_NOW),
    });
    if (!result.decision.allowed) {
      res.status(403).json(result.decision);
      return;
    }
    const data = ChangeSecurityVisibilityResponse.parse({
      decision: result.decision,
      record: result.record,
      auditEntryId: result.audit?.entryId,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/security/audit/:organizationId", async (req, res) => {
  const params = GetSecurityAuditParams.parse(req.params);
  const engine = getSecurityEngine();
  if (!engine.getOrganization(params.organizationId)) {
    res.status(404).json({ error: "organization_not_found" });
    return;
  }
  const data = GetSecurityAuditResponse.parse({
    organizationId: params.organizationId,
    entries: engine.listAudit(params.organizationId),
  });
  res.json(data);
});

router.get("/security/snapshot/:organizationId", async (req, res) => {
  const params = GetSecuritySnapshotParams.parse(req.params);
  const engine = getSecurityEngine();
  if (!engine.getOrganization(params.organizationId)) {
    res.status(404).json({ error: "organization_not_found" });
    return;
  }
  const snap = engine.snapshot(params.organizationId);
  const data = GetSecuritySnapshotResponse.parse({
    organizationId: params.organizationId,
    organizations: snap.organizations,
    reviewers: snap.reviewers,
    visibility: snap.visibility,
    recentDecisions: snap.recentDecisions,
    recentAudit: snap.recentAudit,
    sensitive: snap.sensitive,
    sessions: snap.sessions,
    benchmarkResults: snap.benchmarkResults,
    capabilities: engine.listCapabilities(),
    scenarios: engine.listBenchmarkScenarios(),
  });
  res.json(data);
});

export default router;
