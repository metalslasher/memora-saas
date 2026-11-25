-- Batch 7 cleanup (applied after merge): the streak now comes from the daily-goal
-- rule with a weekly freeze; the old get_streak RPC has no callers.
begin;
drop function if exists public.get_streak(text);
commit;
