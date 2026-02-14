"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import PropProofLayout from '@/components/common/PropProofLayout';
import { TIMELINE_DATA, STUDY_SUMMARY } from '@/lib/studyConstants';

const WeeklyReportItem = ({ event, isLast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isImageModalOpen) {
        setIsImageModalOpen(false);
      }
    };

    if (isImageModalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isImageModalOpen]);

  return (
    <div className={`relative pl-8 pb-10 ${isLast ? 'group-last' : 'group'}`}>
      {/* Vertical Line Segment */}
      <div className={`absolute left-[11px] top-2 bottom-0 w-0.5 bg-slate-200 ${isLast ? 'bg-transparent' : ''}`}></div>
      
      {/* Timeline Node */}
      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${
        event.type === 'milestone' ? '' : 
        event.type === 'governance' ? 'bg-amber-500' : 'bg-slate-400'
      }`}
      style={event.type === 'milestone' ? { backgroundColor: '#635BFF' } : {}}
      >
        {event.type === 'milestone' ? (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        ) : event.type === 'governance' ? (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ) : (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">{event.date}</span>
        
        <div 
          onClick={() => event.details && setIsOpen(!isOpen)}
          className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all duration-200 ${
            event.details ? 'cursor-pointer hover:shadow-md' : ''
          }`}
          onMouseEnter={(e) => event.details && (e.currentTarget.style.borderColor = 'rgba(99, 91, 255, 0.4)')}
          onMouseLeave={(e) => event.details && (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          <div className="flex justify-between items-start">
            <div className="flex-grow">
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center">
                {event.title}
                {event.details && (
                  <span className={`ml-3 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    (event.details.pl || 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {event.details.pl && (event.details.pl >= 0 ? '+' : '')}{event.details.pl ? `$${event.details.pl}` : 'Event'}
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">{event.summary}</p>
            </div>
            {event.details && (
              <div className="ml-4 pt-1">
                {isOpen ? (
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {isOpen && event.details && (
            <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Trades</span>
                  <span className="text-sm font-bold text-slate-900">{event.details.trades}</span>
                </div>
                {event.details.metrics?.map((m, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">{m.label}</span>
                    <span className="text-sm font-bold text-slate-900">{m.value}</span>
                  </div>
                ))}
              </div>
              {event.details.screenshot && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Performance Proof</h4>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsImageModalOpen(true);
                    }}
                    className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 group"
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(99, 91, 255, 0.4)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <Image
                      src={event.details.screenshot}
                      alt={`${event.title} performance screenshot`}
                      width={800}
                      height={600}
                      className="w-full h-auto"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-2 shadow-lg">
                        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">Click image to expand</p>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Analysis & Notes</h4>
                <p className="text-sm text-slate-600 italic p-4 rounded-lg border-l-2" style={{ backgroundColor: 'rgba(99, 91, 255, 0.1)', borderLeftColor: '#635BFF' }}>
                  "{event.details.notes}"
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal/Lightbox */}
      {isImageModalOpen && event.details?.screenshot && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsImageModalOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors z-10 bg-black/50 rounded-full p-2 hover:bg-black/70"
            aria-label="Close image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Container */}
          <div 
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={event.details.screenshot}
                alt={`${event.title} performance screenshot - expanded view`}
                width={1200}
                height={900}
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                unoptimized
              />
            </div>
          </div>

          {/* ESC hint */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-xs font-medium bg-black/50 px-4 py-2 rounded-full">
            Press ESC or click outside to close
          </div>
        </div>
      )}
    </div>
  );
};

export default function StudyPage() {
  return (
    <PropProofLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Study Documentary Header */}
        <section className="text-center space-y-6 pt-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Study Documentary</h1>
            <p className="text-slate-500 mt-2 text-base">Continuous tracking of a rules-based prop firm strategy.</p>
          </div>

          {/* Summary Metrics Card */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="py-4 border-r border-slate-100">
              <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">Balance</span>
              </div>
              <span className="text-lg font-black text-slate-900">${STUDY_SUMMARY.currentBalance.toLocaleString()}</span>
            </div>
            <div className="py-4 border-r border-slate-100">
              <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">Return</span>
              </div>
              <span className="text-lg font-black" style={{ color: '#635BFF' }}>+{STUDY_SUMMARY.totalReturn}%</span>
            </div>
            <div className="py-4">
              <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">Duration</span>
              </div>
              <span className="text-lg font-black text-slate-900">{STUDY_SUMMARY.activeDays} Days</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-3">
            <button className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full flex items-center hover:bg-slate-200 transition-colors">
              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verified Results
            </button>
            <button className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center transition-colors" style={{ color: '#635BFF', backgroundColor: 'rgba(99, 91, 255, 0.1)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 91, 255, 0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 91, 255, 0.1)'}>
              Strategy Rules
              <svg className="w-3 h-3 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </section>

        {/* Study History Timeline */}
        <section className="relative">
          <div className="flex items-center space-x-3 mb-10 px-1">
            <h2 className="text-xl font-black text-slate-900">Study History</h2>
            <div className="h-px flex-grow bg-slate-200"></div>
          </div>

          <div className="space-y-2">
            {TIMELINE_DATA.map((event, index) => (
              <WeeklyReportItem 
                key={event.id} 
                event={event} 
                isLast={index === TIMELINE_DATA.length - 1}
              />
            ))}
          </div>
          
          {/* End of Timeline Marker */}
          <div className="flex flex-col items-center pt-8">
            <div className="w-2 h-2 rounded-full bg-slate-200 mb-4"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">End of Available Records</p>
          </div>
        </section>

        {/* Disclaimer */}
        <div className="p-6 bg-slate-900 rounded-2xl text-center space-y-2">
          <p className="text-slate-400 text-xs font-medium">This is a historical archive. No trade alerts or signals are provided.</p>
          <p className="text-white text-xs font-bold">Past performance is not indicative of future results.</p>
        </div>
      </div>
    </PropProofLayout>
  );
}
