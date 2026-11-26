import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getAuthAccountStatus, signInWithIdentifier } from "./accounts.functions";
import { looksLikeEmail, normalizeEmail, normalizeStudentCode } from "./auth-helpers";

export type Role = "student" | "admin";
type AccountStatus = Database["public"]["Enums"]["account_status"];

type ResolvedAccountStatus = {
  userId: string;
  roles: Role[];
  accountStatus: AccountStatus | null;
  registrationStatus: AccountStatus | null;
  rejectionReason: string | null;
};

function classifyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();

  if (lower.includes("config_error") || lower.includes("missing supabase environment variable")) {
    return "إعدادات الاتصال بقاعدة البيانات والمصادقة غير مكتملة على الخادم.";
  }
  if (lower.includes("rate_limit") || lower.includes("too many requests")) {
    return "تم تجاوز عدد محاولات تسجيل الدخول المسموح بها؛ يرجى المحاولة بعد دقيقة.";
  }
  if (lower.includes("auth_status_error") || lower.includes("auth_lookup_error")) {
    return "تعذر التحقق من حالة وصلاحيات الحساب على الخادم، يرجى المحاولة لاحقًا.";
  }
  return "تعذر الاتصال بخدمة المصادقة، يرجى المحاولة لاحقًا.";
}

async function fetchStatusSafely(): Promise<ResolvedAccountStatus> {
  return (await getAuthAccountStatus()) as ResolvedAccountStatus;
}

export async function portalSignIn(
  identifier: string,
  password: string,
): Promise<{ error: string | null; role: Role | null }> {
  const trimmedIdentifier = normalizeStudentCode(identifier);
  // IMPORTANT: Never trim or mutate password; leading/trailing spaces are valid password characters.
  const rawPassword = password;

  // Step 1: Authenticate via Supabase Auth (direct email or server-proxied student-code/username lookup)
  try {
    if (looksLikeEmail(trimmedIdentifier)) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(trimmedIdentifier),
        password: rawPassword,
      });

      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        if (msg.includes("email not confirmed") || error.code === "email_not_confirmed") {
          return {
            error: "يرجى تأكيد بريدك الإلكتروني عبر رابط التفعيل المرسل إلى بريدك قبل تسجيل الدخول.",
            role: null,
          };
        }
        if (error.status === 429) {
          return { error: "تم تجاوز عدد محاولات تسجيل الدخول؛ يرجى الانتظار قليلًا.", role: null };
        }
        if (error.name === "AuthRetryableFetchError" || (error.status !== undefined && (error.status === 0 || error.status >= 500))) {
          return { error: "تعذر الاتصال بخدمة المصادقة، يرجى المحاولة لاحقًا.", role: null };
        }
        return { error: "بيانات الدخول غير صحيحة", role: null };
      }

      if (!data.user || !data.session) {
        return { error: "بيانات الدخول غير صحيحة", role: null };
      }
    } else {
      const proxyRes = await signInWithIdentifier({
        data: { identifier: trimmedIdentifier, password: rawPassword },
      });

      if (!proxyRes.ok) {
        if (proxyRes.reason === "email_not_confirmed") {
          return {
            error: "يرجى تأكيد بريدك الإلكتروني عبر رابط التفعيل المرسل إلى بريدك قبل تسجيل الدخول.",
            role: null,
          };
        }
        if (proxyRes.reason === "rate_limited") {
          return { error: "تم تجاوز عدد محاولات تسجيل الدخول؛ يرجى الانتظار قليلًا.", role: null };
        }
        return { error: "بيانات الدخول غير صحيحة", role: null };
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: proxyRes.accessToken,
        refresh_token: proxyRes.refreshToken,
      });
      if (setErr) {
        return { error: "تعذر تثبيت جلسة المصادقة في المتصفح", role: null };
      }
    }
  } catch (err) {
    return { error: classifyAuthError(err), role: null };
  }

  // Step 2: Verify server-authoritative roles and account/registration status
  try {
    const status = await fetchStatusSafely();

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
  } catch (err) {
    await supabase.auth.signOut().catch(() => {});
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unauthorized") || msg.includes("Forbidden")) {
      return { error: "لا يملك هذا الحساب صلاحية الوصول للبوابة حاليًا", role: null };
    }
    return { error: "تعذر التحقق من حالة وصلاحيات الحساب، يرجى المحاولة لاحقًا.", role: null };
  }
}

export async function portalSignOut(): Promise<void> {
  await supabase.auth.signOut().catch(() => {});
}

export async function fetchRoles(): Promise<Role[]> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return [];
    const status = await fetchStatusSafely();
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

        const status = await fetchStatusSafely();
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
