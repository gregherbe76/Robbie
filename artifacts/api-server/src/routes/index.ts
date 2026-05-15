import { Router, type IRouter } from "express";
import healthRouter from "./health";
import systemRouter from "./system";
import registryRouter from "./registry";
import memoryRouter from "./memory";
import graphRouter from "./graph";
import reportsRouter from "./reports";
import intelligenceRouter from "./intelligence";
import organizationIntelligenceRouter from "./organization-intelligence";
import evaluationRouter from "./evaluation";
import operationsRouter from "./operations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(systemRouter);
router.use(registryRouter);
router.use(memoryRouter);
router.use(graphRouter);
router.use(reportsRouter);
router.use(intelligenceRouter);
router.use(organizationIntelligenceRouter);
router.use(evaluationRouter);
router.use(operationsRouter);

export default router;
