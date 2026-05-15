import { Router, type IRouter } from "express";
import {
  ListAgentsResponse,
  ListSkillsResponse,
  ListProvidersResponse,
  ListWorkflowsResponse,
} from "@workspace/api-zod";
import { getFramework } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/registry/agents", (_req, res) => {
  const fw = getFramework();
  const data = ListAgentsResponse.parse(
    fw.agents.list().map((a) => ({
      id: a.manifest.id,
      name: a.manifest.name,
      role: a.manifest.role,
      status: a.status,
      capabilities: [...a.manifest.capabilities],
      description: a.manifest.description,
      defaultProvider: a.manifest.defaultProvider ?? null,
    })),
  );
  res.json(data);
});

router.get("/registry/skills", (_req, res) => {
  const fw = getFramework();
  const data = ListSkillsResponse.parse(
    fw.skills.list().map((s) => ({
      id: s.manifest.id,
      name: s.manifest.name,
      category: s.manifest.category,
      inputs: [...s.manifest.inputs],
      outputs: [...s.manifest.outputs],
      description: s.manifest.description,
    })),
  );
  res.json(data);
});

router.get("/registry/providers", (_req, res) => {
  const fw = getFramework();
  const data = ListProvidersResponse.parse(
    fw.providers.list().map((p) => ({
      id: p.id,
      name: p.id,
      kind: p.kind,
      models: [...p.models],
      status: p.isConfigured() ? "configured" : "unconfigured",
    })),
  );
  res.json(data);
});

router.get("/registry/workflows", (_req, res) => {
  const fw = getFramework();
  const data = ListWorkflowsResponse.parse(
    fw.workflows.list().map((w) => ({
      id: w.manifest.id,
      name: w.manifest.name,
      trigger: w.manifest.trigger,
      description: w.manifest.description,
      steps: w.manifest.steps.map((s) => ({
        id: s.id,
        agentId: s.agentId,
        skillId: s.skillId,
        description: s.description ?? null,
      })),
    })),
  );
  res.json(data);
});

export default router;
