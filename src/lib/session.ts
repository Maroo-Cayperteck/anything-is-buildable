import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getServerSession, serverSignOut, verifyDemoCredentials } from "./accounts.functions";
import { usernameToEmail } from "./auth-helpers";

export type Role = "student" | "admin";

const LEGACY_DEMO_STORAGE_KEY = "demo_portal_session";

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_DEMO_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function portalSignIn(
  username: string,
  password: string,
): Promise<{ error: string | null; role: Role | null }> {
  const trimmedUser = username.trim();
  const trimmedPass = password.trim();

  // Clear any legacy unverified localStorage session
  clearDemoSession();

  // Verify credentials on the server (hashes & profile never ship to browser bundle)
  try {
    const result = await verifyDemoCredentials({ data: { username: trimmedUser, password: trimmedPass } });
    if (result.ok) {
      if (result.mode === "otp" && result.tokenHash) {
        const { error: otpErr } = await supabase.auth
          .verifyOtp({ token_hash: result.tokenHash, type: "magiclink" })
          .catch(() => ({ error: new Error("otp") }));
        if (otpErr) {
          await supabase.auth.signOut().catch(() => {});
        }
      } else {
        await supabase.auth.signOut().catch(() => {});
      }
      return { error: null, role: result.role };
    }
  } catch {
    // Server function error — fall through to Supabase password login
  }

  // Non-demo account: try Supabase Auth directly
  const email = usernameToEmail(trimmedUser);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: trimmedPass });
    if (!error && data.user) {
      const roles = await fetchRoles(data.user.id);
      const role: Role | null = roles.includes("admin") && !roles.includes("student") ? "admin" : roles[0] ?? null;
      return { error: null, role };
    }
  } catch {
    // network error
  }

  return { error: "اسم المستخدم أو كلمة المرور غير صحيحة", role: null };
}

export async function portalSignOut(): Promise<void> {
  clearDemoSession();
  await Promise.allSettled([serverSignOut(), supabase.auth.signOut()]);
}

export async function fetchRoles(userId?: string): Promise<Role[]> {
  if (userId) {
    try {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = (data ?? []).map((r) => r.role as Role);
      if (roles.length > 0) return roles;
    } catch {
      // fall through to verified server session
    }
  }
  try {
    const serverSession = await getServerSession();
    if (serverSession) return [serverSession.role];
  } catch {
    // ignore
  }
  return [];
}

/** Session + role gate state for client-only protected layouts. */
export function useRoleGate(required: Role) {
  const [state, setState] = useState<{ status: "loading" | "ok" | "denied"; session: Session | null }>({
    status: "loading",
    session: null,
  });

  useEffect(() => {
    let active = true;

    // Remove any legacy client-side demo session key
    clearDemoSession();

    const verifyAuth = async (sbSession: Session | null) => {
      if (sbSession) {
        try {
          const { data } = await supabase.auth.getUser();
          if (data.user) {
            const roles = await fetchRoles(data.user.id);
            if (roles.includes(required)) {
              if (active) setState({ status: "ok", session: sbSession });
              return;
            }
          }
        } catch {
          // fall through to verified server cookie check
        }
      }

      // Check server-verified HttpOnly session cookie
      try {
        const serverSession = await getServerSession();
        if (serverSession && serverSession.role === required) {
          if (active) {
            setState({
              status: "ok",
              session: {
                user: { id: "session-" + serverSession.username, email: usernameToEmail(serverSession.username) },
              } as unknown as Session,
            });
          }
          return;
        }
      } catch {
        // ignore
      }

      if (active) setState({ status: "denied", session: null });
    };

    supabase.auth
      .getSession()
      .then(({ data }) => verifyAuth(data.session))
      .catch(() => verifyAuth(null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        verifyAuth(null);
      } else if (event === "SIGNED_IN") {
        verifyAuth(session);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [required]);

  return state;
}
