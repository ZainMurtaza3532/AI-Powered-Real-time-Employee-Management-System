import { Router } from "express";
import {
  chatCopilot,
  getFlightRiskAnalysis,
  generate1on1Agenda,
  generateExecutiveBriefing,
  generateAttendanceAnomalyReport,
  getSkillsMatrix,
} from "../controllers/copilot.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// All copilot routes require authentication
router.use(requireAuth);

// Conversational HR copilot (available to all authenticated employees, heads, admins)
router.post("/chat", chatCopilot);

// Predictive flight risk & retention intelligence (Admin and Head only)
router.get("/flight-risk", requireRole("admin", "head"), getFlightRiskAnalysis);

// AI 1-on-1 & Career Progression Planner (Admin and Head only)
router.post("/1-on-1", requireRole("admin", "head"), generate1on1Agenda);

// AI Workforce Executive Briefing (Admin and Head only)
router.post("/executive-briefing", requireRole("admin", "head"), generateExecutiveBriefing);

// AI Attendance Anomaly & Overtime Burnout Radar (Admin and Head only)
router.get("/attendance-anomaly", requireRole("admin", "head"), generateAttendanceAnomalyReport);

// AI Skills Radar & Succession Planning Matrix (Admin and Head only)
router.get("/skills-matrix", requireRole("admin", "head"), getSkillsMatrix);

export default router;

