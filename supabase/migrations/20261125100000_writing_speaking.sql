-- Batch 6 — writing and speaking (additive, compatible with the batch-5 code on main).
--
-- * profiles.speaking_enabled: the "Говоріння" switch (on by default).
-- * ai_usage features: sentence (feedback on a written sentence), speak
--   (feedback on a spoken one), transcribe (speech → text).
-- The card kinds `sentence` and `speaking` already exist in the baseline enum;
-- the code on main renders unknown exercises as recall, so new cards do not break it.

begin;

alter table public.profiles add column speaking_enabled boolean not null default true;

alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in (
    'enrich_word', 'enrich_batch', 'tts', 'compare', 'program', 'program_build',
    'sentence', 'speak', 'transcribe'
  ));

commit;
