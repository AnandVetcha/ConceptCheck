import { randomUUID } from "node:crypto";
import type { Conversation, SessionData } from "./types";
import { getCases, getConcepts, getConversation, getConversations, getRecitals, saveConversation, saveRecital, saveAttempt } from "./store";
import { publicCase } from "./catalog";
import { analyze } from "./ai";
import { demonstratedChange, validate } from "./validators";
import { HttpError } from "./auth";
export async function sessionData(c: Conversation): Promise<SessionData> {
  const questionId = c.stage === "case1" ? c.case_question1_id : c.stage === "case2" ? c.case_question2_id : null;
  const q = questionId ? (await getCases(c.concept_id)).find(x => x.id === questionId) : null;
  if(questionId && !q) throw new Error("Missing case question");
  return {conversation:c,caseQuestion:q ? publicCase(q) : null,...(c.stage === "completed" ? {completedCases:(await getCases(c.concept_id)).filter(q => [c.case_question1_id,c.case_question2_id].includes(q.id)).map(publicCase)} : {})};
}
export async function startSession(userId: string, conceptId: string, explanation: string) {
  const concept = (await getConcepts()).find(c => c.id === conceptId);
  if(!concept) throw new HttpError(400,"Choose an available concept.");
  const questions = await getCases(conceptId);
  if(questions.length < 2) throw new HttpError(409,"This concept needs at least two distinct cases before it can be practiced.");
  const history = await getConversations(userId);
  const seen = new Set(history.filter(c => c.concept_id === conceptId).flatMap(c => [c.case_question1_id,c.case_question2_id]));
  // Prefer unseen cases; rotate when this small practice bank is exhausted.
  const offset = history.filter(c => c.concept_id === conceptId).length % questions.length;
  const rotated = [...questions.slice(offset),...questions.slice(0,offset)];
  const selected = [...rotated.filter(q => !seen.has(q.id)),...rotated.filter(q => seen.has(q.id))].slice(0,2);
  const insight = await analyze(concept,explanation,await getRecitals(userId));
  await saveRecital(userId,insight.label);
  const conversation: Conversation = {
    id:randomUUID(),user_id:userId,concept_id:conceptId,user_explanation:explanation,
    recital_sentence:insight.sentence,recital_label:insight.label,recital_match_confidence:insight.confidence,
    case_question1_id:selected[0].id,caseq1_user_answer:null,caseq1_answer_correct:null,
    probe_question:insight.probe,user_probe_answer:null,case_question2_id:selected[1].id,
    caseq2_user_answer:null,caseq2_answer_correct:null,demonstrated_change:null,
    case1_fresh:!seen.has(selected[0].id),case2_fresh:!seen.has(selected[1].id),
    consent_at:null,data_collection_notice_at:new Date().toISOString(),user_probe_answer_at:null,
    stage:"case1",version:0,created_at:new Date().toISOString(),completed_at:null,ai_mode:insight.mode
  };
  await saveConversation(conversation); return sessionData(conversation);
}
export async function submitAnswer(userId: string, id: string, answer: string, stage: string, version: number): Promise<SessionData> {
  const c = await getConversation(id,userId);
  if(!c) throw new HttpError(404,"Session not found.");
  if(c.stage === "completed") throw new HttpError(409,"This session is already complete.");
  if(c.stage !== stage || c.version !== version) throw new HttpError(409,"This session changed. Reload it to continue.");
  const updated = {...c,version:c.version + 1};
  if(c.stage === "probe") {
    updated.user_probe_answer = answer; updated.user_probe_answer_at=new Date().toISOString(); updated.stage = "case2";
    await saveConversation(updated,c.version); return sessionData(updated);
  }
  const q = (await getCases(c.concept_id)).find(q => q.id === (c.stage === "case1" ? c.case_question1_id : c.case_question2_id));
  if(!q) throw new Error("Missing case question");
  const grade = validate(q,answer);
  await saveAttempt({id:randomUUID(),conversation_id:c.id,user_id:userId,case_question_id:q.id,stage:c.stage,answer,status:grade.status,created_at:new Date().toISOString()});
  if(grade.status === "FORMAT_ERROR") return {...await sessionData(c),grade};
  if(c.stage === "case1") { updated.caseq1_user_answer=answer; updated.caseq1_answer_correct=grade.status === "PASS"; updated.stage="probe"; }
  else {
    updated.caseq2_user_answer=answer; updated.caseq2_answer_correct=grade.status === "PASS";
    updated.demonstrated_change=demonstratedChange(updated.caseq1_answer_correct,updated.caseq2_answer_correct);
    updated.completed_at=new Date().toISOString(); updated.stage="completed";
  }
  await saveConversation(updated,c.version); return {...await sessionData(updated),grade};
}
