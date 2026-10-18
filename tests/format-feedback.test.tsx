import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { cases, publicCase } from "../src/lib/catalog";
import { validate } from "../src/lib/validators";
import { AnswerFeedback, AnswerFormatGuide } from "../src/components/answer-feedback";
const question=(id:string)=>cases.find(q=>q.id===id)!;
const golden=(id:string)=>structuredClone(question(id).golden_answer) as Record<string,unknown>;

test("the screenshot typo points to the third route entry with all allowed labels",()=>{
  const answer={...golden("q8"),Question_route:["UI","Backend","Modeljjj"]};
  const grade=validate(question("q8"),JSON.stringify(answer));
  assert.equal(grade.status,"FORMAT_ERROR");
  assert.equal(grade.issues?.length,1);
  assert.equal(grade.issues?.[0].path,"Question_route[2]");
  assert.equal(grade.issues?.[0].received,'"Modeljjj"');
  assert.deepEqual(grade.issues?.[0].allowedValues,["UI","Backend","Model"]);
  assert.ok(!grade.message.includes("Model_provider"));
});
test("all invalid fields are reported together, with nested paths and missing names",()=>{
  const answer=golden("q8");answer.UI="Laptop";answer.Backend=8;answer.Question_route=["UI","Backend","Modeljjj"];answer.Model_machine_remaining_RAM_GB="15";
  const grade=validate(question("q8"),JSON.stringify(answer));
  assert.deepEqual(grade.issues?.map(i=>i.path),["UI","Backend","Question_route[2]","Model_machine_remaining_RAM_GB"]);
  assert.deepEqual(grade.issues?.[0].allowedValues,["Browser","Server","Model_provider"]);
  assert.match(grade.issues![3].expected,/number without quotation marks/);
  const tutor=golden("q4");(tutor.Body as Record<string,unknown>).extra="unexpected";delete (tutor.Body as Record<string,unknown>).question;
  const issues=validate(question("q4"),JSON.stringify(tutor)).issues!;
  assert.ok(issues.some(i=>i.path==="Body.extra"&&i.message.includes("Unexpected")));
  assert.ok(issues.some(i=>i.path==="Body.question"&&i.received==="missing"));
});
test("array length, nested identifiers, boolean types, and syntax have actionable details",()=>{
  const tooShort={...golden("q8"),Question_route:["UI","Backend"]};
  assert.match(validate(question("q8"),JSON.stringify(tooShort)).issues![0].expected,/exactly 3/);
  const rows=golden("q22");(rows.Attempts as {learner_id:string}[])[1].learner_id="L3";
  const issue=validate(question("q22"),JSON.stringify(rows)).issues![0];
  assert.equal(issue.path,"Attempts[1].learner_id");assert.deepEqual(issue.allowedValues,["L1","L2"]);
  const booleans={...golden("q13"),Model_message_text:"false"};
  assert.deepEqual(validate(question("q13"),JSON.stringify(booleans)).issues![0].allowedValues,[true,false]);
  const malformed=validate(question("q8"),'{\n "UI": "Browser"\n "Backend": "Server"\n}');
  assert.match(malformed.issues![0].path,/JSON syntax/);assert.match(malformed.issues![0].message,/commas/);
});
test("valid assignments still receive a correctness grade rather than a format hint",()=>{
  const grade=validate(question("q8"),JSON.stringify({...golden("q8"),UI:"Server",Backend:"Browser"}));
  assert.equal(grade.status,"INCORRECT");assert.equal(grade.issues,undefined);
  assert.equal(validate(question("q8"),JSON.stringify(golden("q8"))).status,"PASS");
});
test("public guidance lists candidates and types without exposing golden assignments or numbers",()=>{
  const safe=publicCase(question("q8"));
  assert.ok(!("golden_answer" in safe));assert.ok(!("validator" in safe));
  assert.deepEqual(safe.format_fields?.find(f=>f.path==="UI")?.allowedValues,["Browser","Server","Model_provider"]);
  const ram=safe.format_fields?.find(f=>f.path==="Model_machine_remaining_RAM_GB");
  assert.ok(ram);assert.equal(ram.allowedValues,undefined);assert.ok(!ram.expected.includes("15"));
  assert.deepEqual(safe.format_fields?.find(f=>f.path==="Question_route[]")?.allowedValues,["UI","Backend","Model"]);
});
test("feedback and guides render readable paths and safely escape submitted HTML",()=>{
  const grade=validate(question("q8"),JSON.stringify({...golden("q8"),Question_route:["UI","Backend","<script>alert(1)</script>"]}));
  const html=renderToStaticMarkup(<AnswerFeedback grade={grade}/>);
  assert.ok(html.includes('role="alert"'));assert.ok(html.includes("Question_route[2]"));assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("<script>"));
  const guide=renderToStaticMarkup(<AnswerFormatGuide fields={publicCase(question("q8")).format_fields!}/>);
  assert.ok(guide.includes("Allowed values for each field"));assert.ok(guide.includes("Model_provider"));
});
test("plain-token guidance does not ask for JSON quotes and repeated headers stay invalid",()=>{
  assert.match(validate(question("q1"),"wrong").issues![0].expected,/without quotation marks/);
  assert.match(validate(question("q6"),"server, wrong, LLM_response").issues![0].expected,/without quotation marks/);
  assert.match(validate(question("q7"),"D,B,E,C,C").issues![0].message,/repeated/);
  const headers=golden("q4");(headers.Headers as Record<string,unknown>).authorization="Bearer DEMO_KEY";
  assert.equal(validate(question("q4"),JSON.stringify(headers)).status,"FORMAT_ERROR");
});
