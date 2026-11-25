import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import {
  adminCleanupOrphanUpload,
  adminCommitPrivateStudentUpload,
  adminCommitSharedUpload,
  adminCreateDocument,
  adminDeleteDocument,
  adminDeletePrivateStudentDocument,
  adminListDocuments,
  adminPreparePdfUpload,
  adminReorderDocuments,
  adminUpdateDocument,
  adminUpdatePrivateStudentDocument,
  getAuthorizedDocumentUrl,
} from "./documents.functions";

export type Doc = Tables<"documents">;
export type PrivateDoc = Tables<"student_documents">;
export type AudienceScope = Database["public"]["Enums"]["document_audience"];
export type DocCategory = "general" | "study_material" | "schedule" | "exam";

export const BUCKET = "student-documents";
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function validatePdfFileClient(file: File) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    throw new Error("يُسمح بملفات PDF فقط");
  }
  if (file.size <= 0) {
    throw new Error("الملف المحدد فارغ");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("الحد الأقصى لحجم الملف 20 ميجابايت");
  }
}

export async function fetchAllDocuments(): Promise<Doc[]> {
  return await adminListDocuments();
}

export async function createDocument(input: {
  title: string;
  description?: string;
  audience_scope?: AudienceScope;
  program_id?: string | null;
  level_id?: string | null;
  target_student_user_id?: string | null;
  offering_id?: string | null;
  doc_category?: DocCategory;
}): Promise<Doc> {
  return await adminCreateDocument({ data: input });
}

export async function updateDocumentFields(
  id: string,
  updates: {
    title?: string;
    description?: string | null;
    is_available?: boolean;
    audience_scope?: AudienceScope;
    program_id?: string | null;
    level_id?: string | null;
    target_student_user_id?: string | null;
    offering_id?: string | null;
    doc_category?: DocCategory;
  },
): Promise<Doc> {
  return await adminUpdateDocument({ data: { id, ...updates } });
}

async function uploadFileToPreparedBucket(
  prepared: { bucket: string; storagePath: string; uploadToken?: string },
  file: File,
  fallbackError: string,
) {
  const bucketClient = supabase.storage.from(prepared.bucket);
  const { error: uploadError } = prepared.uploadToken
    ? await bucketClient.uploadToSignedUrl(prepared.storagePath, prepared.uploadToken, file, {
        contentType: "application/pdf",
      })
    : await bucketClient.upload(prepared.storagePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

  if (uploadError) {
    throw new Error(uploadError.message || fallbackError);
  }
}

/**
 * Uploads a PDF to Supabase Storage, awaits verification and DB persistence,
 * and cleans up old or orphaned objects cleanly. Never reports success early.
 */
export async function uploadAndPublishDocument(docId: string, file: File): Promise<Doc> {
  validatePdfFileClient(file);

  const prepared = await adminPreparePdfUpload({
    data: {
      kind: "shared",
      docId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/pdf",
    },
  });

  await uploadFileToPreparedBucket(prepared, file, "فشل رفع الملف إلى وحدة التخزين");

  try {
    return await adminCommitSharedUpload({
      data: {
        docId,
        storagePath: prepared.storagePath,
        fileName: prepared.safeFileName,
        fileSize: file.size,
        previousPath: prepared.previousPath,
      },
    });
  } catch (commitError) {
    await adminCleanupOrphanUpload({
      data: { kind: "shared", storagePath: prepared.storagePath },
    }).catch(() => {});
    throw commitError;
  }
}

export async function uploadPrivateStudentDocument(input: {
  studentUserId: string;
  title: string;
  description?: string;
  file: File;
}): Promise<PrivateDoc> {
  validatePdfFileClient(input.file);

  const prepared = await adminPreparePdfUpload({
    data: {
      kind: "private",
      studentUserId: input.studentUserId,
      fileName: input.file.name,
      fileSize: input.file.size,
      contentType: input.file.type || "application/pdf",
    },
  });

  await uploadFileToPreparedBucket(prepared, input.file, "فشل رفع ملف الطالب الخاص");

  try {
    return await adminCommitPrivateStudentUpload({
      data: {
        studentUserId: input.studentUserId,
        title: input.title,
        description: input.description ?? "",
        storagePath: prepared.storagePath,
        fileName: prepared.safeFileName,
        fileSize: input.file.size,
        isAvailable: true,
      },
    });
  } catch (commitError) {
    await adminCleanupOrphanUpload({
      data: { kind: "private", storagePath: prepared.storagePath },
    }).catch(() => {});
    throw commitError;
  }
}

export async function togglePrivateStudentDocument(id: string, is_available: boolean) {
  return await adminUpdatePrivateStudentDocument({ data: { id, is_available } });
}

export async function deletePrivateStudentDocument(id: string) {
  return await adminDeletePrivateStudentDocument({ data: { id } });
}

export async function deleteDocumentRecord(doc: Pick<Doc, "id">): Promise<void> {
  await adminDeleteDocument({ data: { id: doc.id } });
}

export async function reorderDocumentList(list: Doc[]): Promise<void> {
  await adminReorderDocuments({ data: { orderedIds: list.map((d) => d.id) } });
}

export async function resolveDocumentUrl(
  docId: string,
  downloadName?: string,
  options?: { allowHidden?: boolean; kind?: "shared" | "private" },
): Promise<string> {
  if (!docId) throw new Error("معرف الملف غير محدد");
  const res = await getAuthorizedDocumentUrl({
    data: {
      kind: options?.kind ?? "shared",
      docId,
      downloadName,
      allowHidden: options?.allowHidden ?? false,
    },
  });
  return res.url;
}
