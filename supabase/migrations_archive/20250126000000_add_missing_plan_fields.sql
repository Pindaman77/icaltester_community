-- Add missing fields to calendars table
ALTER TABLE public.calendars
  ADD COLUMN IF NOT EXISTS include_imported_in_export boolean NOT NULL DEFAULT false;

-- Add missing fields to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS poll_interval_sec int NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS next_due_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_status int,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Update existing subscriptions to have next_due_at = now() if null
UPDATE public.subscriptions
SET next_due_at = now()
WHERE next_due_at IS NULL;

-- Create imported_events table (separate from bookings)
CREATE TABLE IF NOT EXISTS public.imported_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  source_uid text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL, -- exclusive
  summary text NOT NULL DEFAULT 'Imported',
  status text NOT NULL DEFAULT 'confirmed',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, source_uid)
);

-- Enable RLS on imported_events
ALTER TABLE public.imported_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for imported_events
CREATE POLICY "own imported events" ON public.imported_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Update sync_logs to match plan structure (add missing fields)
ALTER TABLE public.sync_logs
  ADD COLUMN IF NOT EXISTS ran_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS http_status int,
  ADD COLUMN IF NOT EXISTS bytes int,
  ADD COLUMN IF NOT EXISTS vevent_count int;

-- Create index for next_due_at queries (for cron)
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_due_at
  ON public.subscriptions(next_due_at)
  WHERE enabled = true;
