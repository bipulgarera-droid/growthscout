import React from 'react';
import { Business } from '../types';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, ChevronRight, LayoutTemplate } from 'lucide-react';

interface AnalysisListProps {
  businesses: Business[];
}

const AnalysisList: React.FC<AnalysisListProps> = ({ businesses }) => {
  // Filter to show only businesses that have been "analyzed" (simulated by having an ID present in list for now)
  // In a real app, we'd check if `auditData` exists.
  
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Website Analyses</h1>
        <p className="text-slate-500">Review design audits and qualification status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((biz) => (
          <Link key={biz.id} to={`/analysis/${biz.id}`} className="group block">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all h-full flex flex-col">
              {/* Card Header / Image Placeholder */}
              <div className="h-40 bg-slate-100 flex items-center justify-center border-b border-slate-100 relative group-hover:bg-slate-200 transition-colors">
                 {biz.redesignImageUrl ? (
                    <img src={biz.redesignImageUrl} alt="Redesign" className="w-full h-full object-cover" />
                 ) : (
                    <LayoutTemplate size={40} className="text-slate-300" />
                 )}
                 
                 {/* Qualification Badge */}
                 <div className="absolute top-3 right-3">
                    {biz.isQualified === true && (
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                            <CheckCircle size={12} /> Qualified
                        </span>
                    )}
                    {biz.isQualified === false && (
                        <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <XCircle size={12} /> Unqualified
                        </span>
                    )}
                 </div>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex-1">
                    <h3 className="font-bold text-slate-900 mb-1 group-hover:text-brand-600 transition-colors">{biz.name}</h3>
                    <p className="text-sm text-slate-500 mb-4">{biz.category}</p>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Quality Score: {biz.qualityScore}</span>
                        <span>•</span>
                        <span>{biz.address.split(',')[0]}</span>
                    </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm font-medium text-brand-600">
                    View Details
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AnalysisList;
