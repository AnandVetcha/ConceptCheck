import { mkdirSync, writeFileSync } from "node:fs";
import { concepts, cases } from "../src/lib/catalog";

const guidance: Record<string,string> = {
  identity: "The backend runs trusted work outside the browser: secret-bearing service calls, application logic, authorised access, and persistent storage operations. Its RAM alone is not durable storage. A learner should identify the responsibility and what breaks if it depends on the browser.",
  contracts: "An API request follows its contract: destination, method, headers, parameters or body. A response has its own status and content. Credentials and bodies are not universal requirements, and status 200 does not prove the answer meets the user’s needs. Application instructions and user input have distinct roles.",
  secrets: "A browser user can inspect frontend code, storage and requests, copy secret credentials, and misuse the application’s provider account. Keep provider secrets in backend-controlled storage and backend-to-provider authentication metadata, never in browser responses or model-readable message content. Publicly designed credentials are a different case.",
  tools: "Persistence lets data survive the relevant restart; it does not automatically give that data to a model. The backend must retrieve relevant authorised records and include them in the model request, or execute a requested retrieval tool and return its result. UI display alone supplies no model context. Q7 and Q11 retain the earlier tool-flow exercises as tests of retrieval and reuse; Q18 and Q19 directly test durable storage and restart behaviour.",
  relationships: "In a one-to-many relationship, each child stores one parent foreign key. A parent can be referenced by many children without maintaining a growing array of child IDs. Many-to-many relationships use a linking table containing one row per pairing.",
  history: "Overwriting a latest-value cell destroys earlier values. Preserve each event or attempt as a separate identified row with ownership or workflow reference and stable timestamp or sequence ordering. A latest pointer may coexist with those rows, but cannot replace them.",
  architecture: "Place components using their responsibility, hardware needs, trusted control, permitted access, persistence needs, and network reachability. UI, backend, storage, and model are distinct responsibilities. Memory fit alone is not sufficient."
};
let output = "# ConceptChek question bank\n\n28 cases across the seven concepts in the supplied `03_ConceptCheck_GoldenAnswer.docx`, with four cases per concept. Existing Q1–Q10 and the earlier supplemental Q11 retain their IDs and answers; Q12–Q28 are the 17 additions. Concept labels are aligned to the supplied reference, while existing concept IDs remain stable to preserve conversation links.\n\nEach case tests part of a concept’s reasoning. Passing one case is not a declaration of complete understanding. Questions require constructed answers rather than multiple-choice selection. The answers below are reviewer material and are never returned to learners by the app’s API.\n\n| Concept | Case IDs | Total |\n|---|---|---|\n";
for(const c of concepts) output += `| ${c.topic} | ${cases.filter(q=>q.concept_id===c.id).sort((a,b)=>a.position-b.position).map(q=>q.id.toUpperCase()).join(", ")} | 4 |\n`;
output += "\n## Grading rules\n\nCase answers are graded by code. JSON keys and scalar types must match the supplied structure, with no extra or missing keys. Object key order and formatting whitespace do not affect correctness. For the new structured cases, arrays must have the stated number of entries in the requested order; JSON booleans and numbers cannot be quoted. Null placeholders must be replaced with booleans. Values outside a field’s stated candidate set, invalid structure, or incorrect types are FORMAT_ERROR and may be corrected. Valid candidate values assigned incorrectly are INCORRECT. Field-level feedback identifies the path, submitted value, and accepted choices or type. Comma-separated ordering cases require A–E exactly once, with whitespace around tokens ignored. Original cases retain their original validators, including Q4’s case-insensitive header names. New Q17 uses the exact header names in its template.\n\n";
for(const c of concepts) {
  output += `## ${c.topic}\n\nReference reasoning: ${guidance[c.id]}\n\n`;
  for(const q of cases.filter(q=>q.concept_id===c.id).sort((a,b)=>a.position-b.position)) {
    const label=Number(q.id.slice(1))<=10 ? "Original golden case" : q.id==="q11" ? "Earlier supplemental case" : "New case";
    output += `### ${q.id.toUpperCase()} ${q.title}\n\n${label}. Validator: \`${q.validator}\`.\n\n${q.question}\n\n`;
    if(q.answer_template) output += `Answer structure:\n\n\`\`\`json\n${q.answer_template}\n\`\`\`\n\n`;
    output += `Golden answer:\n\n\`\`\`${typeof q.golden_answer === "string" ? "text" : "json"}\n${typeof q.golden_answer === "string" ? q.golden_answer : JSON.stringify(q.golden_answer,null,2)}\n\`\`\`\n\n`;
  }
}
output += "## Apply to an existing Supabase project\n\nRun the entire `supabase/migrations/002_four_cases_per_concept.sql` in Supabase SQL Editor, then refresh the app. It adds the structured validator type and upserts all 28 cases and seven concept labels. Existing user records and case IDs are preserved. For a new database, run `supabase/setup.sql` instead. No hosted SQL changes are made by generating these files.\n";
mkdirSync("docs",{recursive:true});
writeFileSync("docs/question-bank.md",output);
console.log("Generated docs/question-bank.md");
