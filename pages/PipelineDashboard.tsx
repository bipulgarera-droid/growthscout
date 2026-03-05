
import React, { useState } from 'react';
import { Search, Loader2, Send, ExternalLink, CheckCircle, Smartphone, Globe, Mail } from 'lucide-react';

interface ContactInfo {
    founderName?: string;
    email?: string;
    linkedin?: string;
    instagram?: string;
    phone?: string;
    whatsappVerified?: boolean;
}

interface AuditData {
    speedScore: number;
    screenshot: string; // base64
}

interface PipelineResult {
    business: {
        name: string;
        website?: string;
        rating?: number;
        address: string;
    };
    contact: ContactInfo;
    slug: string;
    previewUrl: string;
    outreachMessage: string;
    audit: AuditData;
    status: 'success' | 'error';
    error?: string;
}

const PipelineDashboard = () => {
    const [keyword, setKeyword] = useState('Med Spas');
    const [location, setLocation] = useState('Miami, FL');
    const [maxResults, setMaxResults] = useState(3);
    const [templateType, setTemplateType] = useState<'medspa' | 'fitness'>('medspa');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<PipelineResult[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [isVerifyingWA, setIsVerifyingWA] = useState(false);
    const [filterWA, setFilterWA] = useState(false);

    // Load history on mount
    React.useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            const res = await fetch('/api/leads');
            const data = await res.json();
            if (data.success && Array.isArray(data.leads)) {
                // Map DB lead format to UI format
                const mapped = data.leads.map((l: any) => ({
                    id: l.id,
                    business: {
                        name: l.business_name,
                        website: l.original_url,
                        rating: l.rating,
                        address: l.address
                    },
                    contact: {
                        founderName: l.contact_info?.founderName,
                        email: l.contact_info?.email,
                        linkedin: l.contact_info?.linkedin,
                        instagram: l.contact_info?.instagram,
                        phone: l.contact_info?.phone,
                        whatsappVerified: l.whatsapp_verified
                    },
                    slug: l.slug,
                    previewUrl: l.preview_url,
                    outreachMessage: l.outreach_message,
                    audit: {
                        speedScore: l.audit_data?.speed_score || 0,
                        screenshot: null
                    },
                    status: 'success'
                }));
                setResults(mapped);
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const runPipeline = async () => {
        setIsLoading(true);
        // Don't clear results, we will prepend
        try {
            const response = await fetch('/api/pipeline/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, location, maxResults, templateType })
            });
            const data = await response.json();
            if (data.success) {
                // Prepend new results to existing
                setResults(prev => [...data.results, ...prev]);
                // Optionally re-fetch from DB to ensure consistency
                fetchLeads();
            }
        } catch (error) {
            console.error("Pipeline failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyWA = async () => {
        if (selectedLeads.size === 0) return;
        setIsVerifyingWA(true);
        try {
            const res = await fetch('/api/leads/verify-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadIds: Array.from(selectedLeads) })
            });
            const data = await res.json();
            if (data.success) {
                // Keep polling or let the user refresh manually for MVP
                alert(`Started verifying ${selectedLeads.size} numbers. Give Apify a minute and refresh the page.`);
                setSelectedLeads(new Set()); // clear selection
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to start verification process.");
        } finally {
            setIsVerifyingWA(false);
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedLeads);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedLeads(next);
    };

    const toggleAll = () => {
        if (selectedLeads.size === filteredResults.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(filteredResults.map((r: any) => r.id)));
        }
    };

    const filteredResults = results.filter(row => filterWA ? row.contact.whatsappVerified === true : true);

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">

            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <h1 className="text-3xl font-bold mb-2">GrowthScout Pipeline</h1>
                <p className="text-slate-500">Automated Lead Scraping, Enrichment, Audit & Personalization.</p>
            </div>

            {/* Control Bar */}
            <div className="max-w-7xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Target Niche</label>
                    <input
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Med Spa, Dentist..."
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Location</label>
                    <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Miami, FL"
                    />
                </div>
                <div className="w-32">
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Max Leads</label>
                    <input
                        type="number"
                        min={1}
                        max={20}
                        value={maxResults}
                        onChange={(e) => setMaxResults(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
                <div className="w-40">
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Template</label>
                    <select
                        value={templateType}
                        onChange={(e) => setTemplateType(e.target.value as 'medspa' | 'fitness')}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                    >
                        <option value="medspa">Med Spa</option>
                        <option value="fitness">Fitness / Diet</option>
                    </select>
                </div>
                <button
                    onClick={runPipeline}
                    disabled={isLoading}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    {isLoading ? 'Running...' : 'Start Pipeline'}
                </button>
            </div>

            {/* Bulk Actions Bar */}
            <div className="max-w-7xl mx-auto mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setFilterWA(!filterWA)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center gap-2 ${filterWA ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <CheckCircle size={16} />
                        Verified WhatsApp Only
                    </button>

                    {selectedLeads.size > 0 && (
                        <div className="flex items-center gap-3 animate-fade-in">
                            <span className="text-sm font-medium text-slate-500">{selectedLeads.size} selected</span>
                            <button
                                onClick={handleVerifyWA}
                                disabled={isVerifyingWA}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isVerifyingWA ? <Loader2 className="animate-spin" size={16} /> : <Smartphone size={16} />}
                                {isVerifyingWA ? 'Verifying...' : 'Verify in Apify'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Table */}
            <div className="max-w-7xl mx-auto">
                {filteredResults.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                                    <th className="p-4 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedLeads.size === filteredResults.length && filteredResults.length > 0}
                                            onChange={toggleAll}
                                        />
                                    </th>
                                    <th className="p-4 w-1/4">Business</th>
                                    <th className="p-4 w-1/5">Contacts</th>
                                    <th className="p-4 w-1/5">Audit</th>
                                    <th className="p-4 w-1/5">Personalized Site</th>
                                    <th className="p-4 w-1/5">Outreach</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredResults.map((row: any, i: number) => (
                                    <tr key={row.id || i} className={`border-b border-slate-100 transition-colors ${selectedLeads.has(row.id) ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                                        {/* Checkbox */}
                                        <td className="p-4 align-top text-center">
                                            {row.id ? (
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-1"
                                                    checked={selectedLeads.has(row.id)}
                                                    onChange={() => toggleSelection(row.id)}
                                                />
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        {/* Business */}
                                        <td className="p-4 align-top">
                                            <div className="font-bold text-slate-900">{row.business.name}</div>
                                            <div className="text-sm text-slate-500 mb-1">{row.business.address}</div>
                                            {row.business.website && (
                                                <a href={row.business.website} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                    {new URL(row.business.website).hostname} <ExternalLink size={10} />
                                                </a>
                                            )}
                                            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                                                <span>★ {row.business.rating}</span>
                                                <span className="text-slate-400">({row.business.rating})</span>
                                            </div>
                                        </td>

                                        {/* Contacts */}
                                        <td className="p-4 align-top space-y-2">
                                            {row.contact.founderName && (
                                                <div className="text-sm font-semibold text-slate-800">{row.contact.founderName}</div>
                                            )}
                                            {row.contact.email ? (
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Mail size={14} /> {row.contact.email}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400 italic">No email found</div>
                                            )}
                                            {row.contact.phone && (
                                                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                                                    <a
                                                        href={`https://wa.me/${(() => {
                                                            const cleaned = row.contact.phone.replace(/[^\d]/g, '');
                                                            return cleaned.length === 10 ? `1${cleaned}` : cleaned;
                                                        })()}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-2 hover:text-green-600 hover:underline transition-colors"
                                                        title="Message on WhatsApp"
                                                    >
                                                        <Smartphone size={14} /> {row.contact.phone}
                                                    </a>
                                                    {row.contact.whatsappVerified === true && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full" title="Active on WhatsApp">
                                                            <CheckCircle size={10} /> WA Active
                                                        </span>
                                                    )}
                                                    {row.contact.whatsappVerified === false && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full" title="Not on WhatsApp">
                                                            No WA
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex gap-2 mt-2">
                                                {row.contact.linkedin && <a href={row.contact.linkedin} target="_blank" className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Globe size={14} /></a>}
                                                {row.contact.instagram && <a href={row.contact.instagram} target="_blank" className="p-1 bg-pink-100 text-pink-600 rounded hover:bg-pink-200"><Smartphone size={14} /></a>}
                                            </div>
                                        </td>

                                        {/* Audit */}
                                        <td className="p-4 align-top">
                                            <div className="w-full aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 mb-2 relative group">
                                                {row.audit.screenshot ? (
                                                    <img src={row.audit.screenshot} alt="Site" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">No Preview</div>
                                                )}
                                                <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                    {row.audit.speedScore}/100 Speed
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                <span className="font-semibold text-red-500">Missing:</span> Mobile, CTA
                                            </div>
                                        </td>

                                        {/* Personalized Site */}
                                        <td className="p-4 align-top">
                                            <a
                                                href={row.previewUrl}
                                                target="_blank"
                                                className="block group border border-slate-200 rounded-lg p-3 hover:border-blue-500 hover:shadow-md transition-all bg-white"
                                            >
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 group-hover:text-blue-600 mb-1">
                                                    <CheckCircle size={16} className="text-green-500" />
                                                    Ready to Send
                                                </div>
                                                <div className="text-xs text-slate-400 truncate">
                                                    /preview/{row.slug}
                                                </div>
                                            </a>
                                        </td>

                                        {/* Outreach */}
                                        <td className="p-4 align-top">
                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 mb-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                                {row.outreachMessage}
                                            </div>
                                            <button className="w-full py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-black transition-colors flex items-center justify-center gap-2">
                                                <Send size={12} /> Send Email
                                            </button>
                                        </td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    !isLoading && (
                        <div className="text-center py-20 text-slate-400">
                            Click "Start Pipeline" to generate leads.
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default PipelineDashboard;


