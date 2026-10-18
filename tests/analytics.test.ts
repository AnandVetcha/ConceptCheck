import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminInsights, isAdministrator, type AnalyticsConversation } from "../src/lib/analytics";
const session=(id:string,userId:string,extra:Partial<AnalyticsConversation>={}):AnalyticsConversation=>({id,user_id:userId,concept_id:"secrets",stage:"case1",caseq2_answer_correct:null,demonstrated_change:null,case1_fresh:true,case2_fresh:true,...extra});
test("administrator access requires a non-empty verified email in the configured list",()=>{
  assert.equal(isAdministrator("",""),false);
  assert.equal(isAdministrator("learner@example.com",""),false);
  assert.equal(isAdministrator("learner@example.com","admin@example.com"),false);
  assert.equal(isAdministrator("ADMIN@example.com"," , admin@example.com, another@example.com "),true);
});
test("administrator insights include all learners, pending sessions, and format retries",()=>{
  const result=buildAdminInsights([
    session("a","learner1",{stage:"completed",caseq2_answer_correct:true,demonstrated_change:1}),
    session("b","learner2",{stage:"probe"}),
    session("c","learner3",{concept_id:"history",stage:"completed",caseq2_answer_correct:true,demonstrated_change:1,case1_fresh:false}),
  ],[
    {conversation_id:"a",status:"INCORRECT"},{conversation_id:"a",status:"PASS"},
    {conversation_id:"b",status:"FORMAT_ERROR"},{conversation_id:"b",status:"INCORRECT"},
    {conversation_id:"c",status:"INCORRECT"},{conversation_id:"c",status:"PASS"},
  ]);
  assert.equal(result.learners,3);assert.equal(result.sessions,3);assert.equal(result.completed,2);assert.equal(result.inProgress,1);
  assert.equal(result.attempts,6);assert.equal(result.passed,2);assert.equal(result.incorrect,3);assert.equal(result.formatErrors,1);
  assert.equal(result.freshImprovements,1);
  assert.deepEqual(result.concepts.find(c=>c.conceptId==="secrets"),{conceptId:"secrets",sessions:2,completed:1,secondCasePassed:1,improvements:1,attempts:4,passed:1,incorrect:2,formatErrors:1});
  assert.equal(JSON.stringify(result).includes("learner1"),false);
  assert.equal(JSON.stringify(result).includes("conversation_id"),false);
});
test("empty administrator insights have zero counts",()=>{
  const a=buildAdminInsights([],[]);
  assert.equal(a.sessions,0);assert.equal(a.learners,0);assert.equal(a.attempts,0);assert.deepEqual(a.concepts,[]);
});
