-- Batch 9: defence in depth for table privileges (RLS already blocks these; grants make it
-- impossible even if a policy is ever added by mistake). Revokes only; nothing the app uses.
--  * anon: no access to any public table (guests never read tables; auth goes through GoTrue);
--  * authenticated: no TRUNCATE/REFERENCES/TRIGGER anywhere (RLS does not cover TRUNCATE);
--  * lexicon, lexicon_lists, ai_usage: read-only for users, written by the service role only;
--  * allowed_emails: no direct access (is_current_user_allowed is security definer);
--  * trigger function set_updated_at is not callable through the API.

begin;

revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on public.lexicon, public.lexicon_lists, public.ai_usage from authenticated;
revoke all on public.allowed_emails from authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

alter function public.record_error(text, text, text, text, text, text, text) set search_path = '';

commit;
