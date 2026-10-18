-- Generated from src/lib/catalog.ts by npx tsx scripts/seed.ts.
-- Golden q1–q10 follow the supplied document; q11 is a supplemental tool case.
begin;
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
