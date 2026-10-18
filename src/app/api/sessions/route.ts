import { identity, fail, body, HttpError, sameOrigin } from "@/lib/auth";
import { startSession } from "@/lib/session";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request); const user = await identity(request); const data = await body(request);
    if(data.consent !== true) throw new HttpError(400,"Consent is needed before saving your explanation.");
    if(typeof data.conceptId !== "string" || typeof data.explanation !== "string" || data.explanation.trim().length < 20 || data.explanation.length > 6000) throw new HttpError(400,"Write an explanation between 20 and 6,000 characters.");
    return Response.json(await startSession(user.id,data.conceptId,data.explanation.trim()),{status:201});
  } catch(e) {return fail(e);}
}
