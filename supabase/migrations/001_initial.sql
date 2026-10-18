-- Initial schema bootstrap, safe to rerun after an interrupted setup.
-- Existing tables and learner data are preserved; this is not a general schema-upgrade migration.
begin;
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_name text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.concepts (
  id text primary key,
  topic text not null,
  description text not null,
  icon text not null,
  color text not null,
  position integer not null
);
create table if not exists public.case_questions (
  id text primary key,
  concept_id text not null references public.concepts(id),
  title text not null,
  question text not null,
  answer_template text not null default '',
  validator text not null check (validator in ('field','placement','identity','tutor','weather','tokens','order','route','responsibilities','internal')),
  golden_answer jsonb not null,
  position integer not null
);
create table if not exists public.recitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 100),
  created_at timestamptz not null default now(),
  unique(user_id,label)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null references public.concepts(id),
  user_explanation text not null,
  recital_sentence text not null,
  recital_label text not null,
  recital_match_confidence double precision check (recital_match_confidence between 0 and 1),
  case_question1_id text not null references public.case_questions(id),
  caseq1_user_answer text,
  caseq1_answer_correct boolean,
  probe_question text not null,
  user_probe_answer text,
  case_question2_id text not null references public.case_questions(id),
  caseq2_user_answer text,
  caseq2_answer_correct boolean,
  case1_fresh boolean not null,
  case2_fresh boolean not null,
  demonstrated_change smallint,
  stage text not null default 'case1' check (stage in ('case1','probe','case2','completed')),
  version integer not null default 0 check (version >= 0),
  consent_at timestamptz not null,
  user_probe_answer_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  ai_mode text not null check (ai_mode in ('groq','mock')),
  check (case_question1_id <> case_question2_id),
  check (demonstrated_change is not distinct from
    case when caseq1_answer_correct is null or caseq2_answer_correct is null then null
         when caseq1_answer_correct = caseq2_answer_correct then 0
         when caseq2_answer_correct then 1 else -1 end),
  check ((stage='completed') = (completed_at is not null)),
  check (
    (stage='case1' and caseq1_answer_correct is null and user_probe_answer is null and caseq2_answer_correct is null) or
    (stage='probe' and caseq1_answer_correct is not null and user_probe_answer is null and caseq2_answer_correct is null) or
    (stage='case2' and caseq1_answer_correct is not null and user_probe_answer is not null and caseq2_answer_correct is null) or
    (stage='completed' and caseq1_answer_correct is not null and user_probe_answer is not null and caseq2_answer_correct is not null)
  )
);
create index if not exists conversations_user_created on public.conversations(user_id,created_at desc);
create index if not exists conversations_label on public.conversations(recital_label);
create index if not exists cases_concept on public.case_questions(concept_id,position);
create table if not exists public.case_attempts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_question_id text not null references public.case_questions(id),
  stage text not null check (stage in ('case1','case2')),
  answer text not null,
  status text not null check (status in ('PASS','INCORRECT','FORMAT_ERROR')),
  created_at timestamptz not null default now()
);
create index if not exists attempts_conversation on public.case_attempts(conversation_id,created_at);
-- User writes and grading are server-only. Browser clients cannot set their score.
alter table public.profiles enable row level security;
alter table public.concepts enable row level security;
alter table public.case_questions enable row level security;
alter table public.recitals enable row level security;
alter table public.conversations enable row level security;
alter table public.case_attempts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_read_own') then
    create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid())=user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='concepts' and policyname='concepts_read') then
    create policy concepts_read on public.concepts for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recitals' and policyname='recitals_read_own') then
    create policy recitals_read_own on public.recitals for select to authenticated using ((select auth.uid())=user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='conversations' and policyname='conversations_read_own') then
    create policy conversations_read_own on public.conversations for select to authenticated using ((select auth.uid())=user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='case_attempts' and policyname='attempts_read_own') then
    create policy attempts_read_own on public.case_attempts for select to authenticated using ((select auth.uid())=user_id);
  end if;
end $$;
-- There is deliberately no browser SELECT policy for case_questions (golden answers).
create or replace function public.create_learner_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id,user_name) values(new.id,coalesce(new.raw_user_meta_data->>'name',''));
  return new;
end;
$$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='on_auth_user_created' and tgrelid='auth.users'::regclass) then
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_learner_profile();
  end if;
end $$;
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;
-- Only the server may query shared sentence frequency, after checking ADMIN_EMAILS.
create or replace function public.recital_trends() returns table(label text,sentence text,occurrences bigint)
language sql stable security definer set search_path='' as $$
  select recital_label,recital_sentence,count(*)
  from public.conversations
  group by recital_label,recital_sentence
  order by count(*) desc
  limit 20;
$$;
revoke all on function public.recital_trends() from public,anon,authenticated;
grant execute on function public.recital_trends() to service_role;
revoke all on function public.create_learner_profile() from public,anon,authenticated;
commit;
