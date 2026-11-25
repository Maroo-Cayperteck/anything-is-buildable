import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, FileText, FileX2, Lock, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatSize, studentDocumentsQuery } from "@/lib/portal-data";
import { downloadDocument } from "@/lib/download";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/documents")({
  head: () => ({
    meta: [
      { title: "تحميل ملفات الطالب — بوابة الطالب" },
      { name: "description", content: "معاينة وتحميل الملفات والمواد الدراسية والملفات الخاصة بالطالب." },
    ],
  }),
  component: Documents,
});

function DocumentCard({
  d,
  kind,
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
  kind: "shared" | "private";
}) {
  const [downloading, setDownloading] = useState(false);
  const has = !!d.file_path && d.is_available;

  async function handleDownload() {
    if (!has) return;
    setDownloading(true);
    try {
      await downloadDocument(d.id, d.file_name || `${d.title}.pdf`, { kind });
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
          {has ? kind === "private" ? <Lock className="h-6 w-6" /> : <FileText className="h-6 w-6" /> : <FileX2 className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{d.title}</h3>
          {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
        </div>
      </div>

      {has ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {kind === "private" ? "ملف شخصي خاص PDF" : "مستند PDF"}
            </span>
            {d.file_size ? (
              <>
                <span>·</span>
                <span dir="ltr">{formatSize(d.file_size)}</span>
              </>
            ) : null}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
            <Button asChild variant="brand">
              <Link to="/portal/viewer/$docId" params={{ docId: d.id }} search={{ kind }}>
                <Eye /> معاينة الملف
              </Link>
            </Button>

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
  const { data, isLoading, isError } = useQuery(studentDocumentsQuery);

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError) {
    return <div className="rounded-xl border bg-card p-8 text-center text-destructive">تعذر تحميل قائمة الملفات.</div>;
  }

  const shared = data?.shared ?? [];
  const privateDocs = data?.privateDocs ?? [];

  if (shared.length === 0 && privateDocs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
        لا توجد ملفات منشورة متاحة لك حاليًا.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        يمكنك معاينة الملفات المصرح لك بها داخل البوابة مباشرةً أو تحميلها بصيغة PDF.
      </p>

      {privateDocs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold">ملفاتي الخاصة</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {privateDocs.map((d) => (
              <DocumentCard key={d.id} d={d} kind="private" />
            ))}
          </div>
        </section>
      )}

      {shared.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold">الملفات والمواد الدراسية العامة</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shared.map((d) => (
              <DocumentCard key={d.id} d={d} kind="shared" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
