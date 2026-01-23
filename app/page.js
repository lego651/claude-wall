import Link from "next/link";
import PropProofLayout from "@/components/PropProofLayout";
import { THEME, themeStyles } from "@/lib/theme";

const MenuCard = ({ title, description, icon, badge, href, color = "bg-white" }) => (
  <Link href={href}>
    <div className={`${color} p-10 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col items-start gap-6`}>
      <div className="flex justify-between w-full items-start">
        <div className="text-4xl p-4 bg-gray-50 rounded-3xl group-hover:scale-110 transition-transform">{icon}</div>
        {badge && (
          <span className={`text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${
            badge === 'Internal' ? '' : 'bg-emerald-600'
          }`}
          style={badge === 'Internal' ? { backgroundColor: THEME.primary } : {}}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black text-gray-900 transition-colors group-hover:text-[#635BFF]">{title}</h3>
        <p className="text-gray-400 text-sm font-medium leading-relaxed">{description}</p>
      </div>
      <div className="mt-auto pt-4 flex items-center gap-2 font-black text-xs uppercase tracking-widest group-hover:gap-4 transition-all" style={themeStyles.textPrimary}>
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

      </div>
    </PropProofLayout>
  );
}
