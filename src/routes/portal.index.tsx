import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, BookOpen, CalendarDays, Clock, FileDown, GraduationCap, Megaphone, TrendingUp } from "lucide-react";
import { Card, StatCard } from "@/components/portal/Shell";
import { usePortalSnapshot } from "@/lib/use-profile";
import { DAYS, EVENT_KIND_LABEL, KIND_LABEL } from "@/lib/portal-data";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — بوابة الطالب" },
      { name: "description", content: "نظرة عامة على الحالة الأكاديمية والمعدل والجدول الأسبوعي." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: snap } = usePortalSnapshot();
  const p = snap!.profile;
  const timetable = snap!.timetable;
  const enrollments = snap!.enrollments;
  const announcements = snap!.announcements;
  const events = snap!.events;

  const order = DAYS.map((d) => d[0]);
  const todayIdx = (new Date().getDay() + 1) % 7;
  const nextDay =
    order.find((_, i) => i >= todayIdx && timetable.some((s) => s.day === order[i])) ??
    order.find((day) => timetable.some((s) => s.day === day)) ??
    "Saturday";
  const upcoming = timetable.filter((s) => s.day === nextDay);

  const upcomingEvents = events.filter((ev) => new Date(ev.starts_at).getTime() >= Date.now() - 86_400_000).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-hero p-8 text-primary-foreground shadow-elevated">
        <div className="text-sm opacity-80">مرحبًا،</div>
        <h2 className="mt-1 text-2xl font-bold md:text-3xl">{p.full_name_ar}</h2>
        <p className="mt-2 opacity-85">
          {p.resolvedProgramName || "البرنامج غير محدد"} — {p.resolvedLevelName || "المستوى غير محدد"}
          {snap?.selectedSemester ? ` — ${snap.selectedSemester.name_ar}` : ""}
          {p.resolvedYearName ? ` — العام الأكاديمي ${p.resolvedYearName}` : ""}
        </p>
        <GraduationCap className="absolute -bottom-6 left-6 h-40 w-40 opacity-10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Award}
          label="المعدل التراكمي"
          value={
            p.cgpa !== null && p.cgpa !== undefined ? (
              <span className="text-danger">{Number(p.cgpa).toFixed(2)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
          sub={p.cgpa !== null && p.cgpa !== undefined ? "/ 4.00" : undefined}
          tone="danger"
        />
        <StatCard icon={Clock} label="الساعات المكتسبة" value={p.earned_hours ?? "—"} sub={p.earned_hours != null ? "ساعة" : undefined} />
        <StatCard icon={BookOpen} label="مقررات الفصل الحالي" value={enrollments.length} tone="gold" />
        <StatCard icon={TrendingUp} label="الحالة الأكاديمية" value={<span className="text-lg">{p.academic_status || "مقيد"}</span>} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title={`محاضرات يوم ${DAYS.find((d) => d[0] === nextDay)?.[1] ?? ""}`}
          icon={CalendarDays}
          className="lg:col-span-2"
          action={
            <Link to="/portal/registration" className="text-sm text-primary hover:underline">
              الجدول الكامل
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد محاضرات مسجلة لك في الفصل الحالي بعد.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center gap-4 py-3">
                  <div className="w-24 font-mono text-sm text-muted-foreground" dir="ltr">
                    {s.start}:00 – {s.end}:00
                  </div>
                  <div className="flex-1" dir="ltr">
                    <div className="text-left font-medium">{s.course}</div>
                    <div className="text-left text-xs text-muted-foreground">
                      {s.staff} · {s.room} ({s.groupName})
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{KIND_LABEL[s.kind]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="روابط سريعة" icon={FileDown}>
          <div className="grid gap-2">
            {(
              [
                ["/portal/info", "بيانات الطالب"],
                ["/portal/grades", "النتائج والمعدل التراكمي"],
                ["/portal/courses", "المقررات المسجلة"],
                ["/portal/documents", "تحميل ملفات الطالب"],
                ["/portal/events", "الإعلانات والفعاليات"],
              ] as const
            ).map(([to, label]) => (
              <Link key={to} to={to} className="rounded-lg border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-info-soft">
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="أحدث الإعلانات"
          icon={Megaphone}
          action={
            <Link to="/portal/events" className="text-sm text-primary hover:underline">
              عرض الكل
            </Link>
          }
        >
          {announcements.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد إعلانات منشورة حاليًا.</p>
          ) : (
            <ul className="divide-y">
              {announcements.slice(0, 4).map((a) => (
                <li key={a.id} className="py-3">
                  <div className="font-semibold">{a.title}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="الفعاليات والاختبارات القادمة"
          icon={CalendarDays}
          action={
            <Link to="/portal/events" className="text-sm text-primary hover:underline">
              عرض الكل
            </Link>
          }
        >
          {upcomingEvents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد فعاليات قادمة حاليًا.</p>
          ) : (
            <ul className="divide-y">
              {upcomingEvents.map((ev) => (
                <li key={ev.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold">{ev.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                      {new Date(ev.starts_at).toLocaleString("ar-EG")}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-info-soft px-2.5 py-0.5 text-xs text-primary">
                    {EVENT_KIND_LABEL[ev.event_type]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
