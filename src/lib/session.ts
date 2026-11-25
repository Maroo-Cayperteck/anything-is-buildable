import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthAccountStatus } from "./accounts.functions";
import { usernameToEmail } from "./auth-helpers";

export type Role = "student" | "admin";

function toLoginEmail(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : usernameToEmail(trimmed);
}

export async function portalSignIn(
  identifier: string,
  password: string,
): Promise<{ error: string | null; role: Role | null }> {
  const email = toLoginEmail(identifier);
  const trimmedPass = password.trim();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: trimmedPass });
    if (error || !data.user || !data.session) {
      return { error: "اسم المستخدم أو كلمة المرور غير صحيحة", role: null };
    }

    const status = await getAuthAccountStatus();

    if (status.roles.includes("admin")) {
      return { error: null, role: "admin" };
    }

    if (status.roles.includes("student")) {
      if (status.accountStatus === "active") {
        return { error: null, role: "student" };
      }
      await supabase.auth.signOut().catch(() => {});
      if (status.accountStatus === "suspended") {
        return { error: "تم تعليق هذا الحساب من قِبل إدارة شؤون الطلاب", role: null };
      }
      if (status.accountStatus === "rejected") {
        return { error: "تم رفض طلب تفعيل هذا الحساب", role: null };
      }
      return { error: "حسابك قيد المراجعة من قِبل المسؤول", role: null };
    }

    await supabase.auth.signOut().catch(() => {});
    if (status.registrationStatus === "pending") {
      return { error: "طلب التسجيل الخاص بك قيد المراجعة حاليًا من قِبل المسؤول", role: null };
    }
    if (status.registrationStatus === "rejected") {
      return {
        error: status.rejectionReason
          ? `تم رفض طلب التسجيل: ${status.rejectionReason}`
          : "تم رفض طلب التسجيل الخاص بك",
        role: null,
      };
    }
    if (status.registrationStatus === "suspended") {
      return { error: "تم تعليق هذا الحساب من قِبل إدارة شؤون الطلاب", role: null };
    }

    return { error: "لا يملك هذا الحساب صلاحية الوصول للبوابة حاليًا", role: null };
  } catch {
    return { error: "تعذر الاتصال بخدمة المصادقة، يرجى المحاولة لاحقًا", role: null };
  }
}

export async function portalSignOut(): Promise<void> {
  await supabase.auth.signOut().catch(() => {});
}

export async function fetchRoles(): Promise<Role[]> {
  try {
    const status = await getAuthAccountStatus();
    if (status.roles.includes("admin")) return ["admin"];
    if (status.roles.includes("student") && status.accountStatus === "active") return ["student"];
    return [];
  } catch {
    return [];
  }
}

/**
 * Authoritative Supabase session + server-verified role & account status gate.
 * Never falls back to cookies or localStorage when Supabase Auth fails.
 */
export function useRoleGate(required: Role) {
  const [state, setState] = useState<{ status: "loading" | "ok" | "denied"; session: Session | null }>({
    status: "loading",
    session: null,
  });

  useEffect(() => {
    let active = true;

    const verifyAuth = async (sbSession: Session | null) => {
      if (!sbSession) {
        if (active) setState({ status: "denied", session: null });
        return;
      }

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) {
          if (active) setState({ status: "denied", session: null });
          return;
        }

        const status = await getAuthAccountStatus();
        const isAuthorized =
          required === "admin"
            ? status.roles.includes("admin")
            : status.roles.includes("student") && status.accountStatus === "active";

        if (!isAuthorized) {
          if (active) setState({ status: "denied", session: null });
          return;
        }

        if (active) setState({ status: "ok", session: sbSession });
      } catch {
        if (active) setState({ status: "denied", session: null });
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => verifyAuth(data.session))
      .catch(() => verifyAuth(null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (active) setState({ status: "denied", session: null });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
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
