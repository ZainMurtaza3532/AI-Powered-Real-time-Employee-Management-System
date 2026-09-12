import { Router } from "express";
import {
  createOfficeLocation,
  deleteOfficeLocation,
  getAllOfficeLocations,
  getMyIp,
  getOfficeLocationById,
  updateOfficeLocation,
} from "../controllers/officeLocations.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// Protect all routes with authentication and Admin role check
router.use(requireAuth, requireRole("admin"));

// Utility: get admin's currently detected client IP
router.get("/my-ip", getMyIp);

// Standard CRUD endpoints for branch locations & IP whitelisting
router.get("/", getAllOfficeLocations);
router.post("/", createOfficeLocation);
router.get("/:id", getOfficeLocationById);
router.put("/:id", updateOfficeLocation);
router.patch("/:id", updateOfficeLocation);
router.delete("/:id", deleteOfficeLocation);

export default router;
