import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { usernameToEmail } from "./auth-helpers";

/**
 * Server-side credential verification.
 * All credential hashes, profile records, and session signing live in accounts.server.ts
 * so they never enter the browser bundle.
 */
export const verifyDemoCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(128) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { DEMO_ACCOUNTS, STUDENT_PROFILE, sha256Hex, setServerSessionCookie } = await import("./accounts.server");
    const account =
      DEMO_ACCOUNTS[await sha256Hex(`${data.username}:${data.password}`)] ??
      DEMO_ACCOUNTS[await sha256Hex(`${data.username.toLowerCase()}:${data.password}`)] ??
      DEMO_ACCOUNTS[await sha256Hex(`${data.username.toLowerCase()}:${data.password.toLowerCase()}`)];
    if (!account) return { ok: false as const };

    await setServerSessionCookie(account.role, account.username);

    // If Supabase admin credentials are available (production/Lovable Cloud),
    // also provision the user and generate a magiclink OTP token for a real JWT session.
    if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const email = usernameToEmail(account.username);

        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        let user = list?.users.find((u) => u.email === email);
        if (!user) {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: data.password,
            email_confirm: true,
          });
          if (!error && created.user) {
            user = created.user;
          }
        }
        if (user) {
          await supabaseAdmin.from("user_roles").upsert({ user_id: user.id, role: account.role }, { onConflict: "user_id,role" });
          if (account.role === "student") {
            await supabaseAdmin.from("student_profiles").upsert({ ...STUDENT_PROFILE, user_id: user.id }, { onConflict: "user_id" });
          }
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
          });
          const tokenHash = linkData?.properties?.hashed_token;
          if (!linkErr && tokenHash) {
            return {
              ok: true as const,
              role: account.role,
              username: account.username,
              mode: "otp" as const,
              tokenHash,
            };
          }
        }
      } catch {
        // Fall through to HttpOnly cookie session
      }
    }

    return {
      ok: true as const,
      role: account.role,
      username: account.username,
      mode: "cookie" as const,
    };
  });

/** @deprecated Use verifyDemoCredentials instead */
export const ensureDemoAccount = verifyDemoCredentials;

/** Returns the verified HttpOnly server session, or null if not authenticated. */
export const getServerSession = createServerFn({ method: "GET" }).handler(async () => {
  const { readServerSessionCookie } = await import("./accounts.server");
  return readServerSessionCookie();
});

/** Clears the HttpOnly server session cookie on sign out. */
export const serverSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const { clearServerSessionCookie } = await import("./accounts.server");
  clearServerSessionCookie();
  return { ok: true as const };
});

/**
 * Returns the student profile ONLY for an authenticated student session
 * (verified via HttpOnly server cookie or Supabase Bearer token).
 */
export const getStudentProfile = createServerFn({ method: "GET" }).handler(async () => {
  const { readServerSessionCookie, STUDENT_PROFILE } = await import("./accounts.server");
  const cookieSession = await readServerSessionCookie();
  if (cookieSession && cookieSession.role === "student") {
    return STUDENT_PROFILE;
  }

  // Also allow authenticated Supabase student users via Bearer header
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const authHeader = getRequestHeader("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (token && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      const { data: userData } = await sb.auth.getUser(token);
      if (userData?.user) {
        const { data: profile } = await sb
          .from("student_profiles")
          .select("*")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (profile) return profile;
        const { data: roleRow } = await sb
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "student")
          .maybeSingle();
        if (roleRow) return STUDENT_PROFILE;
      }
    }
  }

  throw new Error("Unauthorized");
});
