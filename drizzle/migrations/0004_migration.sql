-- HNU Student Portal Priority Upgrade (Forward-only additive migration)
-- Safe to apply on top of 0000_migration..0003_migration without deleting existing rows.

-- 1. New enum types
do $$ begin
  create type public.account_status as enum ('pending', 'active', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_audience as enum ('all', 'program', 'level', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.slot_kind as enum ('lecture', 'section', 'lab');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_kind as enum ('exam', 'deadline', 'academic', 'announcement');
exception when duplicate_object then null; end $$;

-- 2. Academic structure tables
create table if not exists public.academic_programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text,
  faculty text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_levels (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.academic_programs(id) on delete restrict,
  level_number int not null check (level_number >= 1 and level_number <= 10),
  name_ar text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (program_id, level_number)
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  season text not null check (season in ('FALL', 'SPRING', 'SUMMER')),
  name_ar text not null,
  is_current boolean not null default false,
  is_closed boolean not null default false,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (academic_year_id, season)
);

-- 3. Student roster and registration workflow
create table if not exists public.student_roster (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  approved_email text not null,
  full_name_ar text,
  full_name_en text,
  program_id uuid references public.academic_programs(id) on delete restrict,
  level_id uuid references public.academic_levels(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_student_roster_email_lower
  on public.student_roster (lower(approved_email));

create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  roster_id uuid references public.student_roster(id) on delete restrict,
  student_code text not null,
  email text not null,
  full_name_ar text not null,
  full_name_en text,
  phone text,
  gender text,
  status public.account_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_registration_requests_status
  on public.registration_requests (status, created_at desc);

-- 4. Safely extend existing student_profiles table
alter table public.student_profiles
  add column if not exists email text,
  add column if not exists program_id uuid references public.academic_programs(id) on delete restrict,
  add column if not exists level_id uuid references public.academic_levels(id) on delete restrict,
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete restrict,
  add column if not exists account_status public.account_status not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_student_profiles_student_code_unique
  on public.student_profiles (student_code)
  where student_code is not null;

create index if not exists idx_student_profiles_status_program_level
  on public.student_profiles (account_status, program_id, level_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_profiles_user_id_fkey'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    if not exists (
      select 1 from public.student_profiles sp
      where not exists (select 1 from auth.users u where u.id = sp.user_id)
    ) then
      alter table public.student_profiles
        add constraint student_profiles_user_id_fkey
        foreign key (user_id) references auth.users(id) on delete cascade;
    else
      alter table public.student_profiles
        add constraint student_profiles_user_id_fkey
        foreign key (user_id) references auth.users(id) on delete cascade not valid;
    end if;
  end if;
end $$;

-- 5. Courses, offerings, groups/sections, enrollments, lectures, and grades
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_ar text,
  credit_hours int not null default 3 check (credit_hours > 0 and credit_hours <= 12),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  program_id uuid references public.academic_programs(id) on delete restrict,
  level_id uuid references public.academic_levels(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_course_offerings_unique_scope
  on public.course_offerings (
    course_id,
    semester_id,
    coalesce(program_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(level_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.academic_groups (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  name text not null,
  instructor text,
  capacity int check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  unique (offering_id, name)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete restrict,
  group_id uuid not null references public.academic_groups(id) on delete restrict,
  status text not null default 'enrolled' check (status in ('enrolled', 'dropped', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, offering_id)
);

create index if not exists idx_enrollments_student on public.enrollments (student_user_id, status);
create index if not exists idx_enrollments_group on public.enrollments (group_id);

create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday')),
  start_hour int not null check (start_hour >= 0 and start_hour < 24),
  end_hour int not null check (end_hour > start_hour and end_hour <= 24),
  kind public.slot_kind not null default 'lecture',
  location text not null,
  instructor text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lectures_group_day on public.lectures (group_id, day_of_week, start_hour);

create table if not exists public.student_grades (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  marks numeric(5,2),
  grade_letter text,
  grade_points numeric(3,2),
  status_label text not null default 'ناجح',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, semester_id, course_id)
);

create table if not exists public.semester_grade_summaries (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  semester_gpa numeric(4,2),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, semester_id)
);

-- 6. Extend shared documents & add private student documents
alter table public.documents
  add column if not exists audience_scope public.document_audience not null default 'all',
  add column if not exists program_id uuid references public.academic_programs(id) on delete set null,
  add column if not exists level_id uuid references public.academic_levels(id) on delete set null,
  add column if not exists target_student_user_id uuid references public.student_profiles(user_id) on delete cascade,
  add column if not exists offering_id uuid references public.course_offerings(id) on delete set null,
  add column if not exists doc_category text not null default 'general'
    check (doc_category in ('general', 'study_material', 'schedule', 'exam'));

create index if not exists idx_documents_audience
  on public.documents (is_available, audience_scope, program_id, level_id, target_student_user_id);

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
  title text not null,
  description text,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  is_available boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_documents_owner
  on public.student_documents (student_user_id, is_available, created_at desc);

-- 7. Announcements, academic events, and immutable admin activity logs
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience_scope public.document_audience not null default 'all',
  program_id uuid references public.academic_programs(id) on delete set null,
  level_id uuid references public.academic_levels(id) on delete set null,
  target_student_user_id uuid references public.student_profiles(user_id) on delete cascade,
  is_published boolean not null default false,
  is_archived boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type public.event_kind not null default 'academic',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  semester_id uuid references public.semesters(id) on delete set null,
  offering_id uuid references public.course_offerings(id) on delete set null,
  audience_scope public.document_audience not null default 'all',
  program_id uuid references public.academic_programs(id) on delete set null,
  level_id uuid references public.academic_levels(id) on delete set null,
  target_student_user_id uuid references public.student_profiles(user_id) on delete cascade,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_activity_logs_created
  on public.admin_activity_logs (created_at desc);

-- 8. Updated-at triggers
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'academic_programs',
    'student_roster',
    'registration_requests',
    'student_profiles',
    'courses',
    'enrollments',
    'student_grades',
    'semester_grade_summaries',
    'student_documents',
    'announcements',
    'academic_events'
  ] loop
    if not exists (
      select 1 from pg_trigger
      where tgname = tbl || '_touch'
        and tgrelid = ('public.' || tbl)::regclass
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
        tbl || '_touch',
        tbl
      );
    end if;
  end loop;
end $$;

-- 9. Authorization helper functions for RLS
create or replace function public.is_active_student()
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_role(auth.uid(), 'student')
    and exists (
      select 1 from public.student_profiles sp
      where sp.user_id = auth.uid()
        and sp.account_status = 'active'
    )
$$;

revoke all on function public.is_active_student() from public, anon;
grant execute on function public.is_active_student() to authenticated, service_role;

create or replace function public.can_access_audience(
  _audience public.document_audience,
  _program_id uuid,
  _level_id uuid,
  _target_student_user_id uuid
)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin')
    or (
      public.is_active_student()
      and (
        _audience = 'all'
        or (_audience = 'student' and _target_student_user_id = auth.uid())
        or (
          _audience = 'program'
          and _program_id is not null
          and exists (
            select 1 from public.student_profiles sp
            where sp.user_id = auth.uid() and sp.program_id = _program_id
          )
        )
        or (
          _audience = 'level'
          and _level_id is not null
          and exists (
            select 1 from public.student_profiles sp
            where sp.user_id = auth.uid() and sp.level_id = _level_id
          )
        )
      )
    )
$$;

revoke all on function public.can_access_audience(public.document_audience, uuid, uuid, uuid) from public, anon;
grant execute on function public.can_access_audience(public.document_audience, uuid, uuid, uuid) to authenticated, service_role;

-- 10. Enable RLS and configure grants across all tables
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'academic_programs',
    'academic_levels',
    'academic_years',
    'semesters',
    'student_roster',
    'registration_requests',
    'courses',
    'course_offerings',
    'academic_groups',
    'enrollments',
    'lectures',
    'student_grades',
    'semester_grade_summaries',
    'student_documents',
    'announcements',
    'academic_events',
    'admin_activity_logs'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant all on public.%I to service_role', tbl);
  end loop;
end $$;

grant select on public.academic_programs, public.academic_levels, public.academic_years, public.semesters,
  public.courses, public.course_offerings, public.academic_groups, public.enrollments, public.lectures,
  public.student_grades, public.semester_grade_summaries, public.student_documents,
  public.announcements, public.academic_events, public.registration_requests, public.admin_activity_logs
  to authenticated;

grant insert, update, delete on public.academic_programs, public.academic_levels, public.academic_years,
  public.semesters, public.student_roster, public.registration_requests, public.courses, public.course_offerings,
  public.academic_groups, public.enrollments, public.lectures, public.student_grades, public.semester_grade_summaries,
  public.student_documents, public.announcements, public.academic_events
  to authenticated;

grant insert on public.admin_activity_logs to authenticated;

-- RLS policies: Admin full access + strict student read access
drop policy if exists "read programs" on public.academic_programs;
create policy "read programs" on public.academic_programs for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_active_student());
drop policy if exists "admin write programs" on public.academic_programs;
create policy "admin write programs" on public.academic_programs for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read levels" on public.academic_levels;
create policy "read levels" on public.academic_levels for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_active_student());
drop policy if exists "admin write levels" on public.academic_levels;
create policy "admin write levels" on public.academic_levels for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read years" on public.academic_years;
create policy "read years" on public.academic_years for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_active_student());
drop policy if exists "admin write years" on public.academic_years;
create policy "admin write years" on public.academic_years for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read semesters" on public.semesters;
create policy "read semesters" on public.semesters for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_active_student());
drop policy if exists "admin write semesters" on public.semesters;
create policy "admin write semesters" on public.semesters for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin manage roster" on public.student_roster;
create policy "admin manage roster" on public.student_roster for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read own or admin registration" on public.registration_requests;
create policy "read own or admin registration" on public.registration_requests for select to authenticated
  using (auth_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "admin update registration" on public.registration_requests;
create policy "admin update registration" on public.registration_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read courses" on public.courses;
create policy "read courses" on public.courses for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_active_student());
drop policy if exists "admin write courses" on public.courses;
create policy "admin write courses" on public.courses for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read offerings" on public.course_offerings;
create policy "read offerings" on public.course_offerings for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_active_student());
drop policy if exists "admin write offerings" on public.course_offerings;
create policy "admin write offerings" on public.course_offerings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read groups" on public.academic_groups;
create policy "read groups" on public.academic_groups for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_active_student());
drop policy if exists "admin write groups" on public.academic_groups;
create policy "admin write groups" on public.academic_groups for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read own or admin enrollments" on public.enrollments;
create policy "read own or admin enrollments" on public.enrollments for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (public.is_active_student() and student_user_id = auth.uid())
  );
drop policy if exists "admin write enrollments" on public.enrollments;
create policy "admin write enrollments" on public.enrollments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read own or admin lectures" on public.lectures;
create policy "read own or admin lectures" on public.lectures for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (
      public.is_active_student()
      and exists (
        select 1 from public.enrollments e
        where e.group_id = lectures.group_id
          and e.student_user_id = auth.uid()
          and e.status = 'enrolled'
      )
    )
  );
drop policy if exists "admin write lectures" on public.lectures;
create policy "admin write lectures" on public.lectures for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read own published grades or admin" on public.student_grades;
create policy "read own published grades or admin" on public.student_grades for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (public.is_active_student() and student_user_id = auth.uid() and is_published = true)
  );
drop policy if exists "admin write grades" on public.student_grades;
create policy "admin write grades" on public.student_grades for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read own published summaries or admin" on public.semester_grade_summaries;
create policy "read own published summaries or admin" on public.semester_grade_summaries for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (public.is_active_student() and student_user_id = auth.uid() and is_published = true)
  );
drop policy if exists "admin write summaries" on public.semester_grade_summaries;
create policy "admin write summaries" on public.semester_grade_summaries for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Tighten shared documents RLS with audience targeting + active student check
drop policy if exists "members read docs" on public.documents;
create policy "members read docs" on public.documents for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (
      is_available = true
      and public.can_access_audience(audience_scope, program_id, level_id, target_student_user_id)
    )
  );

-- Private student documents
drop policy if exists "read own private docs or admin" on public.student_documents;
create policy "read own private docs or admin" on public.student_documents for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (public.is_active_student() and student_user_id = auth.uid() and is_available = true)
  );
drop policy if exists "admin write private docs" on public.student_documents;
create policy "admin write private docs" on public.student_documents for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Announcements & academic events
drop policy if exists "read targeted announcements or admin" on public.announcements;
create policy "read targeted announcements or admin" on public.announcements for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (
      is_published = true
      and is_archived = false
      and public.can_access_audience(audience_scope, program_id, level_id, target_student_user_id)
    )
  );
drop policy if exists "admin write announcements" on public.announcements;
create policy "admin write announcements" on public.announcements for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "read targeted events or admin" on public.academic_events;
create policy "read targeted events or admin" on public.academic_events for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (
      is_published = true
      and public.can_access_audience(audience_scope, program_id, level_id, target_student_user_id)
    )
  );
drop policy if exists "admin write events" on public.academic_events;
create policy "admin write events" on public.academic_events for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Admin activity logs: immutable audit log
drop policy if exists "admin read activity logs" on public.admin_activity_logs;
create policy "admin read activity logs" on public.admin_activity_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "admin insert activity logs" on public.admin_activity_logs;
create policy "admin insert activity logs" on public.admin_activity_logs for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- 11. Storage buckets and strict Storage RLS policies
insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('private-student-documents', 'private-student-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "members read student docs" on storage.objects;
create policy "members read student docs" on storage.objects for select to authenticated
  using (
    bucket_id = 'student-documents'
    and (
      public.has_role(auth.uid(), 'admin')
      or exists (
        select 1 from public.documents d
        where d.file_path = storage.objects.name
          and d.is_available = true
          and public.can_access_audience(d.audience_scope, d.program_id, d.level_id, d.target_student_user_id)
      )
    )
  );

drop policy if exists "admin insert student docs" on storage.objects;
drop policy if exists "admin upload student docs" on storage.objects;
create policy "admin upload student docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-documents' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin update student docs" on storage.objects;
create policy "admin update student docs" on storage.objects for update to authenticated
  using (bucket_id = 'student-documents' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin delete student docs" on storage.objects;
create policy "admin delete student docs" on storage.objects for delete to authenticated
  using (bucket_id = 'student-documents' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "read private student docs storage" on storage.objects;
create policy "read private student docs storage" on storage.objects for select to authenticated
  using (
    bucket_id = 'private-student-documents'
    and (
      public.has_role(auth.uid(), 'admin')
      or exists (
        select 1 from public.student_documents sd
        where sd.file_path = storage.objects.name
          and sd.student_user_id = auth.uid()
          and sd.is_available = true
          and public.is_active_student()
      )
    )
  );

drop policy if exists "admin insert private student docs" on storage.objects;
create policy "admin insert private student docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-student-documents' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin update private student docs" on storage.objects;
create policy "admin update private student docs" on storage.objects for update to authenticated
  using (bucket_id = 'private-student-documents' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin delete private student docs" on storage.objects;
create policy "admin delete private student docs" on storage.objects for delete to authenticated
  using (bucket_id = 'private-student-documents' and public.has_role(auth.uid(), 'admin'));
