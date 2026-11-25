-- Fix: has_role must only allow checking your own roles (auth.uid()),
-- not arbitrary user IDs supplied by the caller.
-- The function keeps its signature for backward compatibility with RLS policies,
-- but now ignores _user_id and always uses auth.uid().

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = _role) $$;
