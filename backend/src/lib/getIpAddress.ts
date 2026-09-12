import type { Request } from "express";

/**
 * Normalizes an IP string:
 * 1. Trims surrounding whitespace and quotes.
 * 2. Unwraps IPv4-mapped IPv6 addresses (e.g. `::ffff:192.168.1.1` -> `192.168.1.1`).
 * 3. Normalizes IPv6 loopback (`::1`) to standard `127.0.0.1`.
 * 4. Strips optional port suffix (e.g. `192.168.1.1:54321` or `[::1]:3000`).
 */
export function normalizeIp(rawIp: string | null | undefined): string {
  if (!rawIp) return "127.0.0.1";

  let ip = rawIp.trim().replace(/^["']|["']$/g, "");

  // If IP is bracketed with port (e.g., [::ffff:192.168.1.1]:8080 or [::1]:3000)
  const bracketMatch = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch && bracketMatch[1]) {
    ip = bracketMatch[1];
  } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(ip)) {
    // IPv4 with port (e.g., 192.168.1.1:5000)
    const [host] = ip.split(":");
    if (host) ip = host;
  }

  // Strip IPv4-mapped IPv6 prefix (::ffff:192.168.1.1 -> 192.168.1.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // Standardize IPv6 loopback to IPv4 loopback for consistent matching
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") {
    ip = "127.0.0.1";
  }

  return ip.toLowerCase().trim();
}

/**
 * Extracts and normalizes the client's public IP address from Express `req`.
 *
 * Designed specifically for cloud environments (Vercel, Cloudflare, AWS, Nginx):
 * - Vercel / proxies populate `x-forwarded-for` with a comma-separated chain: `client, proxy1, proxy2`.
 *   The first (leftmost) IP is the original client IP.
 * - Checks fallback headers (`x-vercel-forwarded-for`, `x-real-ip`, `cf-connecting-ip`).
 * - Falls back to Express `req.ip` and socket `remoteAddress`.
 */
export function getIpAddress(req: Request): string {
  // 1. Check x-forwarded-for header (standard proxy header on Vercel & load balancers)
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    if (typeof raw === "string" && raw.trim().length > 0) {
      // The leftmost IP is the original client IP
      const parts = raw.split(",");
      const clientIp = parts[0]?.trim();
      if (clientIp) {
        return normalizeIp(clientIp);
      }
    }
  }

  // 2. Check Vercel-specific forwarded IP header
  const vercelForwarded = req.headers["x-vercel-forwarded-for"];
  if (typeof vercelForwarded === "string" && vercelForwarded.trim().length > 0) {
    const parts = vercelForwarded.split(",");
    const clientIp = parts[0]?.trim();
    if (clientIp) {
      return normalizeIp(clientIp);
    }
  }

  // 3. Check X-Real-IP (common reverse proxy header)
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim().length > 0) {
    return normalizeIp(realIp);
  }

  // 4. Check Cloudflare CF-Connecting-IP
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (typeof cfConnectingIp === "string" && cfConnectingIp.trim().length > 0) {
    return normalizeIp(cfConnectingIp);
  }

  // 5. Check Express req.ip (populated when app.set('trust proxy', 1) is active)
  if (req.ip && typeof req.ip === "string" && req.ip.trim().length > 0) {
    return normalizeIp(req.ip);
  }

  // 6. Direct socket remote address fallback
  if (req.socket?.remoteAddress) {
    return normalizeIp(req.socket.remoteAddress);
  }

  return "127.0.0.1";
}

/**
 * Checks if an IPv4 address is within a CIDR subnet block (e.g. 192.168.1.0/24).
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const parts = cidr.split("/");
  const range = parts[0];
  const bitsStr = parts[1];
  if (!range || !bitsStr) return false;

  const bits = parseInt(bitsStr, 10);
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipToInt = (addr: string): number => {
    return (
      addr
        .split(".")
        .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
    );
  };

  try {
    const ipInt = ipToInt(ip);
    const rangeInt = ipToInt(range);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  } catch {
    return false;
  }
}

/**
 * Compares a client's extracted IP against a list of whitelisted IPs.
 * Supports exact matching, wildcard matching (e.g., 192.168.1.*), and CIDR subnets (e.g., 10.0.0.0/8).
 */
export function isIpWhitelisted(clientIp: string, whitelistedIps: string[]): boolean {
  if (!clientIp || !Array.isArray(whitelistedIps) || whitelistedIps.length === 0) {
    return false;
  }

  const normalizedClient = normalizeIp(clientIp);

  return whitelistedIps.some((allowed) => {
    if (!allowed) return false;
    const cleanAllowed = normalizeIp(allowed);

    // Exact match
    if (normalizedClient === cleanAllowed) {
      return true;
    }

    // CIDR subnet match (e.g. 192.168.1.0/24)
    if (allowed.includes("/")) {
      return isIpInCidr(normalizedClient, allowed.trim());
    }

    // Wildcard match (e.g. 192.168.1.*)
    if (allowed.includes("*")) {
      const regexPattern = "^" + allowed.trim().replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
      return new RegExp(regexPattern).test(normalizedClient);
    }

    return false;
  });
}

export default getIpAddress;
