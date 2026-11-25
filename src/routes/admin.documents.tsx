import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, FileText, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LazyPdf } from "@/components/portal/LazyPdf";
import { getAcademicCatalog, listAdminStudents } from "@/lib/admin.functions";
import { AUDIENCE_LABEL, documentsQuery, formatSize, signedUrl } from "@/lib/portal-data";
import {
  createDocument,
  deleteDocumentRecord,
  reorderDocumentList,
  updateDocumentFields,
  uploadAndPublishDocument,
  validatePdfFileClient,
  type AudienceScope,
  type Doc,
  type DocCategory,
} from "@/lib/documents-storage";

export const Route = createFileRoute("/admin/documents")({
  component: DocumentManager,
});

function DocumentManager() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery(documentsQuery);
  const catalog = useQuery({ queryKey: ["admin-academic-catalog"], queryFn: () => getAcademicCatalog() });
  const students = useQuery({
    queryKey: ["admin-students-picker"],
    queryFn: () => listAdminStudents({ data: { page: 1, pageSize: 50 } }),
  });

  const [preview, setPreview] = useState<{ title: string; url: string; onPublish?: () => Promise<void> } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["documents"] });
    await qc.refetchQueries({ queryKey: ["documents"] });
  };

  async function addDoc() {
    setAdding(true);
    try {
      await createDocument({ title: "ملف جديد", description: "" });
      await refresh();
      toast.success("تمت إضافة تصنيف جديد بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إضافة الملف");
    } finally {
      setAdding(false);
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
    try {
      await reorderDocumentList(next);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر حفظ الترتيب");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteDocumentRecord(toDelete);
      setToDelete(null);
      await refresh();
      toast.success("تم حذف الملف بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر حذف الملف");
    } finally {
      setDeleting(false);
    }
  }

  function stageUpload(d: Doc, file: File) {
    try {
      validatePdfFileClient(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ملف غير صالح");
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
      await refresh();
      toast.success("تم رفع الملف وتأكيد حفظه في قاعدة البيانات");
      URL.revokeObjectURL(preview.url);
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل رفع الملف أو حفظه على الخادم");
    } finally {
      setPublishing(false);
    }
  }

  async function viewCurrent(d: Doc) {
    if (!d.file_path) return;
    try {
      const url = await signedUrl(d.id, undefined, { allowHidden: true, kind: "shared" });
      setPreview({ title: d.title, url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر فتح الملف");
    }
  }

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return <div className="rounded-xl border bg-card p-8 text-center text-destructive">تعذر تحميل الملفات من الخادم.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          تُرفع الملفات إلى التخزين السحابي المركزي وتُحفظ في قاعدة البيانات مباشرة للطلاب المصرح لهم.
        </p>
        <Button variant="brand" className="mr-auto" disabled={adding} onClick={addDoc}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />} إضافة تصنيف ملف
        </Button>
      </div>

      {!data || data.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد ملفات مضافة بعد.</p>
        </Card>
      ) : (
        data.map((d, i) => (
          <DocRow
            key={d.id}
            doc={d}
            first={i === 0}
            last={i === data.length - 1}
            programs={catalog.data?.programs ?? []}
            levels={catalog.data?.levels ?? []}
            offerings={catalog.data?.offerings ?? []}
            courses={catalog.data?.courses ?? []}
            students={students.data?.items ?? []}
            onMove={(dir) => move(i, dir)}
            onDelete={() => setToDelete(d)}
            onUpload={(f) => stageUpload(d, f)}
            onView={() => viewCurrent(d)}
            onSaved={refresh}
          />
        ))
      )}

      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o && !publishing) {
            if (preview?.onPublish) URL.revokeObjectURL(preview.url);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && <LazyPdf url={preview.url} />}
          {preview?.onPublish && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                disabled={publishing}
                onClick={() => {
                  URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
              >
                إلغاء
              </Button>
              <Button variant="brand" disabled={publishing} onClick={publish}>
                {publishing ? <Loader2 className="animate-spin" /> : <Upload />} نشر الملف
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف «{toDelete?.title}»؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف التصنيف والملف المرفوع من قاعدة البيانات ووحدة التخزين نهائيًا.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocRow({
  doc,
  first,
  last,
  programs,
  levels,
  offerings,
  courses,
  students,
  onMove,
  onDelete,
  onUpload,
  onView,
  onSaved,
}: {
  doc: Doc;
  first: boolean;
  last: boolean;
  programs: { id: string; name_ar: string }[];
  levels: { id: string; name_ar: string; program_id: string }[];
  offerings: { id: string; course_id: string }[];
  courses: { id: string; code: string; name: string }[];
  students: { user_id: string; full_name_ar: string; student_code: string | null }[];
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
  onUpload: (f: File) => void;
  onView: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(doc.title);
  const [desc, setDesc] = useState(doc.description ?? "");
  const [audience, setAudience] = useState<AudienceScope>(doc.audience_scope);
  const [programId, setProgramId] = useState<string>(doc.program_id ?? "");
  const [levelId, setLevelId] = useState<string>(doc.level_id ?? "");
  const [targetStudentId, setTargetStudentId] = useState<string>(doc.target_student_user_id ?? "");
  const [offeringId, setOfferingId] = useState<string>(doc.offering_id ?? "");
  const [category, setCategory] = useState<DocCategory>((doc.doc_category as DocCategory) || "general");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    title !== doc.title ||
    desc !== (doc.description ?? "") ||
    audience !== doc.audience_scope ||
    (programId || null) !== doc.program_id ||
    (levelId || null) !== doc.level_id ||
    (targetStudentId || null) !== doc.target_student_user_id ||
    (offeringId || null) !== doc.offering_id ||
    category !== doc.doc_category;

  async function save() {
    if (!title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSaving(true);
    try {
      await updateDocumentFields(doc.id, {
        title: title.trim().slice(0, 200),
        description: desc.trim().slice(0, 1000) || null,
        audience_scope: audience,
        program_id: audience === "program" ? programId || null : null,
        level_id: audience === "level" ? levelId || null : null,
        target_student_user_id: audience === "student" ? targetStudentId || null : null,
        offering_id: offeringId || null,
        doc_category: category,
      });
      await onSaved();
      toast.success("تم حفظ التعديلات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(v: boolean) {
    setToggling(true);
    try {
      await updateDocumentFields(doc.id, { is_available: v });
      await onSaved();
      toast.success(v ? "الملف متاح للطلاب المستهدفين الآن" : "تم إخفاء الملف عن الطلاب");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تغيير الحالة");
    } finally {
      setToggling(false);
    }
  }

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return (
    <Card>
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex gap-1 lg:flex-col">
          <Button size="icon" variant="ghost" aria-label="تحريك لأعلى" disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button size="icon" variant="ghost" aria-label="تحريك لأسفل" disabled={last} onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
        </div>

        <div className="flex-1 space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="font-semibold" aria-label="عنوان الملف" />
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="وصف الملف"
            aria-label="وصف الملف"
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">الفئة المستهدفة</label>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value as AudienceScope)}
              >
                {(Object.keys(AUDIENCE_LABEL) as AudienceScope[]).map((k) => (
                  <option key={k} value={k}>
                    {AUDIENCE_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>

            {audience === "program" && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">البرنامج</label>
                <select
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                >
                  <option value="">اختر البرنامج</option>
                  {programs.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name_ar}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audience === "level" && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">المستوى الأكاديمي</label>
                <select
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  value={levelId}
                  onChange={(e) => setLevelId(e.target.value)}
                >
                  <option value="">اختر المستوى</option>
                  {levels.map((lv) => (
                    <option key={lv.id} value={lv.id}>
                      {lv.name_ar}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audience === "student" && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">الطالب المستهدف</label>
                <select
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                >
                  <option value="">اختر الطالب</option>
                  {students.map((st) => (
                    <option key={st.user_id} value={st.user_id}>
                      {st.student_code ? `${st.student_code} — ` : ""}
                      {st.full_name_ar}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">التصنيف</label>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocCategory)}
              >
                <option value="general">وثيقة عامة</option>
                <option value="study_material">مادة دراسية</option>
                <option value="schedule">جدول</option>
                <option value="exam">امتحانات</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">مرتبط بمقرر (اختياري)</label>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={offeringId}
                onChange={(e) => setOfferingId(e.target.value)}
              >
                <option value="">بدون ربط بمقرر</option>
                {offerings.map((o) => {
                  const crs = courseMap.get(o.course_id);
                  return (
                    <option key={o.id} value={o.id}>
                      {crs ? `${crs.code} — ${crs.name}` : o.id}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            {doc.file_path ? (
              <span className="font-mono text-xs" dir="ltr">
                {doc.file_name} · {formatSize(doc.file_size)}
              </span>
            ) : (
              <span className="text-muted-foreground">لم يتم رفع ملف PDF بعد</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap content-start items-center gap-2 lg:w-64 lg:flex-col lg:items-stretch">
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            {doc.is_available ? "متاح للطلاب" : "مخفي"}
            <Switch checked={doc.is_available} disabled={toggling} onCheckedChange={toggle} />
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
          <Button variant="soft" onClick={() => fileRef.current?.click()}>
            <Upload /> {doc.file_path ? "استبدال الملف" : "رفع ملف"}
          </Button>
          {doc.file_path && (
            <Button variant="outline" onClick={onView}>
              <Eye /> معاينة
            </Button>
          )}
          <Button variant="brand" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} حفظ
          </Button>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 /> حذف
          </Button>
        </div>
      </div>
    </Card>
  );
}
