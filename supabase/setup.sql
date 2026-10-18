-- CONCEPTCHEK INITIAL SETUP
-- Safe to rerun after a failed initial setup; existing learner data is preserved.
-- Schema and seed run together in one transaction.
begin;
-- Initial schema bootstrap, safe to rerun after an interrupted setup.
-- Existing tables and learner data are preserved; this is not a general schema-upgrade migration.

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

-- Generated from src/lib/catalog.ts by npx tsx scripts/seed.ts.
-- Golden q1–q10 follow the supplied document; q11 is a supplemental tool case.

insert into public.concepts (id,topic,description,icon,color,position) values ('secrets','API keys & secrets','Know what belongs on the server, and what can safely reach a browser.','key','green',1) on conflict (id) do update set topic=excluded.topic,description=excluded.description,icon=excluded.icon,color=excluded.color,position=excluded.position;
insert into public.concepts (id,topic,description,icon,color,position) values ('architecture','Where code runs','Place the interface, backend, and model where they can actually work.','layers','blue',2) on conflict (id) do update set topic=excluded.topic,description=excluded.description,icon=excluded.icon,color=excluded.color,position=excluded.position;
insert into public.concepts (id,topic,description,icon,color,position) values ('identity','Identity & persistence','Connect verified identity, conversation permissions, and durable storage.','shield','purple',3) on conflict (id) do update set topic=excluded.topic,description=excluded.description,icon=excluded.icon,color=excluded.color,position=excluded.position;
insert into public.concepts (id,topic,description,icon,color,position) values ('contracts','API request contracts','Turn an API contract into a correctly structured request.','braces','orange',4) on conflict (id) do update set topic=excluded.topic,description=excluded.description,icon=excluded.icon,color=excluded.color,position=excluded.position;
insert into public.concepts (id,topic,description,icon,color,position) values ('tools','Tool calling','Trace how a model requests a tool and the backend executes it.','workflow','rose',5) on conflict (id) do update set topic=excluded.topic,description=excluded.description,icon=excluded.icon,color=excluded.color,position=excluded.position;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q1','secrets','A secret in the response',1,'field','A user asks “What does gravity do?” The browser receives:

{"Answer":"Attracts objects with mass","LLM_key":"grok_123332","Request_ID":"REQ_42"}

Which JSON field should not be sent to the user? Reply with exactly one field name: Answer, LLM_key, or Request_ID.','','"LLM_key"'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q2','architecture','Place the chatbot',1,'placement','A chatbot needs UI: 0.5 GB, Backend: 1 GB, and LLM: 65 GB. The backend has a secret key that must stay private. Available memory: Client: 8 GB, Remote_server: 20 GB, LLM_server: 80 GB.

Where will you run the UI, Backend, and LLM? Use Client, Remote_server, or LLM_server.','{
  "UI": "",
  "Backend": "",
  "LLM": ""
}','{"UI":"Client","Backend":"Remote_server","LLM":"LLM_server"}'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q3','identity','Whose conversation is it?',1,'identity','Users may read only conversations they own. The server has authenticated the requester. Browser identity values can be altered.

Request | Server_verified_identity | Conversation_owner | Browser_claimed_identity
R1 | Alice | Alice | Alice
R2 | Alice | Bob | Bob
R3 | Bob | Bob | Alice

Which identity field should be compared with the owner, and which requests should be allowed?','{
  "Compare_owner_with": "",
  "R1": "",
  "R2": "",
  "R3": ""
}','{"Compare_owner_with":"Server_verified_identity","R1":"ALLOW","R2":"DENY","R3":"ALLOW"}'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q4','contracts','Build a tutor request',1,'tutor','A fictional tutor API requires:
Address: https://tutor.example/explain
Method: POST
Authentication: Authorization header with Bearer DEMO_KEY
Body format: application/json
Required body fields: instruction and question

The app instruction is “Explain in simple language”. The learner asks “Why does ice float?”

Prepare the request, keeping instruction and question separate. DEMO_KEY is a dummy credential.','{
  "URL": "",
  "Method": "",
  "Headers": {"Authorization": "", "Content-Type": ""},
  "Body": {"instruction": "", "question": ""}
}','{"URL":"https://tutor.example/explain","Method":"POST","Headers":{"Authorization":"Bearer DEMO_KEY","Content-Type":"application/json"},"Body":{"instruction":"Explain in simple language","question":"Why does ice float?"}}'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q5','contracts','A public weather API',2,'weather','A fictional weather API documents:
Address: https://weather.example/current
Method: GET
Query parameter: city
Authentication: not required
Request body: not required

Prepare a request for Bengaluru. Use JSON null where no value is required.','{
  "URL": "",
  "Method": "",
  "Query": {"city": ""},
  "Authentication": null,
  "Body": null
}','{"URL":"https://weather.example/current","Method":"GET","Query":{"city":"Bengaluru"},"Authentication":null,"Body":null}'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q6','secrets','Repair the secret boundary',2,'tokens','A developer stores DEMO_SECRET_93 in JavaScript downloaded by every browser. Browser code calls the provider directly with that key. The provider does not support public client credentials. The app must keep answering questions.

After fixing the design:
1. Where is the secret stored?
2. Who calls the LLM using the secret?
3. What returns to the browser?

Reply with three comma-separated tokens in order. Allowed labels: server, client, LLM_provider, user_question, LLM_response.','','"server, server, LLM_response"'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q7','tools','Trace a baggage lookup',1,'order','A user asks a travel assistant for the checked baggage allowance on their recent booking. Put these events in execution order:

A. Model generates the baggage answer
B. Backend executes read_booking for booking 52
C. Backend sends the returned allowance to the model
D. Model requests the available read_booking tool
E. History API returns the allowance to the backend

Reply with five comma-separated letters, using A–E once each.','','"D, B, E, C, A"'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q8','architecture','Follow the question',2,'route','Available RAM: Browser: 2 GB, Server: 4 GB, Model_provider: 80 GB.

UI needs 0.5 GB and must run in Browser. Backend needs 1 GB and must run in Server. Model needs 65 GB. All figures include overhead. Components on the same machine run simultaneously. Browser connects to Server, which connects to Model_provider.

Assign components, write the question route using UI, Backend, Model, and calculate the model machine’s remaining RAM.','{
  "UI": "",
  "Backend": "",
  "Model": "",
  "Question_route": ["", "", ""],
  "Model_machine_remaining_RAM_GB": 0
}','{"UI":"Browser","Backend":"Server","Model":"Model_provider","Question_route":["UI","Backend","Model"],"Model_machine_remaining_RAM_GB":15}'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q9','identity','Keep conversations safe',2,'responsibilities','A browser tutor serves several users. Users can alter browser code and requests. The provider’s secret key must stay private. Only the backend has database credentials. Saved conversations must survive application restarts; backend RAM is temporary.

Assign each responsibility using Browser, Backend_secret_storage, Backend_processing, or Persistent_database. Locations may repeat.','{
  "Display_message_input": "",
  "Store_secret_key": "",
  "Verify_conversation_permission": "",
  "Keep_saved_conversations": "",
  "Call_provider_using_secret": ""
}','{"Display_message_input":"Browser","Store_secret_key":"Backend_secret_storage","Verify_conversation_permission":"Backend_processing","Keep_saved_conversations":"Persistent_database","Call_provider_using_secret":"Backend_processing"}'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q10','architecture','Inside the organisation',3,'internal','An engineering app opens in a laptop browser on your organisation’s VPN.
RAM: Laptop: 8 GB; VPN_backend: 4 GB; Internal_worker: 64 GB.

UI runs in the laptop browser. The VPN backend can dispatch to the worker, which can read the internal file store. A public provider cannot reach the worker or file store. Waveform data and file credentials must stay inside the organisation. Analysis needs 16 GB. The user enters only an internal waveform path.

Place operations using Laptop_browser, VPN_backend, Internal_worker, or Internal_secret_storage. Calculate remaining worker RAM, and answer both public-provider checks with JSON booleans.','{
  "Display_UI_and_collect_path": "",
  "Validate_and_dispatch": "",
  "Read_and_analyse_waveform": "",
  "Keep_file_credentials": "",
  "Worker_remaining_RAM_GB": 0,
  "Public_provider_can_reach_internal_file": null,
  "Policy_allows_raw_waveform_at_public_provider": null
}','{"Display_UI_and_collect_path":"Laptop_browser","Validate_and_dispatch":"VPN_backend","Read_and_analyse_waveform":"Internal_worker","Keep_file_credentials":"Internal_secret_storage","Worker_remaining_RAM_GB":48,"Public_provider_can_reach_internal_file":false,"Policy_allows_raw_waveform_at_public_provider":false}'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;
insert into public.case_questions (id,concept_id,title,position,validator,question,answer_template,golden_answer) values ('q11','tools','Trace an inventory lookup',2,'order','A customer asks whether a camera is in stock. A stock_lookup tool is available. Put events in execution order:

A. Model writes an answer from the returned stock count
B. Backend executes stock_lookup for the camera
C. Backend sends the stock count to the model
D. Model requests stock_lookup with the camera identifier
E. Inventory API returns the stock count to the backend

Reply with five comma-separated letters, using A–E once each.','','"D, B, E, C, A"'::jsonb) on conflict (id) do update set concept_id=excluded.concept_id,title=excluded.title,position=excluded.position,validator=excluded.validator,question=excluded.question,answer_template=excluded.answer_template,golden_answer=excluded.golden_answer;

commit;
