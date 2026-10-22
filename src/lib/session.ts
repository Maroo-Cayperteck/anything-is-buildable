import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAccount } from "./accounts.functions";
import { usernameToEmail } from "./auth-helpers";

export type Role = "student" | "admin";

export async function portalSignIn(username: string, password: string) {
  const email = usernameToEmail(username);
  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // First login for a demo account: provision on the server, then retry.
    const res = await ensureDemoAccount({ data: { username, password } }).catch(() => ({ ok: false }));
    if (!res.ok) return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    if (error) return { error: "تعذر تسجيل الدخول، حاول مرة أخرى" };
  }
  return { error: null };
}

export async function fetchRoles(userId: string): Promise<Role[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as Role);
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
      if (!session) return active && setState({ status: "denied", session: null });
      const { data } = await supabase.auth.getUser();
      if (!data.user) return active && setState({ status: "denied", session: null });
      const roles = await fetchRoles(data.user.id);
      if (active) setState({ status: roles.includes(required) ? "ok" : "denied", session });
    };
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setState({ status: "denied", session: null });
      else if (event === "SIGNED_IN") check(session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [required]);

  return state;
}
