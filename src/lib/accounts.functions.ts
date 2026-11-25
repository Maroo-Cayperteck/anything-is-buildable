import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns authoritative server-verified roles and student onboarding/account status
 * for the currently authenticated Supabase user.
 */
export const getAuthAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getUserRolesServer } = await import("./auth.server");
    let client = context.supabase;
    if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      client = supabaseAdmin;
    }

    const roles = await getUserRolesServer(context.userId, client);
    const [{ data: profile, error: profileErr }, { data: regRequest }] = await Promise.all([
      client
        .from("student_profiles")
        .select("user_id, account_status, full_name_ar, student_code")
        .eq("user_id", context.userId)
        .maybeSingle(),
      client
        .from("registration_requests")
        .select("status, rejection_reason")
        .eq("auth_user_id", context.userId)
        .maybeSingle(),
    ]);

    let accountStatus = profile?.account_status ?? null;
    if (profileErr) {
      const msg = (profileErr.message ?? "").toLowerCase();
      const missingAccountStatusCol =
        profileErr.code === "42703" ||
        profileErr.code === "PGRST204" ||
        (msg.includes("account_status") && msg.includes("column"));
      if (missingAccountStatusCol) {
        const { data: legacyProfile } = await client
          .from("student_profiles")
          .select("user_id")
          .eq("user_id", context.userId)
          .maybeSingle();
        if (legacyProfile || roles.includes("student")) {
          accountStatus = "active";
        }
      }
    }

    return {
      userId: context.userId,
      roles,
      accountStatus,
      registrationStatus: regRequest?.status ?? null,
      rejectionReason: regRequest?.rejection_reason ?? null,
    };
  });

const registrationSchema = z.object({
  studentCode: z.string().trim().min(2, "يرجى إدخال الرقم الجامعي").max(40),
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صحيح").max(160),
  fullNameAr: z.string().trim().min(3, "يرجى إدخال الاسم الكامل بالعربية").max(160),
  fullNameEn: z.string().trim().max(160).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, "رقم الهاتف غير صالح")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["ذكر", "أنثى"]).optional(),
});

/**
 * Creates a pending student registration request after validating against the
 * admin-managed student_roster. Caller must be authenticated via Supabase Auth.
 */
export const submitRegistrationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registrationSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalizedEmail = data.email.trim().toLowerCase();
    const { data: userLookup, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr || !userLookup?.user?.email) {
      throw new Error("تعذر التحقق من حساب المصادقة");
    }
    if (userLookup.user.email.toLowerCase() !== normalizedEmail) {
      throw new Error("البريد الإلكتروني المدخل لا يطابق بريد الحساب المسجل");
    }

    const { data: roster, error: rosterErr } = await supabaseAdmin
      .from("student_roster")
      .select("*")
      .eq("student_code", data.studentCode)
      .eq("is_active", true)
      .maybeSingle();

    if (rosterErr) {
      throw new Error("تعذر التحقق من كشف الطلاب المؤهلين");
    }
    if (!roster || roster.approved_email.trim().toLowerCase() !== normalizedEmail) {
      throw new Error("الرقم الجامعي أو البريد الإلكتروني غير مدرج في كشف الطلاب المؤهلين");
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("student_profiles")
      .select("user_id")
      .eq("student_code", data.studentCode)
      .maybeSingle();
    if (existingProfile && existingProfile.user_id !== context.userId) {
      throw new Error("يوجد حساب مفعل بالفعل لهذا الرقم الجامعي");
    }

    const { data: existingByUser } = await supabaseAdmin
      .from("registration_requests")
      .select("id, status")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (existingByUser) {
      if (existingByUser.status === "pending") {
        return { ok: true as const, status: "pending" as const };
      }
      if (existingByUser.status === "active") {
        return { ok: true as const, status: "active" as const };
      }
      throw new Error("لا يمكن إعادة إرسال الطلب لهذا الحساب؛ يرجى مراجعة شؤون الطلاب");
    }

    const { data: existingByCode } = await supabaseAdmin
      .from("registration_requests")
      .select("id, status")
      .eq("student_code", data.studentCode)
      .in("status", ["pending", "active"])
      .maybeSingle();
    if (existingByCode) {
      throw new Error("يوجد طلب تسجيل قائم أو مقبول لهذا الرقم الجامعي");
    }

    const { error: insertErr } = await supabaseAdmin.from("registration_requests").insert({
      auth_user_id: context.userId,
      roster_id: roster.id,
      student_code: data.studentCode,
      email: normalizedEmail,
      full_name_ar: data.fullNameAr,
      full_name_en: data.fullNameEn?.trim() || roster.full_name_en || null,
      phone: data.phone?.trim() || null,
      gender: data.gender ?? null,
      status: "pending",
    });

    if (insertErr) {
      throw new Error("تعذر تسجيل طلب الانضمام");
    }

    return { ok: true as const, status: "pending" as const };
  });

const contactSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, "رقم الهاتف غير صالح")
    .nullable()
    .or(z.literal("")),
});

/**
 * Allows an active student to update ONLY their own permitted contact field (phone).
 * Official academic and identity columns cannot be modified by students.
 */
export const updateOwnContactInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireActiveStudentServer } = await import("./auth.server");

    await requireActiveStudentServer(context.userId);
    const cleanPhone = data.phone && data.phone.trim().length > 0 ? data.phone.trim() : null;

    const { data: updated, error } = await supabaseAdmin
      .from("student_profiles")
      .update({ phone: cleanPhone })
      .eq("user_id", context.userId)
      .select("*")
      .single();

    if (error || !updated) {
      throw new Error("تعذر حفظ رقم الهاتف");
    }

    return updated;
  });
