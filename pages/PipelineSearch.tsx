import React, { useState } from 'react';
import { Search, Loader2, Play, Building2, MapPin, Database, Filter, ExternalLink, Activity, Mail } from 'lucide-react';

export default function PipelineSearch() {
  const [service, setService] = useState('');
  const [city, setCity] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [statusText, setStatusText] = useState('Idle');

  const startPipeline = async () => {
    if (!service || !city) return;
    setIsScraping(true);
    setStatusText('Generating keyword matrices & running remote scraper...');
    
    try {
        const response = await fetch(`/api/pipeline/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, city })
        });
        
        if (!response.ok) throw new Error(await response.text());
        
        const data = await response.json();
        setStatusText('Download complete! Parsing results...');
        
        // Output format will be parsed in next phases. Simply log it for now.
        console.log("Scraper returned CSV path:", data.csvFilePath);
        setStatusText(`Complete. Found CSV at ${data.csvFilePath}`);
    } catch (err: any) {
        setStatusText(`Error: ${err.message}`);
        console.error(err);
    } finally {
        setIsScraping(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 flex flex-col h-full h-screen">
      <div className="bg-white border-b sticky top-0 z-10 px-6 py-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="text-brand-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Mass Pipeline</h1>
            <p className="text-sm text-slate-500">Local automated scraping and enrichment engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Service (e.g. Plumber)"
              className="pl-10 pr-4 py-2 border rounded-xl text-sm w-48 focus:ring-2 focus:ring-brand-500 outline-none"
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="City (e.g. Austin, TX)"
              className="pl-10 pr-4 py-2 border rounded-xl text-sm w-48 focus:ring-2 focus:ring-brand-500 outline-none"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <button
            onClick={startPipeline}
            disabled={isScraping || !service || !city}
            className="bg-brand-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all shadow-brand-500/20 active:scale-95"
          >
            {isScraping ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isScraping ? 'Running...' : 'Start Scan'}
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col max-w-[1600px] mx-auto w-full">
        {/* Status Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex justify-between items-center">
            <div className="flex items-center gap-3 text-sm font-medium">
                <span className="relative flex h-3 w-3">
                  {isScraping && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isScraping ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                </span>
                <span className="text-slate-600">{statusText}</span>
            </div>
            
            {/* Action Bar */}
            <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors">
                    <Activity size={14}/> Score Check
                </button>
                <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors">
                    <Mail size={14}/> Gemini Email
                </button>
                <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors">
                    <Filter size={14}/> Layout Filters
                </button>
            </div>
        </div>

        {/* Data Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Business Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Running Ads</th>
                  <th className="px-4 py-3">Quality Score</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No results yet. Enter a niche and city to start sniping.
                    </td>
                  </tr>
                ) : (
                  results.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.phone || 'N/A'}</td>
                      <td className="px-4 py-3">
                        {r.website ? (
                            <a href={r.website} target="_blank" className="text-brand-600 hover:underline flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                                Link <ExternalLink size={12}/>
                            </a>
                        ) : (
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold uppercase rounded-md">No Website</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.email ? (
                            <span className="text-emerald-700">{r.email}</span>
                        ) : (
                            <span className="text-amber-600 italic text-xs">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.ads ? <span className="text-emerald-600 font-bold">Yes</span> : <span className="text-slate-400">No</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.score === 0 ? <span className="text-slate-300">-</span> : (
                            <span className={`font-bold ${r.score < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.score}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
