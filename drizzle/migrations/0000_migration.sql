create type public.app_role as enum ('admin','student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create table public.student_profiles (
  user_id uuid primary key,
  username text not null unique,
  full_name_ar text not null,
  full_name_en text,
  national_id text,
  student_code text,
  program text,
  faculty text,
  academic_level text,
  academic_status text,
  academic_year text,
  gender text,
  phone text,
  cgpa numeric(4,2),
  earned_hours int,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.student_profiles to authenticated;
grant all on public.student_profiles to service_role;
alter table public.student_profiles enable row level security;
create policy "student reads own profile" on public.student_profiles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text,
  file_name text,
  file_size bigint,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "students read available docs" on public.documents for select to authenticated
  using (is_available or public.has_role(auth.uid(),'admin'));
create policy "admins insert docs" on public.documents for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admins update docs" on public.documents for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admins delete docs" on public.documents for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();

insert into public.documents (title, description, sort_order) values
 ('طلب الالتحاق الخاص بالطالب', 'نموذج طلب الالتحاق المقدم إلى كلية الهندسة', 1),
 ('جدول الحضور الخاص بالطالب', 'الجدول الأسبوعي للمحاضرات والسكاشن — الفصل الدراسي الأول', 2),
 ('جدول امتحانات منتصف الفصل الدراسي الأول', 'مواعيد اختبارات منتصف الفصل الدراسي الأول', 3);

create policy "auth read student docs" on storage.objects for select to authenticated
  using (bucket_id = 'student-documents');
create policy "admin upload student docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-documents' and public.has_role(auth.uid(),'admin'));
create policy "admin update student docs" on storage.objects for update to authenticated
  using (bucket_id = 'student-documents' and public.has_role(auth.uid(),'admin'));
create policy "admin delete student docs" on storage.objects for delete to authenticated
  using (bucket_id = 'student-documents' and public.has_role(auth.uid(),'admin'));