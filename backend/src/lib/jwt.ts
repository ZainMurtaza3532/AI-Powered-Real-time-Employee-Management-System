import jwt from "jsonwebtoken";

/** Name of the httpOnly cookie that carries the access token. */
export const TOKEN_COOKIE = "token";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "7d") as unknown as jwt.SignOptions["expiresIn"];

export interface AccessTokenPayload {
  sub: string;
  role: "admin" | "employee" | "head";
}

export interface TwoFactorChallengePayload {
  sub: string;
  role: "admin" | "employee" | "head";
  purpose: "2fa_challenge" | "2fa_setup";
}

function requireSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Add it to backend/.env (see backend/.env.example).");
  }
  return JWT_SECRET;
}

/** Signs an access token for the given user. */
export function signAccessToken(user: { id?: string; _id?: unknown; role: "admin" | "employee" | "head" }): string {
  const userId = user.id ?? (user._id ? String(user._id) : "");
  return jwt.sign({ sub: userId, role: user.role }, requireSecret(), { expiresIn: JWT_EXPIRES_IN });
}

/** Signs a short-lived (5 min) temporary challenge token for 2FA verification during login. */
export function sign2faChallengeToken(
  user: { id?: string; _id?: unknown; role: "admin" | "employee" | "head" },
  purpose: "2fa_challenge" | "2fa_setup" = "2fa_challenge"
): string {
  const userId = user.id ?? (user._id ? String(user._id) : "");
  return jwt.sign(
    { sub: userId, role: user.role, purpose },
    requireSecret(),
    { expiresIn: "5m" }
  );
}

/** Verifies a 2FA challenge token. */
export function verify2faChallengeToken(token: string): TwoFactorChallengePayload {
  const payload = jwt.verify(token, requireSecret());
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    !payload.purpose
  ) {
    throw new jwt.JsonWebTokenError("Invalid 2FA challenge token payload");
  }
  return {
    sub: payload.sub,
    role: payload.role as TwoFactorChallengePayload["role"],
    purpose: payload.purpose as TwoFactorChallengePayload["purpose"],
  };
}

/** Verifies a token and returns its payload. Throws on invalid or expired tokens. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, requireSecret());
  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }
  return { sub: payload.sub, role: payload.role as AccessTokenPayload["role"] };
}

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Converts a ms-style duration ("7d", "2h", "30m") to milliseconds (for the cookie maxAge). */
export function expiresInToMs(expiresIn: string): number {
  const match = /^(\d+)\s*(s|m|h|d|w)?$/.exec(expiresIn.trim());
  if (!match) {
    throw new Error(`Invalid JWT_EXPIRES_IN value: "${expiresIn}" (use e.g. 7d, 2h, 30m)`);
  }
  const value = Number(match[1]);
  const unit = match[2] ?? "s";
  return value * (UNIT_MS[unit] ?? 1_000);
}
