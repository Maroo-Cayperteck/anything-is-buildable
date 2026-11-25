import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Doc = Tables<"documents">;

export const BUCKET = "student-documents";
const DOCS_STORAGE_KEY = "hnu_portal_documents_v2";

export const INITIAL_DOCUMENTS: Doc[] = [
  {
    id: "doc-1",
    title: "طلب الالتحاق الخاص بالطالب",
    description: "نموذج طلب الالتحاق المقدم إلى كلية الهندسة — جامعة حلوان الأهلية",
    file_path: "/documents/admission-application.pdf",
    file_name: "CamScanner 10-22-2026 17.58(3).pdf",
    file_size: 45279,
    is_available: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "doc-2",
    title: "جدول الحضور الخاص بالطالب",
    description: "الجدول الأسبوعي للمحاضرات والسكاشن — الفصل الدراسي الأول",
    file_path: "/documents/attendance-schedule.pdf",
    file_name: "NCSE_Schedule_First_Semester_2026-2027_Level 1-1 (3).pdf",
    file_size: 389368,
    is_available: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "doc-3",
    title: "جدول امتحانات منتصف الفصل الدراسي الأول",
    description: "مواعيد اختبارات منتصف الفصل الدراسي الأول 2026/2027",
    file_path: "/documents/midterm-exam-schedule.pdf",
    file_name: "جدول اختبارات منتصف الفصل الدراسي الاول.pdf",
    file_size: 212885,
    is_available: true,
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// --- IndexedDB for PDF binary files ---
const DB_NAME = "hnu_portal_db";
const DB_VERSION = 1;
const STORE_NAME = "pdf_files";

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function storePdfBlob(docId: string, file: Blob): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(file, docId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getPdfBlob(docId: string): Promise<Blob | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deletePdfBlob(docId: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(docId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// --- Local Document Metadata Storage ---
export function getLocalDocuments(): Doc[] {
  if (typeof window === "undefined") return INITIAL_DOCUMENTS;
  try {
    const raw = localStorage.getItem(DOCS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(INITIAL_DOCUMENTS));
      return INITIAL_DOCUMENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_DOCUMENTS;
    }
    // Self-healing: if an entry has missing file_path, merge server file_path from INITIAL_DOCUMENTS
    const healed = parsed.map((doc: Doc) => {
      if (!doc.file_path) {
        const init = INITIAL_DOCUMENTS.find((d) => d.id === doc.id);
        if (init?.file_path) {
          return {
            ...doc,
            file_path: init.file_path,
            file_name: doc.file_name || init.file_name,
            file_size: doc.file_size || init.file_size,
          };
        }
      }
      return doc;
    });
    return healed;
  } catch {
    return INITIAL_DOCUMENTS;
  }
}

export function saveLocalDocuments(docs: Doc[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(docs));
  } catch (err) {
    // If quota is exceeded, try to save a minimal version (just metadata, no large fields)
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      try {
        // Store minimal document list without large data
        const minimal = docs.map((d) => ({ ...d, description: d.description?.slice(0, 100) }));
        localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(minimal));
      } catch {
        console.warn("localStorage quota exceeded even for minimal documents", err);
      }
    } else {
      console.warn("Failed to persist documents to localStorage", err);
    }
  }
}

// Helper to prevent hanging Supabase network requests from blocking the UI
function withTimeout<T>(promise: PromiseLike<T>, ms = 1200): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Supabase timeout")), ms)),
  ]);
}

// --- High-level CRUD operations that work offline and with Supabase ---

export async function fetchAllDocuments(): Promise<Doc[]> {
  const local = getLocalDocuments();
  try {
    const res = await withTimeout(
      supabase.from("documents").select("*").order("sort_order"),
      1000,
    );
    if (!res.error && res.data && res.data.length > 0) {
      saveLocalDocuments(res.data);
      return res.data;
    }
  } catch {
    // Supabase unavailable / hanging; return local documents immediately
  }
  return local;
}

export async function createDocument(title = "ملف جديد", description = ""): Promise<Doc> {
  const local = getLocalDocuments();
  const max = Math.max(0, ...local.map((d) => d.sort_order));
  const newDoc: Doc = {
    id: "doc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    title: title.trim().slice(0, 200),
    description: description.trim().slice(0, 1000),
    file_path: null,
    file_name: null,
    file_size: null,
    is_available: true,
    sort_order: max + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const updated = [...local, newDoc];
  saveLocalDocuments(updated);

  // Sync to Supabase in background, never block UI
  withTimeout(
    supabase.from("documents").insert({
      id: newDoc.id,
      title: newDoc.title,
      description: newDoc.description,
      sort_order: newDoc.sort_order,
      is_available: newDoc.is_available,
    }),
    1200,
  ).catch(() => {});

  return newDoc;
}

export async function updateDocumentFields(id: string, updates: Partial<Doc>): Promise<Doc | null> {
  const local = getLocalDocuments();
  const idx = local.findIndex((d) => d.id === id);
  if (idx === -1) return null;

  const current = local[idx];
  if (!current) return null;

  const merged: Doc = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  local[idx] = merged;
  saveLocalDocuments(local);

  // Sync to Supabase in background, never block UI
  withTimeout(supabase.from("documents").update(updates).eq("id", id), 1200).catch(() => {});

  return merged;
}

export async function uploadAndPublishDocument(docId: string, file: File): Promise<Doc | null> {
  // Always store blob locally in IndexedDB first so viewing/downloading always works instantly
  await storePdfBlob(docId, file);
  const filePath = `idb:${docId}`;

  const updated = await updateDocumentFields(docId, {
    file_path: filePath,
    file_name: file.name,
    file_size: file.size,
  });

  // Try uploading to Supabase Storage in the background with timeout
  withTimeout(
    (async () => {
      const remotePath = `docs/${docId}/${Date.now()}.pdf`;
      const up = await supabase.storage.from(BUCKET).upload(remotePath, file, { contentType: "application/pdf" });
      if (!up.error) {
        await supabase
          .from("documents")
          .update({ file_path: remotePath, file_name: file.name, file_size: file.size })
          .eq("id", docId);
      }
    })(),
    2000,
  ).catch(() => {});

  return updated;
}

export async function deleteDocumentRecord(doc: Doc): Promise<void> {
  await deletePdfBlob(doc.id);
  const local = getLocalDocuments().filter((d) => d.id !== doc.id);
  saveLocalDocuments(local);

  withTimeout(
    (async () => {
      if (doc.file_path && !doc.file_path.startsWith("idb:")) {
        await supabase.storage.from(BUCKET).remove([doc.file_path]);
      }
      await supabase.from("documents").delete().eq("id", doc.id);
    })(),
    1200,
  ).catch(() => {});
}

export async function reorderDocumentList(list: Doc[]): Promise<void> {
  const withOrder = list.map((doc, idx) => ({ ...doc, sort_order: idx + 1 }));
  saveLocalDocuments(withOrder);

  withTimeout(
    Promise.all(withOrder.map((d) => supabase.from("documents").update({ sort_order: d.sort_order }).eq("id", d.id))),
    1200,
  ).catch(() => {});
}

/**
 * Checks whether the document identified by docId or storage path is currently available.
 * Hidden documents (is_available === false) must NOT be served to students.
 */
export function isDocumentAvailable(docId: string): boolean {
  const docs = getLocalDocuments();
  const doc = docs.find((d) => d.id === docId);
  if (!doc) return false;
  return doc.is_available;
}

function isDocumentAvailableByPathOrId(path: string, docId?: string): boolean {
  const docs = getLocalDocuments();
  const normalizedPath = path.startsWith("documents/") ? `/${path}` : path;
  const doc = docId
    ? docs.find((d) => d.id === docId)
    : docs.find((d) => d.file_path === path || d.file_path === normalizedPath);
  if (!doc) return false;
  return doc.is_available;
}

async function verifyRemoteAvailability(path: string, docId?: string): Promise<boolean> {
  try {
    const { data: sess } = await withTimeout(supabase.auth.getSession(), 800);
    if (!sess?.session) {
      return isDocumentAvailableByPathOrId(path, docId);
    }
    const query = docId
      ? supabase.from("documents").select("is_available").eq("id", docId).maybeSingle()
      : supabase.from("documents").select("is_available").eq("file_path", path).maybeSingle();
    const res = await withTimeout(query, 1000);
    if (!res.error) {
      return res.data?.is_available === true;
    }
  } catch {
    // Supabase unreachable — rely on local availability state
  }
  return isDocumentAvailableByPathOrId(path, docId);
}

export async function resolveDocumentUrl(
  path: string,
  downloadName?: string,
  docId?: string,
  options?: { allowHidden?: boolean },
): Promise<string> {
  if (!path) throw new Error("مسار الملف غير محدد");

  const allowHidden = options?.allowHidden === true;

  if (!allowHidden && !isDocumentAvailableByPathOrId(path, docId)) {
    throw new Error("هذا الملف غير متاح حاليًا");
  }

  const match = path.match(/docs\/([^/]+)\//);
  const idbDocId = path.startsWith("idb:") ? path.replace("idb:", "") : undefined;
  const extractedDocId = docId ?? idbDocId ?? match?.[1];

  if (!allowHidden) {
    const stillAvailable = await verifyRemoteAvailability(path, extractedDocId);
    if (!stillAvailable) {
      throw new Error("هذا الملف غير متاح حاليًا");
    }
  }

  if (path.startsWith("blob:") || path.startsWith("data:") || path.startsWith("/")) {
    return path;
  }

  if (path.startsWith("documents/")) {
    return `/${path}`;
  }

  if (idbDocId) {
    if (!allowHidden && !isDocumentAvailable(idbDocId)) {
      throw new Error("هذا الملف غير متاح حاليًا");
    }
    const blob = await getPdfBlob(idbDocId);
    if (blob) {
      return URL.createObjectURL(blob);
    }
    // Fallback if accessed on a different device (like mobile): check bundled server file
    const fallback = INITIAL_DOCUMENTS.find((d) => d.id === idbDocId);
    if (fallback?.file_path) {
      return fallback.file_path;
    }
    throw new Error("تعذر قراءة الملف المخزن");
  }

  // Fallback: check if the docId is in the path and stored in IndexedDB
  if (match?.[1]) {
    if (!allowHidden && !isDocumentAvailable(match[1])) {
      throw new Error("هذا الملف غير متاح حاليًا");
    }
    const blob = await getPdfBlob(match[1]);
    if (blob) return URL.createObjectURL(blob);
    const fallback = INITIAL_DOCUMENTS.find((d) => d.id === match[1]);
    if (fallback?.file_path) return fallback.file_path;
  }

  // Try remote Supabase signed URL with short TTL (5 minutes) and timeout
  try {
    const res = await withTimeout(
      supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 5, downloadName ? { download: downloadName } : undefined),
      1500,
    );
    if (!res.error && res.data?.signedUrl) return res.data.signedUrl;
  } catch {
    // fallback
  }

  // Final fallback to matching default document if available
  const finalFallback = INITIAL_DOCUMENTS.find((d) => d.file_path === path || (d.id && path.includes(d.id)));
  if (finalFallback?.file_path && (allowHidden || isDocumentAvailable(finalFallback.id))) {
    return finalFallback.file_path;
  }

  throw new Error("تعذر فتح أو تحميل الملف");
}
