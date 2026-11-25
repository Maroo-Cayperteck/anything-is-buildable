import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Grades below are transcribed from the reference screenshots; anything not
// visible there is marked as sample data in the UI.
export type CourseGrade = { code: string; name: string; hours: number; marks: number; grade: string; points: number };
export type Term = {
  season: string;
  seasonAr: string;
  year: string;
  posted: boolean;
  gpa?: number;
  courses: CourseGrade[];
  cumulative?: { cgpa: number; hours: number; level: number };
};

export const TRANSCRIPT: Term[] = [
  { season: "FALL", seasonAr: "الخريف", year: "2026 / 2027", posted: false, courses: [] },
  {
    season: "SUMMER",
    seasonAr: "الصيفي",
    year: "2025 / 2026",
    posted: true,
    gpa: 1.0,
    courses: [{ code: "GEN112", name: "Mathematics (2)", hours: 3, marks: 60, grade: "D", points: 1.0 }],
    cumulative: { cgpa: 2.7, hours: 28, level: 2 },
  },
  {
    season: "SPRING",
    seasonAr: "الربيع",
    year: "2025 / 2026",
    posted: true,
    gpa: 1.53,
    courses: [
      { code: "CSE121", name: "Computer Programming", hours: 3, marks: 60, grade: "D", points: 1.0 },
      { code: "ECE181", name: "Fundamentals of Cybersecurity", hours: 3, marks: 84, grade: "B+", points: 3.3 },
    ],
  },
];

export const GPA_SCALE = [
  ["A+", "4.00", "≥ 95"],
  ["A", "4.00", "90 – 94"],
  ["A-", "3.70", "85 – 89"],
  ["B+", "3.30", "80 – 84"],
  ["B", "3.00", "75 – 79"],
  ["C+", "2.30", "70 – 74"],
  ["C", "2.00", "65 – 69"],
  ["D", "1.00", "60 – 64"],
  ["F", "0.00", "< 60"],
] as const;

export type SlotKind = "lecture" | "section" | "lab";
export type Slot = { day: string; dayAr: string; start: number; end: number; kind: SlotKind; course: string; staff: string; room: string };

// Weekly schedule — Group 1 / Section 1, from the uploaded attendance schedule (nsce1.pdf).
export const TIMETABLE: Slot[] = [
  { day: "Saturday", dayAr: "السبت", start: 8, end: 10, kind: "lecture", course: "Discrete Mathematics", staff: "Dr. Mohamed Mahdy", room: "Class Room 8" },
  { day: "Saturday", dayAr: "السبت", start: 10, end: 12, kind: "section", course: "Discrete Mathematics", staff: "Eng. Basma Mohamed", room: "Class Room 13" },
  { day: "Saturday", dayAr: "السبت", start: 12, end: 15, kind: "lab", course: "Data Structures and Algorithms", staff: "Eng. Basma Mohamed", room: "Computer Lab 3" },
  { day: "Saturday", dayAr: "السبت", start: 15, end: 17, kind: "section", course: "Signals and Systems", staff: "Eng. Sherif Abdelhamid", room: "Class Room 13" },
  { day: "Sunday", dayAr: "الأحد", start: 8, end: 10, kind: "lecture", course: "Signals and Systems", staff: "Dr. Amr Wageeh", room: "Class Room 8" },
  { day: "Sunday", dayAr: "الأحد", start: 10, end: 12, kind: "lab", course: "Electronic Devices and Circuits", staff: "Eng. Moslem Sayed + Eng. Sherif Abdelhamid", room: "Electronics Lab" },
  { day: "Sunday", dayAr: "الأحد", start: 12, end: 14, kind: "lecture", course: "Electronic Devices and Circuits", staff: "Dr. Mohamed El-Dakroury", room: "Hall 4" },
  { day: "Monday", dayAr: "الاثنين", start: 8, end: 10, kind: "lecture", course: "Cyber Laws, Ethics and Privacy", staff: "Dr. Amany Mohamed", room: "Computer Lab 6" },
  { day: "Monday", dayAr: "الاثنين", start: 10, end: 12, kind: "lecture", course: "Data Structures and Algorithms", staff: "Dr. Samar Ashraf", room: "Computer Lab 6" },
  { day: "Monday", dayAr: "الاثنين", start: 12, end: 14, kind: "lecture", course: "Information Systems and Databases", staff: "Dr. Samar Ashraf", room: "Computer Lab 6" },
  { day: "Monday", dayAr: "الاثنين", start: 14, end: 16, kind: "lecture", course: "Critical Thinking", staff: "Dr. Mostafa Mahmoud", room: "Hall 1" },
  { day: "Monday", dayAr: "الاثنين", start: 16, end: 18, kind: "lab", course: "Information Systems and Databases", staff: "Eng. Nora Essam", room: "Computer Lab 2" },
];

export const DAYS = [
  ["Saturday", "السبت"],
  ["Sunday", "الأحد"],
  ["Monday", "الاثنين"],
  ["Tuesday", "الثلاثاء"],
  ["Wednesday", "الأربعاء"],
  ["Thursday", "الخميس"],
] as const;

export const KIND_LABEL: Record<SlotKind, string> = { lecture: "محاضرة", section: "سكشن", lab: "معمل" };

/** Registered courses derived from the timetable. */
export const REGISTERED_COURSES = Array.from(
  TIMETABLE.reduce((m, s) => {
    const c = m.get(s.course) ?? { course: s.course, lecturer: "", kinds: new Set<SlotKind>(), weeklyHours: 0 };
    if (s.kind === "lecture") c.lecturer = s.staff;
    c.kinds.add(s.kind);
    c.weeklyHours += s.end - s.start;
    m.set(s.course, c);
    return m;
  }, new Map<string, { course: string; lecturer: string; kinds: Set<SlotKind>; weeklyHours: number }>()).values(),
);

import { getStudentProfile } from "./accounts.functions";

export const DEFAULT_DOCUMENTS = [
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

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const { data, error } = await supabase.from("student_profiles").select("*").eq("user_id", u.user.id).maybeSingle();
        if (!error && data) return data;
      }
    } catch {
      // fall through to verified server session
    }
    return await getStudentProfile();
  },
});

import { fetchAllDocuments, resolveDocumentUrl, getLocalDocuments, BUCKET } from "./documents-storage";
export { BUCKET };

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: () => fetchAllDocuments(),
  initialData: () => getLocalDocuments(),
});

export async function signedUrl(
  path: string,
  download?: string,
  docId?: string,
  options?: { allowHidden?: boolean },
) {
  return resolveDocumentUrl(path, download, docId, options);
}

export function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
