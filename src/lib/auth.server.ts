import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type AccountStatus = Database["public"]["Enums"]["account_status"];

export async function getUserRolesServer(
  userId: string,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<AppRole[]> {
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    throw new Error("تعذر التحقق من صلاحيات الحساب");
  }
  return (data ?? []).map((row) => row.role);
}

export async function requireAdminServer(
  userId: string,
): Promise<{ userId: string; actorLabel: string }> {
  const roles = await getUserRolesServer(userId);
  if (!roles.includes("admin")) {
    throw new Error("Forbidden: تتطلب هذه العملية صلاحيات المسؤول");
  }
  let actorLabel = userId;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (data?.user?.email) actorLabel = data.user.email;
  } catch {
    // non-fatal label lookup
  }
  return { userId, actorLabel };
}

export async function requireActiveStudentServer(
  userId: string,
  client: SupabaseClient<Database> = supabaseAdmin,
) {
  const roles = await getUserRolesServer(userId, client);
  const { data: profile, error } = await client
    .from("student_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("تعذر التحقق من ملف الطالب");
  // If 0004_migration.sql has not added account_status yet, treat existing pre-migration rows as active;
  // once the column exists, strictly require account_status === "active".
  const accountStatus = profile && "account_status" in profile ? profile.account_status : "active";
  if (!roles.includes("student") || !profile || accountStatus !== "active") {
    throw new Error("Forbidden: الحساب غير نشط أو لا يملك صلاحية طالب معتمد");
  }
  return profile;
}

export async function logAdminActivity(params: {
  actorUserId: string;
  actorLabel?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, Json>;
}) {
  try {
    await supabaseAdmin.from("admin_activity_logs").insert({
      actor_user_id: params.actorUserId,
      actor_label: params.actorLabel ?? params.actorUserId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: (params.metadata ?? {}) as Json,
    });
  } catch (err) {
    console.error("[audit] Failed to record admin_activity_logs entry", err);
  }
}

export function sanitizePdfFilename(rawName: string): string {
  const base = rawName.replace(/[/\\?%*:|"<>]/g, "_").trim();
  const safe = base.length > 0 ? base.slice(0, 120) : "document.pdf";
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

export function isPdfMagicHeader(bytes: Uint8Array): boolean {
  // %PDF- -> 0x25 0x50 0x44 0x46 0x2D
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export function matchesStudentAudience(
  item: {
    audience_scope: Database["public"]["Enums"]["document_audience"];
    program_id: string | null;
    level_id: string | null;
    target_student_user_id: string | null;
  },
  student: { user_id: string; program_id: string | null; level_id: string | null },
): boolean {
  switch (item.audience_scope) {
    case "all":
      return true;
    case "student":
      return item.target_student_user_id === student.user_id;
    case "program":
      return Boolean(item.program_id && student.program_id === item.program_id);
    case "level":
      return Boolean(item.level_id && student.level_id === item.level_id);
    default:
      return false;
  }
}
