-- Migration: 0029_sweep_threshold_3h
-- Purpose: in_progress 응답을 drop으로 전환하는 stale 임계값을 24h → 3h로 낮춘다.
--          함수 본문만 교체한다(cron 스케줄·백필 로직은 0012 그대로 유지).

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
    AND last_activity_at < now() - interval '3 hours';
$$ LANGUAGE sql;
