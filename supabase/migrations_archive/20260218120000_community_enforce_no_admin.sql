-- Community Edition enforcement: disable admin role usage in runtime.
-- This migration is intended for the community branch/repo only.

-- 1) Remove last-admin protection triggers so existing admin roles can be normalized.
drop trigger if exists trg_prevent_last_admin_update on public.user_roles;
drop trigger if exists trg_prevent_last_admin_delete on public.user_roles;

-- 2) Normalize any existing admin rows to tester.
update public.user_roles
set role = 'tester'::public.app_role
where role = 'admin'::public.app_role;

-- 3) Enforce tester-only role values in Community Edition.
alter table public.user_roles
drop constraint if exists user_roles_tester_only;

alter table public.user_roles
add constraint user_roles_tester_only
check (role = 'tester'::public.app_role);

-- 4) Defensive trigger with explicit message if an insert/update attempts admin.
create or replace function public.reject_admin_role_in_community()
returns trigger
language plpgsql
as $$
begin
  if new.role <> 'tester'::public.app_role then
    raise exception 'Community Edition allows only tester role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_admin_role_in_community on public.user_roles;
create trigger trg_reject_admin_role_in_community
before insert or update on public.user_roles
for each row execute function public.reject_admin_role_in_community();

-- 5) Ensure all authenticated checks resolve as non-admin in Community Edition.
create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

-- 6) Admin audit RPC is not used in Community Edition.
revoke execute on function public.admin_audit(text, uuid, jsonb) from authenticated;
