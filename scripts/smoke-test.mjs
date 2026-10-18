import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
async function call(route, {cookie, data, headers = {}} = {}) {
  const response = await fetch(base + route, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {'Content-Type':'application/json', Origin:base, ...(cookie ? {Cookie:cookie} : {}), ...headers},
    ...(data === undefined ? {} : {body:JSON.stringify(data)}), signal:AbortSignal.timeout(30000)
  });
  const payload = await response.json(); return {status:response.status, payload, cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
assert.equal((await fetch(base)).status,200);
assert.equal((await call('/api/dashboard')).status,401);
const a=await call('/api/bootstrap',{data:{}}), b=await call('/api/bootstrap',{data:{}});
assert.equal(a.payload.demo,true,'Run smoke tests only against the development demo server.');
assert.ok(a.cookie && b.cookie && a.cookie!==b.cookie);
assert.equal((await call('/api/sessions',{cookie:a.cookie,data:{conceptId:'secrets',explanation:'short'}})).status,400);
const dashboard=await call('/api/dashboard',{cookie:a.cookie});assert.equal(dashboard.payload.concepts.length,7);
for(const concept of dashboard.payload.concepts) {
  const created=await call('/api/sessions',{cookie:a.cookie,data:{conceptId:concept.id,explanation:'I think the server does the work for security reasons. The browser shows the result.'}});
  assert.equal(created.status,201);let s=created.payload;const id=s.conversation.id;
  assert.equal(s.conversation.stage,'case1');assert.equal(s.conversation.demonstrated_change,null);
  assert.notEqual(s.conversation.case_question1_id,s.conversation.case_question2_id);
  assert.equal(s.conversation.consent_at,null);assert.ok(s.conversation.data_collection_notice_at);assert.ok(!('golden_answer' in s.caseQuestion));assert.ok(!('validator' in s.caseQuestion));
  assert.equal((await call(`/api/sessions/${id}`,{cookie:b.cookie})).status,404);
  assert.equal((await call(`/api/sessions/${id}`,{cookie:b.cookie,data:{answer:'x',stage:'case1',version:0}})).status,404);
  assert.equal((await call(`/api/sessions/${id}`,{cookie:a.cookie,data:{answer:'x',stage:'case2',version:0}})).status,409);
  const malformed=await call(`/api/sessions/${id}`,{cookie:a.cookie,data:{answer:'malformed',stage:'case1',version:0}});
  assert.equal(malformed.payload.grade.status,'FORMAT_ERROR');assert.equal(malformed.payload.conversation.version,0);
  const wrong={q1:'Answer',q2:'{"UI":"LLM_server","Backend":"Client","LLM":"Remote_server"}',q3:'{"Compare_owner_with":"Browser_claimed_identity","R1":"ALLOW","R2":"ALLOW","R3":"DENY"}',q4:'{"URL":"wrong","Method":"GET","Headers":{"Authorization":"wrong","Content-Type":"text/plain"},"Body":{"instruction":"wrong","question":"wrong"}}',q7:'A,B,C,D,E',q21:JSON.stringify({Foreign_key_table:'Conversations',Foreign_key_column:'conversation_id',References_table:'Messages',References_column:'id',Conversation_requires_message_ID_list:true}),q25:JSON.stringify({Rows:[{attempt_id:'A1',learner_id:'L1',sequence:1,answer:'wrong'},{attempt_id:'A2',learner_id:'L1',sequence:2,answer:'wrong'}],Overwrite_A1:true})};
  s=(await call(`/api/sessions/${id}`,{cookie:a.cookie,data:{answer:wrong[s.caseQuestion.id],stage:'case1',version:0}})).payload;
  assert.equal(s.conversation.stage,'probe');assert.equal(s.conversation.caseq1_answer_correct,false);
  const stale=await call(`/api/sessions/${id}`,{cookie:a.cookie,data:{answer:'Answer',stage:'case1',version:0}});assert.equal(stale.status,409);
  s=(await call(`/api/sessions/${id}`,{cookie:a.cookie,data:{answer:'I would follow the actual request and check what each component can access.',stage:'probe',version:s.conversation.version}})).payload;
  assert.equal(s.conversation.stage,'case2');assert.ok(s.conversation.user_probe_answer_at);
  const correct={q6:'server, server, LLM_response',q8:'{"UI":"Browser","Backend":"Server","Model":"Model_provider","Question_route":["UI","Backend","Model"],"Model_machine_remaining_RAM_GB":15}',q9:'{"Display_message_input":"Browser","Store_secret_key":"Backend_secret_storage","Verify_conversation_permission":"Backend_processing","Keep_saved_conversations":"Persistent_database","Call_provider_using_secret":"Backend_processing"}',q5:'{"URL":"https://weather.example/current","Method":"GET","Query":{"city":"Bengaluru"},"Authentication":null,"Body":null}',q11:'D,B,E,C,A',q22:JSON.stringify({Attempts:[{id:'A',learner_id:'L1'},{id:'B',learner_id:'L1'},{id:'C',learner_id:'L2'}],L1_attempt_count:2,Learner_requires_attempt_ID_array:false}),q26:JSON.stringify({Ordered_attempt_IDs:['A3','A1','A2'],First_answer:'before',Latest_answer:'after',Ordering_field:'sequence'})};
  s=(await call(`/api/sessions/${id}`,{cookie:a.cookie,data:{answer:correct[s.caseQuestion.id],stage:'case2',version:s.conversation.version}})).payload;
  assert.equal(s.conversation.stage,'completed');assert.equal(s.conversation.demonstrated_change,1);assert.ok(s.conversation.completed_at);
  assert.equal((await call(`/api/sessions/${id}`,{cookie:a.cookie})).payload.conversation.demonstrated_change,1);
  assert.equal((await call(`/api/sessions/${id}`,{cookie:a.cookie,data:{answer:'overwrite',stage:'case2',version:s.conversation.version}})).status,409);
  console.log(`PASS ${concept.topic}: malformed → incorrect → probe → new correct case → change +1, ownership and stale-write checks`);
}
assert.equal((await call('/api/dashboard',{cookie:b.cookie})).payload.conversations.length,0);
assert.equal((await call('/api/bootstrap',{data:{},headers:{Origin:'https://untrusted.example'}})).status,403);
const second=await call('/api/sessions',{cookie:a.cookie,data:{conceptId:'secrets',explanation:'I am trying the same concept again to practice my reasoning.'}});
assert.equal(second.payload.conversation.case1_fresh,true);assert.equal(second.payload.conversation.case2_fresh,true);
const repeat=await call('/api/sessions',{cookie:a.cookie,data:{conceptId:'secrets',explanation:'I am testing repeat practice after all four cases were assigned.'}});
assert.equal(repeat.payload.conversation.case1_fresh,false);assert.equal(repeat.payload.conversation.case2_fresh,false);
console.log('PASS persistent reload, learner isolation, automatic analysis notice, cross-origin protection, repeat-case labeling');
