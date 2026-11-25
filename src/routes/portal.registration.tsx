import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, CalendarDays, Loader2 } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { DAYS, KIND_LABEL, type SlotKind } from "@/lib/portal-data";
import { usePortalSnapshot } from "@/lib/use-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/registration")({
  head: () => ({
    meta: [
      { title: "التسجيل الأكاديمي — بوابة الطالب" },
      { name: "description", content: "التسجيل الأكاديمي والجدول الأسبوعي المشتق من المجموعات المسجل بها الطالب." },
    ],
  }),
  component: Registration,
});

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i);
const KIND_CLS: Record<SlotKind, string> = {
  lecture: "bg-lecture text-primary-foreground",
  section: "bg-section text-foreground",
  lab: "bg-lab text-foreground",
};

function Registration() {
  const [semesterId, setSemesterId] = useState<string | undefined>(undefined);
  const { data: snap, isLoading } = usePortalSnapshot(semesterId);

  if (isLoading || !snap) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const p = snap.profile;
  const initial = p.full_name_ar[0] || "ط";
  const enrollments = snap.enrollments;
  const timetable = snap.timetable;
  const distinctGroups = [...new Set(enrollments.map((e) => e.groupName).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-warning">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          يُدار التسجيل وتوزيع المجموعات مركزيًا من إدارة شؤون الطلاب.
        </div>
        {snap.semesters.length > 0 && (
          <select
            aria-label="اختيار الفصل الدراسي"
            className="rounded-lg border bg-card px-3 py-1 text-foreground"
            value={semesterId ?? snap.selectedSemester?.id ?? ""}
            onChange={(e) => setSemesterId(e.target.value || undefined)}
          >
            {snap.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar} {s.is_current ? "(الحالي)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-4 border-b p-5">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {initial}
          </div>
          <div>
            <div className="font-semibold">{p.full_name_ar}</div>
            <div className="text-sm text-muted-foreground">
              الرقم الجامعي: <span className="font-mono">{p.student_code || "—"}</span>
              {p.cgpa != null ? ` · المعدل: ${Number(p.cgpa).toFixed(2)}` : ""}
            </div>
          </div>
          <span className="mr-auto rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            {p.academic_status || "التسجيل معتمد"}
          </span>
        </div>
        <div className="flex flex-wrap gap-8 bg-muted/50 px-6 py-4">
          {[
            ["المقررات المسجلة", enrollments.length, "text-foreground"],
            ["الفصل الدراسي", snap.selectedSemester?.name_ar ?? "—", "text-primary"],
            ["المجموعات", distinctGroups.length > 0 ? distinctGroups.join(" / ") : "—", "text-foreground"],
          ].map(([l, v, c]) => (
            <div key={l as string}>
              <div className="label-caps">{l}</div>
              <div className={cn("mt-1 font-mono font-bold", c as string)} dir="ltr">
                {v}
              </div>
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
        {timetable.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            لا توجد حصص مجدولة في هذا الفصل الدراسي بعد.
          </p>
        ) : (
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
                  const slots = timetable.filter((s) => s.day === day);
                  const cells: React.ReactNode[] = [];
                  for (let h = 8; h < 20; ) {
                    const s = slots.find((x) => x.start === h);
                    if (s) {
                      cells.push(
                        <td key={h} colSpan={Math.max(1, s.end - s.start)} className="border-b border-l p-1">
                          <div className={cn("h-full rounded-md p-2 leading-tight", KIND_CLS[s.kind])}>
                            <div className="font-semibold">
                              {KIND_LABEL[s.kind]} · {s.course}
                            </div>
                            <div className="mt-0.5 opacity-80">{s.staff}</div>
                            <div className="opacity-80">
                              {s.room} · {s.groupName}
                            </div>
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
        )}
      </Card>
    </div>
  );
}
