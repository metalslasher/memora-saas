-- Batch 3: AI layer. Additive only (prod shares this database with `main`).
begin;

-- Ledger of every paid AI call. A row is reserved (status 'pending', estimated
-- cost) before the call and settled with the real cost afterwards, so the
-- monthly budget and the per-user rate limits also count calls in flight.
-- user_id survives account deletion as null: spent money stays in the month.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  feature text not null check (feature in ('enrich_word', 'enrich_batch', 'tts', 'compare')),
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null check (char_length(model) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'ok', 'failed')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  characters integer not null default 0 check (characters >= 0),
  audio_seconds numeric(10, 2) not null default 0 check (audio_seconds >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_created_idx on public.ai_usage (created_at);
create index ai_usage_user_feature_idx on public.ai_usage (user_id, feature, created_at);

alter table public.ai_usage enable row level security;

-- Users read their own rows; only the server (service role) writes.
create policy ai_usage_allowlisted on public.ai_usage as restrictive
  for select to authenticated using ((select public.is_current_user_allowed()));
create policy ai_usage_select_own on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.ai_usage from anon, authenticated;

-- Spend of the current calendar month (UTC), all users together.
create function public.ai_month_spend()
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage
  where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

-- Atomically checks the monthly budget and the user's rate limits and, when
-- both allow it, reserves a ledger row with the estimated cost. One advisory
-- lock serialises reservations so parallel calls cannot overshoot the budget.
-- Returns (reservation_id, null) or (null, 'budget' | 'minute' | 'day').
create function public.ai_reserve(
  p_user uuid,
  p_feature text,
  p_provider text,
  p_model text,
  p_estimate numeric,
  p_monthly_limit numeric,
  p_per_minute integer,
  p_per_day integer
)
returns table (reservation_id uuid, reason text)
language plpgsql
set search_path = ''
as $$
declare
  v_minute integer;
  v_day integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('memora_ai_budget'));

  if public.ai_month_spend() + p_estimate > p_monthly_limit then
    return query select null::uuid, 'budget'::text;
    return;
  end if;

  if p_user is not null then
    select
      count(*) filter (where created_at > now() - interval '1 minute'),
      count(*)
    into v_minute, v_day
    from public.ai_usage
    where user_id = p_user
      and feature = p_feature
      and created_at > now() - interval '1 day';

    if v_minute >= p_per_minute then
      return query select null::uuid, 'minute'::text;
      return;
    end if;
    if v_day >= p_per_day then
      return query select null::uuid, 'day'::text;
      return;
    end if;
  end if;

  insert into public.ai_usage (user_id, feature, provider, model, cost_usd)
  values (p_user, p_feature, p_provider, p_model, p_estimate)
  returning id into v_id;

  return query select v_id, null::text;
end;
$$;

revoke execute on function public.ai_month_spend() from public, anon, authenticated;
revoke execute on function public.ai_reserve(uuid, text, text, text, numeric, numeric, integer, integer)
  from public, anon, authenticated;
grant execute on function public.ai_month_spend() to service_role;
grant execute on function public.ai_reserve(uuid, text, text, text, numeric, numeric, integer, integer)
  to service_role;

-- When a lexicon entry was filled by AI (and by which model). Enriched
-- entries are the shared cache: one word is paid for once for everyone.
alter table public.lexicon add column enriched_at timestamptz;
alter table public.lexicon add column enrich_model text;

-- Cached TTS audio (public read: content is generic English, not personal;
-- uploads only via the service role, so no storage policies are needed).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', true, 1048576, array['audio/mpeg', 'audio/wav'])
on conflict (id) do nothing;

commit;
