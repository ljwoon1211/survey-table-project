-- Migration: 0012_sweep_stale_sessions
-- Purpose: pg_cron job that flags 24h-stale in_progress responses as drop,
--          and backfills the last pageVisits.leftAt so dwell-time analytics stay accurate.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION sweep_stale_sessions() RETURNS void AS $$
  UPDATE survey_responses
  SET
    status = 'drop',
    completed_at = last_activity_at,
    -- If the last pageVisits entry never got a leftAt (because the user closed the tab),
    -- backfill it with last_activity_at so A6 dwell-time distribution doesn't drop the row.
    page_visits = CASE
      WHEN jsonb_array_length(page_visits) > 0
       AND (page_visits -> -1 ->> 'leftAt') IS NULL
      THEN jsonb_set(
             page_visits,
             ARRAY[(jsonb_array_length(page_visits) - 1)::text, 'leftAt'],
             to_jsonb(last_activity_at::text)
           )
      ELSE page_visits
    END
  WHERE status = 'in_progress'
    AND last_activity_at < now() - interval '24 hours';
$$ LANGUAGE sql;

-- Idempotent reschedule: unschedule the existing job (if any) then schedule fresh.
-- Wrapping in a DO block so unschedule's "job not found" doesn't abort the migration.
DO $$
BEGIN
  PERFORM cron.unschedule('sweep-stale-sessions');
EXCEPTION
  WHEN OTHERS THEN
    -- job didn't exist; safe to ignore
    NULL;
END $$;

SELECT cron.schedule(
  'sweep-stale-sessions',
  '0 * * * *',                  -- every hour at :00
  $$SELECT sweep_stale_sessions()$$
);
