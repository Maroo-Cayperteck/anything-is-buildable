import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LoginCard } from "@/components/portal/LoginCard";
import { fetchRoles, getDemoSession, portalSignIn, type Role } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دخول المسؤول — بوابة الطالب" },
      { name: "description", content: "تسجيل دخول المسؤول لإدارة ملفات الطلاب." },
      { property: "og:title", content: "دخول المسؤول — بوابة الطالب" },
      { property: "og:description", content: "لوحة إدارة ملفات الطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();

  return (
    <LoginCard
      title="بوابة المسؤول"
      subtitle="إدارة ملفات الطلاب"
      onSubmit={async (u, p) => {
        const { error } = await portalSignIn(u, p);
        if (error) return error;

        const demo = getDemoSession();
        if (demo) {
          if (demo.role === "admin") {
            navigate({ to: "/admin", replace: true });
            return null;
          }
          return "هذا الحساب لا يملك صلاحيات المسؤول";
        }

        let roles: Role[] = [];
        try {
          const { data } = await supabase.auth.getUser();
          roles = await fetchRoles(data?.user?.id);
        } catch {
          roles = await fetchRoles();
        }
        if (!roles.includes("admin")) {
          await supabase.auth.signOut().catch(() => {});
          return "هذا الحساب لا يملك صلاحيات المسؤول";
        }
        navigate({ to: "/admin", replace: true });
        return null;
      }}
      footer={
        <div className="space-y-3">
          <Button asChild variant="brand" size="lg" className="h-12 w-full text-base">
            <Link to="/">العودة لدخول الطلاب</Link>
          </Button>
          <div className="border-t pt-2">
            <a
              href="https://www.facebook.com/HNU.Helwan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              جامعة حلوان الأهلية — Helwan National University
            </a>
          </div>
        </div>
      }
    />
  );
}
