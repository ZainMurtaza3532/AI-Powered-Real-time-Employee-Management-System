import { Router } from "express";
import {
  analyzeReceiptWithAI,
  createExpense,
  deleteExpense,
  getAllExpenses,
  getMyExpenses,
  updateExpenseStatus,
} from "../controllers/expenses.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// AI Receipt Analyzer
router.post("/ai-analyze-receipt", analyzeReceiptWithAI);

// Employee routes
router.get("/my", getMyExpenses);
router.post("/", createExpense);

// Admin & Head routes
router.get("/", requireRole("admin", "head"), getAllExpenses);
router.patch("/:id/status", requireRole("admin", "head"), updateExpenseStatus);
router.delete("/:id", deleteExpense);

export default router;
