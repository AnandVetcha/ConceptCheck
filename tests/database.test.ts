import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { cases, concepts } from "../src/lib/catalog";

// Supply the minimal Supabase-owned schema to exercise our real SQL in Postgres.
const authSchema = `
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  $$;
`;
const setup = readFileSync("supabase/setup.sql","utf8");
test("setup loads every golden JSON value and safely reruns without losing learner data", async () => {
  const db = new PGlite();
  try {
    await db.exec(authSchema);
    await db.exec(setup);
    const stored = await db.query<{id:string;golden_answer:unknown}>("select id,golden_answer from public.case_questions");
    assert.equal(stored.rows.length,cases.length);
    for(const c of cases) assert.deepEqual(stored.rows.find(r=>r.id===c.id)?.golden_answer,c.golden_answer, c.id);
    assert.equal((await db.query("select id from public.concepts")).rows.length,concepts.length);
    const userId="00000000-0000-0000-0000-000000000001";
    await db.query("insert into auth.users(id,raw_user_meta_data) values ($1,$2)",[userId,{name:"Test learner"}]);
    await db.query("insert into public.recitals(user_id,label) values ($1,'Keep this label')",[userId]);
    await db.exec(setup);
    assert.equal((await db.query("select id from public.case_questions")).rows.length,cases.length);
    assert.equal((await db.query<{user_name:string}>("select user_name from public.profiles")).rows[0].user_name,"Test learner");
    assert.equal((await db.query<{label:string}>("select label from public.recitals")).rows[0].label,"Keep this label");
  } finally { await db.close(); }
});
test("setup recovers after schema-only success, and standalone seed is repeatable", async () => {
  const db = new PGlite();
  try {
    await db.exec(authSchema);
    // Simulate the already-deployed schema, whose CHECK predates structured cases.
    await db.exec(readFileSync("supabase/migrations/001_initial.sql","utf8").replace(",'structured'", ""));
    await db.exec(setup);
    await db.exec(readFileSync("supabase/seed.sql","utf8"));
    assert.equal((await db.query("select id from public.case_questions")).rows.length,cases.length);
  } finally { await db.close(); }
});

test("the content upgrade can run on an existing database without duplicating cases", async () => {
  const db=new PGlite();
  try {
    await db.exec(authSchema);
    await db.exec(readFileSync("supabase/migrations/001_initial.sql","utf8").replace(",'structured'", ""));
    const upgrade=readFileSync("supabase/migrations/002_four_cases_per_concept.sql","utf8");
    await db.exec(upgrade);await db.exec(upgrade);
    const counts=await db.query<{concept_id:string;count:number}>("select concept_id,count(*)::int as count from public.case_questions group by concept_id");
    assert.equal(counts.rows.length,7);assert.ok(counts.rows.every(r=>r.count===4));
  } finally {await db.close();}
});

test("automatic analysis preserves past consent without claiming consent for new sessions", async () => {
  const db=new PGlite();
  try {
    await db.exec(authSchema);
    const original=readFileSync("supabase/migrations/001_initial.sql","utf8").replace("consent_at timestamptz,","consent_at timestamptz not null,").replace("  data_collection_notice_at timestamptz,\n","");
    await db.exec(original);await db.exec(readFileSync("supabase/seed.sql","utf8"));
    const userId="00000000-0000-0000-0000-000000000001";
    await db.query("insert into auth.users(id) values ($1)",[userId]);
    const insert="insert into public.conversations(user_id,concept_id,user_explanation,recital_sentence,recital_label,case_question1_id,probe_question,case_question2_id,case1_fresh,case2_fresh,consent_at,ai_mode) values ($1,'secrets','Example explanation','Example','Example','q1','What breaks?','q6',true,true,$2,'mock')";
    await db.query(insert,[userId,"2026-10-18T12:00:00Z"]);
    const migration=readFileSync("supabase/migrations/003_automatic_learning_analysis.sql","utf8");
    await db.exec(migration);await db.exec(migration);
    await db.query(insert,[userId,null]);
    const rows=await db.query<{consent_at:Date|null}>("select consent_at from public.conversations order by consent_at nulls last");
    assert.equal(rows.rows[0].consent_at?.toISOString(),"2026-10-18T12:00:00.000Z");
    assert.equal(rows.rows[1].consent_at,null);
  } finally {await db.close();}
});
