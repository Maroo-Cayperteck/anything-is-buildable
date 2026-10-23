import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer({ url }: { url: string }) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        // Subtract padding (32px) and ensure min/max bounds
        const w = Math.max(200, Math.min(e.contentRect.width - 32, 1200));
        setWidth(w);
      }
    });
    ro.observe(el);
    // Set initial width immediately
    setWidth(Math.max(200, Math.min(el.clientWidth - 32, 1200)));
    return () => ro.disconnect();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        setPage((p) => Math.min(p + 1, pages));
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        setPage((p) => Math.max(p - 1, 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages]);

  const zoomOut = () => setScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)));
  const zoomIn = () => setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)));
  const rotate = () => setRotation((r) => (r + 90) % 360);

  // Effective render width — account for rotation
  const isRotated = rotation === 90 || rotation === 270;
  // When rotated 90/270, the page "width" becomes the PDF height.
  // react-pdf handles this internally so we just pass our container width.
  const renderWidth = width > 0 ? width * scale : undefined;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="الصفحة السابقة" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-20 select-none text-center text-sm tabular-nums">
            {page} / {pages || "…"}
          </span>
          <Button size="icon" variant="ghost" aria-label="الصفحة التالية" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom + rotate */}
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="تصغير" disabled={scale <= 0.25} onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-14 select-none text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
          <Button size="icon" variant="ghost" aria-label="تكبير" disabled={scale >= 4} onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="تدوير" onClick={rotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF canvas area */}
      <div
        ref={box}
        dir="ltr"
        className="flex min-h-[60vh] max-h-[80vh] justify-center overflow-auto bg-secondary/70 p-4"
        style={{ scrollbarGutter: "stable" }}
      >
        {width > 0 && (
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
            error={
              <div className="flex flex-col items-center gap-3 py-24 text-center text-destructive">
                <span className="text-base font-medium">تعذر عرض الملف</span>
                <span className="text-sm text-muted-foreground">تأكد من صحة الملف أو جرّب إعادة التحميل</span>
              </div>
            }
          >
            <Page
              pageNumber={page}
              {...(renderWidth !== undefined ? { width: renderWidth } : {})}
              rotate={rotation}
              className="shadow-elevated"
              renderAnnotationLayer={true}
              renderTextLayer={true}
              loading={
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            />
          </Document>
        )}
      </div>

      {/* Bottom page indicator strip for mobile */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <button
            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← السابقة
          </button>
          <span className="tabular-nums">
            صفحة {page} من {pages}
          </span>
          <button
            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالية →
          </button>
        </div>
      )}
    </div>
  );
}
