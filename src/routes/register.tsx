import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Info, Loader2, UserPlus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/portal/Shell";
import { supabase } from "@/integrations/supabase/client";
import { createRegistrationIntent, submitRegistrationRequest } from "@/lib/accounts.functions";
import { normalizeEmail, normalizeStudentCode } from "@/lib/auth-helpers";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تفعيل حساب الطالب — جامعة حلوان الأهلية" },
      { name: "description", content: "طلب تفعيل وتسجيل حساب طالب جديد في بوابة جامعة حلوان الأهلية." },
    ],
  }),
  component: RegisterPage,
});

const formSchema = z
  .object({
    studentCode: z.string().trim().min(2, "يرجى إدخال الرقم الجامعي").max(40),
    email: z.string().trim().email("يرجى إدخال بريد إلكتروني شخصي صحيح").max(160),
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(128),
    confirmPassword: z.string().min(1, "يرجى تأكيد كلمة المرور").max(128),
    fullNameAr: z.string().trim().min(3, "يرجى إدخال الاسم الكامل بالعربية").max(160),
    fullNameEn: z.string().trim().max(160).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{7,20}$/, "رقم الهاتف غير صالح")
      .optional()
      .or(z.literal("")),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمة المرور وتأكيدها غير متطابقين",
  });

function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedState, setSubmittedState] = useState<"none" | "pending" | "email_confirm">("none");
  const [rosterVerified, setRosterVerified] = useState<boolean>(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    // Keep passwords verbatim (never .trim() password inputs)
    const rawPassword = String(fd.get("password") ?? "");
    const rawConfirmPassword = String(fd.get("confirmPassword") ?? "");

    const parsed = formSchema.safeParse({
      studentCode: fd.get("studentCode"),
      email: fd.get("email"),
      password: rawPassword,
      confirmPassword: rawConfirmPassword,
      fullNameAr: fd.get("fullNameAr"),
      fullNameEn: fd.get("fullNameEn") || undefined,
      phone: fd.get("phone") || "",
    });
    if (!parsed.success) {
      const firstErr = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      setErrorMsg(firstErr || "يرجى مراجعة البيانات المدخلة");
      return;
    }

    setBusy(true);
    try {
      const email = normalizeEmail(parsed.data.email);
      const studentCode = normalizeStudentCode(parsed.data.studentCode);

      // 1. Persist a durable server-side registration intent BEFORE signUp so confirmation flows never lose form data
      const intentRes = await createRegistrationIntent({
        data: {
          studentCode,
          email,
          fullNameAr: parsed.data.fullNameAr,
          fullNameEn: parsed.data.fullNameEn,
          phone: parsed.data.phone,
        },
      });
      setRosterVerified(intentRes.rosterVerified);

      // 2. Create Supabase Auth account with redirect to /auth/callback
      const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password: parsed.data.password,
        ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
      });

      if (signUpErr) {
        const msg = (signUpErr.message ?? "").toLowerCase();
        if (msg.includes("already registered")) {
          setErrorMsg("هذا البريد الإلكتروني مسجل مسبقًا؛ جرّب تسجيل الدخول أو استعادة كلمة المرور.");
        } else {
          setErrorMsg(signUpErr.message || "تعذر إنشاء حساب المصادقة");
        }
        return;
      }

      if (signUpData.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        setErrorMsg("يوجد حساب مرتبط بهذا البريد الإلكتروني بالفعل؛ جرّب تسجيل الدخول.");
        return;
      }

      // 3. If email confirmation is enabled, session is null — intent is already durably saved for /auth/callback
      if (!signUpData.session) {
        setSubmittedState("email_confirm");
        return;
      }

      // 4. If email confirmation is disabled, commit the pending registration request immediately and sign out
      await submitRegistrationRequest({
        data: {
          studentCode,
          email,
          fullNameAr: parsed.data.fullNameAr,
          fullNameEn: parsed.data.fullNameEn,
          phone: parsed.data.phone,
        },
      });
      await supabase.auth.signOut().catch(() => {});
      setSubmittedState("pending");
    } catch (err) {
      await supabase.auth.signOut().catch(() => {});
      setErrorMsg(err instanceof Error ? err.message : "تعذر إرسال طلب التسجيل");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-login p-4">
      <div className="page-enter w-full max-w-lg rounded-2xl bg-card p-8 shadow-elevated sm:p-10">
        <div className="flex flex-col items-center text-center">
          <BrandMark className="h-14 w-14 rounded-2xl shadow-elevated" />
          <h1 className="mt-4 text-2xl font-bold">تسجيل / تفعيل حساب طالب جديد</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            استخدم الرقم الجامعي وأي بريد إلكتروني شخصي صحيح (مثل Gmail أو Outlook) — لا يلزم بريد جامعي
          </p>
        </div>

        {submittedState !== "none" ? (
          <div className="mt-8 space-y-5 rounded-xl border bg-success-soft/60 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <h2 className="text-lg font-bold">
              {submittedState === "email_confirm"
                ? "تم حفظ طلبك — يرجى تأكيد بريدك الإلكتروني"
                : "تم إرسال طلب التسجيل بنجاح"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {submittedState === "email_confirm"
                ? "تم حفظ بيانات طلبك على الخادم وأرسلنا رسالة تأكيد إلى بريدك الشخصي. افتح رابط التأكيد لإتمام ربط الطلب وإحالته لمراجعة المسؤول."
                : "طلبك الآن قيد المراجعة من قِبل إدارة شؤون الطلاب. ستتمكن من دخول بوابة الطالب فور موافقة المسؤول."}
            </p>
            {!rosterVerified && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-right text-xs text-warning">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  لم يُعثر على الرقم الجامعي في الكشف المبدئي؛ سيظهر طلبك لدى المسؤول للمراجعة والتحقق اليدوي قبل التفعيل.
                </span>
              </div>
            )}
            <Button asChild variant="brand" className="w-full">
              <Link to="/">العودة لتسجيل الدخول</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="studentCode" className="mb-1 block text-sm font-medium">
                  الرقم الجامعي
                </label>
                <Input id="studentCode" name="studentCode" dir="ltr" required placeholder="20260001" />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  البريد الإلكتروني الشخصي
                </label>
                <Input id="email" name="email" type="email" dir="ltr" required placeholder="name@gmail.com" />
              </div>
            </div>
            <div>
              <label htmlFor="fullNameAr" className="mb-1 block text-sm font-medium">
                الاسم الكامل بالعربية
              </label>
              <Input id="fullNameAr" name="fullNameAr" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fullNameEn" className="mb-1 block text-sm font-medium">
                  الاسم بالإنجليزية (اختياري)
                </label>
                <Input id="fullNameEn" name="fullNameEn" dir="ltr" />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                  رقم الهاتف (اختياري)
                </label>
                <Input id="phone" name="phone" dir="ltr" placeholder="01xxxxxxxxx" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium">
                  كلمة المرور
                </label>
                <Input id="password" name="password" type="password" dir="ltr" minLength={8} required />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
                  تأكيد كلمة المرور
                </label>
                <Input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" minLength={8} required />
              </div>
            </div>

            {errorMsg && <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMsg}</div>}

            <Button type="submit" variant="brand" size="lg" disabled={busy} className="h-12 w-full text-base">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              إرسال طلب التسجيل للمراجعة
            </Button>

            <div className="pt-2 text-center">
              <Link to="/" className="text-xs font-semibold text-primary hover:underline">
                لدي حساب بالفعل — العودة لتسجيل الدخول
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
