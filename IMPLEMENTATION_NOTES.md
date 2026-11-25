# HNU Student Portal — Priority Upgrade Implementation Notes

> **Target Branch:** `restore-working-version` ONLY (`origin/main` must remain untouched at `85d8575bd1da604ff45e2c7f3a5aabc51dce51df`).  
> **Created before implementation** as requested for planning, architectural verification, and post-implementation review.

---

## 1. Recorded Git Baseline (Pre-Edit)

- `origin/main` SHA: `85d8575bd1da604ff45e2c7f3a5aabc51dce51df`
- `origin/restore-working-version` SHA: `85d8575bd1da604ff45e2c7f3a5aabc51dce51df`
- Active local branch: `restore-working-version`
- Hygiene action required: `.env` is currently tracked in Git (`git ls-files .env`). Remove `.env` from Git index (`git rm --cached .env`) without deleting the local copy, ignore `.env` and `.env.*` in `.gitignore`, and add a safe `.env.example` with placeholders only.

---

## 2. Critical UI & Persistence Bugs Identified from User Report & Screenshots

### Bug 1: Sidebar Ends / Fails to Scroll With Page Across All Portal & Admin Pages
- **Observed in screenshots:** On `/admin` and `/portal/info` (and any page taller than `100vh`), scrolling down leaves white empty space beneath the dark sidebar because the sidebar stays stuck at the top of the document instead of scrolling with the viewport.
- **Root cause:**
  1. `src/styles.css` sets `body { overflow-x: hidden; }`.
  2. `src/components/portal/Shell.tsx` wraps the layout in `<div dir="ltr" className="flex min-h-screen w-full overflow-x-hidden">`.
  3. Per CSS Overflow rules, `overflow-x: hidden` forces `overflow-y: auto` on both `body` and the flex wrapper, breaking `position: sticky` on both `<aside>` (`lg:sticky lg:top-0 lg:h-screen`) and the sticky top `<header>`.
- **Fix:** Change `overflow-x: hidden` to `overflow-x: clip` in `src/styles.css` (`body`) and `src/components/portal/Shell.tsx` (outer layout container), and ensure `<aside>` has `lg:sticky lg:top-0 lg:h-screen lg:self-start` across all Admin and Student routes using `Shell`.

### Bug 2: Admin File Upload / Replacement Fails Silently or Is Invisible on the Web
- **Observed by user:** When Admin uploads or replaces a PDF file, it either shows success despite failing remotely or saves only locally (`idb:<docId>`) so students on other devices/sessions cannot find the file.
- **Root cause in `src/lib/documents-storage.ts`:**
  1. `uploadAndPublishDocument` saves the blob to local IndexedDB, sets `file_path = "idb:<docId>"`, returns immediately, and runs Supabase Storage upload + DB update in a background `withTimeout(..., 2000).catch(() => {})`.
  2. `createDocument`, `updateDocumentFields`, `deleteDocumentRecord`, and `reorderDocumentList` also use `localStorage` + synthetic `doc-...` IDs and swallow remote errors silently.
- **Fix:**
  1. Remove `localStorage` / IndexedDB as an authoritative data store or fallback for document publication.
  2. Let PostgreSQL generate UUID primary keys.
  3. Upload files to Supabase Storage (`student-documents` for shared files, `private-student-documents` for personal student files), await and check errors, verify object presence and validate PDF/size on server, then persist metadata in PostgreSQL.
  4. On failure after upload, roll back/delete the newly uploaded object and show an error toast without losing user input.
  5. On replacement, upload new file + update DB first, then delete the old Storage object.
  6. Never show `toast.success` until PostgreSQL write + query refetch succeed.

---

## 3. Database Schema & Forward Migration Plan (`0004_migration.sql`)

All changes are additive and backward-compatible with `0000`–`0003`:
- **Enums:** `account_status` (`pending`, `active`, `rejected`, `suspended`), `document_audience` (`all`, `program`, `level`, `student`), `slot_kind` (`lecture`, `section`, `lab`), `event_kind` (`exam`, `deadline`, `academic`, `announcement`).
- **Academic entities:** `academic_programs`, `academic_levels`, `academic_years`, `semesters`, `courses`, `course_offerings`, `academic_groups`, `enrollments` (`UNIQUE(student_user_id, offering_id)` so each course offering has at most one active group/section per student, allowing different groups across different courses), `lectures`, `student_grades`, `semester_grade_summaries`.
- **Onboarding & profiles:** `student_roster`, `registration_requests`, additive columns on `student_profiles` (`email`, `program_id`, `level_id`, `academic_year_id`, `account_status`, `updated_at`) + safe FK/unique constraints.
- **Documents & materials:** additive audience/category/offering columns on `documents` (`audience_scope`, `program_id`, `level_id`, `target_student_user_id`, `offering_id`, `doc_category`), new `student_documents` table for private student files, new private `private-student-documents` Storage bucket.
- **Communications & audit:** `announcements`, `academic_events`, `admin_activity_logs`.
- **RLS & Storage Policies:** Strict row-level security on every table and bucket (`student-documents` enforces `is_available` + audience targeting + active student status; `private-student-documents` enforces `student_user_id = auth.uid()` + `is_available`; `admin_activity_logs` readable only by Admins).

---

## 4. Authentication, Registration & Authorization Plan

1. Consolidate authentication on **Supabase Auth** (email or username mapped to email) and remove hardcoded demo credentials/profile fallbacks from production paths.
2. Add `/register` student self-registration flow:
   - Student submits student code, email, password (to Supabase Auth), full Arabic name, and phone.
   - Server validates `student_code` + `email` against `student_roster` (`supabaseAdmin`), checks duplicates, and creates a `pending` `registration_requests` row.
   - Pending/rejected/suspended users cannot access `/portal` or read other students' records.
3. Admin reviews pending registrations, approves (atomically creates/updates `student_profiles`, sets `account_status = 'active'`, assigns `student` role in `user_roles`), rejects, or suspends/reactivates.
4. Students may update only permitted contact info (`phone`) on their own profile; all official identity/academic fields are Admin-only.
5. Admin account provisioning is server/SQL-documented (no open public Admin signup or default production password).

---

## 5. Admin Control Center & Student Portal Pages Plan

- **Admin (`/admin` layout + sub-routes using existing `Shell`):**
  - `/admin` — Overview (live DB counts + recent admin activity logs).
  - `/admin/students` & `/admin/students/$userId` — Search/filter/paginated student directory, pending registrations approval/rejection, eligible roster management, official profile/placement editor, account status toggle with confirmation, private student documents, enrollments, and grade entry.
  - `/admin/academic` — CRUD for Programs, Levels, Years/Semesters, Courses, Offerings, Groups/Sections, Enrollments, and Lectures.
  - `/admin/documents` — Upgraded shared documents & study materials manager with audience targeting, course offering linking, strict awaited storage/DB persistence, and delete confirmation.
  - `/admin/events` — Announcements & academic events CRUD with publish/archive/audience controls.
  - `/admin/logs` — Immutable Admin activity log viewer.
- **Student (`/portal` routes, preserving current visual design):**
  - `/portal` — Live profile summary, current semester, upcoming lectures from enrollments, published announcements & events.
  - `/portal/info` — DB-backed profile with read-only official fields and editable permitted contact (`phone`).
  - `/portal/courses` — Derived from enrollments per selected/current semester.
  - `/portal/registration` — Derived from enrollments -> groups -> lectures (supports per-course groups).
  - `/portal/grades` — Admin-entered persisted grades & semester summaries with clean empty state when unpublished.
  - `/portal/documents` & `/portal/viewer/$docId` — Audience-targeted shared documents + private student documents with server-authorized short-lived signed URLs.
  - `/portal/events` — Full view of published announcements and academic events targeted to the student.

---

## 6. Verification & Review Checklist

- [x] `.env` untracked from Git, `.gitignore` updated, `.env.example` created.
- [x] `0004_migration.sql` added + `_journal.json` updated + `src/integrations/supabase/types.ts` updated.
- [x] `Shell.tsx` & `styles.css` sticky sidebar scroll fixed (`overflow-x-clip` + `lg:sticky lg:top-0 lg:h-screen lg:self-start`).
- [x] Document upload/replace/delete/hide persistence refactored to fail loudly on DB/Storage error and clean up orphans.
- [x] Auth, RBAC, audience targeting, routing, and document upload tests added (`25 passed` across `src/test/app-routing.test.tsx` & `src/test/portal-upgrade.test.ts`).
- [x] `tsc --noEmit` (0 errors), `eslint` (0 errors), and `vite build` checked.
- [ ] Committed and pushed ONLY to `restore-working-version`; `origin/main` verified unchanged.
