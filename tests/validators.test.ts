import test from "node:test";
import assert from "node:assert/strict";
import { cases, concepts } from "../src/lib/catalog";
import { validate,demonstratedChange } from "../src/lib/validators";
const q = (id:string) => cases.find(q=>q.id===id)!;
const answer = (id:string) => typeof q(id).golden_answer === "string" ? q(id).golden_answer as string : JSON.stringify(q(id).golden_answer);
for(const c of cases) {
  test(`${c.id}: golden answer passes`,()=>{assert.equal(validate(c,answer(c.id)).status,"PASS");});
  test(`${c.id}: malformed answer is rejected`,()=>{assert.equal(validate(c,"not an answer").status,"FORMAT_ERROR");});
}
test("field is case sensitive, trims only outer whitespace",()=>{
  assert.equal(validate(q("q1"),"  LLM_key \n").status,"PASS");
  assert.equal(validate(q("q1"),"llm_key").status,"FORMAT_ERROR");
  assert.equal(validate(q("q1"),"Answer").status,"INCORRECT");
});
test("JSON key order does not matter; extras and incorrect types fail format",()=>{
  assert.equal(validate(q("q2"),'{"LLM":"LLM_server","UI":"Client","Backend":"Remote_server"}').status,"PASS");
  assert.equal(validate(q("q2"),JSON.stringify({...q("q2").golden_answer as object,extra:1})).status,"FORMAT_ERROR");
  assert.equal(validate(q("q2"),'{"UI":3,"Backend":"Remote_server","LLM":"LLM_server"}').status,"FORMAT_ERROR");
  assert.equal(validate(q("q2"),'{"UI":"Remote_server","Backend":"Client","LLM":"LLM_server"}').status,"INCORRECT");
});
test("identity uses verified identity, not client claims",()=>{
  assert.equal(validate(q("q3"),JSON.stringify({...q("q3").golden_answer as object,Compare_owner_with:"Browser_claimed_identity"})).status,"INCORRECT");
});
test("header names are case insensitive, values remain exact",()=>{
  const a=JSON.parse(answer("q4"));a.Headers={authorization:"Bearer DEMO_KEY","content-type":"application/json"};
  assert.equal(validate(q("q4"),JSON.stringify(a)).status,"PASS");
  a.Headers.authorization="DEMO_KEY";assert.equal(validate(q("q4"),JSON.stringify(a)).status,"INCORRECT");
  a.Headers.extra="bad";assert.equal(validate(q("q4"),JSON.stringify(a)).status,"FORMAT_ERROR");
});
test("weather accepts string/object authentication structurally but grades incorrect",()=>{
  for(const Authentication of ["null",{},"Bearer something"]) assert.equal(validate(q("q5"),JSON.stringify({...q("q5").golden_answer as object,Authentication})).status,"INCORRECT");
  for(const Authentication of [true,[],42]) assert.equal(validate(q("q5"),JSON.stringify({...q("q5").golden_answer as object,Authentication})).status,"FORMAT_ERROR");
});
test("token order matters and extra tokens are format errors",()=>{
  assert.equal(validate(q("q6"),"client, server, LLM_response").status,"INCORRECT");
  assert.equal(validate(q("q6"),"server, server, LLM_response, client").status,"FORMAT_ERROR");
  assert.equal(validate(q("q7"),"A,B,E,C,D").status,"INCORRECT");
  assert.equal(validate(q("q7"),"D,B,E,C,C").status,"FORMAT_ERROR");
});
test("route and RAM require correct types and exact values",()=>{
  assert.equal(validate(q("q8"),JSON.stringify({...q("q8").golden_answer as object,Model_machine_remaining_RAM_GB:"15"})).status,"FORMAT_ERROR");
  assert.equal(validate(q("q8"),JSON.stringify({...q("q8").golden_answer as object,Model_machine_remaining_RAM_GB:14})).status,"INCORRECT");
  assert.equal(validate(q("q8"),JSON.stringify({...q("q8").golden_answer as object,Question_route:["Model","Backend","UI"]})).status,"INCORRECT");
});
test("internal policy answers must be boolean, not string",()=>{
  assert.equal(validate(q("q10"),JSON.stringify({...q("q10").golden_answer as object,Public_provider_can_reach_internal_file:"false"})).status,"FORMAT_ERROR");
  assert.equal(validate(q("q10"),JSON.stringify({...q("q10").golden_answer as object,Policy_allows_raw_waveform_at_public_provider:true})).status,"INCORRECT");
});
test("change is null until both graded, otherwise matches all four outcomes",()=>{
  assert.equal(demonstratedChange(null,true),null);assert.equal(demonstratedChange(false,null),null);
  assert.equal(demonstratedChange(false,true),1);assert.equal(demonstratedChange(true,false),-1);
  assert.equal(demonstratedChange(true,true),0);assert.equal(demonstratedChange(false,false),0);
});

test("the seven supplied concepts have exactly four distinct cases each",()=>{
  assert.equal(concepts.length,7);assert.equal(cases.length,28);
  assert.equal(new Set(cases.map(c=>c.id)).size,28);
  for(const concept of concepts) {
    const group=cases.filter(q=>q.concept_id===concept.id);
    assert.equal(group.length,4,concept.topic);
    assert.deepEqual(group.map(q=>q.position).sort(),[1,2,3,4]);
  }
  assert.ok(cases.every(q=>concepts.some(c=>c.id===q.concept_id)));
});
test("structured cases distinguish wrong reasoning from malformed types and nesting",()=>{
  assert.equal(validate(q("q12"),JSON.stringify({...q("q12").golden_answer as object,Secret_location:"Browser"})).status,"INCORRECT");
  assert.equal(validate(q("q12"),JSON.stringify({...q("q12").golden_answer as object,Browser_user_can_recover_key:"true"})).status,"FORMAT_ERROR");
  assert.equal(validate(q("q13"),q("q13").answer_template).status,"FORMAT_ERROR");
  assert.equal(validate(q("q14"),JSON.stringify({...q("q14").golden_answer as object,Correct_total_rupees:1})).status,"INCORRECT");
  assert.equal(validate(q("q14"),JSON.stringify({...q("q14").golden_answer as object,Correct_total_rupees:"360"})).status,"FORMAT_ERROR");
  const nested=JSON.parse(answer("q22"));nested.Attempts[0].owner="L1";
  assert.equal(validate(q("q22"),JSON.stringify(nested)).status,"FORMAT_ERROR");
  const missing=JSON.parse(answer("q23"));missing.Rows.pop();
  assert.equal(validate(q("q23"),JSON.stringify(missing)).status,"FORMAT_ERROR");
  const wrong=JSON.parse(answer("q23"));wrong.Rows[2].course_id="C2";
  assert.equal(validate(q("q23"),JSON.stringify(wrong)).status,"INCORRECT");
  const reordered=JSON.parse(answer("q26"));reordered.Ordered_attempt_IDs.reverse();
  assert.equal(validate(q("q26"),JSON.stringify(reordered)).status,"INCORRECT");
  const shuffled=Object.fromEntries(Object.entries(JSON.parse(answer("q28"))).reverse());
  assert.equal(validate(q("q28"),JSON.stringify(shuffled)).status,"PASS");
});
test("retrieval ordering uses the scenario-specific sequence",()=>{
  assert.equal(validate(q("q19")," B, D, A, E, C ").status,"PASS");
  assert.equal(validate(q("q19"),"D,B,E,C,A").status,"INCORRECT");
});
