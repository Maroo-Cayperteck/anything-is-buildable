import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/portal/Shell";
import { supabase } from "@/integrations/supabase/client";
import { completeRegistrationCallback, submitRegistrationRequest } from "@/lib/accounts.functions";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "استكمال تفعيل الحساب — جامعة حلوان الأهلية" }],
  }),
  component: AuthCallbackPage,
});

type CallbackViewState =
  | { kind: "loading" }
  | { kind: "completed_pending"; studentCode: string; status: string }
  | { kind: "already_active"; studentCode: string }
  | { kind: "rejected"; reason?: string | null }
  | { kind: "needs_intent"; email: string }
  | { kind: "error"; message: string };

function AuthCallbackPage() {
  const [state, setState] = useState<CallbackViewState>({ kind: "loading" });
  const [studentCode, setStudentCode] = useState("");
  const [fullNameAr, setFullNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [submittingRecovery, setSubmittingRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function processCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const errorDesc = params.get("error_description") || params.get("error");
        if (errorDesc) {
          if (active)
            setState({ kind: "error", message: "تم إلغاء رابط التأكيد أو انتهت صلاحيته." });
          return;
        }

        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const otpType = params.get("type");

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            if (active)
              setState({ kind: "error", message: "رابط التأكيد غير صالح أو منتهي الصلاحية." });
            return;
          }
        } else if (tokenHash && otpType) {
          const { error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as "signup" | "email" | "recovery",
          });
          if (otpErr) {
            if (active)
              setState({ kind: "error", message: "تعذر التحقق من رمز تأكيد البريد الإلكتروني." });
            return;
          }
        }

        const { data: sessData } = await supabase.auth.getSession();
        if (!sessData.session) {
          if (active) {
            setState({
              kind: "error",
              message:
                "لم يتم العثور على جلسة مؤكدة. يمكنك تسجيل الدخول ببريدك الشخصي لاستكمال الحالة.",
            });
          }
          return;
        }

        const result = await completeRegistrationCallback();
        if (!active) return;

        if (result.outcome === "needs_intent") {
          setState({ kind: "needs_intent", email: result.email });
          return;
        }

        if (result.status === "active") {
          setState({ kind: "already_active", studentCode: result.studentCode });
          return;
        }

        await supabase.auth.signOut().catch(() => {});

        if (result.status === "rejected") {
          setState({
            kind: "rejected",
            reason: "rejectionReason" in result ? result.rejectionReason : null,
          });
          return;
        }

        setState({
          kind: "completed_pending",
          studentCode: result.studentCode,
          status: result.status,
        });
      } catch (err) {
        if (active) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "تعذر استكمال تأكيد البريد الإلكتروني",
          });
        }
      }
    }

    processCallback();
    return () => {
      active = false;
    };
  }, []);

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "needs_intent") return;
    setRecoveryError(null);
    setSubmittingRecovery(true);
    try {
      await submitRegistrationRequest({
        data: {
          studentCode,
          email: state.email,
          fullNameAr,
          phone,
        },
      });
      await supabase.auth.signOut().catch(() => {});
      setState({ kind: "completed_pending", studentCode, status: "pending" });
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "تعذر إرسال الطلب");
    } finally {
      setSubmittingRecovery(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-login p-4">
      <div className="page-enter w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-elevated sm:p-10">
        <div className="flex flex-col items-center">
          <BrandMark className="h-14 w-14 rounded-2xl shadow-elevated" />
          <h1 className="mt-4 text-xl font-bold">تأكيد البريد واستكمال التسجيل</h1>
        </div>

        <div className="mt-6">
          {state.kind === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" />
              <p className="text-sm">جارٍ التحقق من رابط التأكيد وتثبيت طلب التسجيل…</p>
            </div>
          )}

          {state.kind === "completed_pending" && (
            <div className="space-y-4 rounded-xl border bg-success-soft/60 p-5">
              <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
              <h2 className="font-bold">تم تأكيد البريد وإحالة طلبك للمراجعة</h2>
              <p className="text-sm text-muted-foreground">
                الرقم الجامعي <span className="font-mono font-semibold">{state.studentCode}</span>{" "}
                قيد المراجعة الآن من إدارة شؤون الطلاب. لن يتم فتح البوابة إلا بعد اعتماد المسؤول.
              </p>
              <Button asChild variant="brand" className="w-full">
                <Link to="/">العودة لصفحة تسجيل الدخول</Link>
              </Button>
            </div>
          )}

          {state.kind === "already_active" && (
            <div className="space-y-4 rounded-xl border bg-success-soft/60 p-5">
              <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
              <h2 className="font-bold">حسابك مفعل بالفعل</h2>
              <p className="text-sm text-muted-foreground">
                يمكنك المتابعة مباشرة إلى بوابة الطالب.
              </p>
              <Button asChild variant="brand" className="w-full">
                <Link to="/portal">الانتقال إلى بوابة الطالب</Link>
              </Button>
            </div>
          )}

          {state.kind === "rejected" && (
            <div className="space-y-4 rounded-xl border bg-destructive/10 p-5">
              <AlertCircle className="mx-auto h-9 w-9 text-destructive" />
              <h2 className="font-bold text-destructive">تم رفض طلب التسجيل</h2>
              <p className="text-sm text-muted-foreground">
                {state.reason || "يرجى مراجعة إدارة شؤون الطلاب."}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">العودة للرئيسية</Link>
              </Button>
            </div>
          )}

          {state.kind === "needs_intent" && (
            <form onSubmit={handleRecoverySubmit} className="space-y-4 text-right">
              <p className="text-sm text-muted-foreground">
                تم تأكيد بريدك الإلكتروني (<span className="font-mono">{state.email}</span>)، لكن
                انتهت صلاحية بيانات الطلب الأولية. أدخل الرقم الجامعي والاسم لإرسال طلب المراجعة
                للمسؤول:
              </p>
              <Input
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                dir="ltr"
                placeholder="الرقم الجامعي"
                required
              />
              <Input
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
                placeholder="الاسم الكامل بالعربية"
                required
              />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                placeholder="رقم الهاتف (اختياري)"
              />
              {recoveryError && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {recoveryError}
                </div>
              )}
              <Button
                type="submit"
                variant="brand"
                disabled={submittingRecovery}
                className="w-full"
              >
                {submittingRecovery ? <Loader2 className="h-4 w-4 animate-spin" /> : null} استكمال
                وإرسال الطلب
              </Button>
            </form>
          )}

          {state.kind === "error" && (
            <div className="space-y-4 rounded-xl border bg-destructive/10 p-5">
              <AlertCircle className="mx-auto h-9 w-9 text-destructive" />
              <h2 className="font-bold text-destructive">تعذر استكمال التأكيد</h2>
              <p className="text-sm text-muted-foreground">{state.message}</p>
              <div className="grid gap-2">
                <Button asChild variant="brand" className="w-full">
                  <Link to="/register">إعادة المحاولة في التسجيل</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">تسجيل الدخول</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
