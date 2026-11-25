import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LazyPdf } from "@/components/portal/LazyPdf";
import { documentsQuery, signedUrl } from "@/lib/portal-data";
import { downloadDocument } from "@/lib/download";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/viewer/$docId")({
  head: () => ({
    meta: [
      { title: "معاينة الملف — بوابة الطالب" },
      { name: "description", content: "عرض ملف الطالب بصيغة PDF داخل البوابة." },
      { property: "og:title", content: "معاينة الملف — بوابة الطالب" },
      { property: "og:description", content: "عرض ملفات الطالب داخل البوابة." },
    ],
  }),
  component: Viewer,
});

function Viewer() {
  const { docId } = Route.useParams();
  const docs = useQuery(documentsQuery);
  const doc = docs.data?.find((d) => d.id === docId);
  const [downloading, setDownloading] = useState(false);

  const url = useQuery({
    queryKey: ["signed", doc?.id, doc?.file_path, doc?.is_available],
    queryFn: () => signedUrl(doc!.file_path!, undefined, doc!.id),
    enabled: !!doc?.file_path && doc.is_available,
    staleTime: 0,
  });

  async function handleDownload() {
    if (!doc?.file_path || !doc.is_available) return;
    setDownloading(true);
    try {
      await downloadDocument(doc.file_path, `${doc.title}.pdf`, doc.id);
    } catch {
      toast.error("تعذر تحميل الملف");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/portal/documents">
            <ArrowRight className="h-4 w-4" /> العودة إلى الملفات
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{doc?.title ?? "معاينة الملف"}</h2>
        {doc?.file_path && doc.is_available && (
          <Button
            variant="outline"
            size="sm"
            className="mr-auto"
            disabled={downloading}
            onClick={handleDownload}
            aria-label="تحميل الملف"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تحميل الملف
          </Button>
        )}
      </div>

      {docs.isLoading || url.isLoading ? (
        <div className="grid h-96 place-items-center text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">جارٍ تحميل الملف…</span>
          </div>
        </div>
      ) : url.isError ? (
        <div className="rounded-xl border border-dashed bg-card p-16 text-center">
          <p className="text-destructive font-medium">تعذر تحميل الملف</p>
          <p className="mt-2 text-sm text-muted-foreground">يرجى المحاولة مرة أخرى أو تحميل الملف مباشرةً</p>
        </div>
      ) : !doc?.file_path || !url.data ? (
        <div className="rounded-xl border border-dashed bg-card p-16 text-center text-muted-foreground">
          هذا الملف غير متاح حاليًا.
        </div>
      ) : (
        <LazyPdf url={url.data} />
      )}
    </div>
  );
}
