-- Memora schema v2 — fresh baseline.
-- Supersedes every earlier migration: drops all v1 objects (all data was
-- disposable test data) and creates the v2 schema from scratch.

-- ---------------------------------------------------------------------------
-- 1. Drop v1
-- ---------------------------------------------------------------------------
drop function if exists public.restore_memora_backup(jsonb);
drop function if exists public.clear_memora_materials();
drop function if exists public.reset_memora_learning_stats();

drop table if exists
  public.analytics_daily,
  public.media,
  public.note_tags,
  public.tags,
  public.import_rows,
  public.imports,
  public.review_logs,
  public.cards,
  public.notes,
  public.decks,
  public.profiles
cascade;

drop function if exists public.set_updated_at();

drop type if exists
  public.memora_module_type,
  public.memora_note_type,
  public.memora_card_state,
  public.memora_review_rating,
  public.memora_note_status,
  public.memora_import_status,
  public.memora_import_row_status
cascade;

-- ---------------------------------------------------------------------------
-- 2. Types and shared trigger
-- ---------------------------------------------------------------------------
create type public.word_source as enum ('program', 'manual', 'text', 'import');
create type public.word_status as enum ('active', 'paused', 'archived');
create type public.card_kind as enum (
  'recognition', 'recall', 'cloze', 'listening', 'sentence', 'speaking'
);
create type public.card_state as enum ('New', 'Learning', 'Review', 'Relearning');
create type public.card_status as enum ('active', 'paused');
create type public.review_rating as enum ('again', 'hard', 'good', 'easy');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Closed-beta allowlist
-- ---------------------------------------------------------------------------
-- RLS on, no policies: only the service role and the security definer
-- function below can read it.
create table public.allowed_emails (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

create function public.is_current_user_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_emails a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke execute on function public.is_current_user_allowed() from public, anon;
grant execute on function public.is_current_user_allowed() to authenticated;

insert into public.allowed_emails (email) values
  ('t0mmy.v4sk1s@gmail.com'),
  ('mishaboyko2015@gmail.com'),
  ('memora.e2e@example.com');

-- ---------------------------------------------------------------------------
-- 4. Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  daily_minutes integer not null default 15 check (daily_minutes between 5 and 180),
  goals text[] not null default '{}',
  -- Filled by the placement test (batch 4).
  level_estimate jsonb,
  -- Temporary knobs (daily new limit, review buttons) until batch 2.
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  timezone text not null default 'Europe/Kyiv' check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared dictionary of program words. Written only by the service role.
create table public.lexicon (
  id uuid primary key default gen_random_uuid(),
  lemma text not null check (char_length(lemma) between 1 and 200),
  part_of_speech text not null default '',
  frequency_rank integer check (frequency_rank > 0),
  source_list text,
  cefr text check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  content jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lemma, part_of_speech)
);

create table public.user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lexicon_id uuid references public.lexicon (id) on delete set null,
  lemma text not null check (char_length(lemma) between 1 and 200),
  source public.word_source not null default 'manual',
  status public.word_status not null default 'active',
  content jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign keys below (ownership must match).
  unique (id, user_id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  user_word_id uuid not null,
  kind public.card_kind not null,
  status public.card_status not null default 'active',
  state public.card_state not null default 'New',
  due timestamptz not null default now(),
  stability double precision not null default 0 check (stability >= 0),
  difficulty double precision not null default 0 check (difficulty >= 0),
  elapsed_days integer not null default 0 check (elapsed_days >= 0),
  scheduled_days integer not null default 0 check (scheduled_days >= 0),
  learning_steps integer not null default 0 check (learning_steps >= 0),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_review timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_word_id, kind),
  unique (id, user_id),
  foreign key (user_word_id, user_id)
    references public.user_words (id, user_id) on delete cascade
);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null,
  user_word_id uuid not null,
  rating public.review_rating not null,
  reviewed_at timestamptz not null default now(),
  elapsed_ms integer not null default 0 check (elapsed_ms >= 0),
  response_text text not null default '' check (char_length(response_text) <= 2000),
  was_correct boolean not null,
  schedule_before jsonb not null check (jsonb_typeof(schedule_before) = 'object'),
  schedule_after jsonb not null check (jsonb_typeof(schedule_after) = 'object'),
  foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete cascade,
  foreign key (user_word_id, user_id)
    references public.user_words (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
create unique index user_words_user_lemma_key on public.user_words (user_id, lower(lemma));
create index user_words_user_status_idx on public.user_words (user_id, status, created_at desc);
create index user_words_lexicon_idx on public.user_words (lexicon_id);
create index cards_user_status_due_idx on public.cards (user_id, status, due);
create index cards_word_user_idx on public.cards (user_word_id, user_id);
create index review_logs_user_reviewed_idx on public.review_logs (user_id, reviewed_at desc);
create index review_logs_card_user_idx on public.review_logs (card_id, user_id);
create index review_logs_word_user_idx on public.review_logs (user_word_id, user_id);

-- ---------------------------------------------------------------------------
-- 6. updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger lexicon_set_updated_at before update on public.lexicon
  for each row execute function public.set_updated_at();
create trigger user_words_set_updated_at before update on public.user_words
  for each row execute function public.set_updated_at();
create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row level security
-- ---------------------------------------------------------------------------
-- Permissive policies grant owners access to their rows; one restrictive
-- policy per table additionally requires the closed-beta allowlist, so a
-- signed-up but not invited account cannot read or write anything.
-- Public launch = make is_current_user_allowed() return true.
alter table public.profiles enable row level security;
alter table public.lexicon enable row level security;
alter table public.user_words enable row level security;
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;

create policy profiles_allowlisted on public.profiles as restrictive
  for all to authenticated
  using ((select public.is_current_user_allowed()))
  with check ((select public.is_current_user_allowed()));
create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy lexicon_allowlisted on public.lexicon as restrictive
  for select to authenticated
  using ((select public.is_current_user_allowed()));
create policy lexicon_select_all on public.lexicon for select to authenticated
  using (true);

create policy user_words_allowlisted on public.user_words as restrictive
  for all to authenticated
  using ((select public.is_current_user_allowed()))
  with check ((select public.is_current_user_allowed()));
create policy user_words_select_own on public.user_words for select to authenticated
  using ((select auth.uid()) = user_id);
create policy user_words_insert_own on public.user_words for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy user_words_update_own on public.user_words for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_words_delete_own on public.user_words for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy cards_allowlisted on public.cards as restrictive
  for all to authenticated
  using ((select public.is_current_user_allowed()))
  with check ((select public.is_current_user_allowed()));
create policy cards_select_own on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cards_insert_own on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy cards_update_own on public.cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cards_delete_own on public.cards for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy review_logs_allowlisted on public.review_logs as restrictive
  for all to authenticated
  using ((select public.is_current_user_allowed()))
  with check ((select public.is_current_user_allowed()));
create policy review_logs_select_own on public.review_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy review_logs_insert_own on public.review_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy review_logs_delete_own on public.review_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 8. Aggregation functions (security invoker: RLS applies)
-- ---------------------------------------------------------------------------

-- Counters for the practice screen. New-card limit = profiles.settings
-- daily_new_limit (default 8) minus first-ever reviews since local midnight.
create function public.get_practice_summary(p_tz text)
returns table (
  due_reviews integer,
  new_ready integer,
  new_today integer,
  daily_new_limit integer,
  next_due_at timestamptz,
  active_cards integer
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
  active as (
    select c.due, c.reps
    from public.cards c
    join public.user_words w on w.id = c.user_word_id
    cross join me
    where c.user_id = me.uid and c.status = 'active' and w.status = 'active'
  )
  select
    (select count(*) from active where reps > 0 and due <= now())::integer,
    (select count(*) from active where reps = 0 and due <= now())::integer,
    (select count(*) from public.review_logs r, me
       where r.user_id = me.uid and r.reviewed_at >= me.day_start
         and (r.schedule_before ->> 'reps')::integer = 0)::integer,
    coalesce((select (p.settings ->> 'daily_new_limit')::integer
                from public.profiles p, me where p.id = me.uid), 8),
    (select min(due) from active where reps > 0 and due > now()),
    (select count(*) from active)::integer;
$$;

-- Due cards for one practice session: every due review (most-forgotten
-- first, by FSRS retrievability) plus as many new cards as today's limit
-- allows (+ p_extra_new the learner asked for). Joined with word content so
-- the client can render prompts.
create function public.get_practice_queue(
  p_tz text,
  p_extra_new integer default 0,
  p_limit integer default 200
)
returns table (
  id uuid,
  user_word_id uuid,
  kind public.card_kind,
  state public.card_state,
  due timestamptz,
  stability double precision,
  difficulty double precision,
  elapsed_days integer,
  scheduled_days integer,
  learning_steps integer,
  reps integer,
  lapses integer,
  last_review timestamptz,
  lemma text,
  content jsonb
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
  allowance as (
    select greatest(
      0,
      coalesce((select (p.settings ->> 'daily_new_limit')::integer
                  from public.profiles p, me where p.id = me.uid), 8)
      - (select count(*) from public.review_logs r, me
           where r.user_id = me.uid and r.reviewed_at >= me.day_start
             and (r.schedule_before ->> 'reps')::integer = 0)
    ) + greatest(coalesce(p_extra_new, 0), 0) as n
  ),
  due_cards as (
    select c.id, c.user_word_id, c.kind, c.state, c.due, c.stability, c.difficulty,
           c.elapsed_days, c.scheduled_days, c.learning_steps, c.reps, c.lapses,
           c.last_review, w.lemma, w.content, w.created_at as word_created_at
    from public.cards c
    join public.user_words w on w.id = c.user_word_id
    cross join me
    where c.user_id = me.uid and c.status = 'active' and w.status = 'active'
      and c.due <= now()
  ),
  reviews as (
    select d.*
    from due_cards d
    where d.reps > 0
    order by power(
      1 + (19.0 / 81.0)
        * greatest(extract(epoch from now() - coalesce(d.last_review, d.due)) / 86400.0, 0)
        / greatest(d.stability, 0.01),
      -0.5
    ) asc, d.due asc
    limit greatest(coalesce(p_limit, 200), 1)
  ),
  news as (
    select d.*
    from due_cards d
    where d.reps = 0
    order by d.kind asc, d.word_created_at asc, d.id asc
    limit least(greatest(coalesce(p_limit, 200), 1), (select n from allowance))
  )
  select id, user_word_id, kind, state, due, stability, difficulty, elapsed_days,
         scheduled_days, learning_steps, reps, lapses, last_review, lemma, content
  from reviews
  union all
  select id, user_word_id, kind, state, due, stability, difficulty, elapsed_days,
         scheduled_days, learning_steps, reps, lapses, last_review, lemma, content
  from news;
$$;

-- Streak: consecutive local days with at least one review, ending today
-- (or yesterday if today has no reviews yet). week_days = review days of
-- the current Monday–Sunday week.
create function public.get_streak(p_tz text)
returns table (
  streak integer,
  reviewed_today boolean,
  today date,
  week_days date[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as uid, (now() at time zone p_tz)::date as today
  ),
  days as (
    select distinct (r.reviewed_at at time zone p_tz)::date as d
    from public.review_logs r, me
    where r.user_id = me.uid and r.reviewed_at >= now() - interval '400 days'
  ),
  anchor as (
    select case when exists (select 1 from days, me where d = me.today)
                then me.today else me.today - 1 end as a
    from me
  ),
  runs as (
    select d, d + (row_number() over (order by d desc))::integer as grp
    from days, anchor
    where d <= anchor.a
  )
  select
    (select count(*) from runs, anchor where grp = anchor.a + 1)::integer,
    exists (select 1 from days, me where d = me.today),
    me.today,
    coalesce(
      (select array_agg(d order by d) from days
        where d >= me.today - ((extract(isodow from me.today))::integer - 1)),
      '{}'
    )
  from me;
$$;

-- Everything the progress screen needs in one round trip.
create function public.get_progress_stats(p_tz text)
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
    'streak', (select to_jsonb(s) from public.get_streak(p_tz) s),
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

-- Replaces the caller's whole library with a backup in one transaction.
-- The payload is validated in TypeScript first; ids are regenerated.
create function public.restore_words_backup(p_words jsonb)
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
        elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review
      )
      values (
        v_uid, v_word_id,
        (v_card ->> 'kind')::public.card_kind,
        (v_card ->> 'status')::public.card_status,
        (v_card ->> 'state')::public.card_state,
        (v_card ->> 'due')::timestamptz,
        (v_card ->> 'stability')::double precision,
        (v_card ->> 'difficulty')::double precision,
        (v_card ->> 'elapsed_days')::integer,
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

revoke execute on function public.get_practice_summary(text) from public, anon;
revoke execute on function public.get_practice_queue(text, integer, integer) from public, anon;
revoke execute on function public.get_streak(text) from public, anon;
revoke execute on function public.get_progress_stats(text) from public, anon;
revoke execute on function public.restore_words_backup(jsonb) from public, anon;
grant execute on function public.get_practice_summary(text) to authenticated;
grant execute on function public.get_practice_queue(text, integer, integer) to authenticated;
grant execute on function public.get_streak(text) to authenticated;
grant execute on function public.get_progress_stats(text) to authenticated;
grant execute on function public.restore_words_backup(jsonb) to authenticated;
