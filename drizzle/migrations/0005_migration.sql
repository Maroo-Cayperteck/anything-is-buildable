-- HNU Student Portal Phase A/B Forward-Only Migration (0005)
-- Safe additive migration on top of 0000..0004. Never drops or truncates existing student data.

-- 1. Durable server-side registration intents (supports email confirmation continuation)
create table if not exists public.registration_intents (
  id uuid primary key default gen_random_uuid(),
  student_code text not null,
  email text not null,
  full_name_ar text not null,
  full_name_en text,
  phone text,
  gender text,
  roster_id uuid references public.student_roster(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  consumed_at timestamptz,
  consumed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_registration_intents_email_lower
  on public.registration_intents (lower(email), created_at desc);

create index if not exists idx_registration_intents_code
  on public.registration_intents (student_code, created_at desc);

alter table public.registration_intents enable row level security;
revoke all on public.registration_intents from public, anon, authenticated;
grant all on public.registration_intents to service_role;

-- Track whether a registration request matched an active admin roster entry
alter table public.registration_requests
  add column if not exists roster_verified boolean not null default false;

-- 2. Enrollment history & offering/group composite integrity (§7.1, §7.2)
do $$
declare
  conflict_count int;
begin
  select count(*) into conflict_count
  from (
    select student_user_id, offering_id
    from public.enrollments
    where status in ('enrolled', 'completed')
    group by student_user_id, offering_id
    having count(*) > 1
  ) dupes;

  if conflict_count > 0 then
    raise exception 'Cannot add partial unique index idx_enrollments_active_unique: % duplicate active/completed (student_user_id, offering_id) pairs exist. Reconcile them manually first without deleting history.', conflict_count;
  end if;
end $$;

alter table public.enrollments
  drop constraint if exists enrollments_student_user_id_offering_id_key;

create unique index if not exists idx_enrollments_active_unique
  on public.enrollments (student_user_id, offering_id)
  where status in ('enrolled', 'completed');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'academic_groups_id_offering_id_key'
      and conrelid = 'public.academic_groups'::regclass
  ) then
    alter table public.academic_groups
      add constraint academic_groups_id_offering_id_key unique (id, offering_id);
  end if;
end $$;

do $$
declare
  mismatched_count int;
begin
  select count(*) into mismatched_count
  from public.enrollments e
  join public.academic_groups g on g.id = e.group_id
  where g.offering_id <> e.offering_id;

  if mismatched_count > 0 then
    raise exception 'Cannot add composite FK enrollments_group_offering_fkey: % existing enrollment rows reference a group from a different offering.', mismatched_count;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'enrollments_group_offering_fkey'
      and conrelid = 'public.enrollments'::regclass
  ) then
    alter table public.enrollments
      add constraint enrollments_group_offering_fkey
      foreign key (group_id, offering_id)
      references public.academic_groups (id, offering_id)
      on delete restrict;
  end if;
end $$;

-- 3. Program / Level consistency safeguards (§7.2, §7.3)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'academic_levels_id_program_id_key'
      and conrelid = 'public.academic_levels'::regclass
  ) then
    alter table public.academic_levels
      add constraint academic_levels_id_program_id_key unique (id, program_id);
  end if;
end $$;

create or replace function public.enforce_program_level_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  lvl_program_id uuid;
begin
  if NEW.level_id is not null then
    select program_id into lvl_program_id
    from public.academic_levels
    where id = NEW.level_id;

    if lvl_program_id is null then
      raise exception 'Academic level (%) does not exist', NEW.level_id;
    end if;

    if NEW.program_id is not null and NEW.program_id <> lvl_program_id then
      raise exception 'Academic level (%) belongs to a different academic program (%) than %', NEW.level_id, lvl_program_id, NEW.program_id;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists student_roster_program_level_check on public.student_roster;
create trigger student_roster_program_level_check
  before insert or update of program_id, level_id on public.student_roster
  for each row execute function public.enforce_program_level_consistency();

drop trigger if exists student_profiles_program_level_check on public.student_profiles;
create trigger student_profiles_program_level_check
  before insert or update of program_id, level_id on public.student_profiles
  for each row execute function public.enforce_program_level_consistency();

drop trigger if exists course_offerings_program_level_check on public.course_offerings;
create trigger course_offerings_program_level_check
  before insert or update of program_id, level_id on public.course_offerings
  for each row execute function public.enforce_program_level_consistency();

create or replace function public.enforce_enrollment_scope_compatibility()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stu_program_id uuid;
  stu_level_id uuid;
  off_program_id uuid;
  off_level_id uuid;
begin
  if NEW.status = 'dropped' then
    return NEW;
  end if;

  select program_id, level_id into stu_program_id, stu_level_id
  from public.student_profiles
  where user_id = NEW.student_user_id;

  select program_id, level_id into off_program_id, off_level_id
  from public.course_offerings
  where id = NEW.offering_id;

  if off_program_id is not null and stu_program_id is distinct from off_program_id then
    raise exception 'Student program does not match course offering program restriction';
  end if;

  if off_level_id is not null and stu_level_id is distinct from off_level_id then
    raise exception 'Student level does not match course offering level restriction';
  end if;

  return NEW;
end $$;

drop trigger if exists enrollments_scope_check on public.enrollments;
create trigger enrollments_scope_check
  before insert or update of offering_id, group_id, status on public.enrollments
  for each row execute function public.enforce_enrollment_scope_compatibility();

-- 4. Single current academic year & semester uniqueness (§7.5)
do $$
declare
  curr_years int;
  curr_sems int;
begin
  select count(*) into curr_years from public.academic_years where is_current = true;
  if curr_years > 1 then
    raise exception 'Multiple academic_years currently have is_current = true (% rows). Reconcile manually before applying idx_academic_years_single_current.', curr_years;
  end if;

  select count(*) into curr_sems from public.semesters where is_current = true;
  if curr_sems > 1 then
    raise exception 'Multiple semesters currently have is_current = true (% rows). Reconcile manually before applying idx_semesters_single_current.', curr_sems;
  end if;
end $$;

create unique index if not exists idx_academic_years_single_current
  on public.academic_years (is_current)
  where is_current = true;

create unique index if not exists idx_semesters_single_current
  on public.semesters (is_current)
  where is_current = true;

-- 5. Lecture TIME precision + safe backfill (§7.4)
alter table public.lectures
  add column if not exists start_time time,
  add column if not exists end_time time;

update public.lectures
set
  start_time = coalesce(start_time, make_time(least(23, greatest(0, coalesce(start_hour, 8))), 0, 0)),
  end_time = coalesce(
    end_time,
    case
      when coalesce(end_hour, 10) >= 24 then time '23:59:00'
      else make_time(least(23, greatest(0, coalesce(end_hour, 10))), 0, 0)
    end
  )
where start_time is null or end_time is null;

alter table public.lectures
  alter column start_time set not null,
  alter column end_time set not null;

alter table public.lectures
  drop constraint if exists lectures_time_order_check;
alter table public.lectures
  add constraint lectures_time_order_check check (end_time > start_time);

-- Keep legacy integer hour columns synchronized automatically for backward compatibility
create or replace function public.sync_lecture_legacy_hours()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.start_time is not null then
    NEW.start_hour := extract(hour from NEW.start_time)::int;
  end if;
  if NEW.end_time is not null then
    NEW.end_hour := greatest(
      coalesce(NEW.start_hour, 0) + 1,
      least(24, extract(hour from NEW.end_time)::int + case when extract(minute from NEW.end_time) > 0 then 1 else 0 end)
    );
  end if;
  return NEW;
end $$;

drop trigger if exists lectures_sync_legacy_hours on public.lectures;
create trigger lectures_sync_legacy_hours
  before insert or update on public.lectures
  for each row execute function public.sync_lecture_legacy_hours();

-- 6. Storage orphan cleanup tracking queue (Phase B reliability)
create table if not exists public.storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  storage_path text not null,
  reason text,
  attempts int not null default 1,
  last_error text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from public, anon, authenticated;
grant all on public.storage_cleanup_queue to service_role;

-- 7. Atomic transactional RPCs for Admin state machine & current year/semester (§5, §7.5)
create or replace function public.admin_upsert_academic_year_atomic(
  _id uuid,
  _name text,
  _is_current boolean,
  _actor_user_id uuid,
  _actor_label text
)
returns public.academic_years
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.academic_years;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_user_id and role = 'admin') then
    raise exception 'Forbidden: Admin role required';
  end if;

  if _is_current then
    update public.academic_years
    set is_current = false
    where is_current = true
      and (_id is null or id <> _id);
  end if;

  if _id is not null then
    update public.academic_years
    set name = _name, is_current = _is_current
    where id = _id
    returning * into v_row;
  else
    insert into public.academic_years (name, is_current)
    values (_name, _is_current)
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Academic year not found';
  end if;

  insert into public.admin_activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata)
  values (
    _actor_user_id,
    coalesce(_actor_label, _actor_user_id::text),
    case when _id is not null then 'update_academic_year' else 'create_academic_year' end,
    'academic_years',
    v_row.id::text,
    jsonb_build_object('name', v_row.name, 'is_current', v_row.is_current)
  );

  return v_row;
end $$;

create or replace function public.admin_upsert_semester_atomic(
  _id uuid,
  _academic_year_id uuid,
  _season text,
  _name_ar text,
  _is_current boolean,
  _is_closed boolean,
  _actor_user_id uuid,
  _actor_label text
)
returns public.semesters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.semesters;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_user_id and role = 'admin') then
    raise exception 'Forbidden: Admin role required';
  end if;

  if _is_current then
    update public.semesters
    set is_current = false
    where is_current = true
      and (_id is null or id <> _id);
  end if;

  if _id is not null then
    update public.semesters
    set
      academic_year_id = _academic_year_id,
      season = _season,
      name_ar = _name_ar,
      is_current = _is_current,
      is_closed = _is_closed
    where id = _id
    returning * into v_row;
  else
    insert into public.semesters (academic_year_id, season, name_ar, is_current, is_closed)
    values (_academic_year_id, _season, _name_ar, _is_current, _is_closed)
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Semester not found';
  end if;

  insert into public.admin_activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata)
  values (
    _actor_user_id,
    coalesce(_actor_label, _actor_user_id::text),
    case when _id is not null then 'update_semester' else 'create_semester' end,
    'semesters',
    v_row.id::text,
    jsonb_build_object('name_ar', v_row.name_ar, 'season', v_row.season, 'is_current', v_row.is_current)
  );

  return v_row;
end $$;

create or replace function public.admin_approve_registration_atomic(
  _request_id uuid,
  _actor_user_id uuid,
  _actor_label text,
  _program_id uuid default null,
  _level_id uuid default null,
  _academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.registration_requests;
  v_roster public.student_roster;
  v_program_id uuid;
  v_level_id uuid;
  v_program_name text;
  v_faculty_name text;
  v_level_name text;
  v_year_name text;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_user_id and role = 'admin') then
    raise exception 'Forbidden: Admin role required';
  end if;

  select * into v_req
  from public.registration_requests
  where id = _request_id
  for update;

  if v_req.id is null then
    raise exception 'NOT_FOUND: طلب التسجيل غير موجود';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'CONFLICT: طلب التسجيل تمت معالجته بالفعل بحالة (%)', v_req.status;
  end if;

  if exists (
    select 1 from public.student_profiles sp
    where sp.student_code = v_req.student_code
      and sp.user_id <> v_req.auth_user_id
  ) then
    raise exception 'CONFLICT: يوجد ملف طالب آخر مرتبط بالفعل بهذا الرقم الجامعي';
  end if;

  if v_req.roster_id is not null then
    select * into v_roster from public.student_roster where id = v_req.roster_id;
    if v_roster.id is not null then
      if not v_roster.is_active then
        raise exception 'CONFLICT: سجل الطالب في كشف المؤهلين غير نشط';
      end if;
      if v_roster.student_code <> v_req.student_code or lower(v_roster.approved_email) <> lower(v_req.email) then
        raise exception 'CONFLICT: بيانات الطلب لا تطابق سجل كشف المؤهلين';
      end if;
    end if;
  end if;

  v_program_id := coalesce(_program_id, v_roster.program_id);
  v_level_id := coalesce(_level_id, v_roster.level_id);

  if v_program_id is not null then
    select name_ar, faculty into v_program_name, v_faculty_name
    from public.academic_programs
    where id = v_program_id;
    if v_program_name is null then
      raise exception 'البرنامج الأكاديمي غير موجود';
    end if;
  end if;

  if v_level_id is not null then
    select name_ar into v_level_name
    from public.academic_levels
    where id = v_level_id
      and (v_program_id is null or program_id = v_program_id);
    if v_level_name is null then
      raise exception 'المستوى الأكاديمي غير صالح أو لا يتبع البرنامج المختار';
    end if;
  end if;

  if _academic_year_id is not null then
    select name into v_year_name from public.academic_years where id = _academic_year_id;
  end if;

  insert into public.student_profiles (
    user_id, username, student_code, email, full_name_ar, full_name_en,
    phone, gender, program_id, level_id, academic_year_id,
    program, faculty, academic_level, academic_year,
    academic_status, account_status
  ) values (
    v_req.auth_user_id, v_req.student_code, v_req.student_code, lower(v_req.email),
    v_req.full_name_ar, v_req.full_name_en, v_req.phone, v_req.gender,
    v_program_id, v_level_id, _academic_year_id,
    v_program_name, v_faculty_name, v_level_name, v_year_name,
    'مقيد — منتظم', 'active'
  )
  on conflict (user_id) do update set
    username = excluded.username,
    student_code = excluded.student_code,
    email = excluded.email,
    full_name_ar = excluded.full_name_ar,
    full_name_en = coalesce(excluded.full_name_en, public.student_profiles.full_name_en),
    phone = coalesce(excluded.phone, public.student_profiles.phone),
    gender = coalesce(excluded.gender, public.student_profiles.gender),
    program_id = coalesce(excluded.program_id, public.student_profiles.program_id),
    level_id = coalesce(excluded.level_id, public.student_profiles.level_id),
    academic_year_id = coalesce(excluded.academic_year_id, public.student_profiles.academic_year_id),
    program = coalesce(excluded.program, public.student_profiles.program),
    faculty = coalesce(excluded.faculty, public.student_profiles.faculty),
    academic_level = coalesce(excluded.academic_level, public.student_profiles.academic_level),
    academic_year = coalesce(excluded.academic_year, public.student_profiles.academic_year),
    academic_status = coalesce(public.student_profiles.academic_status, 'مقيد — منتظم'),
    account_status = 'active';

  insert into public.user_roles (user_id, role)
  values (v_req.auth_user_id, 'student')
  on conflict (user_id, role) do nothing;

  update public.registration_requests
  set
    status = 'active',
    rejection_reason = null,
    reviewed_by = _actor_user_id,
    reviewed_at = now()
  where id = v_req.id;

  insert into public.admin_activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata)
  values (
    _actor_user_id,
    coalesce(_actor_label, _actor_user_id::text),
    'approve_registration',
    'registration_requests',
    v_req.id::text,
    jsonb_build_object('student_code', v_req.student_code, 'auth_user_id', v_req.auth_user_id)
  );

  return jsonb_build_object('ok', true, 'auth_user_id', v_req.auth_user_id, 'student_code', v_req.student_code);
end $$;

create or replace function public.admin_reject_registration_atomic(
  _request_id uuid,
  _actor_user_id uuid,
  _actor_label text,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.registration_requests;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_user_id and role = 'admin') then
    raise exception 'Forbidden: Admin role required';
  end if;

  select * into v_req
  from public.registration_requests
  where id = _request_id
  for update;

  if v_req.id is null then
    raise exception 'NOT_FOUND: طلب التسجيل غير موجود';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'CONFLICT: طلب التسجيل تمت معالجته بالفعل بحالة (%)', v_req.status;
  end if;

  update public.registration_requests
  set
    status = 'rejected',
    rejection_reason = nullif(trim(coalesce(_reason, '')), ''),
    reviewed_by = _actor_user_id,
    reviewed_at = now()
  where id = v_req.id;

  delete from public.user_roles
  where user_id = v_req.auth_user_id
    and role = 'student';

  update public.student_profiles
  set account_status = 'rejected'
  where user_id = v_req.auth_user_id;

  insert into public.admin_activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata)
  values (
    _actor_user_id,
    coalesce(_actor_label, _actor_user_id::text),
    'reject_registration',
    'registration_requests',
    v_req.id::text,
    jsonb_build_object('student_code', v_req.student_code, 'reason', nullif(trim(coalesce(_reason, '')), ''))
  );

  return jsonb_build_object('ok', true, 'auth_user_id', v_req.auth_user_id);
end $$;

create or replace function public.admin_set_account_status_atomic(
  _target_user_id uuid,
  _new_status public.account_status,
  _actor_user_id uuid,
  _actor_label text,
  _reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_status public.account_status;
  v_profile_exists boolean;
begin
  if not exists (select 1 from public.user_roles where user_id = _actor_user_id and role = 'admin') then
    raise exception 'Forbidden: Admin role required';
  end if;

  select account_status into v_prev_status
  from public.student_profiles
  where user_id = _target_user_id
  for update;

  v_profile_exists := found;
  if not v_profile_exists then
    raise exception 'NOT_FOUND: ملف الطالب غير موجود';
  end if;

  update public.student_profiles
  set account_status = _new_status
  where user_id = _target_user_id;

  update public.registration_requests
  set
    status = _new_status,
    rejection_reason = case
      when _new_status = 'active' then null
      when _reason is not null then nullif(trim(_reason), '')
      else rejection_reason
    end,
    reviewed_by = _actor_user_id,
    reviewed_at = now()
  where auth_user_id = _target_user_id;

  if _new_status = 'active' then
    insert into public.user_roles (user_id, role)
    values (_target_user_id, 'student')
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
    where user_id = _target_user_id
      and role = 'student';
  end if;

  insert into public.admin_activity_logs (actor_user_id, actor_label, action, entity_type, entity_id, metadata)
  values (
    _actor_user_id,
    coalesce(_actor_label, _actor_user_id::text),
    'set_account_status_' || _new_status::text,
    'student_profiles',
    _target_user_id::text,
    jsonb_build_object('previous_status', v_prev_status, 'new_status', _new_status)
  );

  return jsonb_build_object('ok', true, 'previous_status', v_prev_status, 'new_status', _new_status);
end $$;

revoke all on function public.admin_upsert_academic_year_atomic(uuid, text, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_upsert_academic_year_atomic(uuid, text, boolean, uuid, text) to service_role;

revoke all on function public.admin_upsert_semester_atomic(uuid, uuid, text, text, boolean, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_upsert_semester_atomic(uuid, uuid, text, text, boolean, boolean, uuid, text) to service_role;

revoke all on function public.admin_approve_registration_atomic(uuid, uuid, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_registration_atomic(uuid, uuid, text, uuid, uuid, uuid) to service_role;

revoke all on function public.admin_reject_registration_atomic(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_reject_registration_atomic(uuid, uuid, text, text) to service_role;

revoke all on function public.admin_set_account_status_atomic(uuid, public.account_status, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_account_status_atomic(uuid, public.account_status, uuid, text, text) to service_role;
