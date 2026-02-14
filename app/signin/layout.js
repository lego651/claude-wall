import config from "@/config";
import { getSEOTags } from "@/lib/seo";

// Prevent static prerender so Supabase client is not required at build time (CI has no env vars).
export const dynamic = "force-dynamic";

export const metadata = getSEOTags({
  title: `Sign-in to ${config.appName}`,
  canonicalUrlRelative: "/auth/signin",
});

export default function Layout({ children }) {
  return <>{children}</>;
}
