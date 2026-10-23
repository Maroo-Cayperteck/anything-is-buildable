import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer({ url }: { url: string }) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState(800);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.min(e.contentRect.width - 32, 1000)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-4 py-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="الصفحة السابقة" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums">
            {page} / {pages || "…"}
          </span>
          <Button size="icon" variant="ghost" aria-label="الصفحة التالية" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="تصغير" disabled={scale <= 0.5} onClick={() => setScale((s) => +(s - 0.25).toFixed(2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
          <Button size="icon" variant="ghost" aria-label="تكبير" disabled={scale >= 3} onClick={() => setScale((s) => +(s + 0.25).toFixed(2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={box} dir="ltr" className="flex max-h-[75vh] min-h-[50vh] justify-center overflow-auto bg-secondary p-4">
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => {
            setPages(numPages);
            setPage(1);
          }}
          loading={
            <div className="flex items-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل الملف…
            </div>
          }
          error={<div className="py-24 text-destructive">تعذر عرض الملف.</div>}
        >
          <Page pageNumber={page} width={width * scale} className="shadow-elevated" />
        </Document>
      </div>
    </div>
  );
}
