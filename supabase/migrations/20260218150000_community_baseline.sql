-- Community Edition consolidated baseline schema.
-- Fresh setup path: apply this migration on a new Supabase project.

set client_min_messages = warning;

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'tester' check (role = 'tester'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  feed_token text not null unique,
  feed_token_hash text not null unique,
  include_imported_in_export boolean not null default false,
  default_booking_status text not null default 'tentative'
    check (default_booking_status in ('pending', 'tentative', 'confirmed')),
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
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'tentative', 'pending')),
  source text not null default 'manual' check (source in ('manual', 'imported')),
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
  enabled boolean not null default true,
  poll_interval_sec int not null default 300,
  next_due_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_status int,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.imported_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  source_uid text not null,
  start_date date not null,
  end_date date not null,
  summary text not null default 'Imported',
  status text not null default 'confirmed',
  updated_at timestamptz not null default now(),
  unique (subscription_id, source_uid)
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  direction text not null check (direction in ('import', 'export')),
  status text not null check (status in ('success', 'error')),
  message text,
  events_added int not null default 0,
  events_updated int not null default 0,
  events_removed int not null default 0,
  ran_at timestamptz not null default now(),
  http_status int,
  bytes int,
  vevent_count int,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_rate_limits (
  token_hash text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (token_hash, window_start)
);

create table if not exists public.feed_access_audit (
  id uuid primary key default gen_random_uuid(),
  token_hash_prefix text,
  ip text,
  accessed_at timestamptz not null default now(),
  status_code int,
  is_rate_limited boolean not null default false
);

create table if not exists public.ics_cron_settings (
  id int primary key default 1 check (id = 1),
  cron_secret text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.generate_feed_token()
returns text
language sql
volatile
as $$
  select encode(gen_random_bytes(32), 'hex');
$$;

create or replace function public.set_feed_token_hash()
returns trigger
language plpgsql
as $$
begin
  if new.feed_token is null or new.feed_token = '' then
    new.feed_token := public.generate_feed_token();
  end if;

  new.feed_token_hash := encode(digest(new.feed_token, 'sha256'), 'hex');
  return new;
end;
$$;

create or replace function public.increment_feed_rate_limit(
  p_token_hash text,
  p_window_start timestamptz
) returns int
language sql
security definer
set search_path = public
as $$
  insert into public.feed_rate_limits (token_hash, window_start, count)
  values (p_token_hash, p_window_start, 1)
  on conflict (token_hash, window_start)
  do update set count = public.feed_rate_limits.count + 1
  returning count;
$$;

create or replace function public.cleanup_old_feed_rate_limits()
returns void
language plpgsql
as $$
begin
  delete from public.feed_rate_limits
  where window_start < now() - interval '2 hours';

  delete from public.feed_access_audit
  where accessed_at < now() - interval '7 days';
end;
$$;

create or replace function public.rotate_ics_cron_secret(p_function_url text, p_cron_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_function_url is null or p_function_url = '' then
    raise exception 'function_url required';
  end if;
  if p_cron_secret is null or p_cron_secret = '' then
    raise exception 'cron_secret required';
  end if;

  insert into public.ics_cron_settings (id, cron_secret, updated_at)
  values (1, p_cron_secret, now())
  on conflict (id)
  do update set cron_secret = excluded.cron_secret, updated_at = excluded.updated_at;

  if exists (select 1 from cron.job where jobname = 'ics-mock-cron-every-minute') then
    perform cron.unschedule('ics-mock-cron-every-minute');
  end if;

  perform cron.schedule(
    'ics-mock-cron-every-minute',
    '* * * * *',
    format($cron$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, p_function_url, p_cron_secret)
  );
end;
$$;

create or replace function public.handle_new_user_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    insert into public.profiles(id, email)
    values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
  end if;

  insert into public.user_roles(user_id, role)
  values (new.id, 'tester')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    insert into public.profiles(id, email)
    values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

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
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

drop trigger if exists trg_calendars_updated_at on public.calendars;
create trigger trg_calendars_updated_at
before update on public.calendars
for each row execute function public.set_updated_at();

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists trg_set_feed_token_hash on public.calendars;
create trigger trg_set_feed_token_hash
before insert or update of feed_token on public.calendars
for each row execute function public.set_feed_token_hash();

drop trigger if exists on_auth_user_created_bootstrap on auth.users;
create trigger on_auth_user_created_bootstrap
after insert on auth.users
for each row execute function public.handle_new_user_bootstrap();

drop trigger if exists on_auth_user_updated_profile on auth.users;
create trigger on_auth_user_updated_profile
after update of email on auth.users
for each row execute function public.handle_user_email_update();

drop trigger if exists trg_set_user_id_calendars on public.calendars;
create trigger trg_set_user_id_calendars
before insert on public.calendars
for each row execute function public.set_user_id();

drop trigger if exists trg_prevent_user_change_calendars on public.calendars;
create trigger trg_prevent_user_change_calendars
before update on public.calendars
for each row execute function public.prevent_user_change();

drop trigger if exists trg_set_user_id_bookings on public.bookings;
create trigger trg_set_user_id_bookings
before insert on public.bookings
for each row execute function public.set_user_id_from_calendar();

drop trigger if exists trg_prevent_user_change_bookings on public.bookings;
create trigger trg_prevent_user_change_bookings
before update on public.bookings
for each row execute function public.prevent_user_change();

drop trigger if exists trg_set_user_id_subscriptions on public.subscriptions;
create trigger trg_set_user_id_subscriptions
before insert on public.subscriptions
for each row execute function public.set_user_id_from_calendar();

drop trigger if exists trg_prevent_user_change_subscriptions on public.subscriptions;
create trigger trg_prevent_user_change_subscriptions
before update on public.subscriptions
for each row execute function public.prevent_user_change();

drop trigger if exists trg_set_user_id_sync_logs on public.sync_logs;
create trigger trg_set_user_id_sync_logs
before insert on public.sync_logs
for each row execute function public.set_user_id_from_calendar();

drop trigger if exists trg_prevent_user_change_sync_logs on public.sync_logs;
create trigger trg_prevent_user_change_sync_logs
before update on public.sync_logs
for each row execute function public.prevent_user_change();

drop trigger if exists trg_set_user_id_imported_events on public.imported_events;
create trigger trg_set_user_id_imported_events
before insert on public.imported_events
for each row execute function public.set_user_id_from_calendar();

drop trigger if exists trg_prevent_user_change_imported_events on public.imported_events;
create trigger trg_prevent_user_change_imported_events
before update on public.imported_events
for each row execute function public.prevent_user_change();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.calendars enable row level security;
alter table public.bookings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.imported_events enable row level security;
alter table public.sync_logs enable row level security;
alter table public.ics_cron_settings enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

revoke all on public.calendars from anon, authenticated;
grant select, insert, update, delete on public.calendars to authenticated;

revoke all on public.bookings from anon, authenticated;
grant select, insert, update, delete on public.bookings to authenticated;

revoke all on public.subscriptions from anon, authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;

revoke all on public.imported_events from anon, authenticated;
grant select, insert, update, delete on public.imported_events to authenticated;

revoke all on public.sync_logs from anon, authenticated;
grant select, insert, update, delete on public.sync_logs to authenticated;

revoke all on public.feed_rate_limits from anon, authenticated;
revoke all on public.feed_access_audit from anon, authenticated;
revoke all on public.ics_cron_settings from public, anon, authenticated;
grant select, insert, update, delete on public.ics_cron_settings to service_role;

revoke all on function public.increment_feed_rate_limit(text, timestamptz) from public, anon, authenticated;
grant execute on function public.increment_feed_rate_limit(text, timestamptz) to service_role;

revoke all on function public.rotate_ics_cron_secret(text, text) from public, anon, authenticated;
grant execute on function public.rotate_ics_cron_secret(text, text) to service_role;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "read own role" on public.user_roles;
create policy "read own role"
on public.user_roles for select
using (user_id = auth.uid());

drop policy if exists "calendars own" on public.calendars;
create policy "calendars own"
on public.calendars for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "bookings own" on public.bookings;
create policy "bookings own"
on public.bookings for all
using (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "subscriptions own" on public.subscriptions;
create policy "subscriptions own"
on public.subscriptions for all
using (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "imported_events own" on public.imported_events;
create policy "imported_events own"
on public.imported_events for all
using (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

drop policy if exists "sync_logs own" on public.sync_logs;
create policy "sync_logs own"
on public.sync_logs for all
using (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.calendars c
    where c.id = calendar_id and c.user_id = auth.uid()
  )
);

create index if not exists calendars_user_id_idx on public.calendars(user_id);
create index if not exists calendars_feed_token_hash_idx on public.calendars(feed_token_hash);
create index if not exists bookings_calendar_id_idx on public.bookings(calendar_id);
create index if not exists subscriptions_calendar_id_idx on public.subscriptions(calendar_id);
create index if not exists subscriptions_next_due_at_enabled_idx
on public.subscriptions(next_due_at)
where enabled = true;
create index if not exists imported_events_calendar_id_idx on public.imported_events(calendar_id);
create index if not exists imported_events_subscription_id_idx on public.imported_events(subscription_id);
create index if not exists sync_logs_calendar_id_idx on public.sync_logs(calendar_id);
create index if not exists sync_logs_subscription_id_idx on public.sync_logs(subscription_id);
create index if not exists feed_rate_limits_window_start_idx on public.feed_rate_limits(window_start);
create index if not exists feed_access_audit_time_idx on public.feed_access_audit(accessed_at);

do $do$
begin
  if not exists (
    select 1 from cron.job where jobname = 'cleanup-feed-rate-limits'
  ) then
    perform cron.schedule(
      'cleanup-feed-rate-limits',
      '0 * * * *',
      'select public.cleanup_old_feed_rate_limits()'
    );
  end if;
end;
$do$;

reset client_min_messages;
