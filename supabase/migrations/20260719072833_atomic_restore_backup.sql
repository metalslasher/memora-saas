create or replace function public.restore_memora_backup(backup_state jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  english_deck_id uuid := gen_random_uuid();
  qa_deck_id uuid := gen_random_uuid();
  note_record jsonb;
  card_record jsonb;
  review_record jsonb;
  import_record jsonb;
  import_row_record jsonb;
  note_id_map jsonb := '{}'::jsonb;
  card_id_map jsonb := '{}'::jsonb;
  original_note_id text;
  original_card_id text;
  new_note_id uuid;
  new_card_id uuid;
  new_import_id uuid;
  new_card_state public.memora_card_state;
  card_status public.memora_note_status;
  schedule_json jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if backup_state is null or jsonb_typeof(backup_state) <> 'object' then
    raise exception 'Invalid Memora backup payload';
  end if;

  delete from public.imports
  where user_id = current_user_id;

  delete from public.decks
  where user_id = current_user_id;

  insert into public.decks (id, user_id, module_type, title, settings)
  values
    (
      english_deck_id,
      current_user_id,
      'english',
      'Англійські слова',
      coalesce(backup_state -> 'settings', '{}'::jsonb)
    ),
    (
      qa_deck_id,
      current_user_id,
      'qa',
      'QA та тестування',
      coalesce(backup_state -> 'settings', '{}'::jsonb)
    );

  for note_record in
    select value
    from jsonb_array_elements(coalesce(backup_state -> 'notes', '[]'::jsonb))
  loop
    original_note_id := note_record ->> 'id';
    new_note_id := gen_random_uuid();
    note_id_map := note_id_map || jsonb_build_object(original_note_id, new_note_id::text);

    insert into public.notes (
      id,
      user_id,
      deck_id,
      note_type,
      source,
      content_json,
      status,
      created_at
    )
    values (
      new_note_id,
      current_user_id,
      case
        when note_record ->> 'module' = 'english' then english_deck_id
        else qa_deck_id
      end,
      case
        when note_record ->> 'module' = 'english' then 'english_vocab'::public.memora_note_type
        else 'qa_concept'::public.memora_note_type
      end,
      coalesce(nullif(note_record ->> 'source', ''), 'user'),
      coalesce(note_record -> 'content', '{}'::jsonb),
      coalesce(nullif(note_record ->> 'status', ''), 'active')::public.memora_note_status,
      (note_record ->> 'createdAt')::timestamptz
    );
  end loop;

  for card_record in
    select value
    from jsonb_array_elements(coalesce(backup_state -> 'cards', '[]'::jsonb))
  loop
    original_card_id := card_record ->> 'id';
    original_note_id := card_record ->> 'noteId';
    new_note_id := (note_id_map ->> original_note_id)::uuid;

    if new_note_id is null then
      raise exception 'Backup card % points to a missing note', original_card_id;
    end if;

    new_card_id := gen_random_uuid();
    card_id_map := card_id_map || jsonb_build_object(original_card_id, new_card_id::text);
    schedule_json := coalesce(card_record -> 'schedule', '{}'::jsonb);
    card_status := coalesce(nullif(card_record ->> 'status', ''), 'active')::public.memora_note_status;

    new_card_state :=
      case
        when card_status <> 'active' then card_status::text::public.memora_card_state
        when lower(coalesce(schedule_json ->> 'state', 'new')) in ('new', 'learning', 'review', 'relearning')
          then lower(coalesce(schedule_json ->> 'state', 'new'))::public.memora_card_state
        else 'review'::public.memora_card_state
      end;

    insert into public.cards (
      id,
      user_id,
      note_id,
      card_type,
      state,
      due_at,
      stability,
      difficulty,
      retrievability,
      elapsed_days,
      scheduled_days,
      learning_steps,
      reps,
      lapses,
      last_reviewed_at,
      prompt_json,
      answer_json,
      status
    )
    values (
      new_card_id,
      current_user_id,
      new_note_id,
      coalesce(nullif(card_record ->> 'type', ''), 'term_definition'),
      new_card_state,
      (schedule_json ->> 'due')::timestamptz,
      coalesce(nullif(schedule_json ->> 'stability', '')::double precision, 0),
      coalesce(nullif(schedule_json ->> 'difficulty', '')::double precision, 0),
      nullif(schedule_json ->> 'retrievability', '')::double precision,
      coalesce(nullif(schedule_json ->> 'elapsed_days', '')::integer, 0),
      coalesce(nullif(schedule_json ->> 'scheduled_days', '')::integer, 0),
      coalesce(nullif(schedule_json ->> 'learning_steps', '')::integer, 0),
      coalesce(nullif(schedule_json ->> 'reps', '')::integer, 0),
      coalesce(nullif(schedule_json ->> 'lapses', '')::integer, 0),
      nullif(schedule_json ->> 'last_review', '')::timestamptz,
      jsonb_build_object(
        'text', coalesce(card_record ->> 'prompt', ''),
        'module', coalesce(card_record ->> 'module', 'english'),
        'priority', coalesce(nullif(card_record ->> 'priority', '')::integer, 50),
        'tags', coalesce(card_record -> 'tags', '[]'::jsonb)
      ),
      jsonb_build_object(
        'text', coalesce(card_record ->> 'answer', ''),
        'explanation', coalesce(card_record ->> 'explanation', ''),
        'example', card_record ->> 'example'
      ),
      card_status
    );
  end loop;

  for review_record in
    select value
    from jsonb_array_elements(coalesce(backup_state -> 'reviewLogs', '[]'::jsonb))
  loop
    new_card_id := (card_id_map ->> (review_record ->> 'cardId'))::uuid;
    new_note_id := (note_id_map ->> (review_record ->> 'noteId'))::uuid;

    if new_card_id is null or new_note_id is null then
      raise exception 'Backup review log points to a missing card or note';
    end if;

    insert into public.review_logs (
      user_id,
      card_id,
      note_id,
      module_type,
      reviewed_at,
      rating,
      elapsed_ms,
      response_text,
      was_correct,
      due_before,
      due_after,
      schedule_before,
      schedule_after
    )
    values (
      current_user_id,
      new_card_id,
      new_note_id,
      coalesce(nullif(review_record ->> 'module', ''), 'english')::public.memora_module_type,
      (review_record ->> 'reviewedAt')::timestamptz,
      coalesce(nullif(review_record ->> 'rating', ''), 'good')::public.memora_review_rating,
      coalesce(nullif(review_record ->> 'elapsedMs', '')::integer, 0),
      nullif(review_record ->> 'responseText', ''),
      coalesce((review_record ->> 'wasCorrect')::boolean, true),
      nullif(review_record ->> 'dueBefore', '')::timestamptz,
      nullif(review_record ->> 'dueAfter', '')::timestamptz,
      case
        when nullif(review_record ->> 'dueBefore', '') is null then '{}'::jsonb
        else jsonb_build_object('due', review_record ->> 'dueBefore')
      end,
      case
        when nullif(review_record ->> 'dueAfter', '') is null then '{}'::jsonb
        else jsonb_build_object('due', review_record ->> 'dueAfter')
      end
    );
  end loop;

  for import_record in
    select value
    from jsonb_array_elements(coalesce(backup_state -> 'imports', '[]'::jsonb))
  loop
    new_import_id := gen_random_uuid();

    insert into public.imports (
      id,
      user_id,
      file_name,
      status,
      row_count,
      created_at,
      updated_at
    )
    values (
      new_import_id,
      current_user_id,
      coalesce(nullif(import_record ->> 'fileName', ''), 'import.csv'),
      coalesce(nullif(import_record ->> 'status', ''), 'completed')::public.memora_import_status,
      coalesce(nullif(import_record ->> 'rowCount', '')::integer, 0),
      (import_record ->> 'createdAt')::timestamptz,
      (import_record ->> 'updatedAt')::timestamptz
    );

    for import_row_record in
      select value
      from jsonb_array_elements(coalesce(import_record -> 'rows', '[]'::jsonb))
    loop
      insert into public.import_rows (
        user_id,
        import_id,
        row_number,
        status,
        error_json,
        raw_json,
        created_at
      )
      values (
        current_user_id,
        new_import_id,
        coalesce(nullif(import_row_record ->> 'rowNumber', '')::integer, 1),
        coalesce(nullif(import_row_record ->> 'status', ''), 'imported')::public.memora_import_row_status,
        jsonb_build_object('errors', coalesce(import_row_record -> 'errors', '[]'::jsonb)),
        coalesce(import_row_record -> 'raw', '{}'::jsonb)
          || case
            when import_row_record ? 'module' then jsonb_build_object('module', import_row_record ->> 'module')
            else '{}'::jsonb
          end,
        (import_row_record ->> 'createdAt')::timestamptz
      );
    end loop;
  end loop;
end;
$$;

revoke all on function public.restore_memora_backup(jsonb) from public;
grant execute on function public.restore_memora_backup(jsonb) to authenticated;
