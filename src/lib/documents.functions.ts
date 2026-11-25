import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TablesUpdate } from "@/integrations/supabase/types";

export const SHARED_BUCKET = "student-documents";
export const PRIVATE_BUCKET = "private-student-documents";
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 180;

const audienceSchema = z.enum(["all", "program", "level", "student"]);
const categorySchema = z.enum(["general", "study_material", "schedule", "exam"]);

const createDocumentSchema = z.object({
  title: z.string().trim().min(1, "عنوان الملف مطلوب").max(200),
  description: z.string().trim().max(1000).optional().default(""),
  audience_scope: audienceSchema.optional().default("all"),
  program_id: z.string().uuid().nullable().optional().default(null),
  level_id: z.string().uuid().nullable().optional().default(null),
  target_student_user_id: z.string().uuid().nullable().optional().default(null),
  offering_id: z.string().uuid().nullable().optional().default(null),
  doc_category: categorySchema.optional().default("general"),
  is_available: z.boolean().optional().default(true),
});

function validateAudienceTargets(input: {
  audience_scope: "all" | "program" | "level" | "student";
  program_id?: string | null | undefined;
  level_id?: string | null | undefined;
  target_student_user_id?: string | null | undefined;
}) {
  if (input.audience_scope === "program" && !input.program_id) {
    throw new Error("يرجى اختيار البرنامج الأكاديمي المستهدف");
  }
  if (input.audience_scope === "level" && !input.level_id) {
    throw new Error("يرجى اختيار المستوى الأكاديمي المستهدف");
  }
  if (input.audience_scope === "student" && !input.target_student_user_id) {
    throw new Error("يرجى اختيار الطالب المستهدف");
  }
}

export const adminListDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message || "تعذر جلب قائمة الملفات من الخادم");
    }
    return data ?? [];
  });

export const adminCreateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createDocumentSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    validateAudienceTargets(data);

    const { data: existing } = await supabaseAdmin
      .from("documents")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const { data: created, error } = await supabaseAdmin
      .from("documents")
      .insert({
        title: data.title,
        description: data.description || null,
        audience_scope: data.audience_scope,
        program_id: data.audience_scope === "program" ? data.program_id : null,
        level_id: data.audience_scope === "level" ? data.level_id : null,
        target_student_user_id: data.audience_scope === "student" ? data.target_student_user_id : null,
        offering_id: data.offering_id,
        doc_category: data.doc_category,
        is_available: data.is_available,
        sort_order: nextOrder,
      })
      .select("*")
      .single();

    if (error || !created) {
      throw new Error(error?.message || "تعذر إنشاء تصنيف الملف في قاعدة البيانات");
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "create_document",
      entityType: "documents",
      entityId: created.id,
      metadata: { title: created.title, audience_scope: created.audience_scope },
    });

    return created;
  });

const updateDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  is_available: z.boolean().optional(),
  audience_scope: audienceSchema.optional(),
  program_id: z.string().uuid().nullable().optional(),
  level_id: z.string().uuid().nullable().optional(),
  target_student_user_id: z.string().uuid().nullable().optional(),
  offering_id: z.string().uuid().nullable().optional(),
  doc_category: categorySchema.optional(),
});

export const adminUpdateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateDocumentSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { id, ...fields } = data;
    const patch: TablesUpdate<"documents"> = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.is_available !== undefined) patch.is_available = fields.is_available;
    if (fields.doc_category !== undefined) patch.doc_category = fields.doc_category;
    if (fields.offering_id !== undefined) patch.offering_id = fields.offering_id;
    if (fields.audience_scope !== undefined) {
      const { data: existingDoc } = await supabaseAdmin
        .from("documents")
        .select("program_id, level_id, target_student_user_id")
        .eq("id", id)
        .maybeSingle();

      const resolvedProgramId =
        fields.program_id !== undefined ? fields.program_id : (existingDoc?.program_id ?? null);
      const resolvedLevelId =
        fields.level_id !== undefined ? fields.level_id : (existingDoc?.level_id ?? null);
      const resolvedTargetStudentId =
        fields.target_student_user_id !== undefined
          ? fields.target_student_user_id
          : (existingDoc?.target_student_user_id ?? null);

      validateAudienceTargets({
        audience_scope: fields.audience_scope,
        program_id: resolvedProgramId,
        level_id: resolvedLevelId,
        target_student_user_id: resolvedTargetStudentId,
      });

      patch.audience_scope = fields.audience_scope;
      patch.program_id = fields.audience_scope === "program" ? (resolvedProgramId ?? null) : null;
      patch.level_id = fields.audience_scope === "level" ? (resolvedLevelId ?? null) : null;
      patch.target_student_user_id =
        fields.audience_scope === "student" ? (resolvedTargetStudentId ?? null) : null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("documents")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) {
      throw new Error(error?.message || "تعذر تحديث بيانات الملف");
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "update_document",
      entityType: "documents",
      entityId: updated.id,
      metadata: { title: updated.title, is_available: updated.is_available },
    });

    return updated;
  });

const prepareUploadSchema = z.object({
  kind: z.enum(["shared", "private"]),
  docId: z.string().uuid().optional(),
  studentUserId: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.number().int().positive().max(MAX_PDF_BYTES, "الحد الأقصى لحجم الملف 20 ميجابايت"),
  contentType: z.string().trim().optional(),
});

export const adminPreparePdfUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => prepareUploadSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer, sanitizePdfFilename } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const safeName = sanitizePdfFilename(data.fileName);
    if (data.contentType && data.contentType !== "application/pdf" && !safeName.toLowerCase().endsWith(".pdf")) {
      throw new Error("يُسمح بملفات PDF فقط");
    }

    if (data.kind === "shared") {
      if (!data.docId) throw new Error("معرف المستند مطلوب");
      const { data: existingDoc, error } = await supabaseAdmin
        .from("documents")
        .select("id, file_path")
        .eq("id", data.docId)
        .maybeSingle();
      if (error || !existingDoc) throw new Error("لم يتم العثور على سجل المستند");

      const storagePath = `docs/${data.docId}/${crypto.randomUUID()}.pdf`;
      const { data: signedUpload, error: signErr } = await supabaseAdmin.storage
        .from(SHARED_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: false });

      if (signErr || !signedUpload?.token) {
        throw new Error(signErr?.message || "تعذر تهيئة رابط الرفع في وحدة التخزين");
      }

      return {
        bucket: SHARED_BUCKET,
        storagePath,
        safeFileName: safeName,
        previousPath: existingDoc.file_path,
        uploadToken: signedUpload.token,
      };
    }

    if (!data.studentUserId) throw new Error("معرف الطالب مطلوب");
    const { data: studentProfile, error: stuErr } = await supabaseAdmin
      .from("student_profiles")
      .select("user_id")
      .eq("user_id", data.studentUserId)
      .maybeSingle();
    if (stuErr || !studentProfile) throw new Error("لم يتم العثور على ملف الطالب");

    const storagePath = `students/${data.studentUserId}/${crypto.randomUUID()}.pdf`;
    const { data: signedUpload, error: signErr } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signErr || !signedUpload?.token) {
      throw new Error(signErr?.message || "تعذر تهيئة رابط رفع الملف الخاص في وحدة التخزين");
    }

    return {
      bucket: PRIVATE_BUCKET,
      storagePath,
      safeFileName: safeName,
      previousPath: null,
      uploadToken: signedUpload.token,
    };
  });

const commitSharedUploadSchema = z.object({
  docId: z.string().uuid(),
  storagePath: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.number().int().positive().max(MAX_PDF_BYTES),
  previousPath: z.string().nullable().optional(),
});

async function verifyUploadedPdfInStorage(bucket: string, storagePath: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isPdfMagicHeader } = await import("./auth.server");

  let head: Uint8Array | null = null;
  const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 60);
  if (signed?.signedUrl) {
    try {
      const resp = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-7" } });
      if (resp.ok || resp.status === 206) {
        head = new Uint8Array(await resp.arrayBuffer());
      }
    } catch {
      // Fall back to direct Storage download check
    }
  }

  if (!head) {
    const { data: blob, error } = await supabaseAdmin.storage.from(bucket).download(storagePath);
    if (error || !blob) {
      throw new Error("تعذر التحقق من وجود الملف المرفوع في وحدة التخزين");
    }
    head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  }

  if (!isPdfMagicHeader(head)) {
    await supabaseAdmin.storage.from(bucket).remove([storagePath]).catch(() => {});
    throw new Error("الملف المرفوع ليس ملف PDF صالحًا");
  }
}

export const adminCleanupOrphanUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["shared", "private"]),
        storagePath: z.string().trim().min(1).max(400),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    if (data.kind === "shared") {
      if (!data.storagePath.startsWith("docs/")) return { ok: false as const };
      const { data: ref } = await supabaseAdmin
        .from("documents")
        .select("id")
        .eq("file_path", data.storagePath)
        .maybeSingle();
      if (ref) return { ok: false as const };
      await supabaseAdmin.storage.from(SHARED_BUCKET).remove([data.storagePath]).catch(() => {});
      return { ok: true as const };
    }

    if (!data.storagePath.startsWith("students/")) return { ok: false as const };
    const { data: ref } = await supabaseAdmin
      .from("student_documents")
      .select("id")
      .eq("file_path", data.storagePath)
      .maybeSingle();
    if (ref) return { ok: false as const };
    await supabaseAdmin.storage.from(PRIVATE_BUCKET).remove([data.storagePath]).catch(() => {});
    return { ok: true as const };
  });

export const adminCommitSharedUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => commitSharedUploadSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer, sanitizePdfFilename } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    if (!data.storagePath.startsWith(`docs/${data.docId}/`)) {
      throw new Error("مسار التخزين غير متطابق مع المستند");
    }

    await verifyUploadedPdfInStorage(SHARED_BUCKET, data.storagePath);

    const safeFileName = sanitizePdfFilename(data.fileName);
    const { data: updated, error: dbErr } = await supabaseAdmin
      .from("documents")
      .update({
        file_path: data.storagePath,
        file_name: safeFileName,
        file_size: data.fileSize,
      })
      .eq("id", data.docId)
      .select("*")
      .single();

    if (dbErr || !updated || updated.file_path !== data.storagePath) {
      await supabaseAdmin.storage.from(SHARED_BUCKET).remove([data.storagePath]).catch(() => {});
      throw new Error(dbErr?.message || "فشل حفظ بيانات الملف في قاعدة البيانات؛ تم التراجع عن الرفع");
    }

    // Safely remove previous Storage object ONLY after DB update succeeded
    if (
      data.previousPath &&
      data.previousPath !== data.storagePath &&
      !data.previousPath.startsWith("/") &&
      !data.previousPath.startsWith("idb:")
    ) {
      await supabaseAdmin.storage.from(SHARED_BUCKET).remove([data.previousPath]).catch(() => {});
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "upload_document",
      entityType: "documents",
      entityId: updated.id,
      metadata: { title: updated.title, file_name: safeFileName, file_size: data.fileSize },
    });

    return updated;
  });

const commitPrivateUploadSchema = z.object({
  studentUserId: z.string().uuid(),
  title: z.string().trim().min(1, "العنوان مطلوب").max(200),
  description: z.string().trim().max(1000).optional().default(""),
  storagePath: z.string().trim().min(1).max(400),
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.number().int().positive().max(MAX_PDF_BYTES),
  isAvailable: z.boolean().optional().default(true),
});

export const adminCommitPrivateStudentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => commitPrivateUploadSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer, sanitizePdfFilename } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    if (!data.storagePath.startsWith(`students/${data.studentUserId}/`)) {
      throw new Error("مسار التخزين غير متطابق مع الطالب");
    }

    await verifyUploadedPdfInStorage(PRIVATE_BUCKET, data.storagePath);

    const safeFileName = sanitizePdfFilename(data.fileName);
    const { data: created, error: dbErr } = await supabaseAdmin
      .from("student_documents")
      .insert({
        student_user_id: data.studentUserId,
        title: data.title,
        description: data.description || null,
        file_path: data.storagePath,
        file_name: safeFileName,
        file_size: data.fileSize,
        is_available: data.isAvailable,
        uploaded_by: admin.userId,
      })
      .select("*")
      .single();

    if (dbErr || !created || created.file_path !== data.storagePath) {
      await supabaseAdmin.storage.from(PRIVATE_BUCKET).remove([data.storagePath]).catch(() => {});
      throw new Error(dbErr?.message || "تعذر حفظ الملف الخاص بالطالب في قاعدة البيانات");
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "upload_student_document",
      entityType: "student_documents",
      entityId: created.id,
      metadata: { student_user_id: data.studentUserId, title: created.title },
    });

    return created;
  });

export const adminDeleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from("documents")
      .select("id, title, file_path")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr || !doc) throw new Error("المستند غير موجود");

    const { error: delErr } = await supabaseAdmin.from("documents").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message || "تعذر حذف سجل المستند");

    if (doc.file_path && !doc.file_path.startsWith("/") && !doc.file_path.startsWith("idb:")) {
      const { error: storageErr } = await supabaseAdmin.storage.from(SHARED_BUCKET).remove([doc.file_path]);
      if (storageErr) {
        console.error("[storage] Deleted DB row but failed to remove storage object:", storageErr);
      }
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_document",
      entityType: "documents",
      entityId: doc.id,
      metadata: { title: doc.title },
    });

    return { ok: true as const };
  });

export const adminUpdatePrivateStudentDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), is_available: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: updated, error } = await supabaseAdmin
      .from("student_documents")
      .update({ is_available: data.is_available })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !updated) throw new Error("تعذر تحديث حالة الملف");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "update_student_document",
      entityType: "student_documents",
      entityId: updated.id,
      metadata: { is_available: updated.is_available },
    });

    return updated;
  });

export const adminDeletePrivateStudentDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from("student_documents")
      .select("id, title, file_path, student_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !doc) throw new Error("الملف غير موجود");

    const { error: delErr } = await supabaseAdmin.from("student_documents").delete().eq("id", data.id);
    if (delErr) throw new Error("تعذر حذف سجل الملف");

    if (doc.file_path && !doc.file_path.startsWith("/")) {
      await supabaseAdmin.storage.from(PRIVATE_BUCKET).remove([doc.file_path]).catch(() => {});
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_student_document",
      entityType: "student_documents",
      entityId: doc.id,
      metadata: { title: doc.title, student_user_id: doc.student_user_id },
    });

    return { ok: true as const };
  });

export const adminReorderDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderedIds: z.array(z.string().uuid()).min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    for (let i = 0; i < data.orderedIds.length; i++) {
      const id = data.orderedIds[i]!;
      const { error } = await supabaseAdmin.from("documents").update({ sort_order: i + 1 }).eq("id", id);
      if (error) throw new Error("تعذر حفظ ترتيب الملفات");
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "reorder_documents",
      entityType: "documents",
      metadata: { count: data.orderedIds.length },
    });

    return { ok: true as const };
  });

const signedUrlRequestSchema = z.object({
  kind: z.enum(["shared", "private"]),
  docId: z.string().min(1).max(100),
  downloadName: z.string().trim().max(200).optional(),
  allowHidden: z.boolean().optional().default(false),
});

/**
 * Issues a short-lived signed URL ONLY after verifying authentication,
 * active student status / admin role, availability, and audience/ownership.
 */
export const getAuthorizedDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => signedUrlRequestSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      getUserRolesServer,
      matchesStudentAudience,
      requireActiveStudentServer,
    } = await import("./auth.server");

    const roles = await getUserRolesServer(context.userId);
    const isAdmin = roles.includes("admin");

    if (data.kind === "shared") {
      const { data: doc, error } = await supabaseAdmin
        .from("documents")
        .select("*")
        .eq("id", data.docId)
        .maybeSingle();

      if (error || !doc || !doc.file_path) {
        throw new Error("المستند غير موجود");
      }

      if (!isAdmin) {
        const student = await requireActiveStudentServer(context.userId);
        if (!doc.is_available) {
          throw new Error("هذا الملف غير متاح حاليًا");
        }
        if (!matchesStudentAudience(doc, student)) {
          throw new Error("غير مصرح لك بالوصول إلى هذا الملف");
        }
      } else if (!data.allowHidden && !doc.is_available) {
        throw new Error("هذا الملف مخفي حاليًا");
      }

      if (doc.file_path.startsWith("/") || doc.file_path.startsWith("documents/")) {
        return { url: doc.file_path.startsWith("/") ? doc.file_path : `/${doc.file_path}` };
      }

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(SHARED_BUCKET)
        .createSignedUrl(
          doc.file_path,
          SIGNED_URL_TTL_SECONDS,
          data.downloadName ? { download: data.downloadName } : undefined,
        );

      if (signErr || !signed?.signedUrl) {
        throw new Error("تعذر إنشاء رابط آمن للملف");
      }
      return { url: signed.signedUrl };
    }

    // Private student document
    const { data: pDoc, error: pErr } = await supabaseAdmin
      .from("student_documents")
      .select("*")
      .eq("id", data.docId)
      .maybeSingle();

    if (pErr || !pDoc || !pDoc.file_path) {
      throw new Error("الملف غير موجود");
    }

    if (!isAdmin) {
      const student = await requireActiveStudentServer(context.userId);
      if (pDoc.student_user_id !== student.user_id || !pDoc.is_available) {
        throw new Error("غير مصرح لك بالوصول إلى هذا الملف");
      }
    } else if (!data.allowHidden && !pDoc.is_available) {
      throw new Error("هذا الملف مخفي حاليًا");
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(
        pDoc.file_path,
        SIGNED_URL_TTL_SECONDS,
        data.downloadName ? { download: data.downloadName } : undefined,
      );

    if (signErr || !signed?.signedUrl) {
      throw new Error("تعذر إنشاء رابط آمن للملف");
    }
    return { url: signed.signedUrl };
  });
