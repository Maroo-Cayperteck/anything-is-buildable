import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ClipboardList,
  FileDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  BarChart3,
  X,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; icon: LucideIcon };

export const STUDENT_NAV: NavItem[] = [
  { to: "/portal", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/portal/info", label: "بيانات الطالب", icon: UserRound },
  { to: "/portal/registration", label: "التسجيل الأكاديمي", icon: ClipboardList },
  { to: "/portal/courses", label: "المقررات الدراسية", icon: BookOpen },
  { to: "/portal/grades", label: "النتائج والمعدل التراكمي", icon: BarChart3 },
  { to: "/portal/documents", label: "تحميل ملفات الطالب", icon: FileDown },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-11 w-11 place-items-center rounded-xl bg-brand text-primary-foreground shadow-card", className)}>
      <GraduationCap className="h-6 w-6" />
    </div>
  );
}

export function Shell({
  nav,
  title,
  userName,
  userTag,
  signOutTo,
  children,
}: {
  nav: NavItem[];
  title: string;
  userName: string;
  userTag?: string;
  signOutTo: "/" | "/admin-login";
  children: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/" });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: signOutTo, replace: true });
  }

  const isActive = (to: string) => (to === "/portal" || to === "/admin" ? path === to : path.startsWith(to));
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("");

  return (
    <div dir="ltr" className="flex min-h-screen w-full">
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        dir="rtl"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <BrandMark className="bg-sidebar-accent" />
          <div className="min-w-0">
            <div className="font-bold">بوابة الطالب</div>
            <div className="text-xs text-sidebar-muted">نسخة تجريبية للعرض</div>
          </div>
          <button className="mr-auto lg:hidden" aria-label="إغلاق القائمة" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
                  active ? "bg-sidebar-accent font-semibold" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "text-gold")} />
                {item.label}
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-gold" />}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={signOut}
          className="flex items-center gap-3 border-t border-sidebar-border px-7 py-4 text-sm text-sidebar-muted transition-colors hover:text-sidebar-foreground"
        >
          <LogOut className="h-5 w-5" /> تسجيل الخروج
        </button>
      </aside>

      <div dir="rtl" className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-card/95 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden" aria-label="فتح القائمة" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">{title}</h1>
          <div className="mr-auto flex items-center gap-3">
            {userTag && (
              <span className="hidden rounded-full bg-secondary px-3 py-1 font-mono text-xs font-semibold text-secondary-foreground sm:inline">
                {userTag}
              </span>
            )}
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initials}</div>
            <span className="hidden max-w-48 truncate text-sm md:inline">{userName}</span>
          </div>
        </header>
        <main key={path} className="page-enter mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          {children}
        </main>
        <footer className="px-8 pb-6 text-center text-xs text-muted-foreground">
          محاكاة تعليمية لبوابة طالب — البيانات المعروضة لأغراض العرض والاختبار فقط
        </footer>
      </div>
    </div>
  );
}

export function Card({ title, icon: Icon, action, children, className }: { title?: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-center gap-3 border-b px-6 py-4">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <h2 className="font-semibold">{title}</h2>
          {action && <div className="mr-auto">{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Field({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className={cn("mt-1.5 text-[0.95rem]", mono && "font-mono font-semibold")}>{value || "—"}</div>
    </div>
  );
}

export function SampleBadge() {
  return <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">بيانات تجريبية</span>;
}

export function GradePill({ grade }: { grade: string }) {
  const tone = grade.startsWith("A") || grade.startsWith("B") ? "bg-info-soft text-primary" : grade === "F" ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-warning";
  return <span className={cn("inline-grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-bold", tone)}>{grade}</span>;
}

export function FullLoader() {
  return (
    <div className="grid min-h-screen place-items-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = "info" }: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: string; tone?: "info" | "gold" | "success" | "danger" }) {
  const toneCls = { info: "bg-info-soft text-primary", gold: "bg-gold-soft text-warning", success: "bg-success-soft text-success", danger: "bg-destructive/10 text-danger" }[tone];
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5">
      <div className={cn("grid h-12 w-12 place-items-center rounded-xl", toneCls)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="label-caps">{label}</div>
        <div className="mt-1 text-2xl font-bold">
          {value} {sub && <span className="text-sm font-normal text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

