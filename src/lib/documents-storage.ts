import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Doc = Tables<"documents">;

export const BUCKET = "student-documents";
const DOCS_STORAGE_KEY = "hnu_portal_documents_v1";

export const INITIAL_DOCUMENTS: Doc[] = [
  {
    id: "doc-1",
    title: "طلب الالتحاق الخاص بالطالب",
    description: "نموذج طلب الالتحاق المقدم إلى كلية الهندسة — جامعة حلوان الأهلية",
    file_path: null,
    file_name: null,
    file_size: null,
    is_available: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "doc-2",
    title: "جدول الحضور الخاص بالطالب",
    description: "الجدول الأسبوعي للمحاضرات والسكاشن — الفصل الدراسي الأول",
    file_path: null,
    file_name: null,
    file_size: null,
    is_available: true,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "doc-3",
    title: "جدول امتحانات منتصف الفصل الدراسي الأول",
    description: "مواعيد اختبارات منتصف الفصل الدراسي الأول 2026/2027",
    file_path: null,
    file_name: null,
    file_size: null,
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DOCUMENTS;
  } catch {
    return INITIAL_DOCUMENTS;
  }
}

export function saveLocalDocuments(docs: Doc[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(docs));
  } catch (err) {
    console.warn("Failed to persist documents to localStorage", err);
  }
}

// --- High-level CRUD operations that work offline and with Supabase ---

export async function fetchAllDocuments(): Promise<Doc[]> {
  try {
    const { data, error } = await supabase.from("documents").select("*").order("sort_order");
    if (!error && data && data.length > 0) {
      saveLocalDocuments(data);
      return data;
    }
  } catch {
    // ignore supabase error and use local
  }
  return getLocalDocuments();
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

  try {
    const { data, error } = await supabase.from("documents").insert({
      id: newDoc.id,
      title: newDoc.title,
      description: newDoc.description,
      sort_order: newDoc.sort_order,
      is_available: newDoc.is_available,
    }).select().maybeSingle();
    if (!error && data) {
      newDoc.id = data.id;
    }
  } catch {
    // continue with local id
  }

  const updated = [...local, newDoc];
  saveLocalDocuments(updated);
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

  try {
    await supabase.from("documents").update(updates).eq("id", id);
  } catch {
    // ignore
  }

  return merged;
}

export async function uploadAndPublishDocument(docId: string, file: File): Promise<Doc | null> {
  // Always store blob locally in IndexedDB first
  await storePdfBlob(docId, file);
  let filePath = `idb:${docId}`;

  // Try uploading to Supabase Storage if available
  try {
    const remotePath = `docs/${docId}/${Date.now()}.pdf`;
    const up = await supabase.storage.from(BUCKET).upload(remotePath, file, { contentType: "application/pdf" });
    if (!up.error) {
      filePath = remotePath;
    }
  } catch {
    // keep local idb path
  }

  const updated = await updateDocumentFields(docId, {
    file_path: filePath,
    file_name: file.name,
    file_size: file.size,
  });

  return updated;
}

export async function deleteDocumentRecord(doc: Doc): Promise<void> {
  await deletePdfBlob(doc.id);
  const local = getLocalDocuments().filter((d) => d.id !== doc.id);
  saveLocalDocuments(local);

  try {
    if (doc.file_path && !doc.file_path.startsWith("idb:")) {
      await supabase.storage.from(BUCKET).remove([doc.file_path]);
    }
    await supabase.from("documents").delete().eq("id", doc.id);
  } catch {
    // ignore
  }
}

export async function reorderDocumentList(list: Doc[]): Promise<void> {
  const withOrder = list.map((doc, idx) => ({ ...doc, sort_order: idx + 1 }));
  saveLocalDocuments(withOrder);

  try {
    await Promise.all(
      withOrder.map((d) => supabase.from("documents").update({ sort_order: d.sort_order }).eq("id", d.id)),
    );
  } catch {
    // ignore
  }
}

export async function resolveDocumentUrl(path: string, downloadName?: string): Promise<string> {
  if (!path) throw new Error("مسار الملف غير محدد");

  if (path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }

  if (path.startsWith("idb:")) {
    const docId = path.replace("idb:", "");
    const blob = await getPdfBlob(docId);
    if (!blob) throw new Error("تعذر قراءة الملف المخزن");
    return URL.createObjectURL(blob);
  }

  // Try remote Supabase signed URL
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 30, downloadName ? { download: downloadName } : undefined);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    // fallback
  }

  // Fallback: check if the docId is in the path and stored in IndexedDB
  const match = path.match(/docs\/([^/]+)\//);
  if (match?.[1]) {
    const blob = await getPdfBlob(match[1]);
    if (blob) return URL.createObjectURL(blob);
  }

  throw new Error("تعذر فتح أو تحميل الملف");
}
