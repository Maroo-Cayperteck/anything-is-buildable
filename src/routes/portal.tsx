import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { FullLoader, Shell, STUDENT_NAV } from "@/components/portal/Shell";
import { useRoleGate } from "@/lib/session";
import { profileQuery } from "@/lib/portal-data";

export const Route = createFileRoute("/portal")({
  ssr: false,
  component: PortalLayout,
});

function PortalLayout() {
  const gate = useRoleGate("student");
  const path = useRouterState({ select: (s) => s.location.pathname });
  const profile = useQuery({ ...profileQuery, enabled: gate.status === "ok" });

  if (gate.status === "loading") return <FullLoader />;
  if (gate.status === "denied") return <Navigate to="/" replace />;

  const current =
    [...STUDENT_NAV].reverse().find((n) => (n.to === "/portal" ? path.replace(/\/$/, "") === "/portal" : path.startsWith(n.to))) ??
    STUDENT_NAV[0]!;
  const p = profile.data;

  return (
    <Shell nav={STUDENT_NAV} title={current.label} userName={p?.full_name_ar ?? "…"} userTag={p?.student_code ?? undefined} signOutTo="/">
      {profile.isLoading ? (
        <div className="grid h-64 place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : profile.isError || !p ? (
        <div className="rounded-xl border bg-card p-8 text-center text-destructive">تعذر تحميل بيانات الطالب.</div>
      ) : (
        <Outlet />
      )}
    </Shell>
  );
}
