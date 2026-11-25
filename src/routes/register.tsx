import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/portal/Shell";
import { supabase } from "@/integrations/supabase/client";
import { submitRegistrationRequest } from "@/lib/accounts.functions";

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

const formSchema = z.object({
  studentCode: z.string().trim().min(2, "يرجى إدخال الرقم الجامعي").max(40),
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صحيح").max(160),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(128),
  fullNameAr: z.string().trim().min(3, "يرجى إدخال الاسم الكامل بالعربية").max(160),
  fullNameEn: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(25).optional(),
});

function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedState, setSubmittedState] = useState<"none" | "pending" | "email_confirm">("none");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    const parsed = formSchema.safeParse({
      studentCode: fd.get("studentCode"),
      email: fd.get("email"),
      password: fd.get("password"),
      fullNameAr: fd.get("fullNameAr"),
      fullNameEn: fd.get("fullNameEn") || undefined,
      phone: fd.get("phone") || undefined,
    });
    if (!parsed.success) {
      const firstErr = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      setErrorMsg(firstErr || "يرجى مراجعة البيانات المدخلة");
      return;
    }

    setBusy(true);
    try {
      const email = parsed.data.email.trim().toLowerCase();
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password: parsed.data.password,
      });

      if (signUpErr) {
        setErrorMsg(signUpErr.message || "تعذر إنشاء حساب المصادقة");
        return;
      }

      if (!signUpData.session) {
        // Email confirmation enabled in Supabase Auth: prompt user to confirm email first, then sign in to complete roster request.
        setSubmittedState("email_confirm");
        return;
      }

      await submitRegistrationRequest({
        data: {
          studentCode: parsed.data.studentCode,
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
          <h1 className="mt-4 text-2xl font-bold">تفعيل حساب الطالب</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            يتم التحقق من الرقم الجامعي والبريد الإلكتروني ومراجعة الطلب من إدارة شؤون الطلاب
          </p>
        </div>

        {submittedState !== "none" ? (
          <div className="mt-8 space-y-5 rounded-xl border bg-success-soft/60 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <h2 className="text-lg font-bold">
              {submittedState === "email_confirm"
                ? "تم إنشاء الحساب — يرجى تأكيد البريد الإلكتروني"
                : "تم إرسال طلب التسجيل بنجاح"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {submittedState === "email_confirm"
                ? "أرسلنا رسالة تأكيد إلى بريدك الإلكتروني. بعد التأكيد، سجل الدخول لمطابقة طلبك مع كشف الطلاب وانتظار موافقة المسؤول."
                : "طلبك الآن قيد المراجعة (قيد الانتظار). ستتمكن من دخول البوابة فور اعتماد الحساب من المسؤول."}
            </p>
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
                <Input id="studentCode" name="studentCode" dir="ltr" required placeholder="مثال: 20260001" />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  البريد الإلكتروني المعتمد
                </label>
                <Input id="email" name="email" type="email" dir="ltr" required placeholder="student@hnu.edu.eg" />
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
                <Input id="phone" name="phone" dir="ltr" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                كلمة المرور
              </label>
              <Input id="password" name="password" type="password" dir="ltr" required minLength={8} />
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMsg}</div>
            )}

            <Button type="submit" variant="brand" size="lg" disabled={busy} className="h-12 w-full text-base">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              إرسال طلب التفعيل
            </Button>
          </form>
        )}

        <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
          لديك حساب مفعل بالفعل؟{" "}
          <Link to="/" className="font-semibold text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
