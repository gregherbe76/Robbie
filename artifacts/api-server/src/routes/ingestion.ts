import { Router, type IRouter } from "express";
import {
  GetIngestionStateResponse,
  IngestCandidateBody,
  IngestCandidateResponse,
  IngestOrganizationBody,
  IngestOrganizationResponse,
  IngestTranscriptBody,
  IngestTranscriptResponse,
  GetIngestionEventResponse,
  GetIngestionAuditResponse,
} from "@workspace/api-zod";
import type {
  RawInputEnvelope,
  IngestionSourceKind,
} from "@workspace/framework/ingestion";
import type { OrganizationSource } from "@workspace/framework/ingestion";
import {
  getIngestionGateway,
  getIngestionState,
  buildIngestionAudit,
} from "../framework/ingestion";

const router: IRouter = Router();

function isoOrDefault(d: string | Date | undefined): string {
  if (!d) return new Date(0).toISOString();
  return typeof d === "string" ? d : d.toISOString();
}

function envelopeFromBody(e: {
  rawId: string;
  sourceKind: string;
  mediaType: string;
  sourceUri?: string;
  submittedBy: string;
  submittedAt: string | Date;
  payload?: unknown;
}): RawInputEnvelope {
  return {
    rawId: e.rawId,
    sourceKind: e.sourceKind as IngestionSourceKind,
    mediaType: e.mediaType,
    sourceUri: e.sourceUri,
    submittedBy: e.submittedBy,
    submittedAt: isoOrDefault(e.submittedAt),
    payload: e.payload,
  };
}

router.get("/ingestion/state", async (_req, res) => {
  const gateway = getIngestionGateway();
  const state = getIngestionState();
  const payload = {
    jobs: state.jobs,
    candidates: Object.values(state.candidateResults),
    organizations: Object.values(state.organizationResults),
    supportedSourceKinds: gateway.supportedSourceKinds(),
  };
  const data = GetIngestionStateResponse.parse(payload);
  res.json(data);
});

router.post("/ingestion/candidate", async (req, res) => {
  const body = IngestCandidateBody.parse(req.body);
  const gateway = getIngestionGateway();
  const result = gateway.ingestCandidate({
    candidateId: body.candidateId,
    candidateDisplayName: body.candidateDisplayName,
    envelopes: body.envelopes.map(envelopeFromBody),
    submittedBy: body.submittedBy,
    now: isoOrDefault(body.now),
  });
  const data = IngestCandidateResponse.parse(result);
  res.json(data);
});

router.post("/ingestion/organization", async (req, res) => {
  const body = IngestOrganizationBody.parse(req.body);
  const gateway = getIngestionGateway();
  const sources: OrganizationSource[] = body.sources.map((s) => ({
    rawId: s.rawId,
    kind: s.kind,
    submittedBy: s.submittedBy,
    fields: s.fields.map((f) => ({
      field: f.field,
      value: f.value ?? null,
      confidence: f.confidence,
      rationale: f.rationale,
    })),
  }));
  const result = gateway.ingestOrganization({
    organizationId: body.organizationId,
    organizationName: body.organizationName,
    sources,
    submittedBy: body.submittedBy,
    now: isoOrDefault(body.now),
  });
  const data = IngestOrganizationResponse.parse(result);
  res.json(data);
});

router.post("/ingestion/transcript", async (req, res) => {
  const body = IngestTranscriptBody.parse(req.body);
  const gateway = getIngestionGateway();
  const result = gateway.ingestTranscript({
    candidateId: body.candidateId,
    envelope: envelopeFromBody(body.envelope),
    submittedBy: body.submittedBy,
    now: isoOrDefault(body.now),
  });
  const data = IngestTranscriptResponse.parse(result);
  res.json(data);
});

router.get("/ingestion/events/:id", async (req, res) => {
  const gateway = getIngestionGateway();
  const job = gateway.getJob(req.params.id);
  const result = gateway.getResultByJobId(req.params.id);
  if (!job || !result) {
    res.status(404).json({ error: "ingestion_event_not_found" });
    return;
  }
  const data = GetIngestionEventResponse.parse({ job, result });
  res.json(data);
});

router.get("/ingestion/audit/:candidateId", async (req, res) => {
  const bundle = buildIngestionAudit(req.params.candidateId);
  const data = GetIngestionAuditResponse.parse({
    subjectId: req.params.candidateId,
    ...bundle,
  });
  res.json(data);
});

export default router;
