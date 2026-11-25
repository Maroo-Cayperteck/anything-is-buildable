/**
 * Server-only synthetic development fixtures.
 * NEVER enabled in production; requires explicit ENABLE_DEV_AUTH_FIXTURES="true"
 * in an isolated non-production environment.
 */
export function isDevFixturesEnabled(): boolean {
  return process.env["NODE_ENV"] !== "production" && process.env["ENABLE_DEV_AUTH_FIXTURES"] === "true";
}

export const SYNTHETIC_DEV_STUDENT = {
  user_id: "00000000-0000-0000-0000-000000000001",
  username: "dev_student",
  full_name_ar: "طالب تجريبي (بيئة التطوير)",
  full_name_en: "Synthetic Dev Student",
  national_id: null,
  student_code: "DEV-0001",
  program: "هندسة الشبكات والأمن السيبراني",
  faculty: "كلية الهندسة",
  academic_level: "المستوى الثاني",
  academic_status: "مقيد — منتظم",
  academic_year: "2026 / 2027",
  gender: "ذكر",
  phone: null,
  email: "dev-student@example.invalid",
  cgpa: null,
  earned_hours: null,
  account_status: "active" as const,
  program_id: null,
  level_id: null,
  academic_year_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  extra: {},
};
