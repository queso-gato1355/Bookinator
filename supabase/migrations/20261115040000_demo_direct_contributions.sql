-- Hackathon demo: explicitly bypass review using a separate playable overlay.
-- Immutable catalog releases and the normal moderation tables remain untouched.
create table public.demo_contributions (
  id uuid primary key,
  catalog_version text not null references public.catalog_releases(version),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  submitted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.demo_contributions enable row level security;
-- Access only through the bounded RPCs below; never expose contributor IDs.
revoke all on public.demo_contributions from anon, authenticated;

create or replace function public.submit_demo_contribution(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.tb_require_contributor();
  entry_id uuid;
  release_id text := p->>'catalog_version';
  item jsonb;
  old public.demo_contributions;
begin
  if jsonb_typeof(p) is distinct from 'object'
     or coalesce(p->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or jsonb_typeof(p->'title') is distinct from 'string'
     or length(btrim(p->>'title')) not between 1 and 300
     or jsonb_typeof(p->'author') is distinct from 'string' or length(p->>'author') > 200
     or jsonb_typeof(p->'notes') is distinct from 'string' or length(p->>'notes') > 2000
     or (p ? 'title_ko' and (jsonb_typeof(p->'title_ko') is distinct from 'string' or length(p->>'title_ko') > 300))
     or jsonb_typeof(p->'answers') is distinct from 'array'
     or jsonb_typeof(p->'questions') is distinct from 'array' then
    raise exception 'invalid demo book payload' using errcode = '22023';
  end if;
  if not exists (select 1 from public.catalog_releases r where r.version = release_id) then
    raise exception 'unknown catalog release' using errcode = '22023';
  end if;
  if jsonb_array_length(p->'answers') > 2000 or jsonb_array_length(p->'questions') > 20 then
    raise exception 'too many demo answers or custom questions' using errcode = '22023';
  end if;
  if p ? 'book_id' and not (
    exists (select 1 from public.release_books r where r.catalog_version = release_id and r.book_id = p->>'book_id')
    or exists (select 1 from public.demo_contributions d where d.catalog_version = release_id and 'demo-book:' || d.id::text = p->>'book_id')
  ) then
    raise exception 'book is not on this shelf' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p->'answers') loop
    if jsonb_typeof(item->'question_id') is distinct from 'string'
       or coalesce(item->>'answer', '') not in ('yes', 'probably', 'dont_know', 'probably_not', 'no')
       or not (exists (select 1 from public.release_questions q where q.catalog_version = release_id and q.question_id = item->>'question_id')
               or coalesce(item->>'question_id', '') ~ '^demo-q:[0-9a-f]{1,16}$') then
      raise exception 'invalid demo answer' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p->'answers')) <>
     (select count(distinct a->>'question_id') from jsonb_array_elements(p->'answers') a) then
    raise exception 'duplicate demo answer' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p->'questions') loop
    if jsonb_typeof(item->'text') is distinct from 'string' or length(btrim(item->>'text')) not between 5 and 500
       or coalesce(item->>'answer', '') not in ('yes', 'probably', 'dont_know', 'probably_not', 'no') then
      raise exception 'invalid custom question' using errcode = '22023';
    end if;
  end loop;
  entry_id := (p->>'id')::uuid;
  select * into old from public.demo_contributions where id = entry_id;
  if found then
    if old.submitted_by <> uid or old.payload <> p then
      raise exception 'demo entry id already used' using errcode = '22023';
    end if;
    return entry_id;
  end if;
  perform public.tb_rate_limit(uid, 'demo_contributions', 'submitted_by', 'rate_book_submissions_per_hour', 10);
  insert into public.demo_contributions(id, catalog_version, payload, submitted_by)
  values (entry_id, release_id, p, uid);
  return entry_id;
end $$;

create or replace function public.get_demo_contributions(release_version text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(d.payload order by d.created_at, d.id), '[]'::jsonb)
  from public.demo_contributions d where d.catalog_version = release_version
$$;
revoke all on function public.submit_demo_contribution(jsonb), public.get_demo_contributions(text) from public, anon, authenticated;
grant execute on function public.submit_demo_contribution(jsonb) to authenticated;
grant execute on function public.get_demo_contributions(text) to anon, authenticated;

-- Derive the legacy session limit from its release; never reject a valid >40-question game.
create or replace function public.submit_game_session(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.tb_require_contributor();
  v text := p->>'catalog_version';
  sid uuid;
  item jsonb;
  n int := 0;
  rev int;
  max_answers int := (select count(*)::int from public.release_questions where catalog_version = v);
  book text;
begin
  perform public.tb_rate_limit(uid, 'game_sessions', 'contributor_id', 'rate_sessions_per_hour', 30);
  if not exists (select 1 from public.catalog_releases where version = v) then
    raise exception 'unknown catalog_version %', v using errcode = '22023';
  end if;
  if jsonb_typeof(p->'answers') <> 'array' or jsonb_array_length(p->'answers') not between 1 and max_answers then
    raise exception 'answers must be an array of 1..% items', max_answers using errcode = '22023';
  end if;
  if coalesce(btrim(p->>'consent_version'), '') = '' then
    raise exception 'consent_version is required' using errcode = '22023';
  end if;
  foreach book in array array[p->>'confirmed_book_id', p->>'identified_book_id']
                        || coalesce(array(select jsonb_array_elements_text(p->'rejected_book_ids')), '{}') loop
    if book is not null and not exists (select 1 from public.release_books where catalog_version = v and book_id = book) then
      raise exception 'book % is not in release %', book, v using errcode = '22023';
    end if;
  end loop;

  insert into public.game_sessions (contributor_id, catalog_version, film_memory_mode, outcome,
                                    confirmed_book_id, identified_book_id, rejected_book_ids, consent_version)
  values (uid, v, coalesce((p->>'film_memory_mode')::boolean, false), (p->>'outcome')::public.session_outcome,
          p->>'confirmed_book_id', p->>'identified_book_id',
          coalesce(array(select jsonb_array_elements_text(p->'rejected_book_ids')), '{}'),
          p->>'consent_version')
  returning id into sid;

  for item in select * from jsonb_array_elements(p->'answers') loop
    n := n + 1;
    select rq.revision into rev from public.release_questions rq
      where rq.catalog_version = v and rq.question_id = item->>'question_id';
    if rev is null then
      raise exception 'question % is not in release %', item->>'question_id', v using errcode = '22023';
    end if;
    insert into public.session_answers (session_id, seq, question_id, question_revision, answer)
    values (sid, n, item->>'question_id', rev, (item->>'answer')::public.answer_kind);
  end loop;
  return sid;
end $$;
