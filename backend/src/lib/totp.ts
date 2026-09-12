import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a buffer to a Base32 string (RFC 4648).
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]!;
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string back to a Buffer.
 */
export function base32Decode(base32: string): Buffer {
  const cleanBase32 = base32.toUpperCase().replace(/=+$/, "").replace(/[\s-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanBase32.length; i++) {
    const char = cleanBase32[i]!;
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a cryptographically random 20-byte Base32 secret for TOTP (Google Authenticator).
 */
export function generateTotpSecret(length = 20): string {
  const randomBytes = crypto.randomBytes(length);
  return base32Encode(randomBytes);
}

/**
 * Generates an RFC 6238 TOTP token for a given Base32 secret and timestamp.
 */
export function generateTotpToken(
  secret: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
  digits = 6
): string {
  const key = base32Decode(secret);
  const timeStep = Math.floor(timestampMs / 1000 / stepSeconds);

  // 8-byte big-endian time buffer
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));

  // HMAC-SHA1 computation
  const hmac = crypto.createHmac("sha1", key);
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226)
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

/**
 * Verifies a user-submitted 6-digit TOTP code against a secret.
 * Allows a +/- 1 step window (30 seconds drift).
 */
export function verifyTotpToken(
  token: string,
  secret: string,
  windowSteps = 1,
  stepSeconds = 30
): boolean {
  if (!token || typeof token !== "string" || !secret) {
    return false;
  }

  const cleanToken = token.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  const now = Date.now();

  for (let i = -windowSteps; i <= windowSteps; i++) {
    const checkTime = now + i * stepSeconds * 1000;
    try {
      const expected = generateTotpToken(secret, checkTime, stepSeconds, 6);
      if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Builds the standard otpauth URL for QR Code scanners.
 */
export function buildOtpauthUrl(
  userEmail: string,
  secret: string,
  issuer = "EMS Platform"
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(userEmail);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates a high-resolution base64 PNG Data URL for QR Code scanning in apps.
 */
export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

export interface BackupCode {
  codeHash: string;
  used: boolean;
}

/**
 * Generates 8 random emergency backup recovery codes (e.g. 842b-91c4).
 * Returns plain codes for the user to write down and hashed versions for DB storage.
 */
export async function generateBackupCodes(count = 8): Promise<{
  plainCodes: string[];
  hashedCodes: BackupCode[];
}> {
  const plainCodes: string[] = [];
  const hashedCodes: BackupCode[] = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString("hex"); // 8 hex chars
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    plainCodes.push(formatted);

    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(formatted.replace("-", "").toLowerCase(), salt);
    hashedCodes.push({ codeHash, used: false });
  }

  return { plainCodes, hashedCodes };
}

/**
 * Verifies and redeems a single-use backup recovery code.
 */
export async function verifyAndRedeemBackupCode(
  candidateCode: string,
  backupCodes: BackupCode[]
): Promise<{ success: boolean; updatedCodes: BackupCode[] }> {
  if (!candidateCode || !Array.isArray(backupCodes)) {
    return { success: false, updatedCodes: backupCodes };
  }

  const cleanCandidate = candidateCode.trim().replace(/[-\s]/g, "").toLowerCase();

  for (let i = 0; i < backupCodes.length; i++) {
    const item = backupCodes[i]!;
    if (!item.used) {
      const match = await bcrypt.compare(cleanCandidate, item.codeHash);
      if (match) {
        // Mark code as used
        const updated = backupCodes.map((c, idx) =>
          idx === i ? { ...c, used: true } : c
        );
        return { success: true, updatedCodes: updated };
      }
    }
  }

  return { success: false, updatedCodes: backupCodes };
}
