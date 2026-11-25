import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { ADMIN_NAV, FullLoader, Shell } from "@/components/portal/Shell";
import { useRoleGate } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "مركز التحكم — بوابة المسؤول" },
      { name: "description", content: "إدارة الطلاب والشؤون الأكاديمية والملفات والإعلانات." },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const gate = useRoleGate("admin");
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (gate.status === "loading") return <FullLoader />;
  if (gate.status === "denied") return <Navigate to="/admin-login" replace />;

  const current =
    [...ADMIN_NAV]
      .reverse()
      .find((n) => (n.to === "/admin" ? path.replace(/\/$/, "") === "/admin" : path.startsWith(n.to))) ??
    ADMIN_NAV[0]!;

  return (
    <Shell nav={ADMIN_NAV} title={current.label} userName="مسؤول النظام" userTag="admin" signOutTo="/admin-login">
      <Outlet />
    </Shell>
  );
}
