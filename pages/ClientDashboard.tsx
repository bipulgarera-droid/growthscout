import React, { useState } from 'react';
import { Business } from '../types';
import { updateBusinessInDB } from '../services/backendApi';
import { Blocks, MessageSquare, Star, PhoneMissed, Settings, CheckCircle } from 'lucide-react';

interface Props {
  leads: Business[];
  onUpdateClient: (id: string, data: Partial<Business>) => void;
}

const ClientDashboard = ({ leads, onUpdateClient }: Props) => {
  // Only show clients who are in "won" status
  const clients = leads.filter(l => l.status === 'won');
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Sidebar: Client List */}
      <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
          <h2 className="text-lg font-bold text-slate-800">Active Clients ({clients.length})</h2>
          <p className="text-xs text-slate-500">Manage fulfillment engines</p>
        </div>
        
        {clients.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CheckCircle className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">No active clients yet.</p>
            <p className="text-xs mt-1">Move a prospect to "Won" in the Prospecting Hub.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {clients.map(client => (
              <button
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${selectedClientId === client.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-slate-50 border border-transparent'}`}
              >
                <div className="font-medium text-slate-800 truncate">{client.name}</div>
                <div className="text-xs text-slate-500 truncate">{client.category} • {client.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Content: Services Config */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Blocks size={48} className="mb-4 opacity-50 text-slate-300" />
            <p>Select a client from the sidebar to manage their services.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">{selectedClient.name} Dashboard</h1>
              <p className="text-slate-500">Fulfillment Configuration & Service Engines</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* RAG Chatbot Knowledge Base */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                    <MessageSquare size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">Chatbot Knowledge (RAG)</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">Feed FAQs, pricing, or specific instructions for the custom AI chatbot template.</p>
                <textarea 
                  className="w-full h-32 p-3 border rounded-lg text-sm mb-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Paste business facts here... e.g. We close at 9pm. Price for AC repair is $99 minimum."
                  value={selectedClient.ragKnowledgeBase || ''}
                  onChange={(e) => onUpdateClient(selectedClient.id, { ragKnowledgeBase: e.target.value })}
                />
              </div>

              {/* Review Gate Configuration */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
                    <Star size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">Review Gate Setup</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">Google My Business review URL to redirect happy customers (4-5 stars).</p>
                <input 
                  type="text"
                  className="w-full p-3 border rounded-lg text-sm mb-3 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="https://g.page/r/example..."
                  value={selectedClient.reviewUrl || ''}
                  onChange={(e) => onUpdateClient(selectedClient.id, { reviewUrl: e.target.value })}
                />
              </div>

              {/* Missed Call Webhook */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-100 text-purple-600 p-2 rounded-lg">
                    <PhoneMissed size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">Missed Call Text-Back</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">Auto-reply sent via Twilio when the client misses a phone call.</p>
                <textarea 
                  className="w-full h-20 p-3 border rounded-lg text-sm mb-3 focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Hey, we just missed your call. How can we help?"
                  value={selectedClient.missedCallTemplate || ''}
                  onChange={(e) => onUpdateClient(selectedClient.id, { missedCallTemplate: e.target.value })}
                />
              </div>

              {/* General Config Sync */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-slate-100 text-slate-600 p-2 rounded-lg">
                    <Settings size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">Active Services</h3>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 text-brand-600 rounded" defaultChecked />
                    <span className="text-sm font-medium">Website Hosting</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 text-brand-600 rounded" defaultChecked />
                    <span className="text-sm font-medium">AI Chatbot Active</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 text-brand-600 rounded" />
                    <span className="text-sm font-medium">Missed Call Text-Back</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 text-brand-600 rounded" />
                    <span className="text-sm font-medium">Review Automations</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
