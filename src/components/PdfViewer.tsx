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

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        setPage((p) => Math.min(p + 1, pages));
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        setPage((p) => Math.max(p - 1, 1));
      } else if (e.key === "+" || e.key === "=") {
        zoomIn();
      } else if (e.key === "-") {
        zoomOut();
      } else if (e.key === "0") {
        setScale(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages]);

  const zoomOut = () => setScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)));
  const zoomIn = () => setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)));
  const rotate = () => setRotation((r) => (r + 90) % 360);

  // Touch pinch-to-zoom support for mobile
  const touchStartDist = useRef<number | null>(null);
  const touchStartScale = useRef<number>(1);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        touchStartDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        touchStartScale.current = scale;
      }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const ratio = dist / touchStartDist.current;
        const newScale = Math.min(4, Math.max(0.3, +(touchStartScale.current * ratio).toFixed(2)));
        setScale(newScale);
      }
    }
  }

  function handleTouchEnd() {
    touchStartDist.current = null;
  }

  // Effective render width — account for rotation
  const renderWidth = width > 0 ? width * scale : undefined;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="الصفحة السابقة" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 w-8 touch-manipulation">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-20 select-none text-center text-sm font-medium tabular-nums">
            {page} / {pages || "…"}
          </span>
          <Button size="icon" variant="ghost" aria-label="الصفحة التالية" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 touch-manipulation">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom + rotate controls */}
        <div className="flex items-center gap-1" dir="ltr">
          <Button
            size="icon"
            variant="ghost"
            aria-label="تصغير المستند"
            title="تصغير"
            disabled={scale <= 0.25}
            onClick={zoomOut}
            className="h-8 w-8 touch-manipulation transition-transform active:scale-90"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={() => setScale(1)}
            title="إعادة ضبط الحجم (100%)"
            className="w-14 select-none rounded px-1.5 py-1 text-center text-xs font-semibold tabular-nums text-foreground transition-all hover:bg-muted active:scale-95"
          >
            {Math.round(scale * 100)}%
          </button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="تكبير المستند"
            title="تكبير"
            disabled={scale >= 4}
            onClick={zoomIn}
            className="h-8 w-8 touch-manipulation transition-transform active:scale-90"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="تدوير المستند"
            title="تدوير 90°"
            onClick={rotate}
            className="h-8 w-8 touch-manipulation transition-transform active:scale-90"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF canvas area with m-auto safe centering (prevents left cutoff when zoomed in) */}
      <div
        ref={box}
        dir="ltr"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex min-h-[60vh] max-h-[80vh] overflow-auto bg-secondary/70 p-4 touch-pan-x touch-pan-y"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="m-auto flex flex-col items-center">
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
                className="shadow-elevated transition-[width] duration-150"
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
