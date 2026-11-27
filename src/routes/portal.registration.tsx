import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CalendarDays } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { useProfile } from "@/lib/use-profile";
import { DAYS, KIND_LABEL, REGISTERED_COURSES, TIMETABLE, type SlotKind } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/registration")({
  head: () => ({
    meta: [
      { title: "التسجيل الأكاديمي — بوابة الطالب" },
      { name: "description", content: "حالة التسجيل والجدول الأسبوعي للفصل الدراسي الأول 2026/2027." },
      { property: "og:title", content: "التسجيل الأكاديمي — بوابة الطالب" },
      { property: "og:description", content: "حالة التسجيل والجدول الأسبوعي." },
    ],
  }),
  component: Registration,
});

const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i);
const KIND_CLS: Record<SlotKind, string> = {
  lecture: "bg-lecture text-primary-foreground",
  section: "bg-section text-foreground",
  lab: "bg-lab text-foreground",
};

function Registration() {
  const p = useProfile();
  const initial = p.full_name_ar[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-warning">
        <AlertCircle className="h-5 w-5 shrink-0" /> لا توجد فترة تسجيل مفتوحة حاليًا — يُعرض التسجيل المعتمد للفصل الدراسي الأول.
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-4 border-b p-5">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{initial}</div>
          <div>
            <div className="font-semibold">{p.full_name_ar}</div>
            <div className="text-sm text-muted-foreground">
              الرقم الجامعي: <span className="font-mono">{p.student_code}</span> · المعدل: {Number(p.cgpa).toFixed(2)}
            </div>
          </div>
          <span className="mr-auto rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">التسجيل معتمد</span>
        </div>
        <div className="flex flex-wrap gap-8 bg-muted/50 px-6 py-4">
          {[
            ["المقررات المسجلة", REGISTERED_COURSES.length, "text-foreground"],
            ["الفصل الدراسي", "الأول 2026/2027", "text-primary"],
            ["المجموعة", "Group 1 - Section 1", "text-foreground"],
          ].map(([l, v, c]) => (
            <div key={l as string}>
              <div className="label-caps">{l}</div>
              <div className={cn("mt-1 font-mono font-bold", c as string)} dir="ltr">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <Card
        title="الجدول الأسبوعي"
        icon={CalendarDays}
        action={
          <div className="flex gap-3 text-xs">
            {(Object.keys(KIND_LABEL) as SlotKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm", KIND_CLS[k])} /> {KIND_LABEL[k]}
              </span>
            ))}
          </div>
        }
      >
        <div className="-m-6 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-xs" dir="ltr">
            <thead>
              <tr className="bg-muted/60">
                <th className="w-24 border-b p-3 font-semibold">اليوم</th>
                {HOURS.map((h) => (
                  <th key={h} className="border-b border-l p-3 font-semibold">
                    {String(h).padStart(2, "0")}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(([day, ar]) => {
                const slots = TIMETABLE.filter((s) => s.day === day);
                const cells: React.ReactNode[] = [];
                for (let h = 8; h < 18; ) {
                  const s = slots.find((x) => x.start === h);
                  if (s) {
                    cells.push(
                      <td key={h} colSpan={s.end - s.start} className="border-b border-l p-1">
                        <div className={cn("h-full rounded-md p-2 leading-tight", KIND_CLS[s.kind])}>
                          <div className="font-semibold">{KIND_LABEL[s.kind]} · {s.course}</div>
                          <div className="mt-0.5 opacity-80">{s.staff}</div>
                          <div className="opacity-80">{s.room}</div>
                        </div>
                      </td>,
                    );
                    h = s.end;
                  } else {
                    cells.push(<td key={h} className="h-16 border-b border-l" />);
                    h++;
                  }
                }
                return (
                  <tr key={day}>
                    <td className="border-b bg-muted/40 p-3 text-center font-semibold">{ar}</td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
