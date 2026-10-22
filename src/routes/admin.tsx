import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, FileText, FolderCog, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { Card, FullLoader, Shell } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LazyPdf } from "@/components/portal/LazyPdf";
import { useRoleGate } from "@/lib/session";
import { documentsQuery, formatSize, signedUrl } from "@/lib/portal-data";
import {
  createDocument,
  updateDocumentFields,
  uploadAndPublishDocument,
  deleteDocumentRecord,
  reorderDocumentList,
  type Doc,
} from "@/lib/documents-storage";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة الملفات — بوابة المسؤول" },
      { name: "description", content: "رفع واستبدال وحذف وترتيب ملفات الطلاب." },
      { property: "og:title", content: "إدارة الملفات — بوابة المسؤول" },
      { property: "og:description", content: "لوحة إدارة ملفات الطلاب." },
    ],
  }),
  component: Admin,
});

const MAX = 20 * 1024 * 1024;

function Admin() {
  const gate = useRoleGate("admin");
  if (gate.status === "loading") return <FullLoader />;
  if (gate.status === "denied") return <Navigate to="/admin-login" replace />;
  return (
    <Shell nav={[{ to: "/admin", label: "إدارة ملفات الطلاب", icon: FolderCog }]} title="إدارة ملفات الطلاب" userName="مسؤول النظام" userTag="admin" signOutTo="/admin-login">
      <DocumentManager />
    </Shell>
  );
}

function DocumentManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(documentsQuery);
  const [preview, setPreview] = useState<{ title: string; url: string; onPublish?: () => Promise<void> } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["documents"] });

  async function addDoc() {
    try {
      await createDocument("ملف جديد", "");
      toast.success("تمت إضافة تصنيف جديد بنجاح");
      refresh();
    } catch {
      toast.error("تعذر إضافة الملف");
    }
  }

  async function move(i: number, dir: -1 | 1) {
    if (!data) return;
    const targetIdx = i + dir;
    if (targetIdx < 0 || targetIdx >= data.length) return;
    const next = [...data];
    const temp = next[i];
    const target = next[targetIdx];
    if (!temp || !target) return;
    next[i] = target;
    next[targetIdx] = temp;
    await reorderDocumentList(next);
    refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteDocumentRecord(toDelete);
      setToDelete(null);
      toast.success("تم حذف الملف بنجاح");
      refresh();
    } catch {
      toast.error("تعذر الحذف");
    }
  }

  function stageUpload(d: Doc, file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("يُسمح بملفات PDF فقط");
      return;
    }
    if (file.size > MAX) {
      toast.error("الحد الأقصى لحجم الملف 20 ميجابايت");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({
      title: `معاينة قبل النشر — ${d.title}`,
      url,
      onPublish: async () => {
        await uploadAndPublishDocument(d.id, file);
      },
    });
  }

  async function publish() {
    if (!preview?.onPublish) return;
    setPublishing(true);
    try {
      await preview.onPublish();
      toast.success("تم نشر الملف بنجاح وحفظه للطلاب");
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      refresh();
    } catch {
      toast.error("تعذر رفع الملف");
    } finally {
      setPublishing(false);
    }
  }

  async function viewCurrent(d: Doc) {
    if (!d.file_path) return;
    try {
      const url = await signedUrl(d.file_path);
      setPreview({ title: d.title, url });
    } catch {
      toast.error("تعذر فتح الملف");
    }
  }

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">التغييرات تظهر مباشرة في صفحة «تحميل ملفات الطالب».</p>
        <Button variant="brand" className="mr-auto" onClick={addDoc}><Plus /> إضافة تصنيف ملف</Button>
      </div>
      {data?.map((d, i) => (
        <DocRow key={d.id} doc={d} first={i === 0} last={i === data.length - 1} onMove={(dir) => move(i, dir)} onDelete={() => setToDelete(d)}
          onUpload={(f) => stageUpload(d, f)} onView={() => viewCurrent(d)} onSaved={refresh} />
      ))}

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o && !publishing) { if (preview?.onPublish) URL.revokeObjectURL(preview.url); setPreview(null); } }}>
        <DialogContent className="max-w-4xl" dir="rtl">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          {preview && <LazyPdf url={preview.url} />}
          {preview?.onPublish && (
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={publishing} onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>إلغاء</Button>
              <Button variant="brand" disabled={publishing} onClick={publish}>
                {publishing ? <Loader2 className="animate-spin" /> : <Upload />} نشر الملف
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف «{toDelete?.title}»؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف التصنيف والملف المرفوع نهائيًا.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocRow({ doc, first, last, onMove, onDelete, onUpload, onView, onSaved }: {
  doc: Doc; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onDelete: () => void; onUpload: (f: File) => void; onView: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [desc, setDesc] = useState(doc.description ?? "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = title !== doc.title || desc !== (doc.description ?? "");

  async function save() {
    if (!title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSaving(true);
    try {
      await updateDocumentFields(doc.id, {
        title: title.trim().slice(0, 200),
        description: desc.trim().slice(0, 1000),
      });
      toast.success("تم حفظ التعديلات");
      onSaved();
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(v: boolean) {
    try {
      await updateDocumentFields(doc.id, { is_available: v });
      toast.success(v ? "الملف متاح للطلاب الآن" : "تم إخفاء الملف عن الطلاب");
      onSaved();
    } catch {
      toast.error("تعذر تغيير الحالة");
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex gap-1 lg:flex-col">
          <Button size="icon" variant="ghost" aria-label="تحريك لأعلى" disabled={first} onClick={() => onMove(-1)}><ArrowUp /></Button>
          <Button size="icon" variant="ghost" aria-label="تحريك لأسفل" disabled={last} onClick={() => onMove(1)}><ArrowDown /></Button>
        </div>
        <div className="flex-1 space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="font-semibold" aria-label="عنوان الملف" />
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} rows={2} placeholder="وصف الملف" aria-label="وصف الملف" />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            {doc.file_path ? (
              <span className="font-mono text-xs" dir="ltr">{doc.file_name} · {formatSize(doc.file_size)}</span>
            ) : (
              <span className="text-muted-foreground">لم يتم رفع ملف بعد</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap content-start items-center gap-2 lg:w-64 lg:flex-col lg:items-stretch">
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            {doc.is_available ? "متاح للطلاب" : "مخفي"}
            <Switch checked={doc.is_available} onCheckedChange={toggle} />
          </label>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
          <Button variant="soft" onClick={() => fileRef.current?.click()}><Upload /> {doc.file_path ? "استبدال الملف" : "رفع ملف"}</Button>
          {doc.file_path && <Button variant="outline" onClick={onView}><Eye /> معاينة</Button>}
          <Button variant="brand" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : <Save />} حفظ</Button>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /> حذف</Button>
        </div>
      </div>
    </Card>
  );
}
