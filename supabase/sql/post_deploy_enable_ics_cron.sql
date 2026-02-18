-- Community post-deploy step: enable scheduled ICS sync.
-- Run this after deploying edge functions and choosing your ICS_CRON_SECRET.
--
-- Example:
--   psql "$SUPABASE_DB_URL" -f supabase/sql/post_deploy_enable_ics_cron.sql
--
-- Then replace placeholder values below and run:
--   select public.rotate_ics_cron_secret('https://<project-ref>.functions.supabase.co/ics_cron', '<your-ics-cron-secret>');

select public.rotate_ics_cron_secret(
  'https://<project-ref>.functions.supabase.co/ics_cron',
  '<your-ics-cron-secret>'
);
