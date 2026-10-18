import { identity, fail, body, HttpError, sameOrigin } from "@/lib/auth";
import { getConversation } from "@/lib/store";
import { sessionData, submitAnswer } from "@/lib/session";
export async function GET(request: Request, context: {params:Promise<{id:string}>}) {
  try {
    const user = await identity(request); const {id} = await context.params;
    const c = await getConversation(id,user.id); if(!c) throw new HttpError(404,"Session not found.");
    return Response.json(await sessionData(c),{headers:{"Cache-Control":"no-store"}});
  } catch(e) {return fail(e);}
}
export async function POST(request: Request, context: {params:Promise<{id:string}>}) {
  try {
    sameOrigin(request); const user = await identity(request); const {id} = await context.params; const data = await body(request);
    if(typeof data.answer !== "string" || !data.answer.trim() || data.answer.length > 6000 || typeof data.stage !== "string" || !Number.isInteger(data.version)) throw new HttpError(400,"Provide a response of 1–6,000 characters and the current session version.");
    return Response.json(await submitAnswer(user.id,id,data.answer.trim(),data.stage,data.version as number));
  } catch(e) {return fail(e);}
}
