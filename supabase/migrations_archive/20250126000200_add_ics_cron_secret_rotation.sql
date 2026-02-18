-- Store cron secret server-side and allow secure rotation/reschedule
CREATE TABLE IF NOT EXISTS public.ics_cron_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ics_cron_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ics_cron_settings FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ics_cron_settings TO service_role;

CREATE OR REPLACE FUNCTION public.rotate_ics_cron_secret(p_function_url text, p_cron_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_function_url IS NULL OR p_function_url = '' THEN
    RAISE EXCEPTION 'function_url required';
  END IF;
  IF p_cron_secret IS NULL OR p_cron_secret = '' THEN
    RAISE EXCEPTION 'cron_secret required';
  END IF;

  INSERT INTO public.ics_cron_settings (id, cron_secret, updated_at)
  VALUES (1, p_cron_secret, now())
  ON CONFLICT (id)
  DO UPDATE SET cron_secret = EXCLUDED.cron_secret, updated_at = EXCLUDED.updated_at;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ics-mock-cron-every-minute') THEN
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
    $cron$, p_function_url, p_cron_secret)
  );
END $$;

REVOKE ALL ON FUNCTION public.rotate_ics_cron_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_ics_cron_secret(text, text) TO service_role;
