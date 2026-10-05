import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import memberRouter from "./member";
import adminRouter from "./admin";
import depositRouter from "./deposits";
import receiptRouter from "./receipts";
import financeAdminRouter from "./finance-admin";
import tasksRouter from "./tasks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(memberRouter);
router.use(adminRouter);
router.use(depositRouter);
router.use(receiptRouter);
router.use(financeAdminRouter);
router.use(tasksRouter);

export default router;
