import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, BookOpen, CalendarDays, Clock, FileDown, GraduationCap, TrendingUp } from "lucide-react";
import { Card, StatCard } from "@/components/portal/Shell";
import { useProfile } from "@/lib/use-profile";
import { DAYS, KIND_LABEL, REGISTERED_COURSES, TIMETABLE } from "@/lib/portal-data";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — بوابة الطالب" },
      { name: "description", content: "نظرة عامة على الحالة الأكاديمية والمعدل والجدول الأسبوعي." },
      { property: "og:title", content: "لوحة التحكم — بوابة الطالب" },
      { property: "og:description", content: "نظرة عامة على الحالة الأكاديمية للطالب." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const p = useProfile();
  const order = DAYS.map((d) => d[0]);
  const todayIdx = (new Date().getDay() + 1) % 7; // Saturday = 0
  const nextDay = order.find((_, i) => i >= todayIdx && TIMETABLE.some((s) => s.day === order[i])) ?? "Saturday";
  const upcoming = TIMETABLE.filter((s) => s.day === nextDay);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-hero p-8 text-primary-foreground shadow-elevated">
        <div className="text-sm opacity-80">مرحبًا،</div>
        <h2 className="mt-1 text-2xl font-bold md:text-3xl">{p.full_name_ar}</h2>
        <p className="mt-2 opacity-85">
          {p.program} — {p.academic_level} — العام الأكاديمي {p.academic_year}
        </p>
        <GraduationCap className="absolute -bottom-6 left-6 h-40 w-40 opacity-10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Award} label="المعدل التراكمي" value={<span className="text-danger">{Number(p.cgpa).toFixed(2)}</span>} sub="/ 4.00" tone="danger" />
        <StatCard icon={Clock} label="الساعات المكتسبة" value={p.earned_hours} sub="ساعة" />
        <StatCard icon={BookOpen} label="مقررات الفصل الحالي" value={REGISTERED_COURSES.length} tone="gold" />
        <StatCard icon={TrendingUp} label="الحالة الأكاديمية" value={<span className="text-lg">{p.academic_status}</span>} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`محاضرات يوم ${DAYS.find((d) => d[0] === nextDay)?.[1]}`} icon={CalendarDays} className="lg:col-span-2"
          action={<Link to="/portal/registration" className="text-sm text-primary hover:underline">الجدول الكامل</Link>}>
          <ul className="divide-y">
            {upcoming.map((s) => (
              <li key={s.start} className="flex items-center gap-4 py-3">
                <div className="w-24 font-mono text-sm text-muted-foreground" dir="ltr">
                  {s.start}:00 – {s.end}:00
                </div>
                <div className="flex-1" dir="ltr">
                  <div className="text-left font-medium">{s.course}</div>
                  <div className="text-left text-xs text-muted-foreground">{s.staff} · {s.room}</div>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{KIND_LABEL[s.kind]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="روابط سريعة" icon={FileDown}>
          <div className="grid gap-2">
            {[
              ["/portal/info", "بيانات الطالب"],
              ["/portal/grades", "النتائج والمعدل التراكمي"],
              ["/portal/courses", "المقررات المسجلة"],
              ["/portal/documents", "تحميل ملفات الطالب"],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="rounded-lg border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-info-soft">
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
