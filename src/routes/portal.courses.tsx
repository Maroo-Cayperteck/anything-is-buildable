import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { KIND_LABEL, REGISTERED_COURSES } from "@/lib/portal-data";

export const Route = createFileRoute("/portal/courses")({
  head: () => ({
    meta: [
      { title: "المقررات الدراسية — بوابة الطالب" },
      { name: "description", content: "قائمة المقررات المسجلة للفصل الدراسي الأول 2026/2027." },
      { property: "og:title", content: "المقررات الدراسية — بوابة الطالب" },
      { property: "og:description", content: "المقررات المسجلة للفصل الحالي." },
    ],
  }),
  component: Courses,
});

function Courses() {
  return (
    <Card title={`المقررات المسجلة (${REGISTERED_COURSES.length})`} icon={BookOpen}>
      <div className="-m-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="p-4 text-right">#</th>
              <th className="p-4 text-right">المقرر</th>
              <th className="p-4 text-right">المحاضر</th>
              <th className="p-4 text-right">المكونات</th>
              <th className="p-4 text-center">ساعات أسبوعية</th>
            </tr>
          </thead>
          <tbody>
            {REGISTERED_COURSES.map((c, i) => (
              <tr key={c.course} className="border-t transition-colors hover:bg-muted/40">
                <td className="p-4 text-muted-foreground">{i + 1}</td>
                <td className="p-4 font-medium" dir="ltr" style={{ textAlign: "right" }}>{c.course}</td>
                <td className="p-4 text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{c.lecturer || "—"}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {[...c.kinds].map((k) => (
                      <span key={k} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{KIND_LABEL[k]}</span>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-center font-mono">{c.weeklyHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
