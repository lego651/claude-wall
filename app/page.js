import Link from "next/link";
import PropProofLayout from "@/components/PropProofLayout";

const MenuCard = ({ title, description, icon, badge, href, color = "bg-white" }) => (
  <Link href={href}>
    <div className={`${color} p-10 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col items-start gap-6`}>
      <div className="flex justify-between w-full items-start">
        <div className="text-4xl p-4 bg-gray-50 rounded-3xl group-hover:scale-110 transition-transform">{icon}</div>
        {badge && (
          <span className={`text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${
            badge === 'Internal' ? 'bg-indigo-600' : 'bg-emerald-600'
          }`}>
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors">{title}</h3>
        <p className="text-gray-400 text-sm font-medium leading-relaxed">{description}</p>
      </div>
      <div className="mt-auto pt-4 flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest group-hover:gap-4 transition-all">
        Explore Section
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
        </svg>
      </div>
    </div>
  </Link>
);

export default function Page() {
  return (
    <PropProofLayout>
      <div className="space-y-24 max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">

        {/* Hero Header */}
        <section className="text-center space-y-6">
          <h1 className="text-6xl font-black text-gray-900 tracking-tight">
            Ship Fast <span className="text-yellow-400">⚡️</span>
          </h1>
          <p className="text-xl text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
            The start of your new trading empire. What are you going to build today?
          </p>
          <div className="flex justify-center pt-4">
            <button className="bg-white border border-gray-200 px-6 py-2.5 rounded-full text-sm font-bold text-gray-900 shadow-sm hover:shadow-md transition-all">
              Login to Workspace
            </button>
          </div>
        </section>

        {/* Admin Section */}
        <section className="space-y-12">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-indigo-50 px-4 py-1 rounded-full border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em]">
              Admin Control Center
            </div>
            <h2 className="text-3xl font-black text-gray-900">Manage Your Assets</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MenuCard
              title="Trading Strategies"
              description="Proven strategies with backtested results, risk management frameworks, and performance tracking."
              icon="📈"
              badge="Internal"
              href="/strategies"
              color="bg-indigo-50"
            />
            <MenuCard
              title="Trading Reports"
              description="View detailed verified payouts, monthly trading history, and blockchain transaction records."
              icon="📊"
              href="/reports"
              color="bg-white"
            />
            <MenuCard
              title="Portfolio Analytics"
              description="Track weekly and cumulative performance across all strategies with detailed deep-dives."
              icon="💼"
              href="/portfolio"
              color="bg-white"
            />
          </div>
        </section>

        {/* Public Section */}
        <section className="space-y-12">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-emerald-50 px-4 py-1 rounded-full border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em]">
              Public Discovery
            </div>
            <h2 className="text-3xl font-black text-gray-900">Explore the Ecosystem</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <MenuCard
              title="Leaderboard"
              description="Real-time global rankings of top performing strategies and verified traders."
              icon="🏆"
              badge="Live"
              href="/leaderboard"
              color="bg-white"
            />
            <MenuCard
              title="Prop Firms Directory"
              description="The most comprehensive comparison of prop firm rules, payouts, and trustworthiness."
              icon="🏢"
              href="/propfirms"
              color="bg-white"
            />
          </div>
        </section>

        {/* Footer Support */}
        <section className="text-center pt-12 space-y-8">
          <a
            href="https://shipfa.st/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-black hover:scale-105 transition-all shadow-xl shadow-indigo-100"
          >
            Documentation & Tutorials
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </a>
          <p>
            <Link href="/blog" className="text-sm font-bold text-gray-400 hover:text-indigo-600 cursor-pointer transition-colors">
              Fancy a blog?
            </Link>
          </p>
        </section>
      </div>
    </PropProofLayout>
  );
}
