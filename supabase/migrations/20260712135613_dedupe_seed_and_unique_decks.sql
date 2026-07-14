with ranked_decks as (
  select
    id,
    row_number() over (
      partition by user_id, module_type
      order by created_at asc, id asc
    ) as deck_rank
  from public.decks
),
duplicate_seed_decks as (
  select ranked_decks.id
  from ranked_decks
  where ranked_decks.deck_rank > 1
    and not exists (
      select 1
      from public.notes
      where notes.deck_id = ranked_decks.id
        and notes.source <> 'seed'
    )
)
delete from public.decks
where id in (select id from duplicate_seed_decks);

drop index if exists public.decks_user_module_idx;

create unique index decks_user_module_unique_idx
  on public.decks (user_id, module_type);
