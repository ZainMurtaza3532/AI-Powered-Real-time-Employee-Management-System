import { Router } from "express";
import {
  attendanceStats,
  departmentAttendance,
  getAllAttendances,
  getAttendance,
  getTodayStatus,
  markAttendance,
  myAttendance,
  selfPunch,
  updateAttendance,
} from "../controllers/attendance.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user: role-scoped list of attendances
// (Admin: company-wide, Head: department members, Employee: personal records)
router.get("/", getAllAttendances);

// Any authenticated user: get today's punch status and active work timer.
router.get("/today", getTodayStatus);

// Any authenticated user: 1-click self check-in / check-out.
router.post("/punch", selfPunch);

// Any authenticated user: their own attendance records.
router.get("/mine", myAttendance);

// Head or admin: mark attendance for department members.
router.post("/", requireRole("head", "admin"), markAttendance);

// Head or admin: department attendance overview.
router.get("/department", requireRole("head", "admin"), departmentAttendance);

// Admin-only: attendance statistics and reports.
router.get("/stats", requireRole("admin"), attendanceStats);

// Any authenticated user: single record detail.
router.get("/:id", getAttendance);

// Head or admin: update an existing attendance record.
router.patch("/:id", requireRole("head", "admin"), updateAttendance);

export default router;
