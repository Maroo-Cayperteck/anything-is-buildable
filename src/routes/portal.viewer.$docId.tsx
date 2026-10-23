import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LazyPdf } from "@/components/portal/LazyPdf";
import { documentsQuery, signedUrl } from "@/lib/portal-data";
import { downloadDocument } from "@/lib/download";

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
  const url = useQuery({
    queryKey: ["signed", doc?.file_path],
    queryFn: () => signedUrl(doc!.file_path!),
    enabled: !!doc?.file_path,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost">
          <Link to="/portal/documents">
            <ArrowRight /> العودة إلى الملفات
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{doc?.title}</h2>
        {doc?.file_path && (
          <Button variant="outline" className="mr-auto" onClick={() => downloadDocument(doc.file_path!, doc.file_name ?? "document.pdf")}>
            <Download /> تحميل الملف
          </Button>
        )}
      </div>
      {docs.isLoading || url.isLoading ? (
        <div className="grid h-96 place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !doc?.file_path || !url.data ? (
        <div className="rounded-xl border border-dashed bg-card p-16 text-center text-muted-foreground">هذا الملف غير متاح حاليًا.</div>
      ) : (
        <LazyPdf url={url.data} />
      )}
    </div>
  );
}
