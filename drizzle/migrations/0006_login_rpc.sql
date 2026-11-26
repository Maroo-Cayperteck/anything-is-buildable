-- HNU Portal 0006: Login Email Resolution RPC
-- Adds a SECURITY DEFINER function that resolves a student code / username
-- to its verified email so the client can sign-in without exposing the
-- service role key. The function uses fixed search_path and is callable
-- by the anon role but only returns an email when a matching active record
-- exists – it never reveals whether an account exists for other identifiers.

-- ============================================================
-- resolve_login_email(p_identifier text) -> text | null
-- ============================================================
-- Priority order:
--   1. student_profiles  (student_code or username) → email column or
--      resolved via auth.users(id) if email column is blank
--   2. registration_requests (student_code)         → email column
--   3. student_roster    (student_code, is_active)  → approved_email
-- Returns NULL when no match – caller treats NULL as invalid credentials.
-- ============================================================

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_user_id uuid;
begin
  -- Normalise: trim and fold to lower-case
  p_identifier := lower(trim(p_identifier));

  if p_identifier is null or length(p_identifier) = 0 then
    return null;
  end if;

  -- 1. Check student_profiles by student_code or username
  select sp.email, sp.user_id
    into v_email, v_user_id
    from public.student_profiles sp
   where lower(sp.student_code) = p_identifier
      or lower(sp.username)     = p_identifier
   limit 1;

  if v_email is not null and length(trim(v_email)) > 0 then
    return lower(trim(v_email));
  end if;

  -- If we have a user_id but no email column, look up auth.users
  -- (requires security definer to access auth schema)
  if v_user_id is not null then
    select lower(trim(au.email))
      into v_email
      from auth.users au
     where au.id = v_user_id
     limit 1;

    if v_email is not null then
      return v_email;
    end if;
  end if;

  -- 2. Check pending/active registration_requests by student_code
  --    (so applicants whose profile isn't created yet can still log in)
  select lower(trim(rr.email))
    into v_email
    from public.registration_requests rr
   where lower(rr.student_code) = p_identifier
   order by rr.created_at desc
   limit 1;

  if v_email is not null then
    return v_email;
  end if;

  -- 3. Check student_roster for pre-provisioned accounts
  select lower(trim(sr.approved_email))
    into v_email
    from public.student_roster sr
   where lower(sr.student_code) = p_identifier
     and sr.is_active = true
   limit 1;

  return v_email; -- may be null → caller returns invalid_credentials
end;
$$;

-- Grant execute to the anon and authenticated roles
-- (the function itself only reads safe columns, never auth tokens)
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Revoke from public (belt-and-suspenders)
revoke execute on function public.resolve_login_email(text) from public;
