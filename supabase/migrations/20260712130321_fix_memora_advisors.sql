create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index import_rows_user_id_idx on public.import_rows (user_id);
create index imports_user_id_idx on public.imports (user_id);
create index media_note_id_idx on public.media (note_id);
create index media_user_id_idx on public.media (user_id);
create index note_tags_tag_id_idx on public.note_tags (tag_id);
create index notes_deck_id_idx on public.notes (deck_id);
create index review_logs_note_id_idx on public.review_logs (note_id);
create index tags_parent_id_idx on public.tags (parent_id);
