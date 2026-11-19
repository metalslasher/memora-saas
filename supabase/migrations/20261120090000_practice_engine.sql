-- Batch 2 — practice engine (part 1, compatible with the batch-1 code on main).
--
-- * get_practice_overview / get_practice_cards replace get_practice_summary /
--   get_practice_queue (dropped in part 2, once main runs the new code):
--   sibling burying (one card per word a day), pace-based new words
--   (computed in TypeScript, lib/memora/pace.ts), ordering by FSRS-6
--   retrievability done in TypeScript (lib/memora/queue.ts).
-- * daily_minutes: only the values the settings screen offers.
-- * restore_words_backup no longer writes cards.elapsed_days (removed from
--   ts-fsrs 6; the column is dropped in part 2).
-- * Exercises are unlocked lazily: unstarted non-recognition cards of words
--   whose recognition card has not graduated yet are removed (test data).

begin;

-- ---------------------------------------------------------------------------
-- Minutes per day
-- ---------------------------------------------------------------------------
update public.profiles set daily_minutes = 15
  where daily_minutes not in (5, 10, 15, 20, 30);
alter table public.profiles drop constraint if exists profiles_daily_minutes_check;
alter table public.profiles add constraint profiles_daily_minutes_check
  check (daily_minutes in (5, 10, 15, 20, 30));

-- ---------------------------------------------------------------------------
-- Lazy exercises: drop cards that would not be unlocked yet
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Practice overview: counters for the badge and the pace formula.
-- A card is "available today" when it is due and its word was not rated
-- today — or it is the same card coming back for a learning step.
-- New words = recognition cards never reviewed.
-- ---------------------------------------------------------------------------
create function public.get_practice_overview(p_tz text)
returns table (
  due_words integer,
  reviews_today integer,
  new_ready integer,
  new_today integer,
  daily_minutes integer,
  next_due_at timestamptz,
  active_cards integer,
  day_start timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as uid,
           date_trunc('day', now() at time zone p_tz) at time zone p_tz as day_start,
           (date_trunc('day', now() at time zone p_tz) + interval '1 day') at time zone p_tz as next_day
  ),
  touched as (
    select c.user_word_id, max(c.last_review) as reviewed_at
    from public.cards c, me
    where c.user_id = me.uid and c.last_review >= me.day_start
    group by c.user_word_id
  ),
  active as (
    select c.user_word_id, c.kind, c.due, c.reps, c.state, c.last_review,
           t.user_word_id is not null as word_touched
    from public.cards c
    join public.user_words w on w.id = c.user_word_id
    left join touched t on t.user_word_id = c.user_word_id
    cross join me
    where c.user_id = me.uid and c.status = 'active' and w.status = 'active'
  ),
  today_logs as (
    select (r.schedule_before ->> 'reps')::integer = 0 and c.kind = 'recognition' as first_look,
           r.user_word_id
    from public.review_logs r
    join public.cards c on c.id = r.card_id
    cross join me
    where r.user_id = me.uid and r.reviewed_at >= me.day_start
  )
  select
    (select count(distinct a.user_word_id) from active a, me
       where a.due <= now()
         and not (a.kind = 'recognition' and a.reps = 0)
         and (not a.word_touched
              or (a.last_review >= me.day_start and a.state in ('Learning', 'Relearning'))))::integer,
    (select count(*) from today_logs where not first_look)::integer,
    (select count(distinct a.user_word_id) from active a
       where a.kind = 'recognition' and a.reps = 0 and a.due <= now() and not a.word_touched)::integer,
    (select count(distinct user_word_id) from today_logs where first_look)::integer,
    coalesce((select p.daily_minutes from public.profiles p, me where p.id = me.uid), 15),
    least(
      (select min(a.due) from active a where a.reps > 0 and a.due > now()),
      (select me.next_day from me
        where exists (select 1 from active a where a.due <= now() and a.word_touched
                        and not (a.kind = 'recognition' and a.reps = 0)))
    ),
    (select count(*) from active)::integer,
    (select day_start from me);
$$;

-- ---------------------------------------------------------------------------
-- Practice cards: everything a session may show, with word content.
-- * reviews and unlocked exercises available today (burying applied), plus
--   learning-step cards coming due within the hour (the client re-checks
--   due times every minute);
-- * the first p_new_words new words (oldest first); TypeScript keeps as
--   many as today's pace allows.
-- word_reviewed_at = latest review of any card of the word, so the client
-- can keep burying siblings during the session.
-- ---------------------------------------------------------------------------
create function public.get_practice_cards(
  p_tz text,
  p_new_words integer default 50,
  p_limit integer default 300
)
returns table (
  id uuid,
  user_word_id uuid,
  kind public.card_kind,
  state public.card_state,
  due timestamptz,
  stability double precision,
  difficulty double precision,
  scheduled_days integer,
  learning_steps integer,
  reps integer,
  lapses integer,
  last_review timestamptz,
  lemma text,
  content jsonb,
  word_reviewed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as uid,
           date_trunc('day', now() at time zone p_tz) at time zone p_tz as day_start
  ),
  word_reviews as (
    select c.user_word_id, max(c.last_review) as reviewed_at
    from public.cards c, me
    where c.user_id = me.uid and c.last_review is not null
    group by c.user_word_id
  ),
  active as (
    select c.id, c.user_word_id, c.kind, c.state, c.due, c.stability, c.difficulty,
           c.scheduled_days, c.learning_steps, c.reps, c.lapses, c.last_review,
           w.lemma, w.content, w.created_at as word_created_at,
           wr.reviewed_at as word_reviewed_at,
           coalesce(wr.reviewed_at >= me.day_start, false) as word_touched,
           me.day_start
    from public.cards c
    join public.user_words w on w.id = c.user_word_id
    left join word_reviews wr on wr.user_word_id = c.user_word_id
    cross join me
    where c.user_id = me.uid and c.status = 'active' and w.status = 'active'
  ),
  reviews as (
    select a.*
    from active a
    where not (a.kind = 'recognition' and a.reps = 0)
      and (
        (a.due <= now() and not a.word_touched)
        or (a.last_review >= a.day_start and a.state in ('Learning', 'Relearning')
            and a.due <= now() + interval '1 hour')
      )
    order by a.due asc
    limit greatest(coalesce(p_limit, 300), 1)
  ),
  news as (
    select a.*
    from active a
    where a.kind = 'recognition' and a.reps = 0 and a.due <= now() and not a.word_touched
    order by a.word_created_at asc, a.id asc
    limit least(greatest(coalesce(p_new_words, 50), 0), 200)
  )
  select id, user_word_id, kind, state, due, stability, difficulty, scheduled_days,
         learning_steps, reps, lapses, last_review, lemma, content, word_reviewed_at
  from reviews
  union all
  select id, user_word_id, kind, state, due, stability, difficulty, scheduled_days,
         learning_steps, reps, lapses, last_review, lemma, content, word_reviewed_at
  from news;
$$;

revoke execute on function public.get_practice_overview(text) from public, anon;
revoke execute on function public.get_practice_cards(text, integer, integer) from public, anon;
grant execute on function public.get_practice_overview(text) to authenticated;
grant execute on function public.get_practice_cards(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Backup restore without cards.elapsed_days (the column keeps its default).
-- ---------------------------------------------------------------------------
create or replace function public.restore_words_backup(p_words jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_word jsonb;
  v_card jsonb;
  v_word_id uuid;
  v_card_id uuid;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if jsonb_typeof(p_words) <> 'array' then
    raise exception 'Backup words must be an array';
  end if;

  delete from public.user_words where user_id = v_uid;

  for v_word in select value from jsonb_array_elements(p_words) loop
    insert into public.user_words (user_id, lemma, source, status, content, created_at)
    values (
      v_uid,
      v_word ->> 'lemma',
      (v_word ->> 'source')::public.word_source,
      (v_word ->> 'status')::public.word_status,
      coalesce(v_word -> 'content', '{}'::jsonb),
      coalesce((v_word ->> 'created_at')::timestamptz, now())
    )
    returning id into v_word_id;

    for v_card in select value from jsonb_array_elements(coalesce(v_word -> 'cards', '[]'::jsonb)) loop
      insert into public.cards (
        user_id, user_word_id, kind, status, state, due, stability, difficulty,
        scheduled_days, learning_steps, reps, lapses, last_review
      )
      values (
        v_uid, v_word_id,
        (v_card ->> 'kind')::public.card_kind,
        (v_card ->> 'status')::public.card_status,
        (v_card ->> 'state')::public.card_state,
        (v_card ->> 'due')::timestamptz,
        (v_card ->> 'stability')::double precision,
        (v_card ->> 'difficulty')::double precision,
        (v_card ->> 'scheduled_days')::integer,
        (v_card ->> 'learning_steps')::integer,
        (v_card ->> 'reps')::integer,
        (v_card ->> 'lapses')::integer,
        (v_card ->> 'last_review')::timestamptz
      )
      returning id into v_card_id;

      insert into public.review_logs (
        user_id, card_id, user_word_id, rating, reviewed_at, elapsed_ms,
        response_text, was_correct, schedule_before, schedule_after
      )
      select
        v_uid, v_card_id, v_word_id,
        (r ->> 'rating')::public.review_rating,
        (r ->> 'reviewed_at')::timestamptz,
        (r ->> 'elapsed_ms')::integer,
        coalesce(r ->> 'response_text', ''),
        (r ->> 'was_correct')::boolean,
        r -> 'schedule_before',
        r -> 'schedule_after'
      from jsonb_array_elements(coalesce(v_card -> 'reviews', '[]'::jsonb)) as r;
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

commit;
