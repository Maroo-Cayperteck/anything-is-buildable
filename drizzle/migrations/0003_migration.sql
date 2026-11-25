-- Fix 1 (Finding: Anyone can check other users' roles):
-- Bind _user_id to auth.uid() and revoke public/anon execute on has_role
-- so callers cannot query role assignments of other user IDs.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select _user_id is not null
    and _user_id = auth.uid()
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = _role
    )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- Fix 2 (Finding: Any student can keep viewing files after you hide them):
-- Require documents.is_available = true in storage.objects SELECT policy for students,
-- so students cannot access or re-sign storage paths once a document is hidden.
drop policy if exists "members read student docs" on storage.objects;
create policy "members read student docs" on storage.objects for select to authenticated
  using (
    bucket_id = 'student-documents'
    and (
      public.has_role(auth.uid(), 'admin')
      or (
        public.has_role(auth.uid(), 'student')
        and exists (
          select 1 from public.documents d
          where d.file_path = storage.objects.name
            and d.is_available = true
        )
      )
    )
  );
