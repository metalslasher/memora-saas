-- Batch 9: error monitoring without a paid service.
-- error_reports: one row per distinct error (fingerprint), with a counter. No user ids,
-- no IPs, no cookies. Written only by the server (service role) through record_error();
-- users and anon cannot read or write it. Spam control: a fingerprint is stored once,
-- at most 100 new fingerprints per hour, rows older than 30 days are removed on insert.

begin;

create table public.error_reports (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  source text not null check (source in ('client', 'server')),
  route text not null default '',
  message text not null,
  stack text not null default '',
  digest text not null default '',
  release text not null default '',
  occurrences integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index error_reports_last_seen_idx on public.error_reports (last_seen desc);

alter table public.error_reports enable row level security;
-- No policies on purpose: only the service role (bypasses RLS) reads and writes.
revoke all on public.error_reports from anon, authenticated;

create function public.record_error(
  p_fingerprint text,
  p_source text,
  p_route text,
  p_message text,
  p_stack text,
  p_digest text,
  p_release text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.error_reports
     set occurrences = occurrences + 1, last_seen = now(), release = p_release
   where fingerprint = p_fingerprint;
  if found then
    return;
  end if;

  if (select count(*) from public.error_reports where first_seen > now() - interval '1 hour') >= 100 then
    return;
  end if;

  delete from public.error_reports where last_seen < now() - interval '30 days';
  insert into public.error_reports (fingerprint, source, route, message, stack, digest, release)
  values (p_fingerprint, p_source, left(p_route, 200), left(p_message, 500), left(p_stack, 3000),
          left(p_digest, 64), left(p_release, 64))
  on conflict (fingerprint) do nothing;
end;
$$;
revoke execute on function public.record_error(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_error(text, text, text, text, text, text, text) to service_role;

commit;
