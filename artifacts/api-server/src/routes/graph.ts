import { Router, type IRouter } from "express";
import {
  GetCandidateGraphResponse,
  GetOrganizationGraphResponse,
} from "@workspace/api-zod";
import { getFramework } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/graph/candidate", async (_req, res) => {
  const fw = getFramework();
  const snap = await fw.candidateGraph.snapshot();
  const data = GetCandidateGraphResponse.parse({
    nodes: snap.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      weight: n.weight ?? null,
    })),
    edges: snap.edges.map((e) => ({
      from: e.from,
      to: e.to,
      relation: e.relation,
      weight: e.weight ?? null,
    })),
  });
  res.json(data);
});

router.get("/graph/organization", async (_req, res) => {
  const fw = getFramework();
  const snap = await fw.organizationGraph.snapshot();
  const data = GetOrganizationGraphResponse.parse({
    nodes: snap.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      weight: n.weight ?? null,
    })),
    edges: snap.edges.map((e) => ({
      from: e.from,
      to: e.to,
      relation: e.relation,
      weight: e.weight ?? null,
    })),
  });
  res.json(data);
});

export default router;
