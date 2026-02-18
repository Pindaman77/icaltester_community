-- Base schema and RBAC (runs first on fresh DB; originally 20251231120000_admin_role_migration).
-- Creates: profiles, user_roles, admin_audit_log, calendars, bookings, subscriptions, sync_logs,
-- RLS, is_admin(), bootstrap trigger. Community Edition then applies 20260218 to enforce tester-only.

-------------------------------------------------------------------------------
-- 1.1 Enable Extensions (include pgcrypto for gen_random_uuid)
-------------------------------------------------------------------------------
-- Ensure auth schema exists (fresh projects)
create schema if not exists auth;

create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;  -- Required for gen_random_uuid()

-------------------------------------------------------------------------------
-- 1.2 Role Enum Type
-------------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'tester');
exception when duplicate_object then null;
end $$;

-------------------------------------------------------------------------------
-- 1.3 Helper Function: set_updated_at
-------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- 1.4 Profiles Table (searchable directory; citext email)
-------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- REVOKE + GRANT pattern (RLS does not replace privileges)
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- 1.5 user_roles Table (SELECT only for clients; service role writes)
-------------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'tester',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;  -- needed for useRole()
-- No insert/update/delete grants (service role only)

-------------------------------------------------------------------------------
-- 1.6 Admin Audit Log Table (inserts only via RPC)
-------------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_user_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;  -- RLS restricts to admins

-------------------------------------------------------------------------------
-- 1.6 App Tables (calendars, bookings, subscriptions, sync_logs)
-- Uses user_id as owner. feed_token auto-generated for calendars.
-------------------------------------------------------------------------------

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  feed_token text not null unique default gen_random_uuid()::text,
  poll_interval_minutes integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  uid text not null,
  summary text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','tentative')),
  source text not null default 'manual' check (source in ('manual','imported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, uid)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  ical_url text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  direction text not null check (direction in ('import','export')),
  status text not null check (status in ('success','error')),
  message text,
  events_added int not null default 0,
  events_updated int not null default 0,
  events_removed int not null default 0,
  created_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- 1.7 is_admin() Helper Function
-------------------------------------------------------------------------------
create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = p_uid and r.role = 'admin'::public.app_role
  );
$$;

-------------------------------------------------------------------------------
-- 1.8 EXECUTE Privileges on is_admin()
-------------------------------------------------------------------------------
grant execute on function public.is_admin(uuid) to authenticated;
revoke execute on function public.is_admin(uuid) from anon;

-------------------------------------------------------------------------------
-- 1.9 RLS Policies for profiles
-------------------------------------------------------------------------------
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles"
on public.profiles for select
using (public.is_admin());

-------------------------------------------------------------------------------
-- 1.10 RLS Policies for user_roles (SELECT only)
-------------------------------------------------------------------------------
drop policy if exists "read own role" on public.user_roles;
create policy "read own role"
on public.user_roles for select
using (user_id = auth.uid());

drop policy if exists "admin read all roles" on public.user_roles;
create policy "admin read all roles"
on public.user_roles for select
using (public.is_admin());

-- No insert/update/delete policies (service role only)

-------------------------------------------------------------------------------
-- 1.11 RLS Policies for admin_audit_log
-------------------------------------------------------------------------------
drop policy if exists "admin read audit" on public.admin_audit_log;
create policy "admin read audit"
on public.admin_audit_log for select
using (public.is_admin());

-------------------------------------------------------------------------------
-- 1.12 Admin Audit RPC Function
-------------------------------------------------------------------------------
create or replace function public.admin_audit(
  p_action text,
  p_target_user_id uuid default null,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  insert into public.admin_audit_log(actor_user_id, action, target_user_id, meta)
  values (auth.uid(), p_action, p_target_user_id, coalesce(p_meta,'{}'::jsonb));
end;
$$;

-------------------------------------------------------------------------------
-- 1.13 EXECUTE Privileges on admin_audit()
-------------------------------------------------------------------------------
grant execute on function public.admin_audit(text, uuid, jsonb) to authenticated;
revoke execute on function public.admin_audit(text, uuid, jsonb) from anon;

-------------------------------------------------------------------------------
-- 1.14 Combined Bootstrap Trigger (profiles + roles)
-------------------------------------------------------------------------------
create or replace function public.handle_new_user_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.user_roles(user_id, role)
  values (new.id, 'tester'::public.app_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created_bootstrap on auth.users;

create trigger on_auth_user_created_bootstrap
after insert on auth.users
for each row execute function public.handle_new_user_bootstrap();

-------------------------------------------------------------------------------
-- 1.15 Email Synchronization Trigger (UPSERT, original casing)
-------------------------------------------------------------------------------
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    insert into public.profiles(id, email)
    values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_profile on auth.users;
create trigger on_auth_user_updated_profile
after update of email on auth.users
for each row execute function public.handle_user_email_update();

-------------------------------------------------------------------------------
-- 1.16 Last Admin Protection Trigger
-------------------------------------------------------------------------------
create or replace function public.prevent_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
begin
  if (tg_op = 'DELETE' and old.role = 'admin'::public.app_role)
     or (tg_op = 'UPDATE' and old.role = 'admin'::public.app_role and new.role <> old.role) then

    select count(*) into admin_count from public.user_roles where role = 'admin'::public.app_role;

    if admin_count <= 1 then
      raise exception 'Cannot remove/demote the last admin';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_last_admin_update on public.user_roles;
create trigger trg_prevent_last_admin_update
before update on public.user_roles
for each row execute function public.prevent_last_admin();

drop trigger if exists trg_prevent_last_admin_delete on public.user_roles;
create trigger trg_prevent_last_admin_delete
before delete on public.user_roles
for each row execute function public.prevent_last_admin();

-------------------------------------------------------------------------------
-- 1.17 Explicit Policy Drops (generated from pg_policies)
-------------------------------------------------------------------------------
-- none found for target tables at time of generation

-------------------------------------------------------------------------------
-- 1.18 Create/Update RLS Policies for app tables (calendars, bookings, subscriptions, sync_logs)
-- Admins read all via is_admin(); owners restricted by user_id with calendar linkage.
-------------------------------------------------------------------------------

-- Enable RLS on app tables
alter table public.calendars enable row level security;
alter table public.bookings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.sync_logs enable row level security;

-- REVOKE + GRANT pattern
revoke all on public.calendars from anon, authenticated;
grant select on public.calendars to authenticated;
grant insert, update, delete on public.calendars to authenticated;

revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;
grant insert, update, delete on public.bookings to authenticated;

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant insert, update, delete on public.subscriptions to authenticated;

revoke all on public.sync_logs from anon, authenticated;
grant select on public.sync_logs to authenticated;
grant insert, update, delete on public.sync_logs to authenticated;

-- Calendars policies (user_id used as owner column)
drop policy if exists "calendars read own or admin" on public.calendars;
create policy "calendars read own or admin"
on public.calendars for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "calendars insert own" on public.calendars;
create policy "calendars insert own"
on public.calendars for insert
with check (user_id = auth.uid());

drop policy if exists "calendars update own" on public.calendars;
create policy "calendars update own"
on public.calendars for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "calendars delete own" on public.calendars;
create policy "calendars delete own"
on public.calendars for delete
using (user_id = auth.uid());

-- Bookings policies (owner derived from calendar.user_id)
drop policy if exists "bookings read own or admin" on public.bookings;
create policy "bookings read own or admin"
on public.bookings for select
using (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "bookings insert own" on public.bookings;
create policy "bookings insert own"
on public.bookings for insert
with check (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "bookings update own" on public.bookings;
create policy "bookings update own"
on public.bookings for update
using (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "bookings delete own" on public.bookings;
create policy "bookings delete own"
on public.bookings for delete
using (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

-- Subscriptions policies (owner derived from calendar.user_id)
drop policy if exists "subscriptions read own or admin" on public.subscriptions;
create policy "subscriptions read own or admin"
on public.subscriptions for select
using (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "subscriptions insert own" on public.subscriptions;
create policy "subscriptions insert own"
on public.subscriptions for insert
with check (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "subscriptions update own" on public.subscriptions;
create policy "subscriptions update own"
on public.subscriptions for update
using (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "subscriptions delete own" on public.subscriptions;
create policy "subscriptions delete own"
on public.subscriptions for delete
using (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

-- sync_logs policies (owner derived from calendar.user_id)
drop policy if exists "sync_logs read own or admin" on public.sync_logs;
create policy "sync_logs read own or admin"
on public.sync_logs for select
using (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "sync_logs insert own" on public.sync_logs;
create policy "sync_logs insert own"
on public.sync_logs for insert
with check (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "sync_logs update own" on public.sync_logs;
create policy "sync_logs update own"
on public.sync_logs for update
using (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "sync_logs delete own" on public.sync_logs;
create policy "sync_logs delete own"
on public.sync_logs for delete
using (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

-------------------------------------------------------------------------------
-- 1.19 Data Invariants (user_id immutability, default on insert)
-------------------------------------------------------------------------------
create or replace function public.set_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null and auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_user_id_from_calendar()
returns trigger
language plpgsql
as $$
declare
  owner uuid;
begin
  if new.user_id is null and new.calendar_id is not null then
    select user_id into owner from public.calendars where id = new.calendar_id;
    if owner is not null then
      new.user_id := owner;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_user_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;
  return new;
end;
$$;

-- Calendars invariants
drop trigger if exists trg_set_user_id_calendars on public.calendars;
create trigger trg_set_user_id_calendars
before insert on public.calendars
for each row execute function public.set_user_id();

drop trigger if exists trg_prevent_user_change_calendars on public.calendars;
create trigger trg_prevent_user_change_calendars
before update on public.calendars
for each row execute function public.prevent_user_change();

-- Bookings invariants
drop trigger if exists trg_set_user_id_bookings on public.bookings;
create trigger trg_set_user_id_bookings
before insert on public.bookings
for each row execute function public.set_user_id_from_calendar();

drop trigger if exists trg_prevent_user_change_bookings on public.bookings;
create trigger trg_prevent_user_change_bookings
before update on public.bookings
for each row execute function public.prevent_user_change();

-- Subscriptions invariants
drop trigger if exists trg_set_user_id_subscriptions on public.subscriptions;
create trigger trg_set_user_id_subscriptions
before insert on public.subscriptions
for each row execute function public.set_user_id_from_calendar();

drop trigger if exists trg_prevent_user_change_subscriptions on public.subscriptions;
create trigger trg_prevent_user_change_subscriptions
before update on public.subscriptions
for each row execute function public.prevent_user_change();

-- sync_logs invariants
drop trigger if exists trg_set_user_id_sync_logs on public.sync_logs;
create trigger trg_set_user_id_sync_logs
before insert on public.sync_logs
for each row execute function public.set_user_id_from_calendar();

drop trigger if exists trg_prevent_user_change_sync_logs on public.sync_logs;
create trigger trg_prevent_user_change_sync_logs
before update on public.sync_logs
for each row execute function public.prevent_user_change();

-------------------------------------------------------------------------------
-- 1.20 Indexes
-------------------------------------------------------------------------------
create index if not exists user_roles_role_idx on public.user_roles(role);
create index if not exists profiles_created_at_idx on public.profiles(created_at desc);
create index if not exists profiles_email_trgm_idx
on public.profiles using gin ((email::text) gin_trgm_ops);

-- Optional helper indexes for app tables
create index if not exists calendars_user_id_idx on public.calendars(user_id);
create index if not exists calendars_feed_token_idx on public.calendars(feed_token);
create index if not exists bookings_calendar_id_idx on public.bookings(calendar_id);
create index if not exists subscriptions_calendar_id_idx on public.subscriptions(calendar_id);
create index if not exists sync_logs_calendar_id_idx on public.sync_logs(calendar_id);
