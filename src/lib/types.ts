export type Concept = { id: string; topic: string; description: string; icon: string; color: string; position: number };
export type CaseQuestion = { id: string; concept_id: string; title: string; question: string; answer_template: string; validator: string; golden_answer: unknown; position: number };
export type PublicCase = Omit<CaseQuestion, "golden_answer" | "validator">;
export type Grade = { status: "PASS" | "INCORRECT" | "FORMAT_ERROR"; message: string };
export type Stage = "case1" | "probe" | "case2" | "completed";
export type Attempt = { id: string; conversation_id: string; user_id: string; case_question_id: string; stage: "case1" | "case2"; answer: string; status: Grade["status"]; created_at: string };
export type Conversation = {
  id: string; user_id: string; concept_id: string; user_explanation: string;
  recital_sentence: string; recital_label: string; recital_match_confidence: number | null;
  case_question1_id: string; caseq1_user_answer: string | null; caseq1_answer_correct: boolean | null;
  probe_question: string; user_probe_answer: string | null;
  case_question2_id: string; caseq2_user_answer: string | null; caseq2_answer_correct: boolean | null;
  case1_fresh: boolean; case2_fresh: boolean;
  demonstrated_change: -1 | 0 | 1 | null; stage: Stage; version: number;
  consent_at: string; user_probe_answer_at: string | null;
  created_at: string; completed_at: string | null; ai_mode: "groq" | "mock";
};
export type SessionData = { conversation: Conversation; caseQuestion: PublicCase | null; completedCases?: PublicCase[]; grade?: Grade };
export type Recital = { id: string; user_id: string; label: string };
