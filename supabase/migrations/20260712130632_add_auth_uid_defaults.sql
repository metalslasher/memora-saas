alter table public.profiles
  alter column id set default auth.uid();

alter table public.decks
  alter column user_id set default auth.uid();

alter table public.notes
  alter column user_id set default auth.uid();

alter table public.cards
  alter column user_id set default auth.uid();

alter table public.review_logs
  alter column user_id set default auth.uid();

alter table public.tags
  alter column user_id set default auth.uid();

alter table public.note_tags
  alter column user_id set default auth.uid();

alter table public.imports
  alter column user_id set default auth.uid();

alter table public.import_rows
  alter column user_id set default auth.uid();

alter table public.media
  alter column user_id set default auth.uid();

alter table public.analytics_daily
  alter column user_id set default auth.uid();
