import { readFileSync, writeFileSync } from "node:fs";
import { concepts,cases } from "../src/lib/catalog";
const literal = (value:unknown) => value === null ? "null" : typeof value === "number" ? String(value) : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'","''")}'`;
let sql = "-- Generated from src/lib/catalog.ts by npx tsx scripts/seed.ts.\n-- Golden q1–q10 follow the supplied document; q11 is a supplemental tool case.\nbegin;\n";
for(const [table,rows] of [["concepts",concepts],["case_questions",cases]] as const) {
  for(const row of rows) {
    const keys=Object.keys(row);
    const values = Object.entries(row).map(([key,value]) => key === "golden_answer" ? `${literal(JSON.stringify(value))}::jsonb` : literal(value));
    sql += `insert into public.${table} (${keys.join(",")}) values (${values.join(",")}) on conflict (id) do update set ${keys.filter(k=>k!=="id").map(k=>`${k}=excluded.${k}`).join(",")};\n`;
  }
}
writeFileSync("supabase/seed.sql",sql+"commit;\n");
const unwrapped = (text: string) => text.replace(/^begin;\s*$/gmi, "").replace(/^commit;\s*$/gmi, "");
const migration = readFileSync("supabase/migrations/001_initial.sql","utf8");
writeFileSync("supabase/setup.sql", "-- CONCEPTCHEK INITIAL SETUP\n-- Safe to rerun after a failed initial setup; existing learner data is preserved.\n-- Schema and seed run together in one transaction.\nbegin;\n" + unwrapped(migration) + "\n" + unwrapped(sql) + "\ncommit;\n");
console.log("Generated supabase/seed.sql and supabase/setup.sql");
