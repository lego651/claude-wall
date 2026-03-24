import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogsPageClient from "@/components/trade-log/LogsPageClient";

export default async function LogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  return <LogsPageClient />;
}
