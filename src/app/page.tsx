import Workspace from "@/components/workspace";
import { isDemo } from "@/lib/config";
export default function Page() {
  return <Workspace demo={isDemo()} supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} supabaseKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""} />;
}
