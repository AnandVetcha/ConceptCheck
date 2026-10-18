import { cookies } from "next/headers";
import { isDemo } from "@/lib/config";
import { demoSession } from "@/lib/store";
import { fail, sameOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if(isDemo()) {
      const jar = await cookies(); const id = await demoSession(jar.get("conceptchek-demo")?.value);
      jar.set("conceptchek-demo",id,{httpOnly:true,sameSite:"strict",secure:false,path:"/",maxAge:60*60*24*30});
    }
    return Response.json({demo:isDemo()});
  } catch(e) {return fail(e);}
}
