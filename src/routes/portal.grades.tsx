import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, ChevronDown, Clock, GraduationCap, Info, TrendingUp } from "lucide-react";
import { GradePill, StatCard } from "@/components/portal/Shell";
import { useProfile } from "@/lib/use-profile";
import { GPA_SCALE, TRANSCRIPT } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/grades")({
  head: () => ({
    meta: [
      { title: "النتائج والمعدل التراكمي — بوابة الطالب" },
      { name: "description", content: "السجل الأكاديمي ونتائج الفصول والمعدل التراكمي." },
      { property: "og:title", content: "النتائج والمعدل التراكمي — بوابة الطالب" },
      { property: "og:description", content: "السجل الأكاديمي للطالب." },
    ],
  }),
  component: Grades,
});

function Grades() {
  const p = useProfile();
  const [scaleOpen, setScaleOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Award} label="المعدل التراكمي" value={<span className="text-danger">{Number(p.cgpa).toFixed(2)}</span>} sub="/ 4.00" tone="danger" />
        <StatCard icon={GraduationCap} label="التقدير" value="D+" tone="gold" />
        <StatCard icon={Clock} label="الساعات المكتسبة" value={p.earned_hours} sub="ساعة" />
        <StatCard icon={TrendingUp} label="المستوى" value="4" tone="success" />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <button onClick={() => setScaleOpen((o) => !o)} className="flex w-full items-center gap-3 px-6 py-4 text-sm font-semibold">
          <Info className="h-4 w-4 text-primary" /> سلم التقديرات
          <ChevronDown className={cn("mr-auto h-4 w-4 transition-transform", scaleOpen && "rotate-180")} />
        </button>
        {scaleOpen && (
          <div className="grid grid-cols-3 gap-2 border-t p-6 sm:grid-cols-5 lg:grid-cols-9">
            {GPA_SCALE.map(([g, pts, range]) => (
              <div key={g} className="rounded-lg border p-3 text-center">
                <GradePill grade={g} />
                <div className="mt-2 font-mono text-sm font-bold">{pts}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{range}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {TRANSCRIPT.map((t) => (
        <section key={t.season + t.year} className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
            <h3 className="text-lg font-bold">الفصل {t.seasonAr}</h3>
            <span className="rounded-full bg-secondary px-3 py-0.5 text-sm">{t.year}</span>
            <span className={cn("rounded-full px-3 py-0.5 text-sm font-medium", t.posted ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
              {t.posted ? "معلنة" : "لم تُعلن بعد"}
            </span>
            {t.gpa != null && (
              <span className="mr-auto rounded-full bg-muted px-4 py-1 text-sm text-muted-foreground">
                المعدل الفصلي <span className="font-mono font-bold text-danger">{t.gpa.toFixed(2)}</span>
              </span>
            )}
          </div>
          {t.courses.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">لا توجد نتائج متاحة لهذا الفصل.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="label-caps">
                    <th className="p-4 text-right">المقرر</th>
                    <th className="p-4">الساعات</th>
                    <th className="p-4">الدرجة</th>
                    <th className="p-4">التقدير</th>
                    <th className="p-4">النقاط</th>
                    <th className="p-4">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {t.courses.map((c) => (
                    <tr key={c.code} className="border-t text-center">
                      <td className="p-4 text-right" dir="ltr" style={{ textAlign: "right" }}>
                        <div className="font-medium">{c.code}-{c.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                      </td>
                      <td className="p-4">{c.hours}</td>
                      <td className="p-4 font-mono">{c.marks.toFixed(1)}</td>
                      <td className="p-4"><GradePill grade={c.grade} /></td>
                      <td className="p-4 font-mono">{c.points.toFixed(2)}</td>
                      <td className="p-4"><span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs text-success">ناجح</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {t.cumulative && (
            <div className="flex flex-wrap gap-8 border-t bg-muted/40 px-6 py-4 text-sm">
              <div>
                <div className="label-caps">الفصل</div>
                المعدل: <b>{t.gpa?.toFixed(2)}</b> · الساعات: <b>{t.courses.reduce((a, c) => a + c.hours, 0)}</b>
              </div>
              <div>
                <div className="label-caps">التراكمي</div>
                المعدل التراكمي: <b className="text-danger">{t.cumulative.cgpa}</b> · الساعات: <b>{t.cumulative.hours}</b> · المستوى: <b>{t.cumulative.level}</b>
              </div>
            </div>
          )}
        </section>
      ))}
      <p className="text-center text-xs text-muted-foreground">تُعرض المقررات الظاهرة في الصور المرجعية فقط؛ قد لا يشمل السجل جميع المقررات السابقة.</p>
    </div>
  );
}
