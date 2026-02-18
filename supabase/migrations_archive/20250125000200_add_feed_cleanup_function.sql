-- Cleanup functions and pg_cron job for feed rate limit retention.

create extension if not exists pg_cron;

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
