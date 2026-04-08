import React, { useState, useMemo } from 'react';
import { Search, Loader2, Play, Building2, MapPin, Database, Filter, ExternalLink, Activity, Mail, Check, RefreshCw, Smartphone, X, User, Globe, ChevronDown } from 'lucide-react';
import { Business } from '../types';
import { generateWebsite, uploadLogo, enrichBusiness, bulkEnrich, bulkAnalyze } from '../services/backendApi';

export default function PipelineSearch({ initialResults = [], projectId, onUpdateResult }: { initialResults?: any[], projectId?: string, onUpdateResult?: (id: string, data: Partial<Business>) => void }) {
  const [service, setService] = useState('');
  const [city, setCity] = useState('');
  const [targetCount, setTargetCount] = useState('100');
  const [isScraping, setIsScraping] = useState(false);
  const [results, setResults] = useState<any[]>(initialResults);
  const [statusText, setStatusText] = useState('Idle');

  // Sync with global state (project switch, data reload)
  React.useEffect(() => {
    if (!isScraping) {
      setResults(initialResults);
    }
  }, [initialResults, isScraping]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters State
  const [filterWebsite, setFilterWebsite] = useState<'both'|'has'|'doesnt'>('both');
  const [filterAds, setFilterAds] = useState<'both'|'yes'|'no'>('both');
  const [filterEmail, setFilterEmail] = useState<'both'|'yes'|'no'>('both');
  const [filterPhone, setFilterPhone] = useState<'both'|'yes'|'no'>('both');
  const [filterScore, setFilterScore] = useState<'both'|'below50'|'above50'>('both');

  // Modal State
  const [selectedContact, setSelectedContact] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<'contact' | 'website'>('contact');
  const [isModalActionLoading, setIsModalActionLoading] = useState(false);
  const [localHeroPhrases, setLocalHeroPhrases] = useState('');
  const [localServices, setLocalServices] = useState('');
  const [logoUploadUrl, setLogoUploadUrl] = useState('');

  const openContactModal = (r: any) => {
    const b: Business = {
        id: r.place_id || Math.random().toString(),
        name: r.name || 'Unnamed Business',
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
    setActiveTab('contact');
    setSelectedContact(b);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map((r: any) => r.place_id || r.name)));
    }
  };

  const startPipeline = () => {
    if (!service || !city) return;
    setIsScraping(true);
    setStatusText('Routing directly to background scraper engine...');
    setResults([]);
    setSelectedIds(new Set());
    
    const evtSource = new EventSource(`/api/pipeline/stream?service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}&targetCount=${targetCount}&projectId=${projectId || ''}`);

    evtSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
                setStatusText(`Scraping: ${data.message.substring(0, 70)}...`);
            } else if (data.type === 'complete') {
                const resultData = data.result;
                if (resultData.records && resultData.records.length > 0) {
                    // Update our view, but let App.tsx auto-sync take care of DB persistence naturally
                    setResults(prev => {
                        const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
                        const newOnes = resultData.records.filter((r: any) => !existingNames.has(r.name.toLowerCase()));
                        return [...newOnes, ...prev];
                    });
                    setStatusText(`Complete. Loaded ${resultData.records.length} businesses.`);
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
            // Ignore ping frames
        }
    };

    evtSource.onerror = () => {
        setStatusText('Network disconnected or timed out. Reconnecting...');
        evtSource.close();
        setIsScraping(false);
    };
  };

  const handlePageSpeed = async () => {
    if (results.length === 0) return;
    setStatusText('Running bulk PageSpeed & Analysis...');
    setIsScraping(true);
    try {
        const payload = results.map(r => ({ id: r.id, url: r.website || '', name: r.name }));
        const analyzeRes = await bulkAnalyze(payload);
        const newResults = results.map(r => {
            if (analyzeRes[r.id]) {
                return { 
                    ...r, 
                    pageSpeedMobile: analyzeRes[r.id].pageSpeedMobile || r.pageSpeedMobile,
                    pageSpeedDesktop: analyzeRes[r.id].pageSpeedDesktop || r.pageSpeedDesktop,
                    qualityScore: analyzeRes[r.id].digitalScore || r.qualityScore,
                    analysisBullets: analyzeRes[r.id].analysisBullets || r.analysisBullets
                };
            }
            return r;
        });
        setResults(newResults);
        setStatusText('Quality Analysis Complete.');
    } catch (e: any) {
        console.error(e);
        setStatusText('Analysis failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };

  const handleCheckAds = async () => {
    if (results.length === 0) return;
    setStatusText('Checking Google Ads via Serper...');
    setIsScraping(true);
    try {
        const payload = results.map(r => ({ id: r.id, name: r.name, city: city || r.address || '' }));
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5010'}/pipeline/check-ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: payload })
        });
        const data = await response.json();
        
        const newResults = results.map(r => {
            if (data.results && data.results[r.id] !== undefined) {
                // In our current Business type, we might not have 'runningAds' but we can just use status or console log.
                // Assuming we can append 'runningAds' virtually.
                return { 
                    ...r, 
                    runningAds: data.results[r.id] // boolean
                };
            }
            return r;
        });
        setResults(newResults);
        setStatusText('Google Ads check complete.');
    } catch (e: any) {
        console.error(e);
        setStatusText('Ads check failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };

  const handleFallbackEmail = async () => {
    if (results.length === 0) return;
    setStatusText('Running Gemini Fallback Email Search...');
    setIsScraping(true);
    try {
        // Only run for those lacking emails
        const payload = results.filter(r => !r.contactEmail && !r.email && r.website).map(r => ({ id: r.id, website: r.website }));
        if (payload.length === 0) {
            setStatusText('No missing emails with valid websites found.');
            setIsScraping(false);
            return;
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5010'}/pipeline/fallback-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: payload })
        });
        const data = await response.json();
        
        const newResults = results.map(r => {
            if (data.results && data.results[r.id] && data.results[r.id] !== 'NULL') {
                return { 
                    ...r, 
                    contactEmail: data.results[r.id]
                };
            }
            return r;
        });
        setResults(newResults);
        setStatusText('Gemini Email Fallback complete.');
    } catch (e: any) {
        console.error(e);
        setStatusText('Email fallback failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };


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
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                <button onClick={handlePageSpeed} disabled={isScraping || results.length === 0} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-medium hover:bg-blue-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                    <Activity size={14} /> Website Quality & Score (PageSpeed)
                </button>
                <button onClick={handleCheckAds} disabled={isScraping || results.length === 0} className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg border border-orange-200 text-xs font-medium hover:bg-orange-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                    <ExternalLink size={14} /> Check Google Ads (Serper)
                </button>
                <button onClick={handleFallbackEmail} disabled={isScraping || results.length === 0} className="bg-cyan-50 text-cyan-600 px-3 py-1.5 rounded-lg border border-cyan-200 text-xs font-medium hover:bg-cyan-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                    <Mail size={14} /> Fallback Email Search (Gemini Context)
                </button>
            </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
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

            {/* Result Count */}
            {results.length > 0 && (
              <div className="text-sm font-semibold text-slate-600">
                Showing <span className="text-brand-600">{filteredResults.length}</span> of <span className="text-brand-600">{results.length}</span> businesses
                {selectedIds.size > 0 && <span className="ml-2 text-emerald-600">({selectedIds.size} selected)</span>}
              </div>
            )}
        </div>

        {/* Data Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredResults.length > 0 && selectedIds.size === filteredResults.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </th>
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
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      No matching results found in pipeline.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r: any, i: number) => {
                    const rowId = r.place_id || r.name || i.toString();
                    return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(rowId)}
                          onChange={() => toggleSelect(rowId)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800" onClick={() => openContactModal(r)}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
                            {(r.name || '?').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate max-w-[220px] font-semibold">{r.name || 'Unnamed Business'}</div>
                            {r.niche && <div className="text-[10px] text-slate-400 truncate max-w-[220px]">{r.niche}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" onClick={() => openContactModal(r)}>{r.phone || 'N/A'}</td>
                      <td className="px-4 py-3" onClick={() => openContactModal(r)}>
                        {r.website ? (
                            <a href={r.website} target="_blank" className="text-brand-600 hover:underline flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                                Link <ExternalLink size={12}/>
                            </a>
                        ) : (
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold uppercase rounded-md">No Website</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={() => openContactModal(r)}>
                        {r.email ? (
                            <span className="text-emerald-700">{r.email}</span>
                        ) : (
                            <span className="text-amber-600 italic text-xs">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={() => openContactModal(r)}>
                        {r.ads === true ? (
                          <span className="text-emerald-600 font-bold">Yes</span>
                        ) : r.ads === false && r.adsChecked ? (
                          <span className="text-slate-400">No</span>
                        ) : (
                          <span className="text-slate-300 italic text-xs">Not checked</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={() => openContactModal(r)}>
                        {r.score === 0 || !r.score ? <span className="text-slate-300">-</span> : (
                            <span className={`font-bold ${r.score < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.score}</span>
                        )}
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Full Profile Modal — Identical to Sniper */}
      {selectedContact && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-800">{selectedContact.name}</h2>
                        <p className="text-sm text-slate-500">{selectedContact.category || 'Local Business'} · {selectedContact.address}</p>
                    </div>
                    <button onClick={() => setSelectedContact(null)} className="text-slate-400 hover:bg-slate-200 hover:text-slate-800 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                  <button
                    onClick={() => setActiveTab('contact')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'contact' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Contact Info
                  </button>
                  <button
                    onClick={() => setActiveTab('website')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'website' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Create Website
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto w-full">
                  {/* ===== CONTACT INFO TAB ===== */}
                  {activeTab === 'contact' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-2xl shrink-0">
                          {selectedContact.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-slate-900 leading-tight">Business Details</h4>
                          <p className="text-slate-500 text-sm mt-1">Found through Google Maps</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Founder</label>
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-slate-400" />
                            <span className="font-medium text-slate-900">{(selectedContact as any).founderName || "Not detected"}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Email</label>
                          <div className="flex items-center gap-2">
                            <Mail size={16} className="text-slate-400" />
                            <span className="font-medium text-slate-900">{selectedContact.contactEmail || "Not available"}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Phone</label>
                          <div className="flex items-center gap-2">
                            <Smartphone size={16} className="text-green-600" />
                            {selectedContact.phone ? (
                              <a
                                href={`https://wa.me/${(() => {
                                  const cleaned = selectedContact.phone.replace(/[^\d]/g, '');
                                  return cleaned.length === 10 ? `1${cleaned}` : cleaned;
                                })()}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-green-700 hover:text-green-800 hover:underline truncate"
                                title="Message on WhatsApp"
                              >
                                {selectedContact.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">Not available</span>
                            )}
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Reviews</label>
                          <div className="flex items-center gap-2">
                            <Activity size={16} className="text-amber-500" />
                            <span className="font-medium text-slate-900">{selectedContact.reviewCount || 0} reviews · {selectedContact.rating || 0}★</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Category</label>
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-slate-400" />
                            <span className="font-medium text-slate-900">{selectedContact.category || "Not detected"}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Website</label>
                          <div className="flex items-center gap-2">
                            <Globe size={16} className="text-emerald-600" />
                            {selectedContact.website ? (
                              <a href={selectedContact.website} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:underline truncate max-w-[200px]">
                                Visit Site
                              </a>
                            ) : <span className="text-slate-400 italic">Not available</span>}
                          </div>
                        </div>
                      </div>

                      {/* Logo Configuration */}
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Logo Configuration</label>
                          <div className="flex flex-col gap-3">
                             <div className="flex gap-2 items-center">
                               <input 
                                 type="file" 
                                 accept="image/*"
                                 title="Upload an image from your computer"
                                 className="text-sm w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 bg-white border border-dashed border-slate-300 p-2 rounded-xl cursor-pointer"
                                 onChange={async (e) => {
                                   const file = e.target.files?.[0];
                                   if (!file) return;
                                   const reader = new FileReader();
                                   reader.onloadend = async () => {
                                     const base64data = reader.result as string;
                                     setIsModalActionLoading(true);
                                     try {
                                       const res = await uploadLogo(selectedContact.id, { logoData: base64data });
                                       setSelectedContact(prev => prev ? {...prev, logoUrl: res.logoUrl} : null);
                                       if (onUpdateResult) onUpdateResult(selectedContact.id, { logoUrl: res.logoUrl });
                                     } catch (err: any) {
                                       alert('Logo upload failed: ' + err.message);
                                     } finally {
                                       setIsModalActionLoading(false);
                                     }
                                   };
                                   reader.readAsDataURL(file);
                                 }}
                               />
                             </div>
                             
                             <div className="flex items-center gap-2">
                               <div className="h-px bg-slate-200 flex-1"></div>
                               <span className="text-xs font-bold text-slate-400 uppercase">Or link</span>
                               <div className="h-px bg-slate-200 flex-1"></div>
                             </div>

                             <div className="flex gap-2">
                               <input 
                                 type="text" 
                                 placeholder={selectedContact.logoUrl ? "Update logo URL..." : "Paste remote image URL for logo"} 
                                 className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white"
                                 value={logoUploadUrl}
                                 onChange={(e) => setLogoUploadUrl(e.target.value)}
                               />
                               <button 
                                 className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50"
                                 onClick={async () => {
                                   if(!logoUploadUrl) return;
                                   setIsModalActionLoading(true);
                                   try {
                                     const res = await uploadLogo(selectedContact.id, { logoUrl: logoUploadUrl });
                                     setSelectedContact(prev => prev ? {...prev, logoUrl: res.logoUrl} : null);
                                     if (onUpdateResult) onUpdateResult(selectedContact.id, { logoUrl: res.logoUrl });
                                     setLogoUploadUrl('');
                                   } catch (err: any) {
                                     alert('Logo upload failed: ' + err.message);
                                   } finally {
                                     setIsModalActionLoading(false);
                                   }
                                 }}
                                 disabled={isModalActionLoading || !logoUploadUrl}
                               >
                                 {isModalActionLoading ? 'Saving...' : 'Set Logo'}
                               </button>
                             </div>
                          </div>
                          {selectedContact.logoUrl && (
                            <div className="mt-3 flex items-center gap-3">
                               <span className="text-xs text-slate-500">Current Logo:</span>
                               <img src={selectedContact.logoUrl} alt="Logo" className="max-h-8 object-contain rounded bg-white shadow-sm p-1" />
                            </div>
                          )}
                      </div>

                      {/* Enrich Contact Data Button */}
                      <button
                        onClick={async () => {
                          if (!selectedContact) return;
                          setIsModalActionLoading(true);
                          try {
                            const data = await enrichBusiness(selectedContact.name, selectedContact.address, selectedContact.website);
                            const updated = {
                              ...selectedContact,
                              contactEmail: data.email || selectedContact.contactEmail,
                              phone: data.phone || selectedContact.phone,
                              founderName: (data as any).owner || data.founderName || (selectedContact as any).founderName,
                              linkedin: data.linkedin || (selectedContact as any).linkedin,
                              instagram: data.instagram || (selectedContact as any).instagram,
                            };
                            setSelectedContact(updated as any);
                            if (onUpdateResult) onUpdateResult(selectedContact.id, updated);
                          } catch (err: any) {
                            alert('Enrichment failed: ' + err.message);
                          } finally {
                            setIsModalActionLoading(false);
                          }
                        }}
                        disabled={isModalActionLoading}
                        className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                      >
                        {isModalActionLoading ? <RefreshCw className="animate-spin" size={18} /> : <Activity size={18} />}
                        {isModalActionLoading ? 'Enriching...' : 'Enrich Contact Data'}
                      </button>
                    </div>
                  )}

                  {/* ===== CREATE WEBSITE TAB ===== */}
                  {activeTab === 'website' && (
                    <div className="space-y-6 flex flex-col items-center justify-center">
                        <div className="w-full space-y-4 mb-4">
                            <h4 className="font-bold text-slate-800 border-b pb-2">Theme Customization Settings</h4>
                            
                            <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Website Template</label>
                            <select 
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-brand-500"
                                value={(selectedContact as any).themeTemplate || 'med-spa-template-1'}
                                onChange={(e) => setSelectedContact({...selectedContact, themeTemplate: e.target.value} as any)}
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
                                value={(selectedContact as any).themeTagline || ''}
                                onChange={(e) => setSelectedContact({...selectedContact, themeTagline: e.target.value} as any)}
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
                                setSelectedContact({...selectedContact, themeHeroPhrases: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)} as any);
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
                                setSelectedContact({...selectedContact, themeServices: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)} as any);
                                }}
                            />
                            </div>
                        </div>

                        {!(selectedContact as any).previewSiteUrl ? (
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
                                    setSelectedContact({ ...selectedContact, previewSiteUrl: result.previewUrl } as any);
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
                                <input readOnly value={(selectedContact as any).previewSiteUrl} className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 outline-none" />
                                <a href={(selectedContact as any).previewSiteUrl} target="_blank" rel="noreferrer" className="bg-slate-900 text-white px-4 py-2 rounded font-medium text-sm hover:bg-slate-800 flex items-center">
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
                                    setSelectedContact({ ...selectedContact, previewSiteUrl: result.previewUrl } as any);
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
                  )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
