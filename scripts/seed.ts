import { readFileSync, writeFileSync } from "node:fs";
import { concepts,cases } from "../src/lib/catalog";
const literal = (value:unknown) => value === null ? "null" : typeof value === "number" ? String(value) : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'","''")}'`;
let sql = "-- Generated from src/lib/catalog.ts by npx tsx scripts/seed.ts.\n-- Seven concepts, four cases each. q1–q10 original; q11 earlier supplement; q12–q28 new.\n-- Safe to rerun: upgrades the validator constraint and upserts content without deleting learner records.\nbegin;\n";
sql += "alter table public.case_questions drop constraint if exists case_questions_validator_check;\n";
sql += "alter table public.case_questions add constraint case_questions_validator_check check (validator in ('field','placement','identity','tutor','weather','tokens','order','route','responsibilities','internal','structured'));\n";
for(const [table,rows] of [["concepts",concepts],["case_questions",cases]] as const) {
  for(const row of rows) {
    const keys=Object.keys(row);
    const values = Object.entries(row).map(([key,value]) => key === "golden_answer" ? `${literal(JSON.stringify(value))}::jsonb` : literal(value));
    sql += `insert into public.${table} (${keys.join(",")}) values (${values.join(",")}) on conflict (id) do update set ${keys.filter(k=>k!=="id").map(k=>`${k}=excluded.${k}`).join(",")};\n`;
  }
}
writeFileSync("supabase/seed.sql",sql+"commit;\n");
writeFileSync("supabase/migrations/002_four_cases_per_concept.sql",sql+"commit;\n");
const unwrapped = (text: string) => text.replace(/^begin;\s*$/gmi, "").replace(/^commit;\s*$/gmi, "");
const migration = readFileSync("supabase/migrations/001_initial.sql","utf8");
const analysisMigration = readFileSync("supabase/migrations/003_automatic_learning_analysis.sql","utf8");
writeFileSync("supabase/setup.sql", "-- CONCEPTCHEK INITIAL SETUP\n-- Safe to rerun after a failed initial setup; existing learner data is preserved.\n-- Schema and seed run together in one transaction.\nbegin;\n" + unwrapped(migration) + "\n" + unwrapped(analysisMigration) + "\n" + unwrapped(sql) + "\ncommit;\n");
console.log("Generated seed.sql, setup.sql, and migrations/002_four_cases_per_concept.sql");
