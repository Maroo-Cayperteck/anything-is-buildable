import { toast } from "sonner";
import { resolveDocumentUrl } from "./documents-storage";

/**
 * Download a document by its storage path.
 * Handles idb:, blob:, data: and remote Supabase signed URLs.
 * For remote signed URLs we fetch the bytes locally first to
 * ensure the `download` attribute works (cross-origin restrictions).
 */
export async function downloadDocument(path: string, fileName: string, docId?: string) {
  const safeFileName = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  let createdBlobUrl: string | null = null;

  try {
    // Resolve to a usable URL (idb → blob, remote → signed)
    const resolvedUrl = await resolveDocumentUrl(path, safeFileName, docId);

    let downloadUrl = resolvedUrl;

    // For remote (https://) or server-hosted (/) URLs, fetch as blob so the `download` attribute works
    if (resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://") || resolvedUrl.startsWith("/")) {
      const response = await fetch(resolvedUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      downloadUrl = URL.createObjectURL(blob);
      createdBlobUrl = downloadUrl;
    }

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = safeFileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    toast.success("بدأ تحميل الملف");
  } catch {
    toast.error("تعذر تحميل الملف");
  } finally {
    // Revoke blob URL after a short delay to give browser time to start download
    if (createdBlobUrl) {
      setTimeout(() => URL.revokeObjectURL(createdBlobUrl!), 30_000);
    }
  }
}
