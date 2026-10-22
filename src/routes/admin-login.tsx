import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoginCard } from "@/components/portal/LoginCard";
import { fetchRoles, portalSignIn, type Role } from "@/lib/session";
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
        navigate({ to: "/admin" });
        return null;
      }}
      footer={<Link to="/" className="text-primary hover:underline">العودة لدخول الطلاب</Link>}
    />
  );
}
