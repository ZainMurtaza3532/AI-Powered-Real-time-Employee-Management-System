import type { Request, Response } from "express";
import { logActivity } from "../lib/activityLog.js";
import {
  expiresInToMs,
  sign2faChallengeToken,
  signAccessToken,
  TOKEN_COOKIE,
  verify2faChallengeToken,
  verifyAccessToken,
} from "../lib/jwt.js";
import {
  buildOtpauthUrl,
  generateBackupCodes,
  generateQrCodeDataUrl,
  generateTotpSecret,
  verifyAndRedeemBackupCode,
  verifyTotpToken,
} from "../lib/totp.js";
import type { IUser } from "../models/User.js";
import { User } from "../models/User.js";

const DEFAULT_EXPIRES_IN = "7d";

/**
 * Sets the authenticated JWT session cookie.
 */
function setAuthCookie(res: Response, user: IUser): void {
  const token = signAccessToken(user);
  const expiresIn = process.env.JWT_EXPIRES_IN ?? DEFAULT_EXPIRES_IN;
  const isProd = process.env.NODE_ENV === "production";

  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: expiresInToMs(expiresIn),
    path: "/",
  });
}

/**
 * Authenticates credentials.
 * For Admin & Department Head roles (or users with 2FA enabled), returns a 2FA challenge.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() })
    .select("+password +twoFactorSecret");

  if (!user || !(await user.comparePassword(password))) {
    // Audit failed attempts
    logActivity({
      action: "login_failed",
      actorEmail: email.trim().toLowerCase(),
      details: { reason: "invalid_credentials" },
      ip: req.ip,
    });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // -------------------------------------------------------------------------
  // Two-Factor Authentication (2FA / MFA) Challenge Evaluation
  // -------------------------------------------------------------------------
  const isMandatoryRole = user.role === "admin" || user.role === "head";

  // Case 1: User has 2FA configured and active
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const tempToken = sign2faChallengeToken(user, "2fa_challenge");
    res.json({
      mfaRequired: true,
      tempToken,
      email: user.email,
      role: user.role,
      message: "Two-factor authentication code required.",
    });
    return;
  }

  // Case 2: Mandatory 2FA for Admin or Department Head who hasn't enrolled yet
  if (isMandatoryRole) {
    const secret = generateTotpSecret();
    user.twoFactorTempSecret = secret;
    await user.save();

    const otpauthUrl = buildOtpauthUrl(user.email, secret);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl);
    const tempToken = sign2faChallengeToken(user, "2fa_setup");

    res.json({
      mfaSetupRequired: true,
      tempToken,
      email: user.email,
      role: user.role,
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      message: "Two-Factor Authentication (Google Authenticator) is mandatory for your role. Please scan the QR code to finish setup.",
    });
    return;
  }

  // Case 3: Standard Employee without 2FA enabled
  logActivity({ action: "login", actor: user, ip: req.ip });
  setAuthCookie(res, user);
  res.json({ user: user.toJSON() });
}

/**
 * POST /api/auth/2fa/verify-login
 * Verifies 6-digit TOTP code (or backup code) from the 2FA login challenge.
 */
export async function verify2faLogin(req: Request, res: Response): Promise<void> {
  const { tempToken, code, isBackupCode } = (req.body ?? {}) as {
    tempToken?: string;
    code?: string;
    isBackupCode?: boolean;
  };

  if (!tempToken || !code || !code.trim()) {
    res.status(400).json({ error: "Temporary token and verification code are required" });
    return;
  }

  let payload;
  try {
    payload = verify2faChallengeToken(tempToken);
  } catch {
    res.status(401).json({ error: "2FA session expired. Please sign in again." });
    return;
  }

  const user = await User.findById(payload.sub)
    .select("+twoFactorSecret +twoFactorTempSecret +twoFactorBackupCodes");

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // -------------------------------------------------------------------------
  // Existing 2FA Login Challenge
  // -------------------------------------------------------------------------
  if (payload.purpose === "2fa_challenge") {
    if (!user.twoFactorSecret) {
      res.status(400).json({ error: "2FA is not configured for this account" });
      return;
    }

    let isValid = false;

    // Check backup recovery code
    if (isBackupCode || code.includes("-")) {
      const result = await verifyAndRedeemBackupCode(code, user.twoFactorBackupCodes ?? []);
      if (result.success) {
        isValid = true;
        user.twoFactorBackupCodes = result.updatedCodes;
        await user.save();
      }
    } else {
      // Standard 6-digit TOTP code
      isValid = verifyTotpToken(code, user.twoFactorSecret);
    }

    if (!isValid) {
      logActivity({
        action: "login_failed",
        actor: user,
        details: { reason: "invalid_2fa_code" },
        ip: req.ip,
      });
      res.status(401).json({ error: "Invalid two-factor authentication code. Please check Google Authenticator." });
      return;
    }

    logActivity({ action: "login", actor: user, details: { method: "2fa_totp" }, ip: req.ip });
    setAuthCookie(res, user);
    res.json({
      message: "Two-factor authentication successful",
      user: user.toJSON(),
    });
    return;
  }

  // -------------------------------------------------------------------------
  // Mandatory First-Time 2FA Enrollment on Login
  // -------------------------------------------------------------------------
  if (payload.purpose === "2fa_setup") {
    if (!user.twoFactorTempSecret) {
      res.status(400).json({ error: "No pending 2FA setup found. Please sign in again." });
      return;
    }

    const isValid = verifyTotpToken(code, user.twoFactorTempSecret);
    if (!isValid) {
      res.status(401).json({
        error: "Invalid 6-digit verification code. Please ensure your device clock is synchronized and try again.",
      });
      return;
    }

    // Generate 8 emergency backup codes
    const { plainCodes, hashedCodes } = await generateBackupCodes(8);

    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorEnabled = true;
    user.twoFactorTempSecret = undefined;
    user.twoFactorBackupCodes = hashedCodes;
    await user.save();

    logActivity({
      action: "login",
      actor: user,
      details: { method: "2fa_setup_enrolled" },
      ip: req.ip,
    });

    setAuthCookie(res, user);
    res.json({
      message: "Two-Factor Authentication enabled and verified successfully!",
      user: user.toJSON(),
      backupCodes: plainCodes,
    });
    return;
  }

  res.status(400).json({ error: "Invalid challenge purpose" });
}

/**
 * GET /api/auth/2fa/status
 * Returns current user's 2FA enrollment status.
 */
export async function get2faStatus(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const isMandatory = user.role === "admin" || user.role === "head";

  res.json({
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    isMandatory,
    role: user.role,
  });
}

/**
 * POST /api/auth/2fa/setup
 * Generates a new TOTP secret & QR code for the authenticated user.
 */
export async function setup2fa(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const secret = generateTotpSecret();

  user.twoFactorTempSecret = secret;
  await user.save();

  const otpauthUrl = buildOtpauthUrl(user.email, secret);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl);

  res.json({
    secret,
    otpauthUrl,
    qrCodeDataUrl,
  });
}

/**
 * POST /api/auth/2fa/enable
 * Confirms 6-digit code against pending temp secret and activates 2FA.
 */
export async function enable2fa(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!._id).select("+twoFactorTempSecret");
  if (!user || !user.twoFactorTempSecret) {
    res.status(400).json({ error: "Please initiate 2FA setup before verifying." });
    return;
  }

  const { code } = (req.body ?? {}) as { code?: string };
  if (!code || !verifyTotpToken(code, user.twoFactorTempSecret)) {
    res.status(400).json({ error: "Invalid 6-digit code. Please verify the code in Google Authenticator." });
    return;
  }

  const { plainCodes, hashedCodes } = await generateBackupCodes(8);

  user.twoFactorSecret = user.twoFactorTempSecret;
  user.twoFactorEnabled = true;
  user.twoFactorTempSecret = undefined;
  user.twoFactorBackupCodes = hashedCodes;
  await user.save();

  logActivity({
    action: "profile_updated",
    actor: user,
    details: { feature: "2fa_enabled" },
    ip: req.ip,
  });

  res.json({
    message: "Two-Factor Authentication enabled successfully",
    backupCodes: plainCodes,
  });
}

/**
 * POST /api/auth/2fa/disable
 * Disables 2FA (prohibited for Admin and Department Heads).
 */
export async function disable2fa(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!._id)
    .select("+password +twoFactorSecret");

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Strictly prevent Admin and Department Heads from disabling mandatory 2FA
  if (user.role === "admin" || user.role === "head") {
    res.status(403).json({
      error: "Two-Factor Authentication is mandatory for Admin and Department Head accounts and cannot be disabled.",
    });
    return;
  }

  const { password, code } = (req.body ?? {}) as { password?: string; code?: string };

  if (!password || !(await user.comparePassword(password))) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  if (!code || !user.twoFactorSecret || !verifyTotpToken(code, user.twoFactorSecret)) {
    res.status(400).json({ error: "Invalid 2FA code" });
    return;
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.twoFactorBackupCodes = undefined;
  await user.save();

  logActivity({
    action: "profile_updated",
    actor: user,
    details: { feature: "2fa_disabled" },
    ip: req.ip,
  });

  res.json({ message: "Two-Factor Authentication has been disabled" });
}

/**
 * POST /api/auth/2fa/backup-codes
 * Generates fresh backup codes when authenticated with current 2FA code.
 */
export async function regenerateBackupCodes(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!._id).select("+twoFactorSecret");
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    res.status(400).json({ error: "2FA is not enabled on this account" });
    return;
  }

  const { code } = (req.body ?? {}) as { code?: string };
  if (!code || !verifyTotpToken(code, user.twoFactorSecret)) {
    res.status(400).json({ error: "Invalid 2FA code" });
    return;
  }

  const { plainCodes, hashedCodes } = await generateBackupCodes(8);
  user.twoFactorBackupCodes = hashedCodes;
  await user.save();

  res.json({
    message: "New backup codes generated",
    backupCodes: plainCodes,
  });
}

/**
 * Clears the auth cookie.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies.token as string | undefined;
  let actor: IUser | undefined;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub);
      if (user) actor = user;
    } catch {
      // Invalid/expired token
    }
  }
  logActivity({ action: "logout", actor, ip: req.ip });

  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(TOKEN_COOKIE, {
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
  res.json({ message: "Logged out" });
}

/** Returns the authenticated user (requireAuth guarantees req.user is present). */
export async function me(req: Request, res: Response): Promise<void> {
  res.json({ user: req.user!.toJSON() });
}
