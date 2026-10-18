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
    await db.exec(readFileSync("supabase/migrations/001_initial.sql","utf8"));
    await db.exec(setup);
    await db.exec(readFileSync("supabase/seed.sql","utf8"));
    assert.equal((await db.query("select id from public.case_questions")).rows.length,cases.length);
  } finally { await db.close(); }
});
