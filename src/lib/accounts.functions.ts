import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { usernameToEmail } from "./auth-helpers";

// Demo accounts are identified by a SHA-256 of "username:password" so the
// plain passwords never appear in source. On first matching login the account
// is provisioned server-side.
const DEMO_ACCOUNTS: Record<string, { role: "student" | "admin"; username: string }> = {
  "560db5cff851226e12ae4c5c4dfd2879a936af5a12989937b439ca0855b730e8": { role: "student", username: "30706232100316" },
  e146ef6fea917aac134d7e7899ab463c32d99f24e799c716a395373e8105651c: { role: "admin", username: "admin" },
};

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const STUDENT_PROFILE = {
  user_id: "demo-student-id",
  username: "30706232100316",
  full_name_ar: "عمر احمد محمد محمد",
  full_name_en: "Omar Ahmed Mohmed Mohmed",
  national_id: "30706232100316",
  student_code: "925250059",
  program: "هندسة الشبكات والأمن السيبراني",
  faculty: "كلية الهندسة",
  academic_level: "المستوى الأول",
  academic_status: "مقيد — منتظم",
  academic_year: "2026 / 2027",
  gender: "ذكر",
  phone: null,
  cgpa: 1.31,
  earned_hours: 28,
  created_at: "2026-10-22T00:00:00.000Z",
  extra: {
    application_no: "25084",
    certificate: "الثانوية الأزهرية - علمي - 2025",
    birth_date: "2007-06-23",
    group: "Group 1 - Section 1",
  },
};

export const ensureDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(128) }).parse(d),
  )
  .handler(async ({ data }) => {
    const account = DEMO_ACCOUNTS[await sha256(`${data.username}:${data.password}`)];
    if (!account) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = usernameToEmail(account.username);

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list?.users.find((u) => u.email === email);
    if (!user) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
      });
      if (error) throw new Error("تعذر تجهيز الحساب");
      user = created.user!;
    }
    await supabaseAdmin.from("user_roles").upsert({ user_id: user.id, role: account.role }, { onConflict: "user_id,role" });
    if (account.role === "student") {
      await supabaseAdmin.from("student_profiles").upsert({ ...STUDENT_PROFILE, user_id: user.id }, { onConflict: "user_id" });
    }
    return { ok: true as const };
  });
