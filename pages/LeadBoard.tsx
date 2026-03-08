import React, { useState } from 'react';
import { Business } from '../types';
import { MoreHorizontal, Calendar, Phone, Mail, FileText, CheckCircle, ArrowRight, UserSearch, Linkedin, RefreshCw, Instagram } from 'lucide-react';
import { Link } from 'react-router-dom';
import { enrichBusiness } from '../services/backendApi';

interface LeadBoardProps {
  leads: Business[];
  updateStatus: (id: string, status: Business['status']) => void;
  updateBusiness: (id: string, data: Partial<Business>) => void;
  addLead: (business: Business) => void;
}

const COLUMNS: { id: Business['status']; label: string; color: string }[] = [
  { id: 'new', label: 'New Leads', color: 'bg-blue-100 text-blue-700' },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-100 text-purple-700' },
  { id: 'proposal', label: 'Proposal Sent', color: 'bg-amber-100 text-amber-700' },
  { id: 'negotiating', label: 'Negotiating', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'won', label: 'Won Deals', color: 'bg-emerald-100 text-emerald-700' },
];


const LeadBoard: React.FC<LeadBoardProps> = ({ leads, updateStatus, updateBusiness, addLead }) => {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const getLeadsByStatus = (status: string) => {
    return leads.filter(l => l.status === status);
  };

  const getNextStatus = (currentStatus: Business['status']): Business['status'] | null => {
    const currentIndex = COLUMNS.findIndex(col => col.id === currentStatus);
    if (currentIndex >= 0 && currentIndex < COLUMNS.length - 1) {
      return COLUMNS[currentIndex + 1].id;
    }
    return null;
  };

  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);

  // Find Founder handler
  const handleFindFounder = async (lead: Business) => {
    setEnrichingId(lead.id);
    try {
      const data = await enrichBusiness(lead.name, lead.address, lead.website);

      const emails = data.email ? data.email.split(',').map(e => e.trim()).filter(Boolean) : [];
      const primaryEmail = emails.length > 0 ? emails[0] : lead.contactEmail;
      const secondaryEmail = emails.length > 1 ? emails[1] : null;

      updateBusiness(lead.id, {
        founderName: data.founderName || undefined,
        linkedin: data.linkedin || undefined,
        contactEmail: primaryEmail,
        instagram: data.instagram || undefined,
        phone: data.phone || lead.phone,
      });

      if (secondaryEmail) {
        const duplicateBiz: Business = {
          ...lead,
          id: `${lead.id}-${Date.now()}-dup`,
          contactEmail: secondaryEmail,
          founderName: data.founderName || undefined,
          linkedin: data.linkedin || undefined,
          instagram: data.instagram || undefined,
          phone: data.phone || lead.phone,
        };
        addLead(duplicateBiz);
      }
    } catch (e) {
      console.error('Enrichment failed:', e);
      alert('Find Founder failed. Check if Serper API key is set.');
    } finally {
      setEnrichingId(null);
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedLeadId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedLeadId(null);
    e.currentTarget.classList.remove('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: Business['status']) => {
    e.preventDefault();
    if (draggedLeadId) {
      updateStatus(draggedLeadId, newStatus);
      setDraggedLeadId(null);
    }
  };

  return (
    <div className="p-8 h-screen overflow-x-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Management</h1>
          <p className="text-slate-500">Drag and drop leads to move them through the pipeline</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            <span className="text-slate-500 text-sm mr-2">Total Leads:</span>
            <span className="font-bold text-lg text-slate-800">{leads.length}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            <span className="text-slate-500 text-sm mr-2">Est. Value:</span>
            <span className="font-bold text-lg text-emerald-600">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)}
            </span>
          </div>

        </div>
      </div>

      <div className="flex gap-6 min-w-max pb-4 h-[calc(100vh-140px)]">
        {COLUMNS.map((col) => {
          const colLeads = getLeadsByStatus(col.id);
          return (
            <div
              key={col.id}
              className="w-80 flex flex-col h-full"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4 p-1">
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${col.color}`}>
                  {col.label}
                </div>
                <span className="text-slate-400 font-medium text-sm">{colLeads.length}</span>
              </div>

              {/* Column Area */}
              <div className="bg-slate-100/50 rounded-xl p-2 h-full border border-slate-200/60 overflow-y-auto transition-colors hover:bg-slate-100">
                {colLeads.map((lead) => {
                  const nextStatus = getNextStatus(lead.status);
                  const isEnriching = enrichingId === lead.id;
                  const hasFounderInfo = lead.founderName || lead.linkedin || lead.contactEmail;

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${lead.qualityScore > 90 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                          QS: {lead.qualityScore}
                        </span>
                        {lead.estimatedValue && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(lead.estimatedValue)}
                          </span>
                        )}
                        <div className="ml-auto">
                          <div className="relative group/status">
                            <select
                              value={lead.status}
                              onChange={(e) => updateStatus(lead.id, e.target.value as any)}
                              className="text-xs border border-transparent hover:border-slate-300 rounded px-1 py-0.5 bg-transparent hover:bg-white transition-all outline-none cursor-pointer appearance-none pr-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {COLUMNS.map(col => (
                                <option key={col.id} value={col.id}>{col.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <h4 className="font-semibold text-slate-800 mb-1 truncate">{lead.name}</h4>
                      <p className="text-xs text-slate-500 mb-2">{lead.address.split(',')[0]}</p>

                      {/* Founder Info (if enriched) */}
                      {hasFounderInfo && (
                        <div className="bg-slate-50 rounded p-2 mb-2 text-xs space-y-1">
                          {lead.founderName && (
                            <div className="flex items-center gap-1 text-slate-700">
                              <UserSearch size={12} /> <span className="font-medium">{lead.founderName}</span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            {lead.linkedin && (
                              <a href={lead.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5">
                                <Linkedin size={10} /> LinkedIn
                              </a>
                            )}
                            {lead.instagram && (
                              <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline flex items-center gap-0.5">
                                <Instagram size={10} /> IG
                              </a>
                            )}
                          </div>
                          {lead.contactEmail && (
                            <div className="text-slate-600 truncate">
                              <Mail size={10} className="inline mr-1" />{lead.contactEmail}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={`text-xs ${i < Math.floor(lead.rating || 0) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                        ))}
                        <span className="text-xs text-slate-400">({lead.reviewCount})</span>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                        <div className="flex gap-3">
                          <Link to={`/analysis/${lead.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                            Analysis
                          </Link>
                          <Link to={`/analysis/${lead.id}?tab=outreach`} className="text-xs font-medium text-emerald-600 hover:underline">
                            Outreach →
                          </Link>
                        </div>
                        <div className="flex gap-1">
                          {/* Find Founder Button */}
                          {!hasFounderInfo && (
                            <button
                              onClick={() => handleFindFounder(lead)}
                              disabled={isEnriching}
                              className="p-1.5 hover:bg-brand-50 rounded text-brand-600 disabled:opacity-50 text-[10px] flex items-center gap-1 border border-brand-200"
                              title="Find Founder"
                            >
                              {isEnriching ? <RefreshCw size={12} className="animate-spin" /> : <UserSearch size={12} />}
                              Find
                            </button>
                          )}
                          {lead.phone && <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400"><Phone size={14} /></button>}
                          {lead.contactEmail && <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400"><Mail size={14} /></button>}
                        </div>
                      </div>

                      {/* Action to move card */}
                      {nextStatus && (
                        <div className="mt-2 pt-2 border-t border-slate-50 hidden group-hover:flex justify-end">
                          <button
                            onClick={() => updateStatus(lead.id, nextStatus)}
                            className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 px-2 py-1.5 rounded flex items-center gap-1 transition-colors"
                          >
                            Next Stage <ArrowRight size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeadBoard;