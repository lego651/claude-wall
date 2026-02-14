// Prevent static prerender so Supabase client is not required at build time (CI has no env vars).
export const dynamic = "force-dynamic";

export default function ConnectWalletLayout({ children }) {
  return children;
}
