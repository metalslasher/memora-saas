-- Batch 7 — habit: daily goal, streak with a weekly freeze, web push reminders.
-- Additive and compatible with the batch-6 code on main (which ignores all of this).
--
-- * review_logs.counted_ms: time the session timer counted for the review (idle capped).
-- * goal_days: one row per local day on which the daily goal was reached; the streak is
--   computed from it in TypeScript (streak.ts). The condition "queue is empty" cannot be
--   rebuilt from logs afterwards, hence a stored record. Backfilled from past reviews.
-- * profiles: reminder switch, window (local hours, start inclusive / end exclusive), last day pushed.
-- * push_subscriptions: one row per device; save_push_subscription() moves a device to the current account.
-- * get_day_activity(): today's counted time and reviews for the signed-in user.
-- * get_reminder_candidates(): service role only, input for /api/cron/reminders.
-- * pg_cron job: hourly call of /api/cron/reminders with the secret from Vault ('cron_secret').
--   Until the route exists in production the call is a harmless 404.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.review_logs
  add column counted_ms integer not null default 0 check (counted_ms >= 0);

create table public.goal_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  reason text not null check (reason in ('minutes', 'queue', 'history')),
  active_ms integer not null default 0 check (active_ms >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.goal_days enable row level security;
create policy goal_days_allowlisted on public.goal_days as restrictive
  for all to authenticated
  using ((select public.is_current_user_allowed()))
  with check ((select public.is_current_user_allowed()));
create policy goal_days_select_own on public.goal_days for select to authenticated
  using ((select auth.uid()) = user_id);
create policy goal_days_insert_own on public.goal_days for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy goal_days_update_own on public.goal_days for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goal_days_delete_own on public.goal_days for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.profiles
  add column reminders_enabled boolean not null default false,
  add column reminder_start smallint not null default 19 check (reminder_start between 0 and 23),
  add column reminder_end smallint not null default 22 check (reminder_end between 1 and 24),
  add column last_reminder_day date,
  add constraint profiles_reminder_window check (reminder_start < reminder_end);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) <= 512),
  auth text not null check (char_length(auth) <= 512),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_allowlisted on public.push_subscriptions as restrictive
  for all to authenticated
  using ((select public.is_current_user_allowed()))
  with check ((select public.is_current_user_allowed()));
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- A device (endpoint) belongs to whoever subscribed last; RLS alone cannot move it
-- from another account, so this runs as definer and only ever writes auth.uid().
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_current_user_allowed()) then
    raise exception 'not allowed';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Counted time and reviews of the signed-in user's current local day.
create function public.get_day_activity(p_tz text)
returns table (day date, day_start timestamptz, active_ms bigint, reviews integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as uid,
           (now() at time zone p_tz)::date as d,
           date_trunc('day', now() at time zone p_tz) at time zone p_tz as ds
  )
  select me.d, me.ds,
         coalesce(sum(greatest(r.counted_ms, least(r.elapsed_ms, 90000))), 0)::bigint,
         count(r.id)::integer
  from me
  left join public.review_logs r on r.user_id = me.uid and r.reviewed_at >= me.ds
  group by me.d, me.ds;
$$;
revoke execute on function public.get_day_activity(text) from public, anon;
grant execute on function public.get_day_activity(text) to authenticated;

-- Users to consider for a reminder (the route applies window / day rules in TypeScript).
create function public.get_reminder_candidates(p_now timestamptz default now())
returns table (
  user_id uuid,
  timezone text,
  reminder_start smallint,
  reminder_end smallint,
  last_reminder_day date,
  daily_minutes integer,
  met_days date[],
  due_words integer,
  new_ready integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.timezone, p.reminder_start, p.reminder_end, p.last_reminder_day, p.daily_minutes,
    coalesce((select array_agg(g.day) from public.goal_days g
              where g.user_id = p.id and g.day >= (p_now at time zone p.timezone)::date - 1), '{}'),
    (select count(distinct c.user_word_id)::integer
       from public.cards c join public.user_words w on w.id = c.user_word_id
       where c.user_id = p.id and c.status = 'active' and w.status = 'active'
         and c.reps > 0 and c.due <= p_now
         and not exists (select 1 from public.cards t
                         where t.user_word_id = c.user_word_id
                           and t.last_review >= date_trunc('day', p_now at time zone p.timezone) at time zone p.timezone)),
    (select count(distinct c.user_word_id)::integer
       from public.cards c join public.user_words w on w.id = c.user_word_id
       where c.user_id = p.id and c.status = 'active' and w.status = 'active' and c.due <= p_now
         and not exists (select 1 from public.cards t
                         where t.user_word_id = c.user_word_id and t.last_review is not null))
  from public.profiles p
  where p.reminders_enabled
    and exists (select 1 from public.push_subscriptions s where s.user_id = p.id);
$$;
revoke execute on function public.get_reminder_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.get_reminder_candidates(timestamptz) to service_role;

-- Past days count by the old rule (any review), so existing streaks survive the change.
insert into public.goal_days (user_id, day, reason, active_ms)
select r.user_id, (r.reviewed_at at time zone p.timezone)::date, 'history',
       sum(least(r.elapsed_ms, 90000))::integer
from public.review_logs r
join public.profiles p on p.id = r.user_id
where r.reviewed_at >= now() - interval '400 days'
group by r.user_id, (r.reviewed_at at time zone p.timezone)::date
on conflict do nothing;

-- Hourly reminder tick. The secret lives in Vault ('cron_secret'), never in this file.
select cron.schedule(
  'memora-reminders',
  '0 * * * *',
  $job$
  select net.http_post(
    url := 'https://memora-saas.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);

commit;
