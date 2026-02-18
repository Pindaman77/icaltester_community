-- Fix increment_feed_rate_limit function permissions and security settings
-- This migration ensures the function has proper security definer and execute permissions

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

-- Grant execute permission to service role (implicit) and authenticated/anon for edge function calls
grant execute on function public.increment_feed_rate_limit(text, timestamptz) to authenticated, anon;

