import React, { useState, useMemo } from 'react';
import { Search, Loader2, Play, Building2, MapPin, Database, Filter, ExternalLink, Activity, Mail, Check, RefreshCw, Smartphone, X } from 'lucide-react';
import { Business } from '../types';
import { generateWebsite } from '../services/backendApi';

export default function PipelineSearch() {
  const [service, setService] = useState('');
  const [city, setCity] = useState('');
  const [targetCount, setTargetCount] = useState('100'); // New Option
  const [isScraping, setIsScraping] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [statusText, setStatusText] = useState('Idle');

  // Filters State
  const [filterWebsite, setFilterWebsite] = useState<'both'|'has'|'doesnt'>('both');
  const [filterAds, setFilterAds] = useState<'both'|'yes'|'no'>('both');
  const [filterEmail, setFilterEmail] = useState<'both'|'yes'|'no'>('both');
  const [filterPhone, setFilterPhone] = useState<'both'|'yes'|'no'>('both');
  const [filterScore, setFilterScore] = useState<'both'|'below50'|'above50'>('both');

  // Web Generation Modal State
  const [selectedContact, setSelectedContact] = useState<Business | null>(null);
  const [isModalActionLoading, setIsModalActionLoading] = useState(false);
  const [localHeroPhrases, setLocalHeroPhrases] = useState('');
  const [localServices, setLocalServices] = useState('');

  const openContactModal = (r: any) => {
    // Map raw scraped lead to Business interface temporarily
    const b: Business = {
        id: r.place_id || Math.random().toString(),
        name: r.name,
        address: r.address || city,
        website: r.website || '',
        phone: r.phone || '',
        rating: r.score || 0,
        reviewCount: r.reviews || 0,
        category: r.niche || service,
        contactEmail: r.email || '',
        status: 'new',
        qualityScore: r.score || 0
    };
    setSelectedContact(b);
  };

  const startPipeline = () => {
    if (!service || !city) return;
    setIsScraping(true);
    setStatusText('Routing directly to background scraper engine...');
    setResults([]);
    
    // Switch to Server-Sent Events (SSE) to bypass ingress load balancer timeouts
    const evtSource = new EventSource(`/api/pipeline/stream?service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}&targetCount=${targetCount}`);

    evtSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
                setStatusText(`Scraping: ${data.message.substring(0, 70)}...`);
            } else if (data.type === 'complete') {
                const resultData = data.result;
                if (resultData.records && resultData.records.length > 0) {
                    setResults(resultData.records);
                    setStatusText(`Complete. Found CSV at ${resultData.csvFilePath}. Loaded ${resultData.records.length} businesses.`);
                } else {
                    setStatusText(`Complete. No valid records found in resulting CSV.`);
                }
                evtSource.close();
                setIsScraping(false);
            } else if (data.type === 'error') {
                setStatusText(`Error: ${data.message}`);
                evtSource.close();
                setIsScraping(false);
            }
        } catch (e) {
            // Ignore ping frames or malformed text
        }
    };

    evtSource.onerror = () => {
        setStatusText('Network disconnected or timed out. Reconnecting...');
        evtSource.close();
        setIsScraping(false);
    };
  };

  // Enrichment Hook Buttons (To be wired)
  const runFallbackEmailSearch = () => { alert('Triggering Gemini URL Context Search for missing emails...'); };
  const runSerperAdCheck = () => { alert('Triggering Serper.dev Ads verification...'); };
  const runWebsiteQualityCheck = () => { alert('Triggering PageSpeed Insights scoring...'); };

  const filteredResults = useMemo(() => {
    return results.filter(r => {
        if (filterWebsite === 'has' && !r.website) return false;
        if (filterWebsite === 'doesnt' && r.website) return false;
        
        if (filterAds === 'yes' && !r.ads) return false;
        if (filterAds === 'no' && r.ads) return false;

        if (filterEmail === 'yes' && !r.email) return false;
        if (filterEmail === 'no' && r.email) return false;
        
        if (filterPhone === 'yes' && !r.phone) return false;
        if (filterPhone === 'no' && r.phone) return false;

        if (filterScore === 'below50' && r.score >= 50) return false;
        if (filterScore === 'above50' && r.score < 50) return false;

        return true;
    });
  }, [results, filterWebsite, filterAds, filterEmail, filterPhone, filterScore]);

  return (
    <div className="flex-1 overflow-auto bg-slate-50 flex flex-col h-full h-screen relative">
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
          
          <div className="relative hidden md:block">
            <select value={targetCount} onChange={(e) => setTargetCount(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-700 w-32 appearance-none">
                <option value="50">Limit: 50</option>
                <option value="100">Limit: 100</option>
                <option value="250">Limit: 250</option>
                <option value="500">Limit: 500</option>
                <option value="1000">Limit: 1000</option>
                <option value="2000">Limit: 2000</option>
                <option value="5000">Limit: 5000</option>
                <option value="10000">Limit: 10000</option>
            </select>
          </div>
          <button
            onClick={startPipeline}
            disabled={isScraping || !service || !city}
            className="bg-brand-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all shadow-brand-500/20 active:scale-95"
          >
            {isScraping ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isScraping ? 'Running...' : 'Fetch Base Pipeline Data'}
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col max-w-[1600px] mx-auto w-full">
        {/* Status Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-3 text-sm font-medium w-full md:w-auto">
                <span className="relative flex h-3 w-3">
                  {isScraping && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isScraping ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                </span>
                <span className="text-slate-600">{statusText}</span>
            </div>
            
            {/* Action Bar - Manual Triggers exactly tailored to user requests */}
            <div className="flex gap-2">
                <button onClick={runWebsiteQualityCheck} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors">
                    <Activity size={14}/> Website Quality & Score (PageSpeed)
                </button>
                <button onClick={runSerperAdCheck} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors">
                    <ExternalLink size={14}/> Check Google Ads (Serper)
                </button>
                <button onClick={runFallbackEmailSearch} className="px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors">
                    <Mail size={14}/> Fallback Email Search (Gemini Context)
                </button>
            </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-4 items-center">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Filter size={16}/> Layout Filters:</div>
            
            <select className="text-sm border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" value={filterWebsite} onChange={e=>setFilterWebsite(e.target.value as any)}>
                <option value="both">Website: Both</option>
                <option value="has">Has Website</option>
                <option value="doesnt">No Website</option>
            </select>
            
            <select className="text-sm border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" value={filterAds} onChange={e=>setFilterAds(e.target.value as any)}>
                <option value="both">Ads: Both</option>
                <option value="yes">Runs Ads</option>
                <option value="no">No Ads</option>
            </select>
            
            <select className="text-sm border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" value={filterEmail} onChange={e=>setFilterEmail(e.target.value as any)}>
                <option value="both">Email: Both</option>
                <option value="yes">Has Email</option>
                <option value="no">No Email</option>
            </select>
            
            <select className="text-sm border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" value={filterPhone} onChange={e=>setFilterPhone(e.target.value as any)}>
                <option value="both">Phone: Both</option>
                <option value="yes">Has Phone</option>
                <option value="no">No Phone</option>
            </select>
            
            <select className="text-sm border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" value={filterScore} onChange={e=>setFilterScore(e.target.value as any)}>
                <option value="both">Score: Both</option>
                <option value="below50">Quality Score Below 50</option>
                <option value="above50">Quality Score Above 50</option>
            </select>
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
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No matching results found in pipeline.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r, i) => (
                    <tr key={i} onClick={() => openContactModal(r)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                        {r.name}
                        <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-0.5 rounded-full border border-slate-200 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700">Open Generator</span>
                      </td>
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

      {/* Website Generator Modal (Duplicated for Seamless Pipeline UX) */}
      {selectedContact && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-full">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-800">{selectedContact.name}</h2>
                        <p className="text-sm text-slate-500">Pipeline Website Generator Workspace</p>
                    </div>
                    <button onClick={() => setSelectedContact(null)} className="text-slate-400 hover:bg-slate-200 hover:text-slate-800 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto w-full">
                    <div className="space-y-6 flex flex-col items-center justify-center">
                        <div className="w-full space-y-4 mb-4">
                            <h4 className="font-bold text-slate-800 border-b pb-2">Theme Customization Settings</h4>
                            
                            <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Website Template</label>
                            <select 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                                value={selectedContact.themeTemplate || 'med-spa-template-1'}
                                onChange={(e) => setSelectedContact({...selectedContact, themeTemplate: e.target.value})}
                            >
                                <option value="med-spa-template-1">Med Spa Theme (Default)</option>
                                <option value="plumber-template-1">Plumbing Theme</option>
                                <option value="generic-business-1">Generic Local Business</option>
                            </select>
                            </div>

                            <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Brand Tagline</label>
                            <input 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="e.g., The best plumbing in town"
                                value={selectedContact.themeTagline || ''}
                                onChange={(e) => setSelectedContact({...selectedContact, themeTagline: e.target.value})}
                            />
                            </div>

                            <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Hero Phrases (Comma Separated)</label>
                            <input 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="e.g., Fast, Reliable, Affordable"
                                value={localHeroPhrases}
                                onChange={(e) => {
                                setLocalHeroPhrases(e.target.value);
                                setSelectedContact({...selectedContact, themeHeroPhrases: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)});
                                }}
                            />
                            </div>

                            <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Services Offered (Comma Separated)</label>
                            <input 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="e.g., HVAC Repair, AC Installation, Heating"
                                value={localServices}
                                onChange={(e) => {
                                setLocalServices(e.target.value);
                                setSelectedContact({...selectedContact, themeServices: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)});
                                }}
                            />
                            </div>
                        </div>

                        {!selectedContact.previewSiteUrl ? (
                            <>
                            <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 mb-4">
                                <ExternalLink size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Generate Preview Website</h3>
                            <p className="text-slate-500 text-center max-w-sm mb-6">
                                Create a custom, high-speed landing page for {selectedContact.name} to showcase in your cold outreach pipeline.
                            </p>
                            <button
                                onClick={async () => {
                                setIsModalActionLoading(true);
                                try {
                                    const result = await generateWebsite(selectedContact);
                                    setSelectedContact({ ...selectedContact, previewSiteUrl: result.previewUrl });
                                } catch (e: any) { alert('Site generation failed: ' + e.message); }
                                finally { setIsModalActionLoading(false); }
                                }}
                                disabled={isModalActionLoading}
                                className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 hover:shadow-xl transition-all flex items-center gap-2"
                            >
                                {isModalActionLoading ? <RefreshCw className="animate-spin" size={20} /> : <Smartphone size={20} />}
                                {isModalActionLoading ? 'Building Site...' : 'Generate Preview Site'}
                            </button>
                            </>
                        ) : (
                            <div className="w-full space-y-4">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                                <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><Check size={20} /></div>
                                <div className="flex-1">
                                <h4 className="font-bold text-emerald-800">Website Generated!</h4>
                                <p className="text-emerald-700 text-sm">Ready to share via the email pipeline.</p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Preview URL</label>
                                <div className="flex gap-2">
                                <input readOnly value={selectedContact.previewSiteUrl} className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 outline-none" />
                                <a href={selectedContact.previewSiteUrl} target="_blank" rel="noreferrer" className="bg-slate-900 text-white px-4 py-2 rounded font-medium text-sm hover:bg-slate-800 flex items-center">
                                    Open <ExternalLink size={14} className="ml-2" />
                                </a>
                                </div>
                            </div>
                            
                            <div className="flex justify-center pt-2">
                                <button
                                onClick={async () => {
                                    setIsModalActionLoading(true);
                                    try {
                                    const result = await generateWebsite(selectedContact);
                                    setSelectedContact({ ...selectedContact, previewSiteUrl: result.previewUrl });
                                    } catch (e: any) { alert('Site regeneration failed: ' + e.message); }
                                    finally { setIsModalActionLoading(false); }
                                }}
                                disabled={isModalActionLoading}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium"
                                >
                                <RefreshCw size={14} className={isModalActionLoading ? "animate-spin" : ""} /> Regenerate Website
                                </button>
                            </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
