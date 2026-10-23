import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoginCard } from "@/components/portal/LoginCard";
import { portalSignIn, fetchRoles, getDemoSession, type Role } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — جامعة حلوان الأهلية" },
      { name: "description", content: "تسجيل الدخول إلى نظام معلومات الطلاب — جامعة حلوان الأهلية (Helwan National University)" },
      { property: "og:title", content: "تسجيل الدخول — جامعة حلوان الأهلية" },
      { property: "og:description", content: "بوابة نظام معلومات الطلاب — جامعة حلوان الأهلية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const demo = getDemoSession();
    if (demo?.role === "student") {
      navigate({ to: "/portal", replace: true });
    }
  }, [navigate]);

  return (
    <LoginCard
      title="مرحبًا بعودتك"
      subtitle="سجّل الدخول إلى بوابة الطالب"
      onSubmit={async (u, p) => {
        const { error } = await portalSignIn(u, p);
        if (error) return error;

        const demo = getDemoSession();
        if (demo) {
          navigate({ to: demo.role === "admin" ? "/admin" : "/portal", replace: true });
          return null;
        }

        let roles: Role[] = [];
        try {
          const { data } = await supabase.auth.getUser();
          roles = await fetchRoles(data?.user?.id);
        } catch {
          roles = await fetchRoles();
        }
        navigate({ to: roles.includes("admin") && !roles.includes("student") ? "/admin" : "/portal", replace: true });
        return null;
      }}
      footer={
        <div className="space-y-3">
          <a
            href="https://www.facebook.com/HNU.Helwan"
            target="_blank"
            rel="noopener noreferrer"
            className="group block transition-opacity hover:opacity-90"
            title="الصفحة الرسمية لجامعة حلوان الأهلية"
          >
            <div className="text-sm font-bold text-foreground">Helwan National University</div>
            <div className="mt-0.5 text-xs font-medium text-muted-foreground">Student Information System</div>
          </a>
          <div className="pt-1">
            <Link to="/admin-login" className="inline-block text-xs font-semibold text-primary hover:underline">
              دخول المسؤول
            </Link>
          </div>
        </div>
      }
    />
  );
}
