import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, FileText, FileX2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentsQuery, formatSize } from "@/lib/portal-data";
import { downloadDocument } from "@/lib/download";

export const Route = createFileRoute("/portal/documents")({
  head: () => ({
    meta: [
      { title: "تحميل ملفات الطالب — بوابة الطالب" },
      { name: "description", content: "معاينة وتحميل ملفات الطالب: طلب الالتحاق، جدول الحضور، جدول الامتحانات." },
      { property: "og:title", content: "تحميل ملفات الطالب — بوابة الطالب" },
      { property: "og:description", content: "معاينة وتحميل ملفات الطالب." },
    ],
  }),
  component: Documents,
});

function Documents() {
  const { data, isLoading, isError } = useQuery(documentsQuery);

  if (isLoading)
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (isError) return <div className="rounded-xl border bg-card p-8 text-center text-destructive">تعذر تحميل قائمة الملفات.</div>;
  if (!data?.length) return <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">لا توجد ملفات متاحة حاليًا.</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">يمكنك معاينة الملفات داخل البوابة أو تحميلها بصيغة PDF.</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.map((d) => {
          const has = !!d.file_path;
          return (
            <article key={d.id} className="flex flex-col rounded-xl border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated">
              <div className="flex items-start gap-4">
                <div className={has ? "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-info-soft text-primary" : "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"}>
                  {has ? <FileText className="h-6 w-6" /> : <FileX2 className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">{d.title}</h3>
                  {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                </div>
              </div>
              {has ? (
                <>
                  <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
                    <span className="font-mono" dir="ltr">{d.file_name}</span>
                    <span>·</span>
                    <span dir="ltr">{formatSize(d.file_size)}</span>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                    <Button asChild variant="brand">
                      <Link to="/portal/viewer/$docId" params={{ docId: d.id }}>
                        <Eye /> معاينة الملف
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={() => downloadDocument(d.file_path!, d.file_name ?? "document.pdf")}>
                      <Download /> تحميل الملف
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-auto pt-5">
                  <div className="rounded-lg border border-dashed bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                    هذا الملف غير متاح حاليًا
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
