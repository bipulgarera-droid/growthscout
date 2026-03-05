import React, { useState } from 'react';
import { Search, MapPin, ExternalLink, Plus, BarChart3, TrendingDown, Trophy, AlertTriangle } from 'lucide-react';
import { searchRankings, RankedBusiness, RankSearchResult } from '../services/backendApi';
import { Business } from '../types';

interface RankTrackerProps {
    onAddLead: (business: Business) => void;
    existingLeads: Business[];
}

const RankTracker: React.FC<RankTrackerProps> = ({ onAddLead, existingLeads }) => {
    const [keyword, setKeyword] = useState('');
    const [city, setCity] = useState('');
    const [maxResults, setMaxResults] = useState(100);
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<RankSearchResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filterTier, setFilterTier] = useState<'all' | 'top' | 'mid' | 'low'>('all');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyword.trim() || !city.trim()) return;

        setIsSearching(true);
        setError(null);
        setResult(null);

        try {
            const data = await searchRankings(keyword.trim(), city.trim(), maxResults);
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    const getRankTier = (rank: number): 'top' | 'mid' | 'low' => {
        if (rank <= 10) return 'top';
        if (rank <= 30) return 'mid';
        return 'low';
    };

    const getRankBadgeClasses = (rank: number): string => {
        const tier = getRankTier(rank);
        if (tier === 'top') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        if (tier === 'mid') return 'bg-amber-100 text-amber-800 border-amber-200';
        return 'bg-red-100 text-red-800 border-red-200';
    };

    const isAlreadyInPipeline = (business: RankedBusiness): boolean => {
        return existingLeads.some(
            l => l.name.toLowerCase() === business.name.toLowerCase() ||
                (business.placeId && l.id === business.placeId)
        );
    };

    const handleAddToPipeline = (business: RankedBusiness) => {
        const uniqueString = `${business.name}-${business.address || business.website || ''}`;
        const deterministicId = business.placeId || `biz-${btoa(uniqueString).substring(0, 16)}`;

        const newLead: Business = {
            id: deterministicId,
            name: business.name,
            address: business.address,
            category: keyword,
            rating: business.rating || 0,
            reviewCount: business.reviewCount || 0,
            phone: business.phone || '',
            website: business.website,
            status: 'new',
            qualityScore: Math.max(20, 100 - business.rank), // Lower rank = higher opportunity score
            digitalScore: 50,
            seoScore: Math.max(10, 100 - (business.rank * 2)), // Rough SEO score based on rank
            socialScore: 50,
            estimatedValue: 2000 + Math.floor(Math.random() * 3000),
            searchQuery: keyword,
            searchLocation: city,
        };

        onAddLead(newLead);
    };

    const filteredResults = result?.results.filter(r => {
        if (filterTier === 'all') return true;
        return getRankTier(r.rank) === filterTier;
    }) || [];

    // Stats
    const topCount = result?.results.filter(r => r.rank <= 10).length || 0;
    const midCount = result?.results.filter(r => r.rank > 10 && r.rank <= 30).length || 0;
    const lowCount = result?.results.filter(r => r.rank > 30).length || 0;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Rank Tracker</h1>
                        <p className="text-slate-500 text-sm">Find where businesses rank in Google Maps — low-ranked = prime SEO prospects</p>
                    </div>
                </div>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Keyword</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                placeholder="e.g. med spa, dentist, hair salon"
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={city}
                                onChange={e => setCity(e.target.value)}
                                placeholder="e.g. Cape Town, South Africa"
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Max Results</label>
                        <select
                            value={maxResults}
                            onChange={e => setMaxResults(Number(e.target.value))}
                            className="w-full py-2.5 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={400}>400</option>
                            <option value={700}>700</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching || !keyword.trim() || !city.trim()}
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {isSearching ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Searching...
                            </span>
                        ) : 'Search Rankings'}
                    </button>
                </div>
            </form>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Loading State */}
            {isSearching && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center mb-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Searching Google Maps rankings...</p>
                    <p className="text-slate-400 text-sm mt-1">This can take 30-60 seconds for large searches</p>
                </div>
            )}

            {/* Results */}
            {result && !isSearching && (
                <>
                    {/* Stats Bar */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <button
                            onClick={() => setFilterTier('all')}
                            className={`p-4 rounded-xl border transition-all ${filterTier === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                        >
                            <p className="text-2xl font-bold">{result.totalResults}</p>
                            <p className={`text-xs ${filterTier === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>Total Results</p>
                        </button>
                        <button
                            onClick={() => setFilterTier('top')}
                            className={`p-4 rounded-xl border transition-all ${filterTier === 'top' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white border-slate-200 hover:border-emerald-300'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Trophy size={18} className={filterTier === 'top' ? 'text-emerald-200' : 'text-emerald-500'} />
                                <p className="text-2xl font-bold">{topCount}</p>
                            </div>
                            <p className={`text-xs ${filterTier === 'top' ? 'text-emerald-200' : 'text-slate-500'}`}>Rank #1-10</p>
                        </button>
                        <button
                            onClick={() => setFilterTier('mid')}
                            className={`p-4 rounded-xl border transition-all ${filterTier === 'mid' ? 'bg-amber-500 text-white border-amber-500 shadow-lg' : 'bg-white border-slate-200 hover:border-amber-300'}`}
                        >
                            <p className="text-2xl font-bold">{midCount}</p>
                            <p className={`text-xs ${filterTier === 'mid' ? 'text-amber-200' : 'text-slate-500'}`}>Rank #11-30</p>
                        </button>
                        <button
                            onClick={() => setFilterTier('low')}
                            className={`p-4 rounded-xl border transition-all ${filterTier === 'low' ? 'bg-red-500 text-white border-red-500 shadow-lg' : 'bg-white border-slate-200 hover:border-red-300'}`}
                        >
                            <div className="flex items-center gap-2">
                                <TrendingDown size={18} className={filterTier === 'low' ? 'text-red-200' : 'text-red-500'} />
                                <p className="text-2xl font-bold">{lowCount}</p>
                            </div>
                            <p className={`text-xs ${filterTier === 'low' ? 'text-red-200' : 'text-slate-500'}`}>Rank #31+ (Prospects!)</p>
                        </button>
                    </div>

                    {/* Info banner */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <BarChart3 size={20} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-indigo-800 text-sm font-medium">
                                Searched "{result.keyword}" in {result.city} — {result.totalResults} businesses found
                            </p>
                            <p className="text-indigo-600 text-xs mt-1">
                                {lowCount} businesses ranked #31+ are prime SEO prospects. They need help getting found!
                            </p>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-20">Rank</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Business</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-24">Rating</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-24">Reviews</th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-32">Website</th>
                                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase w-36">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredResults.map((biz) => {
                                    const alreadyAdded = isAlreadyInPipeline(biz);
                                    return (
                                        <tr key={biz.placeId || `${biz.name}-${biz.rank}`} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center justify-center w-10 h-7 rounded-md text-xs font-bold border ${getRankBadgeClasses(biz.rank)}`}>
                                                    #{biz.rank}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-slate-900 text-sm">{biz.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{biz.address}</p>
                                            </td>
                                            <td className="py-3 px-4">
                                                {biz.rating ? (
                                                    <span className="text-sm text-slate-700">
                                                        ⭐ {biz.rating.toFixed(1)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">N/A</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-sm text-slate-600">{biz.reviewCount || 0}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {biz.website ? (
                                                    <a
                                                        href={biz.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1"
                                                    >
                                                        <ExternalLink size={12} />
                                                        Visit
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-slate-400">None</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {alreadyAdded ? (
                                                    <span className="text-xs text-emerald-600 font-medium">✓ In Pipeline</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAddToPipeline(biz)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
                                                    >
                                                        <Plus size={12} />
                                                        Add to Pipeline
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {filteredResults.length === 0 && (
                            <div className="p-12 text-center text-slate-400">
                                <p className="text-sm">No results for this filter tier.</p>
                            </div>
                        )}
                    </div>

                    {/* Footer info */}
                    <p className="text-xs text-slate-400 mt-4 text-center">
                        Data from Google Maps via DataForSEO • Searched at {new Date(result.searchedAt).toLocaleString()}
                        {result.cost !== undefined && ` • Cost: $${result.cost.toFixed(4)}`}
                    </p>
                </>
            )}

            {/* Empty State */}
            {!result && !isSearching && !error && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 size={28} className="text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Search Google Maps Rankings</h3>
                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                        Enter a keyword and city to see how businesses rank. Businesses ranked #31+ are prime SEO prospects —
                        they need help getting found by customers.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {['med spa', 'dentist', 'hair salon', 'personal trainer'].map(q => (
                            <button
                                key={q}
                                onClick={() => setKeyword(q)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-slate-200 transition-colors"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RankTracker;
