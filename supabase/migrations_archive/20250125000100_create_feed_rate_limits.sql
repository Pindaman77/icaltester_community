-- Aggregated rate limit counters and optional audit log for feed access.

create table if not exists public.feed_rate_limits (
  token_hash text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (token_hash, window_start)
);

create index if not exists feed_rate_limits_window_start_idx
on public.feed_rate_limits(window_start);

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

-- Grant execute permission to service role (implicit) and authenticated for potential direct calls
grant execute on function public.increment_feed_rate_limit(text, timestamptz) to authenticated, anon;

create table if not exists public.feed_access_audit (
  id uuid primary key default gen_random_uuid(),
  token_hash_prefix text,
  ip text,
  accessed_at timestamptz not null default now(),
  status_code int,
  is_rate_limited boolean not null default false
);

create index if not exists feed_access_audit_time_idx
on public.feed_access_audit(accessed_at);

revoke all on public.feed_rate_limits from anon, authenticated;
revoke all on public.feed_access_audit from anon, authenticated;
