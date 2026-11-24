-- Batch 4 — program and onboarding (additive, compatible with the batch-3 code on main).
--
-- * profiles: onboarding flag, program position (program_rank, known_rank),
--   last calibration time. The vocabulary test result goes into the existing
--   level_estimate jsonb.
-- * user_words.assumed_known: program words the test credited as passively
--   known; they start with an active exercise (recall) instead of recognition.
-- * lexicon_lists: which program list a lexicon entry belongs to, with its
--   rank in that list (one lemma can be in NGSL, NGSL-Spoken and BSL at once).
-- * New word = a word none of whose cards was ever reviewed (was: an unreviewed
--   recognition card). Same result for every existing word; it also covers
--   words that start with recall. Own words come before program words.
-- * get_program_candidates / get_program_calibration for the daily feed.
-- * ai_usage features: program (daily feed enrichment), program_build
--   (one-off generation of themed lists and the test pool).

begin;

-- ---------------------------------------------------------------------------
-- AI usage features
-- ---------------------------------------------------------------------------
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('enrich_word', 'enrich_batch', 'tts', 'compare', 'program', 'program_build'));

-- ---------------------------------------------------------------------------
-- Profiles and words
-- ---------------------------------------------------------------------------
alter table public.profiles add column onboarded_at timestamptz;
alter table public.profiles add column program_rank integer check (program_rank > 0);
alter table public.profiles add column known_rank integer check (known_rank >= 0);
alter table public.profiles add column calibrated_at timestamptz;

alter table public.user_words add column assumed_known boolean not null default false;

-- ---------------------------------------------------------------------------
-- Program lists
-- ---------------------------------------------------------------------------
create table public.lexicon_lists (
  list text not null check (list in ('ngsl', 'ngsl_spoken', 'bsl', 'theme_work', 'theme_travel', 'theme_talk')),
  lexicon_id uuid not null references public.lexicon (id) on delete cascade,
  rank integer not null check (rank > 0),
  primary key (list, lexicon_id)
);
create index lexicon_lists_list_rank_idx on public.lexicon_lists (list, rank);
create index lexicon_lists_lexicon_idx on public.lexicon_lists (lexicon_id);

alter table public.lexicon_lists enable row level security;
create policy lexicon_lists_allowlisted on public.lexicon_lists as restrictive
  for select to authenticated
  using ((select public.is_current_user_allowed()));
create policy lexicon_lists_select_all on public.lexicon_lists for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Practice overview (new word = never reviewed word)
-- ---------------------------------------------------------------------------
create or replace function public.get_practice_overview(p_tz text)
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
  word_reviews as (
    select c.user_word_id, max(c.last_review) as reviewed_at
    from public.cards c, me
    where c.user_id = me.uid and c.last_review is not null
    group by c.user_word_id
  ),
  active as (
    select c.user_word_id, c.kind, c.due, c.reps, c.state, c.last_review,
           coalesce(wr.reviewed_at >= me.day_start, false) as word_touched,
           wr.user_word_id is null as word_new
    from public.cards c
    join public.user_words w on w.id = c.user_word_id
    left join word_reviews wr on wr.user_word_id = c.user_word_id
    cross join me
    where c.user_id = me.uid and c.status = 'active' and w.status = 'active'
  ),
  today_logs as (
    select (r.schedule_before ->> 'reps')::integer = 0
             and not exists (
               select 1 from public.review_logs e
               where e.user_word_id = r.user_word_id and e.reviewed_at < r.reviewed_at
             ) as first_look,
           r.user_word_id
    from public.review_logs r
    cross join me
    where r.user_id = me.uid and r.reviewed_at >= me.day_start
  )
  select
    (select count(distinct a.user_word_id) from active a, me
       where a.due <= now()
         and not a.word_new
         and (not a.word_touched
              or (a.last_review >= me.day_start and a.state in ('Learning', 'Relearning'))))::integer,
    (select count(*) from today_logs where not first_look)::integer,
    (select count(distinct a.user_word_id) from active a
       where a.word_new and a.due <= now())::integer,
    (select count(distinct user_word_id) from today_logs where first_look)::integer,
    coalesce((select p.daily_minutes from public.profiles p, me where p.id = me.uid), 15),
    least(
      (select min(a.due) from active a where a.reps > 0 and a.due > now()),
      (select me.next_day from me
        where exists (select 1 from active a where a.due <= now() and a.word_touched and not a.word_new))
    ),
    (select count(*) from active)::integer,
    (select day_start from me);
$$;

-- ---------------------------------------------------------------------------
-- Practice cards (new word = never reviewed word; own words before program)
-- ---------------------------------------------------------------------------
create or replace function public.get_practice_cards(
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
           w.lemma, w.content, w.created_at as word_created_at, w.source as word_source,
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
    where a.word_reviewed_at is not null
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
    where a.word_reviewed_at is null and a.due <= now()
    order by (a.word_source = 'program') asc, a.word_created_at asc, a.id asc
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

-- ---------------------------------------------------------------------------
-- Daily feed: next words of a program list that are not in the library yet.
-- ---------------------------------------------------------------------------
create function public.get_program_candidates(p_list text, p_min_rank integer, p_limit integer)
returns table (
  lexicon_id uuid,
  lemma text,
  list_rank integer,
  frequency_rank integer,
  content jsonb,
  enriched boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id, l.lemma, ll.rank, l.frequency_rank, l.content, l.enriched_at is not null
  from public.lexicon_lists ll
  join public.lexicon l on l.id = ll.lexicon_id
  where ll.list = p_list
    and ll.rank >= coalesce(p_min_rank, 1)
    and not exists (
      select 1 from public.user_words w
      where w.user_id = (select auth.uid())
        and (lower(w.lemma) = l.lemma or w.lexicon_id = l.id)
    )
  order by ll.rank asc
  limit least(greatest(coalesce(p_limit, 20), 0), 100);
$$;

-- ---------------------------------------------------------------------------
-- Calibration: first-ever reviews of program words since a moment.
-- ---------------------------------------------------------------------------
create function public.get_program_calibration(p_since timestamptz)
returns table (
  assumed_known boolean,
  rating public.review_rating,
  reviewed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.assumed_known, r.rating, r.reviewed_at
  from public.review_logs r
  join public.user_words w on w.id = r.user_word_id
  where r.user_id = (select auth.uid())
    and w.source = 'program'
    and r.reviewed_at >= coalesce(p_since, '-infinity'::timestamptz)
    and (r.schedule_before ->> 'reps')::integer = 0
    and not exists (
      select 1 from public.review_logs e
      where e.user_word_id = r.user_word_id and e.reviewed_at < r.reviewed_at
    )
  order by r.reviewed_at desc
  limit 60;
$$;

revoke execute on function public.get_program_candidates(text, integer, integer) from public, anon;
revoke execute on function public.get_program_calibration(timestamptz) from public, anon;
grant execute on function public.get_program_candidates(text, integer, integer) to authenticated;
grant execute on function public.get_program_calibration(timestamptz) to authenticated;

commit;
