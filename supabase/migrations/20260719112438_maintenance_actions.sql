create policy review_logs_delete_own on public.review_logs
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy imports_delete_own on public.imports
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy analytics_daily_delete_own on public.analytics_daily
for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.clear_memora_materials()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.analytics_daily where user_id = current_user_id;
  delete from public.imports where user_id = current_user_id;
  delete from public.notes where user_id = current_user_id;
end;
$$;

revoke execute on function public.clear_memora_materials() from public;
grant execute on function public.clear_memora_materials() to authenticated;

create or replace function public.reset_memora_learning_stats()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.analytics_daily where user_id = current_user_id;
  delete from public.review_logs where user_id = current_user_id;

  update public.cards
  set
    state = 'new',
    due_at = now(),
    stability = 0,
    difficulty = 0,
    retrievability = null,
    elapsed_days = 0,
    scheduled_days = 0,
    learning_steps = 0,
    reps = 0,
    lapses = 0,
    last_reviewed_at = null
  where user_id = current_user_id;
end;
$$;

revoke execute on function public.reset_memora_learning_stats() from public;
grant execute on function public.reset_memora_learning_stats() to authenticated;
