import { toast } from "sonner";
import { signedUrl } from "./portal-data";

export async function downloadDocument(path: string, fileName: string) {
  try {
    const url = await signedUrl(path, fileName);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("بدأ تحميل الملف");
  } catch {
    toast.error("تعذر تحميل الملف");
  }
}
