import { identity, fail } from "@/lib/auth";
import { getConcepts, getConversations, globalTrends } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await identity(request);
    const [concepts,conversations] = await Promise.all([getConcepts(),getConversations(user.id)]);
    const admin = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).includes(user.email.toLowerCase());
    return Response.json({concepts,conversations,globalTrends:admin ? await globalTrends() : null},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {return fail(e);}
}
