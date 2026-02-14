import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import config from "@/config";

export const dynamic = "force-dynamic";

// Protects all /user/* routes (settings, dashboard, etc.). Redirects to login if not signed in.
export default async function UserLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(config.auth.loginUrl);
  }

  return <>{children}</>;
}
