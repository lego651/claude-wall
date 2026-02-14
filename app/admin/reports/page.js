"use client";

import React from 'react';
import Link from "next/link";
import { reports, reportTypes } from "@/data/reports/reports-data";
import AdminLayout from "@/components/common/AdminLayout";

const WeeklyReportItem = ({ report, isLast }) => {
  const totalR = report.summary.totalR > 0 ? `+${report.summary.totalR}R` : `${report.summary.totalR}R`;
  const totalRColor = report.summary.totalR > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

  // Format date range from period string
  const formatDateRange = (period) => {
    // period is like "2026-01-12 to 2026-01-16"
    const [start, end] = period.split(' to ');
    if (!start || !end) return period;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const startDay = startDate.getDate();
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  };

  // Extract best day info
  const bestDayMatch = report.summary.bestDay?.match(/(\w+)\s*\(([^)]+)\)/);
  const bestDayName = bestDayMatch ? bestDayMatch[1] : '';
  const bestDayR = bestDayMatch ? bestDayMatch[2] : '';

  return (
    <div className={`relative pl-8 pb-10 ${isLast ? '' : ''}`}>
      {/* Vertical Line Segment */}
      <div className={`absolute left-[11px] top-2 bottom-0 w-0.5 bg-slate-200 ${isLast ? 'bg-transparent' : ''}`}></div>
      
      {/* Timeline Node */}
      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 bg-slate-400">
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">{formatDateRange(report.period)}</span>
        
        <Link 
          href={`/admin/reports/${report.slug}`}
          className="relative bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md block"
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(99, 91, 255, 0.4)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
        >
          {/* Clickable icon in top right */}
          <div className="absolute top-4 right-4 z-10">
            <svg 
              className="w-5 h-5 transition-colors" 
              style={{ color: '#635BFF' }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              onMouseEnter={(e) => e.currentTarget.style.color = '#5548E6'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#635BFF'}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>

          <div className="flex justify-between items-start pr-8">
            <div className="flex-grow">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-bold text-slate-900">
                  {report.title}
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${totalRColor}`}>
                  {totalR}
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                Maintained strong execution consistency across the week with focused strategy application and disciplined risk management.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="font-bold text-slate-900">WIN RATE: </span>
                  <span className="text-slate-600">{report.summary.winRate}%</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">TRADES: </span>
                  <span className="text-slate-600">{report.summary.totalTrades}</span>
                </div>
                {bestDayName && (
                  <div>
                    <span className="font-bold text-slate-900">BEST: </span>
                    <span className="text-slate-600">{bestDayName} </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${totalRColor}`}>
                      ({bestDayR})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default function TradingLogsPage() {
  const weeklyReports = reports.filter(r => r.type === reportTypes.weekly);

  // Calculate aggregate stats
  const totalR = reports.reduce((sum, r) => sum + r.summary.totalR, 0);
  const avgWinRate = reports.length > 0 ? reports.reduce((sum, r) => sum + r.summary.winRate, 0) / reports.length : 0;
  const totalTrades = reports.reduce((sum, r) => sum + r.summary.totalTrades, 0);

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Header Section */}
        <section className="text-center space-y-6 pt-4">
          <div>
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight mb-4">Trading Performance Reports</h1>
            <p className="text-lg text-gray-500">
              Continuous tracking of a rules-based prop firm strategy across multiple verified execution methods.
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="py-4 border-r border-slate-100">
              <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">TOTAL R (ALL TIME)</span>
              </div>
              <span className="text-4xl font-bold" style={{ color: '#10b981' }}>+{totalR.toFixed(2)}R</span>
            </div>
            <div className="py-4 border-r border-slate-100">
              <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">AVG. WIN RATE</span>
              </div>
              <span className="text-4xl font-bold" style={{ color: '#635BFF' }}>{avgWinRate.toFixed(1)}%</span>
            </div>
            <div className="py-4">
              <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">TOTAL TRADES</span>
              </div>
              <span className="text-4xl font-bold text-gray-900">{totalTrades}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-3">
            <button className="text-xs font-bold text-white px-3 py-1.5 rounded-full flex items-center transition-colors shadow-sm" style={{ backgroundColor: '#635BFF' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5548E6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#635BFF'}>
              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verified Results
            </button>
            <button className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center transition-colors border" style={{ color: '#635BFF', backgroundColor: 'white', borderColor: '#635BFF' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 91, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
              Strategy Rules
              <svg className="w-3 h-3 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </section>

        {/* Study History Section */}
        <section className="relative">
          <div className="flex items-center space-x-3 mb-10 px-1">
            <h2 className="text-3xl font-bold text-gray-900">Study History</h2>
            <div className="h-px flex-grow bg-slate-200"></div>
          </div>

          <div className="space-y-2">
            {weeklyReports
              .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
              .map((report, index) => (
                <WeeklyReportItem 
                  key={report.slug} 
                  report={report} 
                  isLast={index === weeklyReports.length - 1}
                />
              ))}
          </div>
          
          {/* End of Timeline Marker */}
          {weeklyReports.length > 0 && (
            <div className="flex flex-col items-center pt-8">
              <div className="w-2 h-2 rounded-full bg-slate-200 mb-4"></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">End of Available Records</p>
            </div>
          )}
        </section>

        {/* EMPTY STATE */}
        {reports.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold mb-2">No Reports Yet</h3>
            <p className="text-gray-600">
              Trading reports will appear here once they are generated.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
