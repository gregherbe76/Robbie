import { Router, type IRouter } from "express";
import {
  GetCollaborationStateResponse,
  OpenCollaborationCaseBody,
  OpenCollaborationCaseResponse,
  GetCollaborationCaseParams,
  GetCollaborationCaseResponse,
  RecordCollaborationReviewParams,
  RecordCollaborationReviewBody,
  RecordCollaborationReviewResponse,
  RecordCollaborationOverrideParams,
  RecordCollaborationOverrideBody,
  RecordCollaborationOverrideResponse,
  RecordCollaborationEvidenceReviewParams,
  RecordCollaborationEvidenceReviewBody,
  RecordCollaborationEvidenceReviewResponse,
  GetCollaborationReviewerCalibrationParams,
  GetCollaborationReviewerCalibrationResponse,
  GetCollaborationAuditParams,
  GetCollaborationAuditResponse,
} from "@workspace/api-zod";
import {
  getCollaborationEngine,
  getCollaborationSnapshot,
} from "../framework/collaboration";

const router: IRouter = Router();

function isoOrDefault(d: string | Date | undefined, fallback: string): string {
  if (!d) return fallback;
  return typeof d === "string" ? d : d.toISOString();
}

const SERVER_NOW = "2026-05-15T12:00:00.000Z";

router.get("/collaboration/state", async (_req, res) => {
  const snap = getCollaborationSnapshot(SERVER_NOW);
  const data = GetCollaborationStateResponse.parse(snap);
  res.json(data);
});

router.post("/collaboration/cases", async (req, res) => {
  const body = OpenCollaborationCaseBody.parse(req.body);
  const engine = getCollaborationEngine();
  const c = engine.openCase({
    title: body.title,
    subjectKind: body.subjectKind,
    subjectId: body.subjectId,
    subjectDisplayName: body.subjectDisplayName,
    framing: body.framing,
    invitedReviewers: body.invitedReviewers,
    anchoringRecommendation: body.anchoringRecommendation,
    now: isoOrDefault(body.now, SERVER_NOW),
  });
  const data = OpenCollaborationCaseResponse.parse(c);
  res.json(data);
});

router.get("/collaboration/cases/:id", async (req, res) => {
  const params = GetCollaborationCaseParams.parse(req.params);
  const engine = getCollaborationEngine();
  const c = engine.getCase(params.id);
  if (!c) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const detail = {
    case: c,
    actions: engine.listActions(c.caseId),
    evidenceReviews: engine.listEvidenceReviews(c.caseId),
    disagreements: engine.listDisagreements(c.caseId),
    overrides: engine.listOverrides(c.caseId),
    audit: engine.listAudit(c.caseId),
    timeline: engine.timelineFor(c.caseId),
  };
  const data = GetCollaborationCaseResponse.parse(detail);
  res.json(data);
});

router.post("/collaboration/cases/:id/review", async (req, res) => {
  const params = RecordCollaborationReviewParams.parse(req.params);
  const body = RecordCollaborationReviewBody.parse(req.body);
  const engine = getCollaborationEngine();
  const out = engine.review({
    caseId: params.id,
    reviewerId: body.reviewerId,
    kind: body.kind,
    target: body.target,
    rationale: body.rationale,
    confidence: body.confidence,
    derivedFrom: body.derivedFrom,
    ambiguityMarkers: body.ambiguityMarkers,
    disagreement: body.disagreement
      ? {
          topic: body.disagreement.topic,
          severityScore: body.disagreement.severityScore,
          positions: body.disagreement.positions,
        }
      : undefined,
    transitionTo: body.transitionTo,
    now: isoOrDefault(body.now, SERVER_NOW),
  });
  const data = RecordCollaborationReviewResponse.parse(out);
  res.json(data);
});

router.post("/collaboration/cases/:id/override", async (req, res, next) => {
  const params = RecordCollaborationOverrideParams.parse(req.params);
  const body = RecordCollaborationOverrideBody.parse(req.body);
  if (!body.acknowledgedRisks || body.acknowledgedRisks.length === 0) {
    res.status(400).json({
      error: "override_requires_acknowledged_risks",
      message:
        "Overrides are refused without explicit acknowledged risks. Provide at least one risk you are accepting.",
    });
    return;
  }
  const engine = getCollaborationEngine();
  let rec;
  try {
    rec = engine.issueOverride({
    caseId: params.id,
    reviewerId: body.reviewerId,
    affectedRecommendationId: body.affectedRecommendationId,
    reason: body.reason,
    confidenceImpact: body.confidenceImpact,
    acknowledgedRisks: body.acknowledgedRisks,
    direction: body.direction,
    now: isoOrDefault(body.now, SERVER_NOW),
    });
  } catch (err) {
    next(err);
    return;
  }
  const data = RecordCollaborationOverrideResponse.parse(rec);
  res.json(data);
});

router.post("/collaboration/cases/:id/evidence-review", async (req, res) => {
  const params = RecordCollaborationEvidenceReviewParams.parse(req.params);
  const body = RecordCollaborationEvidenceReviewBody.parse(req.body);
  const engine = getCollaborationEngine();
  const entry = engine.reviewEvidence({
    caseId: params.id,
    evidenceId: body.evidenceId,
    reviewerId: body.reviewerId,
    kind: body.kind,
    rationale: body.rationale,
    reliabilityDelta: body.reliabilityDelta,
    counterEvidenceIds: body.counterEvidenceIds,
    ambiguityMarkers: body.ambiguityMarkers,
    now: isoOrDefault(body.now, SERVER_NOW),
  });
  const data = RecordCollaborationEvidenceReviewResponse.parse(entry);
  res.json(data);
});

router.get("/collaboration/reviewer/:id/calibration", async (req, res) => {
  const params = GetCollaborationReviewerCalibrationParams.parse(req.params);
  const engine = getCollaborationEngine();
  if (!engine.getReviewer(params.id)) {
    res.status(404).json({ error: "reviewer_not_found" });
    return;
  }
  const report = engine.calibrationFor(params.id, SERVER_NOW);
  const data = GetCollaborationReviewerCalibrationResponse.parse(report);
  res.json(data);
});

router.get("/collaboration/audit/:caseId", async (req, res) => {
  const params = GetCollaborationAuditParams.parse(req.params);
  const engine = getCollaborationEngine();
  if (!engine.getCase(params.caseId)) {
    res.status(404).json({ error: "case_not_found" });
    return;
  }
  const entries = engine.listAudit(params.caseId);
  const data = GetCollaborationAuditResponse.parse({
    caseId: params.caseId,
    entries,
  });
  res.json(data);
});

export default router;
