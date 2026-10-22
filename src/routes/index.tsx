import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoginCard } from "@/components/portal/LoginCard";
import { portalSignIn, fetchRoles, type Role } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — بوابة الطالب" },
      { name: "description", content: "تسجيل الدخول إلى بوابة الطالب التجريبية لعرض البيانات الأكاديمية والملفات." },
      { property: "og:title", content: "تسجيل الدخول — بوابة الطالب" },
      { property: "og:description", content: "محاكاة تعليمية لبوابة طالب جامعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  return (
    <LoginCard
      title="مرحبًا بعودتك"
      subtitle="سجّل الدخول إلى بوابة الطالب"
      onSubmit={async (u, p) => {
        const { error } = await portalSignIn(u, p);
        if (error) return error;
        let roles: Role[] = [];
        try {
          const { data } = await supabase.auth.getUser();
          roles = await fetchRoles(data?.user?.id);
        } catch {
          roles = await fetchRoles();
        }
        navigate({ to: roles.includes("admin") && !roles.includes("student") ? "/admin" : "/portal" });
        return null;
      }}
      footer={
        <>
          <div className="font-semibold text-foreground/70">بوابة الطالب — نظام معلومات الطلاب</div>
          <div className="mt-1">نسخة تجريبية لأغراض العرض والاختبار</div>
          <Link to="/admin-login" className="mt-3 inline-block text-primary hover:underline">دخول المسؤول</Link>
        </>
      }
    />
  );
}
