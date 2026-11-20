-- Batch 2 — practice engine (part 2, cleanup).
--
-- APPLY RIGHT AFTER batch-2-practice-engine IS MERGED INTO main: the batch-1
-- code still reads profiles.settings, cards.elapsed_days and calls
-- get_practice_summary / get_practice_queue, so applying this earlier breaks prod.
--
--   supabase db query --linked -f supabase/migrations/20261120100000_practice_engine_cleanup.sql
--   insert into supabase_migrations.schema_migrations (version, name)
--     values ('20261120100000', 'practice_engine_cleanup');
--   supabase gen types typescript --linked > src/lib/supabase/database.types.ts

begin;

-- Replaced by get_practice_overview / get_practice_cards.
drop function if exists public.get_practice_summary(text);
drop function if exists public.get_practice_queue(text, integer, integer);

-- Daily new-card limit and 2/4 grade buttons are gone: pace comes from
-- profiles.daily_minutes and ratings are automatic.
alter table public.profiles drop column if exists settings;

-- ts-fsrs 6 no longer has Card.elapsed_days.
alter table public.cards drop column if exists elapsed_days;

-- Cards the batch-1 code kept creating for new words while the batch was in
-- review: exercises open lazily now.
delete from public.cards c
where c.kind <> 'recognition'
  and c.reps = 0
  and not exists (
    select 1 from public.cards r
    where r.user_word_id = c.user_word_id
      and r.kind = 'recognition'
      and r.state = 'Review'
      and r.scheduled_days >= 1
  );

commit;
