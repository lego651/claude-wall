import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
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

export default function AdminPage() {
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Admin Section */}
        <section className="space-y-12">
          <div className="flex flex-col items-center gap-3">
            <div className="px-4 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.2em]" style={{ ...themeStyles.badge }}>
              Admin Control Center
            </div>
            <h2 className="text-3xl font-black text-gray-900">Manage Your Assets</h2>
          </div>

          {/* Primary Cards Row - Dashboard, Trading Reports, Portfolio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <MenuCard
              title="System health"
              description="API latency, Arbiscan usage, file sizes, database stats, cache hit rates."
              icon="📈"
              href="/admin/dashboard"
              color="bg-white"
            />
            <MenuCard
              title="Trading Reports"
              description="View detailed verified payouts, monthly trading history, and blockchain transaction records."
              icon="📊"
              href="/admin/reports"
              color="bg-white"
            />
            <MenuCard
              title="Portfolio Analytics"
              description="Track weekly and cumulative performance across all strategies with detailed deep-dives."
              icon="💼"
              href="/admin/portfolio"
              color="bg-white"
            />
          </div>

          {/* Secondary Buttons Row - Trading Strategies and Prop Firms */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto pt-4">
            <Link
              href="/admin/strategies"
              className="flex items-center justify-center gap-3 bg-white border border-gray-200 px-8 py-4 rounded-2xl font-bold text-gray-900 shadow-sm hover:shadow-md transition-all group hover:border-[#635BFF] hover:border-opacity-40"
            >
              <span className="text-2xl">📈</span>
              <div className="text-left">
                <div className="text-sm font-black">Trading Strategies</div>
                <div className="text-xs text-gray-500 font-medium">Manage trading strategies</div>
              </div>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={themeStyles.textPrimary}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </Link>
            <Link
              href="/admin/propfirms"
              className="flex items-center justify-center gap-3 bg-white border border-gray-200 px-8 py-4 rounded-2xl font-bold text-gray-900 shadow-sm hover:shadow-md transition-all group hover:border-[#635BFF] hover:border-opacity-40"
            >
              <span className="text-2xl">🏢</span>
              <div className="text-left">
                <div className="text-sm font-black">Prop Firms Management</div>
                <div className="text-xs text-gray-500 font-medium">Manage prop firm data</div>
              </div>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={themeStyles.textPrimary}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
