import { Router } from "express";
import {
  adjustBalance,
  cancelLeave,
  createLeave,
  decideLeave,
  getAllLeaves,
  listBalances,
  listLeaves,
  myBalance,
  myLeaves,
} from "../controllers/leaves.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user: apply, personal records, and balance
router.post("/", createLeave);
router.get("/mine", myLeaves);
router.get("/balance", myBalance);
router.patch("/:id/cancel", cancelLeave);

// Role-based scoping: Admin (all), Head (department members), Employee (own)
router.get("/", getAllLeaves);

// Admin-only: oversight, decisions, and balance management.
router.get("/balances", requireRole("admin"), listBalances);
router.patch("/balances/:userId", requireRole("admin"), adjustBalance);
router.patch("/:id/decide", requireRole("admin"), decideLeave);

export default router;
