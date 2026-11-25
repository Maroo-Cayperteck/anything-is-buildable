import { deleteCookie, getCookie, getRequestProtocol, setCookie } from "@tanstack/react-start/server";

export type Role = "student" | "admin";

export interface ServerSessionData {
  role: Role;
  username: string;
}

// Demo accounts are identified by a SHA-256 of "username:password" so the
// plain passwords never appear in source. This file (*.server.ts) is only
// ever executed on the server and never bundled for the browser.
export const DEMO_ACCOUNTS: Record<string, { role: Role; username: string }> = {
  // 30706232100316:925250059
  "560db5cff851226e12ae4c5c4dfd2879a936af5a12989937b439ca0855b730e8": {
    role: "student",
    username: "30706232100316",
  },
  // 925250059:30706232100316
  d2d58a967590f5b4c80b2ab10a9a287c912d55d39f2f51cb8fb4d595482a1c57: {
    role: "student",
    username: "30706232100316",
  },
  // Admin account
  e146ef6fea917aac134d7e7899ab463c32d99f24e799c716a395373e8105651c: {
    role: "admin",
    username: "admin",
  },
};

export const STUDENT_PROFILE = {
  user_id: "demo-student-id",
  username: "30706232100316",
  full_name_ar: "عمر احمد محمد محمد",
  full_name_en: "Omar Ahmed Mohmed Mohmed",
  national_id: "30706232100316",
  student_code: "925250059",
  program: "هندسة الشبكات والأمن السيبراني",
  faculty: "كلية الهندسة",
  academic_level: "المستوى الثاني",
  academic_status: "مقيد — منتظم",
  academic_year: "2026 / 2027",
  gender: "ذكر",
  phone: null,
  cgpa: 2.7,
  earned_hours: 28,
  created_at: "2026-10-22T00:00:00.000Z",
  extra: {
    application_no: "25084",
    certificate: "الثانوية الأزهرية - علمي - 2025",
    birth_date: "2007-06-23",
    group: "Group 1 - Section 1",
  },
};

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SESSION_COOKIE_NAME = "hnu_portal_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Lazily initialized inside request handlers (Cloudflare Workers forbids crypto in global scope).
let runtimeFallbackSecret: string | undefined;

function getSigningSecret(): string {
  const configured = process.env["SESSION_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (configured) return configured;
  if (!runtimeFallbackSecret) {
    runtimeFallbackSecret = crypto.randomUUID() + crypto.randomUUID();
  }
  return runtimeFallbackSecret;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function isHttpsRequest(): boolean {
  try {
    return getRequestProtocol({ xForwardedProto: true }) === "https";
  } catch {
    return false;
  }
}

export async function setServerSessionCookie(role: Role, username: string): Promise<void> {
  const payload = JSON.stringify({ role, username, exp: Date.now() + SESSION_TTL_MS });
  const encodedPayload = toBase64Url(new TextEncoder().encode(payload));
  const key = await importHmacKey(getSigningSecret());
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload)));
  const token = `${encodedPayload}.${toBase64Url(sig)}`;
  const isHttps = isHttpsRequest();

  setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: isHttps,
  });
}

export async function readServerSessionCookie(): Promise<ServerSessionData | null> {
  let raw: string | undefined;
  try {
    raw = getCookie(SESSION_COOKIE_NAME);
  } catch {
    return null;
  }
  if (!raw) return null;

  const dot = raw.indexOf(".");
  if (dot <= 0) return null;

  const encodedPayload = raw.slice(0, dot);
  const encodedSig = raw.slice(dot + 1);
  const sigBytes = fromBase64Url(encodedSig);
  const payloadBytes = fromBase64Url(encodedPayload);
  if (!sigBytes || !payloadBytes) return null;

  try {
    const key = await importHmacKey(getSigningSecret());
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(encodedPayload),
    );
    if (!valid) return null;

    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      role?: unknown;
      username?: unknown;
      exp?: unknown;
    };
    if (
      (parsed.role !== "student" && parsed.role !== "admin") ||
      typeof parsed.username !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return { role: parsed.role, username: parsed.username };
  } catch {
    return null;
  }
}

export function clearServerSessionCookie(): void {
  try {
    const isHttps = isHttpsRequest();
    deleteCookie(SESSION_COOKIE_NAME, {
      path: "/",
      sameSite: isHttps ? "none" : "lax",
      secure: isHttps,
    });
  } catch {
    // ignore outside request context
  }
}
