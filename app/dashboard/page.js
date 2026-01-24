import ButtonAccount from "@/components/ButtonAccount";
import WalletLinkConfirmation from "@/components/WalletLinkConfirmation";
import WalletLinker from "@/components/WalletLinker";

export const dynamic = "force-dynamic";

// This is a private page: It's protected by the layout.js component which ensures the user is authenticated.
// It's a server compoment which means you can fetch data (like the user profile) before the page is rendered.
// See https://shipfa.st/docs/tutorials/private-page
export default async function Dashboard() {
  return (
    <main className="min-h-screen bg-slate-200/60 p-8 pb-24">
      <WalletLinker />
      <section className="max-w-xl mx-auto space-y-8">
        <WalletLinkConfirmation />
        <ButtonAccount />
        <h1 className="text-3xl md:text-4xl font-extrabold">Private Page</h1>
      </section>
    </main>
  );
}
