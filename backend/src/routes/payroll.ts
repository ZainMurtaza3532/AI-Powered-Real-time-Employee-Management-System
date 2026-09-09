import { Router } from "express";
import {
  createOrUpdateSinglePayroll,
  deletePayroll,
  generateMonthlyPayroll,
  getAllPayrolls,
  getMyPayslips,
  getPayrollStats,
  updatePayrollStatus,
} from "../controllers/payroll.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Employee route: get own payslips
router.get("/my", getMyPayslips);

// Admin & Head routes
router.get("/stats", requireRole("admin", "head"), getPayrollStats);
router.get("/", requireRole("admin", "head"), getAllPayrolls);
router.post("/generate", requireRole("admin"), generateMonthlyPayroll);
router.post("/single", requireRole("admin"), createOrUpdateSinglePayroll);
router.patch("/:id/status", requireRole("admin"), updatePayrollStatus);
router.delete("/:id", requireRole("admin"), deletePayroll);

export default router;
