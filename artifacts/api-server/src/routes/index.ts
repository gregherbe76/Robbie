import { Router, type IRouter } from "express";
import healthRouter from "./health";
import systemRouter from "./system";
import registryRouter from "./registry";
import memoryRouter from "./memory";
import graphRouter from "./graph";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(systemRouter);
router.use(registryRouter);
router.use(memoryRouter);
router.use(graphRouter);
router.use(reportsRouter);

export default router;
