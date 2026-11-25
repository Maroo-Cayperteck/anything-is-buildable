import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, FileText, FileX2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentsQuery, formatSize } from "@/lib/portal-data";
import { downloadDocument } from "@/lib/download";
import { useState } from "react";
import { toast } from "sonner";

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

function DocumentCard({
  d,
}: {
  d: {
    id: string;
    title: string;
    description?: string | null;
    file_path?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    is_available: boolean;
  };
}) {
  const [downloading, setDownloading] = useState(false);
  const has = !!d.file_path && d.is_available;

  async function handleDownload() {
    if (!d.file_path) return;
    setDownloading(true);
    try {
      await downloadDocument(d.file_path, `${d.title}.pdf`, d.id);
    } catch {
      toast.error("تعذر تحميل الملف");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <article className="flex flex-col rounded-xl border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="flex items-start gap-4">
        <div
          className={
            has
              ? "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-info-soft text-primary"
              : "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
          }
        >
          {has ? <FileText className="h-6 w-6" /> : <FileX2 className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{d.title}</h3>
          {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
        </div>
      </div>

      {has ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">مستند PDF</span>
            {d.file_size ? (
              <>
                <span>·</span>
                <span dir="ltr">{formatSize(d.file_size)}</span>
              </>
            ) : null}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
            {/* View button — opens inline PDF viewer */}
            <Button asChild variant="brand">
              <Link to="/portal/viewer/$docId" params={{ docId: d.id }}>
                <Eye /> معاينة الملف
              </Link>
            </Button>

            {/* Download button — triggers file download */}
            <Button
              variant="outline"
              disabled={downloading}
              onClick={handleDownload}
              aria-label={`تحميل ${d.file_name ?? "document.pdf"}`}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download />}
              تحميل الملف
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
}

function Documents() {
  const { data, isLoading, isError } = useQuery(documentsQuery);

  if (isLoading)
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (isError)
    return <div className="rounded-xl border bg-card p-8 text-center text-destructive">تعذر تحميل قائمة الملفات.</div>;
  if (!data?.length)
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">لا توجد ملفات متاحة حاليًا.</div>
    );

  const available = data.filter((d) => d.is_available);
  const hidden = data.filter((d) => !d.is_available);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        يمكنك معاينة الملفات داخل البوابة مباشرةً أو تحميلها بصيغة PDF.
      </p>

      {available.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {available.map((d) => (
            <DocumentCard key={d.id} d={d} />
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <details className="group rounded-xl border bg-card shadow-card">
          <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-muted-foreground select-none">
            ملفات مخفية ({hidden.length})
          </summary>
          <div className="grid gap-5 p-6 pt-2 sm:grid-cols-2 xl:grid-cols-3">
            {hidden.map((d) => (
              <DocumentCard key={d.id} d={d} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
