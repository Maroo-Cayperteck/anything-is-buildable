import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const PdfViewer = lazy(() => import("@/components/PdfViewer"));

export function LazyPdf({ url }: { url: string }) {
  return (
    <Suspense
      fallback={
        <div className="grid h-96 place-items-center rounded-xl border bg-card text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <PdfViewer url={url} />
    </Suspense>
  );
}
