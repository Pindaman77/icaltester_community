-- Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cron job (replace PROJECT_REF and SECRET with actual values)
DO $$
DECLARE
  project_ref text := '<YOUR_PROJECT_REF>';
  cron_secret text := '<YOUR_ICS_CRON_SECRET>';
  function_url text := format('https://%s.functions.supabase.co/ics_cron', project_ref);
BEGIN
  IF project_ref = '<YOUR_PROJECT_REF>' OR cron_secret = '<YOUR_ICS_CRON_SECRET>' THEN
    RAISE NOTICE 'Skipping cron schedule; set PROJECT_REF/ICS_CRON_SECRET (Community Edition: see docs/community-cron-runbook.md).';
  ELSE
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'ics-mock-cron-every-minute'
  ) THEN
    PERFORM cron.unschedule('ics-mock-cron-every-minute');
  END IF;

  PERFORM cron.schedule(
    'ics-mock-cron-every-minute',
    '* * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, function_url, cron_secret)
  );
  END IF;
END $$;
