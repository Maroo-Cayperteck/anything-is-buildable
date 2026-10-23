import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAccount } from "./accounts.functions";
import { usernameToEmail } from "./auth-helpers";

export type Role = "student" | "admin";

const DEMO_STORAGE_KEY = "demo_portal_session";

export interface DemoSession {
  role: Role;
  username: string;
}

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setDemoSession(session: DemoSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(session));
}

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEMO_STORAGE_KEY);
}

export async function portalSignIn(username: string, password: string) {
  const trimmedUser = username.trim();
  const isStudentDemo = trimmedUser === "30706232100316" && password === "925250059";
  const isAdminDemo = trimmedUser.toLowerCase() === "admin" && (password === "admin" || password === "admin123");

  // Check demo credentials immediately and set demo session —
  // this prevents failures caused by a stale admin Supabase session
  // that remains in localStorage after the admin has uploaded files.
  if (isStudentDemo) {
    // Sign out any existing Supabase session silently to avoid conflicts
    await supabase.auth.signOut().catch(() => {});
    clearDemoSession();
    // Try Supabase provisioning in the background but always succeed locally
    const email = usernameToEmail("30706232100316");
    try {
      const directLogin = await supabase.auth.signInWithPassword({ email, password });
      if (!directLogin.error) {
        return { error: null };
      }
      // Try to provision account first
      const res = await ensureDemoAccount({ data: { username: trimmedUser, password } }).catch(() => ({ ok: false }));
      if (res.ok) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        if (!retry.error) {
          return { error: null };
        }
      }
    } catch {
      // ignore — fall through to local demo session below
    }
    setDemoSession({ role: "student", username: "30706232100316" });
    return { error: null };
  }

  if (isAdminDemo) {
    await supabase.auth.signOut().catch(() => {});
    clearDemoSession();
    const email = usernameToEmail("admin");
    try {
      const directLogin = await supabase.auth.signInWithPassword({ email, password });
      if (!directLogin.error) {
        return { error: null };
      }
      const res = await ensureDemoAccount({ data: { username: trimmedUser, password } }).catch(() => ({ ok: false }));
      if (res.ok) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        if (!retry.error) {
          return { error: null };
        }
      }
    } catch {
      // ignore
    }
    setDemoSession({ role: "admin", username: "admin" });
    return { error: null };
  }

  // Non-demo account: try Supabase directly
  const email = usernameToEmail(username);
  try {
    // Sign out existing session first to avoid conflicts
    await supabase.auth.signOut().catch(() => {});
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      clearDemoSession();
      return { error: null };
    }
  } catch {
    // network error
  }

  return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
}

export async function fetchRoles(userId?: string): Promise<Role[]> {
  const demo = getDemoSession();
  if (demo) return [demo.role];
  if (!userId) return [];
  try {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return (data ?? []).map((r) => r.role as Role);
  } catch {
    return [];
  }
}

/** Session + role gate state for client-only protected layouts. */
export function useRoleGate(required: Role) {
  const [state, setState] = useState<{ status: "loading" | "ok" | "denied"; session: Session | null }>({
    status: "loading",
    session: null,
  });

  useEffect(() => {
    let active = true;
    const check = async (session: Session | null) => {
      const demo = getDemoSession();
      if (demo && (demo.role === required || (required === "student" && demo.role === "student"))) {
        return (
          active &&
          setState({
            status: "ok",
            session: {
              user: { id: "demo-" + demo.username, email: `${demo.username}@demo.local` },
            } as unknown as Session,
          })
        );
      }

      if (!session) return active && setState({ status: "denied", session: null });
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return active && setState({ status: "denied", session: null });
        const roles = await fetchRoles(data.user.id);
        if (active) setState({ status: roles.includes(required) ? "ok" : "denied", session });
      } catch {
        if (active) setState({ status: "denied", session: null });
      }
    };

    supabase.auth.getSession().then(({ data }) => check(data.session)).catch(() => check(null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearDemoSession();
        setState({ status: "denied", session: null });
      } else if (event === "SIGNED_IN") {
        check(session);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [required]);

  return state;
}
