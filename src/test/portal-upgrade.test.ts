import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isPdfMagicHeader,
  matchesStudentAudience,
  requireActiveStudentServer,
  requireAdminServer,
  sanitizePdfFilename,
} from "@/lib/auth.server";
import {
  fetchAllDocuments,
  uploadAndPublishDocument,
  uploadPrivateStudentDocument,
  validatePdfFileClient,
} from "@/lib/documents-storage";

const mockFrom = vi.fn();
const mockGetUserById = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageUploadToSignedUrl = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      admin: {
        getUserById: (...args: unknown[]) => mockGetUserById(...args),
      },
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockStorageUpload(...args),
        uploadToSignedUrl: (...args: unknown[]) => mockStorageUploadToSignedUrl(...args),
      }),
    },
  },
}));

const mockPrepare = vi.fn();
const mockCommitShared = vi.fn();
const mockCommitPrivate = vi.fn();
const mockCleanupOrphan = vi.fn();
const mockAdminListDocs = vi.fn();

vi.mock("@/lib/documents.functions", () => ({
  adminListDocuments: (...args: unknown[]) => mockAdminListDocs(...args),
  adminCleanupOrphanUpload: (...args: unknown[]) => mockCleanupOrphan(...args),
  adminPreparePdfUpload: (...args: unknown[]) => mockPrepare(...args),
  adminCommitSharedUpload: (...args: unknown[]) => mockCommitShared(...args),
  adminCommitPrivateStudentUpload: (...args: unknown[]) => mockCommitPrivate(...args),
  adminCreateDocument: vi.fn(),
  adminDeleteDocument: vi.fn(),
  adminDeletePrivateStudentDocument: vi.fn(),
  adminReorderDocuments: vi.fn(),
  adminUpdateDocument: vi.fn(),
  adminUpdatePrivateStudentDocument: vi.fn(),
  getAuthorizedDocumentUrl: vi.fn(),
}));

describe("Security, RBAC, and audience rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates PDF magic headers and rejects executables/HTML", () => {
    expect(isPdfMagicHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(isPdfMagicHeader(new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x00]))).toBe(false); // MZ executable
    expect(isPdfMagicHeader(new TextEncoder().encode("<html>"))).toBe(false);
  });

  it("sanitizes filenames safely and appends .pdf", () => {
    expect(sanitizePdfFilename("../../secret\\doc?.exe")).toBe(".._.._secret_doc_.exe.pdf");
    expect(sanitizePdfFilename("transcript.pdf")).toBe("transcript.pdf");
  });

  it("enforces audience targeting so Student A cannot access Student B items", () => {
    const studentA = { user_id: "user-a", program_id: "prog-1", level_id: "lvl-2" };

    expect(
      matchesStudentAudience(
        { audience_scope: "all", program_id: null, level_id: null, target_student_user_id: null },
        studentA,
      ),
    ).toBe(true);
    expect(
      matchesStudentAudience(
        { audience_scope: "student", program_id: null, level_id: null, target_student_user_id: "user-b" },
        studentA,
      ),
    ).toBe(false);
    expect(
      matchesStudentAudience(
        { audience_scope: "student", program_id: null, level_id: null, target_student_user_id: "user-a" },
        studentA,
      ),
    ).toBe(true);
    expect(
      matchesStudentAudience(
        { audience_scope: "program", program_id: "prog-2", level_id: null, target_student_user_id: null },
        studentA,
      ),
    ).toBe(false);
    expect(
      matchesStudentAudience(
        { audience_scope: "level", program_id: null, level_id: "lvl-2", target_student_user_id: null },
        studentA,
      ),
    ).toBe(true);
  });

  it("rejects non-admin callers in requireAdminServer", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: async () => ({ data: [{ role: "student" }], error: null }),
      }),
    });

    await expect(requireAdminServer("student-user-id")).rejects.toThrow(/Forbidden/);
  });

  it("allows verified admins in requireAdminServer", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: async () => ({ data: [{ role: "admin" }], error: null }),
      }),
    });
    mockGetUserById.mockResolvedValue({ data: { user: { email: "admin@hnu.edu.eg" } } });

    await expect(requireAdminServer("admin-id")).resolves.toEqual({
      userId: "admin-id",
      actorLabel: "admin@hnu.edu.eg",
    });
  });

  it("blocks pending and suspended students in requireActiveStudentServer", async () => {
    for (const status of ["pending", "suspended", "rejected"] as const) {
      mockFrom.mockImplementation((table: string) => {
        if (table === "user_roles") {
          return { select: () => ({ eq: async () => ({ data: [{ role: "student" }], error: null }) }) };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { user_id: "stu-1", account_status: status },
                error: null,
              }),
            }),
          }),
        };
      });

      await expect(requireActiveStudentServer("stu-1")).rejects.toThrow(/Forbidden/);
    }
  });
});

describe("Document upload failure handling (no fake success)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-PDF files on the client before any upload attempt", () => {
    const file = new File(["hello"], "malware.exe", { type: "application/octet-stream" });
    expect(() => validatePdfFileClient(file)).toThrow(/PDF/);
  });

  it("throws when storage upload fails instead of reporting success", async () => {
    mockPrepare.mockResolvedValue({
      bucket: "student-documents",
      storagePath: "docs/11111111-1111-1111-1111-111111111111/test.pdf",
      safeFileName: "test.pdf",
      previousPath: null,
    });
    mockStorageUpload.mockResolvedValue({ error: { message: "Storage quota error" } });

    const pdf = new File(["%PDF-1.4\n"], "test.pdf", { type: "application/pdf" });
    await expect(uploadAndPublishDocument("11111111-1111-1111-1111-111111111111", pdf)).rejects.toThrow(
      /Storage quota error/,
    );
    expect(mockCommitShared).not.toHaveBeenCalled();
  });

  it("throws when DB commit fails after storage upload and requests orphan cleanup", async () => {
    mockPrepare.mockResolvedValue({
      bucket: "student-documents",
      storagePath: "docs/11111111-1111-1111-1111-111111111111/test.pdf",
      safeFileName: "test.pdf",
      previousPath: "docs/11111111-1111-1111-1111-111111111111/old.pdf",
      uploadToken: "signed-upload-token",
    });
    mockStorageUploadToSignedUrl.mockResolvedValue({ error: null });
    mockCommitShared.mockRejectedValue(new Error("DB write failed"));
    mockCleanupOrphan.mockResolvedValue({ ok: true });

    const pdf = new File(["%PDF-1.4\n"], "test.pdf", { type: "application/pdf" });
    await expect(uploadAndPublishDocument("11111111-1111-1111-1111-111111111111", pdf)).rejects.toThrow(
      /DB write failed/,
    );
    expect(mockStorageUploadToSignedUrl).toHaveBeenCalledWith(
      "docs/11111111-1111-1111-1111-111111111111/test.pdf",
      "signed-upload-token",
      pdf,
      { contentType: "application/pdf" },
    );
    expect(mockCleanupOrphan).toHaveBeenCalledWith({
      data: {
        kind: "shared",
        storagePath: "docs/11111111-1111-1111-1111-111111111111/test.pdf",
      },
    });
  });

  it("completes shared replacement upload via signed token and returns DB record", async () => {
    const savedDoc = {
      id: "11111111-1111-1111-1111-111111111111",
      file_path: "docs/11111111-1111-1111-1111-111111111111/new.pdf",
      file_name: "new.pdf",
      file_size: 9,
    };
    mockPrepare.mockResolvedValue({
      bucket: "student-documents",
      storagePath: savedDoc.file_path,
      safeFileName: "new.pdf",
      previousPath: "docs/11111111-1111-1111-1111-111111111111/old.pdf",
      uploadToken: "signed-token-2",
    });
    mockStorageUploadToSignedUrl.mockResolvedValue({ error: null });
    mockCommitShared.mockResolvedValue(savedDoc);

    const pdf = new File(["%PDF-1.4\n"], "new.pdf", { type: "application/pdf" });
    await expect(uploadAndPublishDocument(savedDoc.id, pdf)).resolves.toEqual(savedDoc);
    expect(mockCommitShared).toHaveBeenCalledWith({
      data: {
        docId: savedDoc.id,
        storagePath: savedDoc.file_path,
        fileName: "new.pdf",
        fileSize: pdf.size,
        previousPath: "docs/11111111-1111-1111-1111-111111111111/old.pdf",
      },
    });
    expect(mockCleanupOrphan).not.toHaveBeenCalled();
  });

  it("cleans up private orphan upload when DB commit fails", async () => {
    mockPrepare.mockResolvedValue({
      bucket: "private-student-documents",
      storagePath: "students/22222222-2222-2222-2222-222222222222/private.pdf",
      safeFileName: "private.pdf",
      previousPath: null,
      uploadToken: "priv-token",
    });
    mockStorageUploadToSignedUrl.mockResolvedValue({ error: null });
    mockCommitPrivate.mockRejectedValue(new Error("Private DB insert failed"));
    mockCleanupOrphan.mockResolvedValue({ ok: true });

    const pdf = new File(["%PDF-1.4\n"], "private.pdf", { type: "application/pdf" });
    await expect(
      uploadPrivateStudentDocument({
        studentUserId: "22222222-2222-2222-2222-222222222222",
        title: "إفادة قيد",
        file: pdf,
      }),
    ).rejects.toThrow(/Private DB insert failed/);
    expect(mockCleanupOrphan).toHaveBeenCalledWith({
      data: {
        kind: "private",
        storagePath: "students/22222222-2222-2222-2222-222222222222/private.pdf",
      },
    });
  });

  it("loads canonical admin document list through server function", async () => {
    const docs = [{ id: "doc-1", title: "جدول" }];
    mockAdminListDocs.mockResolvedValue(docs);
    await expect(fetchAllDocuments()).resolves.toEqual(docs);
    expect(mockAdminListDocs).toHaveBeenCalledTimes(1);
  });
});
