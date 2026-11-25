-- Dependency check for the shared Supabase DB. Run after every migration:
--   pnpm db-check
-- Finds functions that reference objects which no longer exist (the
-- 2026-11-26 incident: get_progress_stats still called the dropped get_streak).
-- Everything runs in a transaction that is rolled back, so nothing changes:
-- the plpgsql_check extension is installed only inside it.
--   * language sql functions: re-created from their own definition (Postgres
--     validates SQL bodies on create, which re-resolves every called function,
--     table and column);
--   * plpgsql functions (not triggers): plpgsql_check, errors only;
--   * pg_cron jobs: every public.<name>( they call must exist.
-- Views, policies, triggers and defaults are tracked by Postgres itself, so a
-- drop that would break them is refused without CASCADE.
-- The result is the list of problems; an empty list means "all fine".
begin;

create extension if not exists plpgsql_check with schema extensions;
create temp table _db_check (kind text, object text, problem text) on commit drop;

insert into _db_check
select 'plpgsql function', p.oid::regprocedure::text, c.message
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
join pg_language l on l.oid = p.prolang and l.lanname = 'plpgsql'
cross join lateral extensions.plpgsql_check_function_tb(p.oid, fatal_errors => false) c
where p.prokind = 'f'
  and p.prorettype <> 'trigger'::regtype
  and c.level = 'error';

do $check$
declare
  r record;
  called text;
begin
  for r in
    select p.oid::regprocedure::text as sig, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    join pg_language l on l.oid = p.prolang and l.lanname = 'sql'
    where p.prokind = 'f'
  loop
    begin
      execute r.def;
    exception when others then
      insert into _db_check values ('sql function', r.sig, sqlerrm);
    end;
  end loop;

  if to_regclass('cron.job') is not null then
    for r in execute 'select jobname, command from cron.job' loop
      for called in
        select distinct m[1] from regexp_matches(r.command, 'public\.([a-z_][a-z0-9_]*)\s*\(', 'g') as m
      loop
        if not exists (
          select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = called
        ) then
          insert into _db_check values ('cron job', r.jobname, 'calls missing function public.' || called);
        end if;
      end loop;
    end loop;
  end if;
end
$check$;

select kind, object, problem from _db_check order by kind, object;

rollback;
