import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { verifyDemoCredentials } from "./accounts.functions";
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
  const trimmedPass = password.trim();

  // All credential verification happens server-side via verifyDemoCredentials.
  // No plaintext credentials or comparison logic in the client bundle.
  try {
    const result = await verifyDemoCredentials({ data: { username: trimmedUser, password: trimmedPass } });
    if (result.ok) {
      setDemoSession({ role: result.role, username: result.username });
      return { error: null };
    }
  } catch {
    // Server unreachable — fall through to Supabase auth
  }

  // Non-demo account: try Supabase directly
  const email = usernameToEmail(trimmedUser);
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password: trimmedPass });
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
  const checkDemo = (): { ok: boolean; session: Session | null } => {
    const demo = getDemoSession();
    if (demo && (demo.role === required || (required === "student" && demo.role === "student"))) {
      return {
        ok: true,
        session: {
          user: { id: "demo-" + demo.username, email: `${demo.username}@demo.local` },
        } as unknown as Session,
      };
    }
    return { ok: false, session: null };
  };

  const [state, setState] = useState<{ status: "loading" | "ok" | "denied"; session: Session | null }>(() => {
    const init = checkDemo();
    if (init.ok) return { status: "ok", session: init.session };
    return { status: "loading", session: null };
  });

  useEffect(() => {
    let active = true;

    const demoCheck = checkDemo();
    if (demoCheck.ok) {
      if (active && state.status !== "ok") {
        setState({ status: "ok", session: demoCheck.session });
      }
      return;
    }

    const check = async (session: Session | null) => {
      const liveDemo = checkDemo();
      if (liveDemo.ok) {
        if (active) setState({ status: "ok", session: liveDemo.session });
        return;
      }

      if (!session) {
        if (active) setState({ status: "denied", session: null });
        return;
      }
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (active) setState({ status: "denied", session: null });
          return;
        }
        const roles = await fetchRoles(data.user.id);
        if (active) setState({ status: roles.includes(required) ? "ok" : "denied", session });
      } catch {
        if (active) setState({ status: "denied", session: null });
      }
    };

    supabase.auth.getSession().then(({ data }) => check(data.session)).catch(() => check(null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // NEVER let a Supabase event wipe out a demo session
      const liveDemo = checkDemo();
      if (liveDemo.ok) return;

      if (event === "SIGNED_OUT") {
        if (active) setState({ status: "denied", session: null });
      } else if (event === "SIGNED_IN") {
        check(session);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [required, state.status]);

  return state;
}
