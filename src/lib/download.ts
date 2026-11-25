import { toast } from "sonner";
import { resolveDocumentUrl } from "./documents-storage";

/**
 * Download an authorized document by its database ID using a server-verified short-lived URL.
 */
export async function downloadDocument(
  docId: string,
  fileName: string,
  options?: { kind?: "shared" | "private"; allowHidden?: boolean },
) {
  const safeFileName = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  let createdBlobUrl: string | null = null;

  try {
    const resolvedUrl = await resolveDocumentUrl(docId, safeFileName, options);

    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    createdBlobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = createdBlobUrl;
    a.download = safeFileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    toast.success("بدأ تحميل الملف");
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر تحميل الملف";
    toast.error(message);
  } finally {
    if (createdBlobUrl) {
      setTimeout(() => URL.revokeObjectURL(createdBlobUrl!), 30_000);
    }
  }
}
