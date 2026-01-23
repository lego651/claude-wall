"use client";

import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";

const STRATEGIES = {
  AS_1: { id: 'AS_1', name: 'AS 1', shortName: 'AS', description: 'Asian Session Strategy 1', internalId: 'AS_01', created: 'Dec 2023' },
  AS_2: { id: 'AS_2', name: 'AS 2', shortName: 'AS', description: 'Asian Session Strategy 2', internalId: 'AS_02', created: 'Dec 2023' },
  EU: { id: 'EU', name: 'EU', shortName: 'EU', description: 'European Session Strategy', internalId: 'EU_01', created: 'Dec 2023' },
  NQI: { id: 'NQI', name: 'NQI', shortName: 'NQ', description: 'NASDAQ Index Strategy', internalId: 'NQI_01', created: 'Jan 2024' },
  GOLD_1: { id: 'GOLD_1', name: 'GOLD 1', shortName: 'G1', description: 'Gold Trading Strategy 1', internalId: 'GOLD_01', created: 'Jan 2024' },
  GOLD_2: { id: 'GOLD_2', name: 'GOLD 2', shortName: 'G2', description: 'Gold Trading Strategy 2', internalId: 'GOLD_02', created: 'Feb 2024' },
};

export default function StrategiesPage() {
  const strategiesList = Object.values(STRATEGIES);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Trading Strategies</h1>
                <p className="text-sm text-gray-500">
                  Manage and analyze all trading strategies with detailed performance metrics.
                </p>
              </div>
            </div>
          </div>

          {/* Strategies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategiesList.map((strategy) => (
              <Link
                key={strategy.id}
                href={`/admin/strategies/${strategy.id}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 p-6 group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <span className="text-lg font-black italic">{strategy.shortName}</span>
                  </div>
                  <span className="text-[9px] font-black px-2 py-1 rounded-full border" style={{ backgroundColor: 'rgba(99, 91, 255, 0.1)', color: '#635BFF', borderColor: 'rgba(99, 91, 255, 0.2)' }}>
                    {strategy.internalId}
                  </span>
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-1 transition-colors group-hover:text-[#635BFF]">
                  {strategy.description}
                </h3>
                <p className="text-sm text-gray-400 font-medium mb-4">{strategy.name}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-400 font-medium">
                    Created {strategy.created}
                  </div>
                  <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest group-hover:gap-4 transition-all" style={{ color: '#635BFF' }}>
                    View Details
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
