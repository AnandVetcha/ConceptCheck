import { cookies } from "next/headers";
import { isDemo, requireLiveConfig } from "./config";
import { adminClient, validDemoSession } from "./store";
export class HttpError extends Error { constructor(public status: number, message: string) {super(message);} }
export async function identity(request: Request): Promise<{id:string;email:string}> {
  if(isDemo()) {
    const id = (await cookies()).get("conceptchek-demo")?.value;
    if(!id || !await validDemoSession(id)) throw new HttpError(401,"Start a demo session to continue.");
    return {id,email:"demo@local"};
  }
  requireLiveConfig();
  const bearer = request.headers.get("authorization");
  if(!bearer?.startsWith("Bearer ")) throw new HttpError(401,"Sign in to continue.");
  const {data,error} = await adminClient().auth.getUser(bearer.slice(7));
  if(error || !data.user) throw new HttpError(401,"Your session has expired. Sign in again.");
  return {id:data.user.id,email:data.user.email ?? ""};
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next's internal Request URL may use localhost even when the browser used
  // 127.0.0.1. Compare against the actual HTTP Host, not the internal hostname.
  if(origin) {
    let source: URL;
    try { source = new URL(origin); } catch {throw new HttpError(403,"Cross-origin request rejected.");}
    if(!["http:","https:"].includes(source.protocol) || source.host !== (request.headers.get("host") ?? new URL(request.url).host)) throw new HttpError(403,"Cross-origin request rejected.");
  }
}
export async function body(request: Request) {
  if(Number(request.headers.get("content-length") ?? 0) > 20000) throw new HttpError(413,"This response is too long.");
  const text = await request.text(); if(text.length > 20000) throw new HttpError(413,"This response is too long.");
  try { const parsed = JSON.parse(text); if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error(); return parsed as Record<string,unknown>; } catch {throw new HttpError(400,"Send a valid JSON object.");}
}
export function fail(error: unknown) {
  if(error instanceof HttpError) return Response.json({error:error.message},{status:error.status});
  if(error instanceof Error && error.message === "SESSION_CONFLICT") return Response.json({error:"This session changed in another tab. Reload it to continue."},{status:409});
  console.error("ConceptChek request failed:", error instanceof Error ? error.name : "Unknown error");
  return Response.json({error:"The request could not be completed. Check server configuration or try again. Your previous progress is saved."},{status:503});
}
