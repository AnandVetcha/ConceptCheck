import type { CaseQuestion, FormatField } from "./types";

export type Rule = { types: string[]; properties?: Record<string, Rule>; items?: Rule[]; allowedValues?: (string | number | boolean)[] };
const machines = ["Browser", "Server", "Model_provider"];
const locations = ["Browser", "Backend_secret_storage", "Backend_processing", "Persistent_database"];
const internal = ["Laptop_browser", "VPN_backend", "Internal_worker", "Internal_secret_storage"];
const sides = ["Browser", "Backend"];
export const orderLetters = ["A", "B", "C", "D", "E"];
export const tokenLabels = ["server", "client", "LLM_provider", "user_question", "LLM_response"];
export const fieldNames = ["Answer", "LLM_key", "Request_ID"];

// Candidate sets from the question, never the correct assignment.
// Do not infer allowed values from golden-answer string contents.
const structuredChoices: Record<string, Record<string, (string | number | boolean)[]>> = {
  q12: { Secret_location: sides, Provider_caller: sides },
  q14: { Validate_quantity_at: sides, Calculate_charge_at: sides },
  q15: { Permission_check_at: sides },
  q16: { Request_query_city: ["Bengaluru", "Chennai"], Response_body_city: ["Bengaluru", "Chennai"] },
  q20: { UI: machines, Backend: machines, Model: machines },
  q21: { Foreign_key_table: ["Conversations", "Messages"], Foreign_key_column: ["id", "conversation_id"], References_table: ["Conversations", "Messages"], References_column: ["id", "conversation_id"] },
  q22: { "Attempts[].id": ["A", "B", "C"], "Attempts[].learner_id": ["L1", "L2"] },
  q23: { Link_table: ["Enrollments"], "Rows[].learner_id": ["L1", "L2"], "Rows[].course_id": ["C1", "C2"] },
  q24: { "Accepted_message_IDs[]": ["M1", "M2"], "Rejected_message_IDs[]": ["M1", "M2"], Parent_lookup_column: ["Conversations.id", "Messages.conversation_id"] },
  q25: { "Rows[].attempt_id": ["A1", "A2"], "Rows[].learner_id": ["L1"], "Rows[].answer": ["Answer", "LLM_key"] },
  q26: { "Ordered_attempt_IDs[]": ["A1", "A2", "A3"], First_answer: ["before", "middle", "after"], Latest_answer: ["before", "middle", "after"], Ordering_field: ["sequence", "id", "physical row order"] },
  q27: { Latest_attempt_id: ["A1", "A2", "A3"] },
  q28: { Before_attempt_id: ["A7", "A8", "A9"], After_attempt_id: ["A7", "A8", "A9"], Both_attempts_conversation_id: ["C1", "C2"], Demonstrated_change: [-1, 0, 1] }
};
const wildcard = (path: string) => path.replace(/\[\d+\]/g, "[]");
export const childPath = (parent: string, key: string) => parent ? `${parent}.${key}` : key;
function choices(q: CaseQuestion, path: string) {
  switch (q.validator) {
    case "placement": return ["Client", "Remote_server", "LLM_server"];
    case "identity": return path === "Compare_owner_with" ? ["Server_verified_identity", "Browser_claimed_identity"] : ["ALLOW", "DENY"];
    case "route": return path.startsWith("Question_route[") ? ["UI", "Backend", "Model"] : ["UI", "Backend", "Model"].includes(path) ? machines : undefined;
    case "responsibilities": return locations;
    case "internal": return ["Display_UI_and_collect_path", "Validate_and_dispatch", "Read_and_analyse_waveform", "Keep_file_credentials"].includes(path) ? internal : undefined;
    case "structured": return structuredChoices[q.id]?.[wildcard(path)];
  }
}
export function answerRule(q: CaseQuestion): Rule {
  function build(value: unknown, path: string): Rule {
    if (q.validator === "weather" && ["Authentication", "Body"].includes(path)) return { types: ["null", "string", "object"] };
    if (Array.isArray(value)) return { types: ["array"], items: value.map((item, i) => build(item, `${path}[${i}]`)) };
    if (value !== null && typeof value === "object") return { types: ["object"], properties: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, build(item, childPath(path, key))])) };
    const type = value === null ? "null" : typeof value;
    return { types: [type], allowedValues: type === "boolean" ? [true, false] : choices(q, path) };
  }
  return build(q.golden_answer, "");
}
export function expectedValue(rule: Rule): string {
  if (rule.allowedValues) return `Choose one: ${rule.allowedValues.map(v => JSON.stringify(v)).join(", ")}${rule.types[0] === "string" ? ". Use double quotes and match spelling/case" : ". Do not use quotation marks"}.`;
  if (rule.types.length > 1) return "Use JSON null, a string, or an object. Write null without quotes when no value is required.";
  switch (rule.types[0]) {
    case "string": return "Use a string in double quotes, following the text or identifiers supplied in the question.";
    case "number": return "Use a finite number without quotation marks. Calculate its value from the question.";
    case "array": return `Use an array with exactly ${rule.items?.length ?? 0} entries, in the order requested.`;
    case "object": return `Use a JSON object${rule.properties ? ` with exactly these fields: ${Object.keys(rule.properties).join(", ")}` : ""}.`;
    case "null": return "Use JSON null without quotation marks.";
    default: return "Use the type shown in the supplied answer structure.";
  }
}
export function formatFields(q: CaseQuestion): FormatField[] {
  if (q.validator === "field") return [{ path: "Answer", expected: "Reply with exactly one field name, without JSON or quotes.", allowedValues: fieldNames }];
  if (q.validator === "tokens") return [{ path: "Tokens 1–3", expected: "Use exactly three comma-separated labels in question order. Labels are case-sensitive.", allowedValues: tokenLabels }];
  if (q.validator === "order") return [{ path: "Events 1–5", expected: "Use five comma-separated letters; each letter must appear exactly once. Work out the order from the question.", allowedValues: orderLetters }];
  const fields = new Map<string, FormatField>();
  function visit(rule: Rule, path: string) {
    if (rule.properties) { for (const [key, child] of Object.entries(rule.properties)) visit(child, childPath(path, key)); return; }
    const name = wildcard(path) || "Answer";
    fields.set(name, { path: name, expected: expectedValue(rule), ...(rule.allowedValues ? { allowedValues: rule.allowedValues } : {}) });
    rule.items?.forEach((child, i) => visit(child, `${path}[${i}]`));
  }
  visit(answerRule(q), "");
  return [...fields.values()];
}
