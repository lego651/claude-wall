import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import config from "@/config";

export const dynamic = "force-dynamic";

// Server-side layout to protect admin routes
// Only users with is_admin = true can access /admin and its subpages
// Public routes like /admin/strategies/public/* are excluded from protection
export default async function AdminLayout({ children }) {
  // Get pathname from headers (set by middleware)
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  
  // Check if this is a public route that should be accessible without admin access
  const isPublicRoute = pathname.includes("/admin/strategies/public/");

  // If it's a public route, allow access without admin check
  // Note: This is a workaround - ideally use route groups for public admin routes
  if (isPublicRoute) {
    return <>{children}</>;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is not authenticated, redirect to login
  if (!user) {
    redirect(config.auth.loginUrl);
  }

  // Get user profile to check is_admin status
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  // If profile doesn't exist or user is not admin, redirect to home
  if (!profile || !profile.is_admin) {
    redirect("/");
  }

  return <>{children}</>;
}
