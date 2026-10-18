import { identity, fail } from "@/lib/auth";
import { getConcepts, getConversations, globalTrends, getAdminInsights } from "@/lib/store";
import { isAdministrator } from "@/lib/analytics";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await identity(request);
    const [concepts,conversations] = await Promise.all([getConcepts(),getConversations(user.id)]);
    const admin = isAdministrator(user.email,process.env.ADMIN_EMAILS ?? "");
    const [trends,adminInsights]=admin ? await Promise.all([globalTrends(),getAdminInsights()]) : [null,null];
    return Response.json({concepts,conversations,globalTrends:trends,adminInsights},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {return fail(e);}
}
