import "server-only";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { concepts, cases } from "./catalog";
import { isDemo } from "./config";
import type { Concept, CaseQuestion, Conversation, Recital, Attempt } from "./types";
import { buildAdminInsights, type AnalyticsConversation, type AnalyticsAttempt } from "./analytics";
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
}
type Local = { conversations: Conversation[]; recitals: Recital[]; sessions: string[]; attempts: Attempt[] };
const file = path.join(process.cwd(),".local","data.json");
const globalStore = globalThis as unknown as { conceptStoreQueue?: Promise<unknown> };
async function local<T>(fn: (data: Local) => T | Promise<T>, write = false): Promise<T> {
  const task = (globalStore.conceptStoreQueue ?? Promise.resolve()).then(async () => {
    let data: Local;
    try { data = JSON.parse(await readFile(file,"utf8")); data.attempts ??= []; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; data = {conversations:[],recitals:[],sessions:[],attempts:[]}; }
    const result = await fn(data);
    if (write) { await mkdir(path.dirname(file),{recursive:true}); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp,JSON.stringify(data,null,2)); await rename(tmp,file); }
    return result;
  });
  globalStore.conceptStoreQueue = task.catch(() => {});
  return task;
}
export async function demoSession(id?: string) {
  if (id && await local(d => d.sessions.includes(id))) return id;
  const newId = randomUUID(); await local(d => {d.sessions.push(newId);},true); return newId;
}
export async function validDemoSession(id: string) { return local(d => d.sessions.includes(id)); }
export async function getConcepts(): Promise<Concept[]> {
  if (isDemo()) return concepts;
  const {data,error} = await adminClient().from("concepts").select("*").order("position"); if(error) throw error; return data;
}
export async function getCases(conceptId: string): Promise<CaseQuestion[]> {
  if (isDemo()) return cases.filter(q => q.concept_id === conceptId);
  const {data,error} = await adminClient().from("case_questions").select("*").eq("concept_id",conceptId).order("position"); if(error) throw error; return data;
}
export async function getConversations(userId: string): Promise<Conversation[]> {
  if (isDemo()) return local(d => d.conversations.filter(c => c.user_id === userId).sort((a,b) => b.created_at.localeCompare(a.created_at)));
  const {data,error} = await adminClient().from("conversations").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(500); if(error) throw error; return data;
}
export async function getConversation(id: string, userId: string): Promise<Conversation | null> {
  if (isDemo()) return local(d => d.conversations.find(c => c.id === id && c.user_id === userId) ?? null);
  const {data,error} = await adminClient().from("conversations").select("*").eq("id",id).eq("user_id",userId).maybeSingle(); if(error) throw error; return data;
}
export async function saveConversation(c: Conversation, expectedVersion?: number) {
  if (isDemo()) return local(d => {
    const i = d.conversations.findIndex(x => x.id === c.id);
    if (expectedVersion !== undefined && (i < 0 || d.conversations[i].version !== expectedVersion)) throw new Error("SESSION_CONFLICT");
    if(i < 0) d.conversations.push(c); else d.conversations[i] = c;
  },true);
  if(expectedVersion === undefined) {
    const {error} = await adminClient().from("conversations").insert(c); if(error) throw error;
  } else {
    const {data,error} = await adminClient().from("conversations").update(c).eq("id",c.id).eq("user_id",c.user_id).eq("version",expectedVersion).select("id");
    if(error) throw error; if(!data?.length) throw new Error("SESSION_CONFLICT");
  }
}
export async function getRecitals(userId: string): Promise<Recital[]> {
  if(isDemo()) return local(d => d.recitals.filter(r => r.user_id === userId));
  const {data,error} = await adminClient().from("recitals").select("*").eq("user_id",userId).limit(200); if(error) throw error; return data;
}
export async function saveRecital(userId: string,label: string) {
  if(isDemo()) return local(d => { if(!d.recitals.some(r => r.user_id === userId && r.label === label)) d.recitals.push({id:randomUUID(),user_id:userId,label}); },true);
  const {error} = await adminClient().from("recitals").upsert({user_id:userId,label},{onConflict:"user_id,label"}); if(error) throw error;
}
export async function globalTrends() {
  if(isDemo()) return [];
  const {data,error} = await adminClient().rpc("recital_trends"); if(error) throw error; return data;
}
export async function saveAttempt(attempt: Attempt) {
  if(isDemo()) return local(d => {d.attempts.push(attempt);},true);
  const {error} = await adminClient().from("case_attempts").insert(attempt); if(error) throw error;
}
export async function getAdminInsights() {
  if(isDemo()) return local(d=>buildAdminInsights(d.conversations,d.attempts));
  const db=adminClient();
  // Fetch every page rather than silently limiting the administrator view to
  // PostgREST's default row limit. Raw learner IDs never leave this server.
  async function all<T>(table:string,columns:string):Promise<T[]> {
    const rows:T[]=[];const pageSize=500;
    for(let offset=0;;offset+=pageSize) {
      const {data,error}=await db.from(table).select(columns).order("id").range(offset,offset+pageSize-1);
      if(error) throw error;rows.push(...data as unknown as T[]);
      if(data.length<pageSize) return rows;
    }
  }
  const [conversations,attempts]=await Promise.all([
    all<AnalyticsConversation>("conversations","id,user_id,concept_id,stage,caseq2_answer_correct,demonstrated_change,case1_fresh,case2_fresh"),
    all<AnalyticsAttempt>("case_attempts","id,conversation_id,status")
  ]);
  return buildAdminInsights(conversations,attempts);
}
