"use client";

import { useState } from "react";
import Link from "next/link";

export default function ReportContent({ 
  report, 
  overview, 
  dailyData, 
  strategyData, 
  recommendations,
  bestDayLabel,
  bestDayValue,
  avgRPerTrade,
  winningTrades,
  losingTrades
}) {
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);

  const dailyMaxR = Math.max(...dailyData.map(d => Math.abs(d.totalR)), 1);
  const strategyMaxR = Math.max(...strategyData.map(s => Math.abs(s.totalR)), 1);
  const topStrategy = strategyData.reduce((prev, current) => (prev.totalR > current.totalR) ? prev : current);

  // Helper function to convert strategy name to ID
  const getStrategyId = (name) => {
    const nameMap = {
      'AS 1': 'AS_1',
      'AS 2': 'AS_2',
      'NQI': 'NQI',
      'EU': 'EU',
      'GOLD 1': 'GOLD_1',
      'GOLD 2': 'GOLD_2',
    };
    return nameMap[name] || name.replace(/\s+/g, '_').toUpperCase();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24">
      {/* Breadcrumb & Navigation */}
      <div className="pt-12 mb-8 flex items-center justify-between">
        <Link 
          href="/admin/reports"
          className="flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors group"
          onMouseEnter={(e) => e.currentTarget.style.color = '#635BFF'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
        >
          <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
          REPORTS / <span className="text-slate-900 uppercase tracking-wider">{report.title.toUpperCase()}</span>
        </Link>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          PUBLISHED: {new Date(report.publishedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }).toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 items-stretch">
        {/* Left Column: Summary Card & Expandable Overview */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-10 relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/50 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div>
                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">{report.title}</h1>
                  <span className="text-white text-[9px] font-black px-2 py-0.5 rounded-md tracking-widest uppercase" style={{ backgroundColor: '#635BFF' }}>
                    {report.type === 'weekly' ? 'WEEKLY' : 'MONTHLY'}
                  </span>
                </div>
                <p className="text-slate-400 font-bold text-lg mb-8">{report.period}</p>

                {/* Top Strategy Highlight */}
                {topStrategy && (
                  <Link href={`/admin/strategies/${getStrategyId(topStrategy.name)}`}>
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl px-5 py-3 flex items-center gap-3 mb-8 w-fit hover:bg-emerald-100 hover:border-emerald-200 transition-colors cursor-pointer">
                      <span className="text-xl">🥇</span>
                      <div>
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">TOP STRATEGY</span>
                        <div className="text-sm font-black text-slate-900">
                          {topStrategy.name} <span className="text-emerald-500 ml-1">+{topStrategy.totalR.toFixed(2)}R</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                <div className="grid grid-cols-2 gap-4 mb-8">
                  {[
                    { label: 'TOTAL R', value: `${report.summary.totalR > 0 ? '+' : ''}${report.summary.totalR}R`, color: 'text-emerald-500', bg: 'bg-emerald-50/30' },
                    { label: 'WIN RATE', value: `${report.summary.winRate}%`, color: '', bg: 'bg-white', style: { color: '#635BFF' } },
                    { label: 'TOTAL TRADES', value: report.summary.totalTrades, color: 'text-slate-900', bg: 'bg-white' },
                    { label: 'BEST DAY', value: bestDayLabel, sub: `(${bestDayValue ? (bestDayValue > 0 ? '+' : '') + bestDayValue + 'R' : ''})`, color: 'text-emerald-500', bg: 'bg-white' }
                  ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} border border-slate-50 rounded-2xl p-5`}>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                      <div className={`text-2xl font-black ${stat.color}`} style={stat.style}>{stat.value}</div>
                      {stat.sub && <div className={`text-[10px] font-bold ${stat.color} opacity-80 mt-0.5`} style={stat.style}>{stat.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Expandable Overview Table - Moved to bottom */}
              <div className="mt-auto border-t border-slate-50 pt-6">
                <button 
                  onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                  className="w-full flex items-center justify-between text-[11px] font-black uppercase tracking-widest transition-colors"
                  style={{ color: '#635BFF' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#5548E6';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.color = '#5548E6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#635BFF';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) svg.style.color = '#635BFF';
                  }}
                >
                  <span>{isOverviewExpanded ? 'HIDE' : 'VIEW'} DETAILED METRICS</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${isOverviewExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    style={{ color: '#635BFF' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isOverviewExpanded && (
                  <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-slate-50">
                        {[
                          { label: 'Avg R/Trade', val: avgRPerTrade, indicator: '🟢', suffix: 'R' },
                          { label: 'Winning Trades', val: winningTrades, indicator: '🟢' },
                          { label: 'Losing Trades', val: losingTrades, indicator: '🔴' },
                          { label: 'Best Day', val: overview.bestDay?.value || parseFloat(bestDayValue), sub: overview.bestDay?.date || '', indicator: '🟢', suffix: 'R' },
                          { label: 'Worst Day', val: overview.worstDay?.value || 0, sub: overview.worstDay?.date || '', indicator: '🔴', suffix: 'R' },
                        ].map((row, i) => (
                          <tr key={i}>
                            <td className="py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">{row.label}</td>
                            <td className="py-3 text-sm font-bold text-slate-900 text-right">
                              <span className="mr-2">{row.indicator}</span>
                              {typeof row.val === 'number' && row.val > 0 && row.label.includes('R') ? '+' : ''}{row.val}{row.suffix}
                              {row.sub && <span className="text-[10px] text-slate-400 ml-2 block font-normal">{row.sub}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Strategy Performance */}
        <div className="lg:col-span-5 flex flex-col">
          <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 md:p-10 flex-1">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-xl">🎯</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Strategy Performance</h2>
            </div>
            
            <div className="space-y-6">
              {strategyData.map((strat, i) => (
                <Link 
                  key={i} 
                  href={`/admin/strategies/${getStrategyId(strat.name)}`}
                  className="block group"
                  onMouseEnter={(e) => {
                    const h3 = e.currentTarget.querySelector('h3');
                    if (h3) h3.style.color = '#635BFF';
                  }}
                  onMouseLeave={(e) => {
                    const h3 = e.currentTarget.querySelector('h3');
                    if (h3) h3.style.color = '#0f172a';
                  }}
                >
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 transition-colors uppercase tracking-wider">{strat.name.toUpperCase()}</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{strat.trades} TRADES</span>
                    </div>
                    <span className="text-sm font-black text-emerald-500">+{strat.totalR.toFixed(2)}R</span>
                  </div>
                  <div className="h-4 bg-slate-50 rounded-lg overflow-hidden relative group-hover:bg-slate-100 transition-colors cursor-pointer">
                    <div 
                      className="h-full bg-slate-600 transition-all duration-1000 group-hover:bg-slate-500 rounded-r-md relative"
                      style={{ width: `${(strat.totalR / strategyMaxR) * 100}%` }}
                    >
                       <div className="w-full h-full opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:4px_4px]" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Section: Daily Performance */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">📈</span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Daily Performance</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {dailyData.map((day, i) => (
            <div key={i} className="flex flex-col bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${day.totalR > 0 ? 'bg-emerald-400' : day.totalR < 0 ? 'bg-rose-400' : 'bg-slate-200'}`} />
              
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{day.day.toUpperCase()}</span>
                <span className="text-xs font-bold text-slate-300 mb-6">{day.date}</span>

                <div className="h-48 w-full bg-slate-50 rounded-2xl mb-6 relative flex items-end justify-center p-2">
                  {day.totalR !== 0 && (
                    <div 
                      className="w-full rounded-t-xl transition-all duration-700 bg-slate-600"
                      style={{ height: `${(Math.abs(day.totalR) / dailyMaxR) * 100}%`, minHeight: day.totalR === 0 ? '4px' : '8px' }}
                    >
                      <div className="w-full h-full opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:3px_3px]" />
                    </div>
                  )}
                  {day.totalR === 0 && (
                    <div className="w-full h-1 bg-slate-300 rounded-full" />
                  )}
                </div>

                <span className={`text-xl font-black mb-6 ${day.totalR > 0 ? 'text-emerald-500' : day.totalR < 0 ? 'text-rose-500' : 'text-slate-900'}`}>
                  {day.totalR > 0 ? '+' : ''}{day.totalR.toFixed(2)}R
                </span>
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-50">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Avg R</span>
                  <span className="text-xs font-bold text-slate-900">{day.avgR > 0 ? '+' : ''}{day.avgR.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Win Rate</span>
                  <span className="text-xs font-bold text-slate-900">{day.winRate}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendations Section */}
      <section className="bg-slate-900 rounded-[2.5rem] p-10 md:p-14 text-white mb-12">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-xl">💡</span>
          <h3 className="text-2xl font-black tracking-tight">Recommendations</h3>
        </div>
        <ul className="space-y-6">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-4 group">
              <span className="text-2xl group-hover:scale-125 transition-transform duration-300">💎</span>
              <div>
                <h4 className="text-lg font-bold mb-1">{rec.title}</h4>
                <p className="text-slate-400 font-medium">{rec.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Footer */}
      <div className="text-center pt-10 mb-12">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">
          * REPORT GENERATED ON {report.publishedAt.toUpperCase().replace(/-/g, '-')} *
        </p>
      </div>

      {/* Footer Disclaimers */}
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed uppercase font-bold tracking-tight">Technical Disclaimer</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Note: We can only track performance through verified trade logs and API connections. Firms may also pay out via additional methods and use their operating wallets for other expenses, not solely for trader payouts. All metrics are calculated based on closed equity.
              </p>
            </div>
            <div className="space-y-4 md:text-right">
              <p className="text-xs text-slate-500 leading-relaxed uppercase font-bold tracking-tight">Data Integrity</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                All displayed information is publicly accessible trading data, using data that can be independently verified through respective trade explorers or firm portals. Listings on this platform are not endorsements of any specific prop firm or strategy.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
