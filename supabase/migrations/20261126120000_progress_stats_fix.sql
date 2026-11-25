-- get_progress_stats still called get_streak, dropped in 20261126110000_habit_cleanup,
-- so the progress screen failed. The app takes the streak from goal days (data/progress.ts)
-- and ignores this key, so the function is recreated without it.
begin;

-- Everything the progress screen needs in one round trip.
create or replace function public.get_progress_stats(p_tz text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as uid, (now() at time zone p_tz)::date as today
  ),
  activity as (
    select (r.reviewed_at at time zone p_tz)::date as day,
           count(*)::integer as reviews,
           (count(*) filter (where r.was_correct))::integer as correct
    from public.review_logs r, me
    where r.user_id = me.uid
      and r.reviewed_at >= ((me.today - 126)::timestamp at time zone p_tz)
    group by 1
  ),
  active_cards as (
    select c.due, c.reps, c.state, c.scheduled_days
    from public.cards c
    join public.user_words w on w.id = c.user_word_id
    cross join me
    where c.user_id = me.uid and c.status = 'active' and w.status = 'active'
  ),
  forecast as (
    select g.offset_days,
           (select count(*) from active_cards a
             where a.reps > 0
               and greatest((a.due at time zone p_tz)::date, me.today)
                   = me.today + g.offset_days)::integer as cards
    from me, generate_series(0, 6) as g(offset_days)
  )
  select jsonb_build_object(
    'today', me.today,
    'activity', coalesce(
      (select jsonb_agg(jsonb_build_object('day', day, 'reviews', reviews, 'correct', correct)
                        order by day) from activity),
      '[]'::jsonb),
    'recall_30d', (
      select jsonb_build_object(
        'reviews', count(*),
        'correct', count(*) filter (where r.was_correct))
      from public.review_logs r
      where r.user_id = me.uid and r.reviewed_at >= now() - interval '30 days'),
    'reviews_7d', (
      select count(*) from public.review_logs r
      where r.user_id = me.uid and r.reviewed_at >= now() - interval '7 days'),
    'forecast', (
      select jsonb_agg(jsonb_build_object('day', me.today + offset_days, 'cards', cards)
                       order by offset_days)
      from forecast),
    'stages', (
      select jsonb_build_object(
        'new', count(*) filter (where reps = 0),
        'learning', count(*) filter (where reps > 0 and state in ('Learning', 'Relearning')),
        'young', count(*) filter (where reps > 0 and state = 'Review' and scheduled_days < 21),
        'mature', count(*) filter (where reps > 0 and state = 'Review' and scheduled_days >= 21))
      from active_cards),
    'words', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where w.status = 'active'))
      from public.user_words w
      where w.user_id = me.uid)
  )
  from me;
$$;


commit;
