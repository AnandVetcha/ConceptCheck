import type { AdminInsights, Attempt, Conversation } from "./types";
export type AnalyticsConversation = Pick<Conversation,"id"|"user_id"|"concept_id"|"stage"|"caseq2_answer_correct"|"demonstrated_change"|"case1_fresh"|"case2_fresh">;
export type AnalyticsAttempt = Pick<Attempt,"conversation_id"|"status">;
export function isAdministrator(email: string, configuredEmails: string) {
  return !!email.trim() && configuredEmails.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}
export function buildAdminInsights(conversations: AnalyticsConversation[], attempts: AnalyticsAttempt[]): AdminInsights {
  const concepts = new Map<string,AdminInsights["concepts"][number]>();
  const sessions = new Map(conversations.map(c=>[c.id,c]));
  const row = (id:string) => {
    if(!concepts.has(id)) concepts.set(id,{conceptId:id,sessions:0,completed:0,secondCasePassed:0,improvements:0,attempts:0,passed:0,incorrect:0,formatErrors:0});
    return concepts.get(id)!;
  };
  let freshImprovements=0;
  for(const c of conversations) {
    const r=row(c.concept_id);r.sessions++;
    if(c.stage==="completed") {
      r.completed++;
      if(c.caseq2_answer_correct) r.secondCasePassed++;
      if(c.demonstrated_change===1) {r.improvements++;if(c.case1_fresh&&c.case2_fresh) freshImprovements++;}
    }
  }
  let passed=0,incorrect=0,formatErrors=0;
  for(const a of attempts) {
    if(a.status==="PASS") passed++; else if(a.status==="INCORRECT") incorrect++; else formatErrors++;
    const c=sessions.get(a.conversation_id);if(!c) continue;
    const r=row(c.concept_id);r.attempts++;
    if(a.status==="PASS") r.passed++;else if(a.status==="INCORRECT") r.incorrect++;else r.formatErrors++;
  }
  const completed=conversations.filter(c=>c.stage==="completed").length;
  return {learners:new Set(conversations.map(c=>c.user_id)).size,sessions:conversations.length,completed,inProgress:conversations.length-completed,attempts:attempts.length,passed,incorrect,formatErrors,freshImprovements,concepts:[...concepts.values()]};
}
