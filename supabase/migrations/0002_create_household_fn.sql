-- ============================================================
-- mi-despensa-familiar | migration 0002
-- SECURITY DEFINER function for atomic household creation.
-- Bypasses RLS because the client-side Supabase session is not
-- propagated to PostgREST _authHeaders in Next.js 16 server actions.
-- The caller (server action) validates user identity via getUser()
-- and passes user_id explicitly as p_user_id.
-- ============================================================

create or replace function public.create_household_with_owner(
  p_name    text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'household name cannot be empty';
  end if;

  insert into public.households (name)
  values (trim(p_name))
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, p_user_id, 'owner');

  return v_id;
end;
$$;

-- Grant execute to both roles: the client may send either the user JWT
-- (authenticated role) or the anon key depending on session state.
-- SECURITY DEFINER ensures this is safe regardless.
grant execute on function public.create_household_with_owner(text, uuid)
  to authenticated, anon;
