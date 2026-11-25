import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStudentPortalSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semesterId: z.string().uuid().optional() }).optional().parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { matchesStudentAudience, requireActiveStudentServer } = await import("./auth.server");

    const student = await requireActiveStudentServer(context.userId);

    const [
      { data: programRow },
      { data: levelRow },
      { data: yearRow },
      { data: semesters },
      { data: enrollments },
      { data: announcements },
      { data: events },
      { data: grades },
      { data: gradeSummaries },
    ] = await Promise.all([
      student.program_id
        ? supabaseAdmin.from("academic_programs").select("*").eq("id", student.program_id).maybeSingle()
        : Promise.resolve({ data: null }),
      student.level_id
        ? supabaseAdmin.from("academic_levels").select("*").eq("id", student.level_id).maybeSingle()
        : Promise.resolve({ data: null }),
      student.academic_year_id
        ? supabaseAdmin.from("academic_years").select("*").eq("id", student.academic_year_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from("semesters").select("*, academic_years(name)").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("enrollments")
        .select("*")
        .eq("student_user_id", student.user_id)
        .eq("status", "enrolled"),
      supabaseAdmin
        .from("announcements")
        .select("*")
        .eq("is_published", true)
        .eq("is_archived", false)
        .order("published_at", { ascending: false }),
      supabaseAdmin
        .from("academic_events")
        .select("*")
        .eq("is_published", true)
        .order("starts_at", { ascending: true }),
      supabaseAdmin
        .from("student_grades")
        .select("*")
        .eq("student_user_id", student.user_id)
        .eq("is_published", true)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("semester_grade_summaries")
        .select("*")
        .eq("student_user_id", student.user_id)
        .eq("is_published", true),
    ]);

    const semesterList = semesters ?? [];
    const selectedSemester =
      (data?.semesterId ? semesterList.find((s) => s.id === data.semesterId) : undefined) ??
      semesterList.find((s) => s.is_current) ??
      semesterList[0] ??
      null;

    // Resolve enrolled courses, offerings, groups, and lectures from PostgreSQL
    const enrollmentRows = enrollments ?? [];
    const offeringIds = [...new Set(enrollmentRows.map((e) => e.offering_id))];
    const groupIds = [...new Set(enrollmentRows.map((e) => e.group_id))];

    const [{ data: offerings }, { data: groups }, { data: lectures }] = await Promise.all([
      offeringIds.length > 0
        ? supabaseAdmin.from("course_offerings").select("*").in("id", offeringIds)
        : Promise.resolve({ data: [] }),
      groupIds.length > 0
        ? supabaseAdmin.from("academic_groups").select("*").in("id", groupIds)
        : Promise.resolve({ data: [] }),
      groupIds.length > 0
        ? supabaseAdmin.from("lectures").select("*").in("group_id", groupIds).order("start_hour", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const courseIds = [...new Set([...(offerings ?? []).map((o) => o.course_id), ...(grades ?? []).map((g) => g.course_id)])];
    const { data: courses } =
      courseIds.length > 0
        ? await supabaseAdmin.from("courses").select("*").in("id", courseIds)
        : { data: [] };

    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
    const offeringMap = new Map((offerings ?? []).map((o) => [o.id, o]));
    const groupMap = new Map((groups ?? []).map((g) => [g.id, g]));
    const semesterMap = new Map(semesterList.map((s) => [s.id, s]));

    // Filter enrollments for selected semester if one exists
    const activeEnrollments = enrollmentRows
      .map((e) => {
        const off = offeringMap.get(e.offering_id);
        const grp = groupMap.get(e.group_id);
        const crs = off ? courseMap.get(off.course_id) : undefined;
        const sem = off ? semesterMap.get(off.semester_id) : undefined;
        const grpLectures = (lectures ?? []).filter((l) => l.group_id === e.group_id);
        return {
          enrollmentId: e.id,
          status: e.status,
          offeringId: e.offering_id,
          semesterId: off?.semester_id ?? null,
          semesterName: sem?.name_ar ?? null,
          courseId: crs?.id ?? null,
          courseCode: crs?.code ?? "",
          courseName: crs?.name ?? "",
          courseNameAr: crs?.name_ar ?? null,
          creditHours: crs?.credit_hours ?? 0,
          groupId: grp?.id ?? e.group_id,
          groupName: grp?.name ?? "",
          instructor: grp?.instructor ?? null,
          lectures: grpLectures,
        };
      })
      .filter((item) => (!selectedSemester ? true : item.semesterId === selectedSemester.id));

    const timetableSlots = activeEnrollments.flatMap((enr) =>
      enr.lectures.map((lec) => ({
        id: lec.id,
        day: lec.day_of_week,
        start: lec.start_hour,
        end: lec.end_hour,
        kind: lec.kind,
        course: enr.courseName,
        courseCode: enr.courseCode,
        groupName: enr.groupName,
        staff: lec.instructor || enr.instructor || "—",
        room: lec.location,
      })),
    );

    const targetedAnnouncements = (announcements ?? []).filter((a) => matchesStudentAudience(a, student));
    const targetedEvents = (events ?? []).filter((ev) => matchesStudentAudience(ev, student));

    // Group published grades by semester
    const publishedGrades = (grades ?? []).map((g) => {
      const crs = courseMap.get(g.course_id);
      const sem = semesterMap.get(g.semester_id);
      return {
        ...g,
        courseCode: crs?.code ?? "—",
        courseName: crs?.name ?? "—",
        creditHours: crs?.credit_hours ?? 0,
        semesterName: sem?.name_ar ?? "—",
        semesterSeason: sem?.season ?? "",
        academicYearName: (sem as { academic_years?: { name?: string } } | undefined)?.academic_years?.name ?? "",
      };
    });

    return {
      profile: {
        ...student,
        resolvedProgramName: programRow?.name_ar ?? student.program,
        resolvedFacultyName: programRow?.faculty ?? student.faculty,
        resolvedLevelName: levelRow?.name_ar ?? student.academic_level,
        resolvedYearName: yearRow?.name ?? student.academic_year,
      },
      semesters: semesterList,
      selectedSemester,
      enrollments: activeEnrollments,
      timetable: timetableSlots,
      announcements: targetedAnnouncements,
      events: targetedEvents,
      grades: publishedGrades,
      gradeSummaries: gradeSummaries ?? [],
    };
  });

export const getStudentDocumentsBundle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { matchesStudentAudience, requireActiveStudentServer } = await import("./auth.server");

    const student = await requireActiveStudentServer(context.userId);

    const [{ data: sharedDocs, error: sharedErr }, { data: privateDocs, error: privErr }] = await Promise.all([
      supabaseAdmin.from("documents").select("*").eq("is_available", true).order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("student_documents")
        .select("*")
        .eq("student_user_id", student.user_id)
        .eq("is_available", true)
        .order("created_at", { ascending: false }),
    ]);

    if (sharedErr || privErr) {
      throw new Error("تعذر تحميل الملفات من قاعدة البيانات");
    }

    return {
      shared: (sharedDocs ?? []).filter((doc) => matchesStudentAudience(doc, student)),
      privateDocs: privateDocs ?? [],
    };
  });
