import { Router } from "express";
import {
  disable2fa,
  enable2fa,
  get2faStatus,
  login,
  logout,
  me,
  regenerateBackupCodes,
  setup2fa,
  verify2faLogin,
} from "../controllers/auth.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// Public authentication & 2FA challenge endpoints
router.post("/login", login);
router.post("/2fa/verify-login", verify2faLogin);
router.post("/logout", logout);

// Authenticated session & 2FA management endpoints
router.get("/me", requireAuth, me);
router.get("/2fa/status", requireAuth, get2faStatus);
router.post("/2fa/setup", requireAuth, setup2fa);
router.post("/2fa/enable", requireAuth, enable2fa);
router.post("/2fa/disable", requireAuth, disable2fa);
router.post("/2fa/backup-codes", requireAuth, regenerateBackupCodes);

export default router;
