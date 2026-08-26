import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_ADMIN_KEY_FALLBACK = "boda2026";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || DEFAULT_ADMIN_KEY_FALLBACK;
}

export function computeAdminToken(secret = getAdminPassword()) {
  return createHash("sha256").update(`admin-auth-session-salt-2026:${secret}`).digest("hex");
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyAdminPassword(inputPassword) {
  if (typeof inputPassword !== "string" || !inputPassword.trim()) return false;
  const configuredPassword = getAdminPassword();
  return safeCompare(inputPassword.trim(), configuredPassword.trim());
}

export function verifyAdminToken(inputToken) {
  if (typeof inputToken !== "string" || !inputToken.trim()) return false;
  const expectedToken = computeAdminToken();
  return safeCompare(inputToken.trim(), expectedToken);
}

export function extractAdminTokenFromRequest(request) {
  const authHeader = request.headers.authorization || request.headers.Authorization;
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      return parts[1];
    }
    return authHeader;
  }

  const customHeader = request.headers["x-admin-token"];
  if (customHeader && typeof customHeader === "string") {
    return customHeader;
  }

  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

export function requireAdminAuth(request, response) {
  const token = extractAdminTokenFromRequest(request);
  if (!token || !verifyAdminToken(token)) {
    response.status(401).json({
      error: "Acceso no autorizado. Por favor inicia sesión como administrador."
    });
    return false;
  }
  return true;
}
