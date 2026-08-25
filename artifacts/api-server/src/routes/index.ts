import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coverLetterRouter from "./cover-letter";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coverLetterRouter);

export default router;
