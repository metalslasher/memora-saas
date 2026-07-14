create type public.memora_module_type as enum ('english', 'qa');
create type public.memora_note_type as enum ('english_vocab', 'qa_concept');
create type public.memora_card_state as enum (
  'new',
  'learning',
  'review',
  'relearning',
  'suspended',
  'leech',
  'archived'
);
create type public.memora_review_rating as enum ('again', 'hard', 'good', 'easy');
create type public.memora_note_status as enum ('active', 'suspended', 'archived');
create type public.memora_import_status as enum (
  'uploaded',
  'validating',
  'ready',
  'processing',
  'completed',
  'failed'
);
create type public.memora_import_row_status as enum ('valid', 'invalid', 'imported', 'skipped');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  locale text not null default 'uk-UA',
  timezone text not null default 'Europe/Kiev',
  level text,
  goals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_type public.memora_module_type not null,
  title text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  note_type public.memora_note_type not null,
  source text not null default 'user',
  content_json jsonb not null default '{}'::jsonb,
  status public.memora_note_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  card_type text not null,
  state public.memora_card_state not null default 'new',
  due_at timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  retrievability double precision,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  last_reviewed_at timestamptz,
  prompt_json jsonb not null default '{}'::jsonb,
  answer_json jsonb not null default '{}'::jsonb,
  status public.memora_note_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  module_type public.memora_module_type not null,
  reviewed_at timestamptz not null default now(),
  rating public.memora_review_rating not null,
  elapsed_ms integer not null default 0,
  response_text text,
  was_correct boolean not null,
  due_before timestamptz,
  due_after timestamptz,
  schedule_before jsonb not null default '{}'::jsonb,
  schedule_after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  parent_id uuid references public.tags (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, tag_id)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  status public.memora_import_status not null default 'uploaded',
  row_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  import_id uuid not null references public.imports (id) on delete cascade,
  row_number integer not null,
  status public.memora_import_row_status not null,
  error_json jsonb not null default '{}'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  kind text not null,
  url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analytics_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  reviews_done integer not null default 0,
  new_done integer not null default 0,
  retention double precision,
  minutes integer not null default 0,
  lapses integer not null default 0,
  mature_cards integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index decks_user_module_idx on public.decks (user_id, module_type);
create index notes_user_deck_status_idx on public.notes (user_id, deck_id, status);
create index cards_user_due_state_idx on public.cards (user_id, due_at, state);
create index cards_note_idx on public.cards (note_id);
create index review_logs_user_reviewed_idx on public.review_logs (user_id, reviewed_at desc);
create index review_logs_card_reviewed_idx on public.review_logs (card_id, reviewed_at desc);
create unique index tags_user_label_unique_idx on public.tags (user_id, lower(label));
create index note_tags_user_tag_idx on public.note_tags (user_id, tag_id);
create index import_rows_import_row_number_idx on public.import_rows (import_id, row_number);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger decks_set_updated_at
before update on public.decks
for each row execute function public.set_updated_at();

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

create trigger cards_set_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

create trigger imports_set_updated_at
before update on public.imports
for each row execute function public.set_updated_at();

create trigger media_set_updated_at
before update on public.media
for each row execute function public.set_updated_at();

create trigger analytics_daily_set_updated_at
before update on public.analytics_daily
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.notes enable row level security;
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;
alter table public.imports enable row level security;
alter table public.import_rows enable row level security;
alter table public.media enable row level security;
alter table public.analytics_daily enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy profiles_insert_own on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy decks_select_own on public.decks
for select to authenticated
using ((select auth.uid()) = user_id);

create policy decks_insert_own on public.decks
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy decks_update_own on public.decks
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy decks_delete_own on public.decks
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy notes_select_own on public.notes
for select to authenticated
using ((select auth.uid()) = user_id);

create policy notes_insert_own on public.notes
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy notes_update_own on public.notes
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy notes_delete_own on public.notes
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy cards_select_own on public.cards
for select to authenticated
using ((select auth.uid()) = user_id);

create policy cards_insert_own on public.cards
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy cards_update_own on public.cards
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy cards_delete_own on public.cards
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy review_logs_select_own on public.review_logs
for select to authenticated
using ((select auth.uid()) = user_id);

create policy review_logs_insert_own on public.review_logs
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy tags_select_own on public.tags
for select to authenticated
using ((select auth.uid()) = user_id);

create policy tags_insert_own on public.tags
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy tags_update_own on public.tags
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy tags_delete_own on public.tags
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy note_tags_select_own on public.note_tags
for select to authenticated
using ((select auth.uid()) = user_id);

create policy note_tags_insert_own on public.note_tags
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy note_tags_delete_own on public.note_tags
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy imports_select_own on public.imports
for select to authenticated
using ((select auth.uid()) = user_id);

create policy imports_insert_own on public.imports
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy imports_update_own on public.imports
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy import_rows_select_own on public.import_rows
for select to authenticated
using ((select auth.uid()) = user_id);

create policy import_rows_insert_own on public.import_rows
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy import_rows_update_own on public.import_rows
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy media_select_own on public.media
for select to authenticated
using ((select auth.uid()) = user_id);

create policy media_insert_own on public.media
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy media_update_own on public.media
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy media_delete_own on public.media
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy analytics_daily_select_own on public.analytics_daily
for select to authenticated
using ((select auth.uid()) = user_id);

create policy analytics_daily_insert_own on public.analytics_daily
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy analytics_daily_update_own on public.analytics_daily
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.decks,
  public.notes,
  public.cards,
  public.review_logs,
  public.tags,
  public.note_tags,
  public.imports,
  public.import_rows,
  public.media,
  public.analytics_daily
to authenticated;

revoke execute on function public.set_updated_at() from public;
