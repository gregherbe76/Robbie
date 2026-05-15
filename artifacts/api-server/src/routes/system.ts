import { Router, type IRouter } from "express";
import { GetSystemOverviewResponse } from "@workspace/api-zod";
import { getFramework, getUptimeSeconds } from "../framework/bootstrap";

const router: IRouter = Router();

router.get("/system/overview", async (_req, res) => {
  const fw = getFramework();
  const [memoryEntries, candidate, organization, reports] = await Promise.all([
    fw.memory.query({}),
    fw.candidateGraph.snapshot(),
    fw.organizationGraph.snapshot(),
    fw.reports.list(),
  ]);
  const data = GetSystemOverviewResponse.parse({
    version: "0.1.0",
    agents: fw.agents.list().length,
    skills: fw.skills.list().length,
    providers: fw.providers.list().length,
    workflows: fw.workflows.list().length,
    memoryEntries: memoryEntries.length,
    candidateNodes: candidate.nodes.length,
    organizationNodes: organization.nodes.length,
    reports: reports.length,
    uptimeSeconds: getUptimeSeconds(),
  });
  res.json(data);
});

export default router;
