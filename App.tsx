import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BusinessSearch from './pages/BusinessSearch';
import PipelineSearch from './pages/PipelineSearch';
import ClientDashboard from './pages/ClientDashboard';
import Topbar from './components/Topbar';
import { useProject } from './context/ProjectContext';
import { Business } from './types';
import { discoverBusinesses, enrichBusiness, loadBusinessesFromDB, syncBusinessesToDB, saveBusinessToDB, updateBusinessInDB, searchRankings, saveRankings } from './services/backendApi';

// LocalStorage backup removed to prevent dual-sync crashes
// Supabase is now the single source of truth

const App = () => {
  // Search Store (Global State to survive navigation)
  const [searchResults, setSearchResults] = useState<Business[]>([]);

  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Leads Store (Unified)
  const leads = searchResults;
  const setLeads = setSearchResults;

  // MERGE data from ALL sources on startup AND when active project changes
  const { activeProject } = useProject();

  useEffect(() => {
    if (!activeProject) return; // Wait until project context is ready

    const loadData = async () => {
      setIsLoading(true);
      try {
        console.log(`[App] Loading businesses from Supabase for project: ${activeProject.name}`);
        const dbBusinesses = await loadBusinessesFromDB(activeProject.id);
        console.log(`[App] Found ${dbBusinesses.length} businesses in Supabase`);
        
        setSearchResults(dbBusinesses);
        setDbError(null);
      } catch (error: any) {
        console.error('[App] Failed to load from Supabase:', error);
        setDbError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [activeProject]);

  // NOTE: localStorage dual-sync and auto-sync removed.
  // We prefer explicit saves or backend native persisting to avoid state corruption headers.

  // Manual sync function (for "Sync to DB" button)
  const syncToSupabase = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncBusinessesToDB(searchResults);
      console.log(`[App] Manual sync complete: ${result.saved} saved, ${result.failed} failed`);
      alert(`✅ Synced ${result.saved} businesses to Supabase!`);
      setDbError(null);
    } catch (error: any) {
      console.error('[App] Manual sync failed:', error);
      alert(`❌ Sync failed: ${error.message}`);
      setDbError(error.message);
    } finally {
      setIsSyncing(false);
    }
  }, [searchResults]);

  // Lead Actions
  const addLead = (business: Business) => {
    setLeads(prev => {
      if (prev.find(l => l.id === business.id)) return prev;
      return [...prev, { ...business, status: 'new' }];
    });
  };

  const updateLeadStatus = (id: string, status: Business['status']) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const updateBusiness = (id: string, data: Partial<Business>) => {
    console.log(`[Persistence] Updating business ${id}:`, data);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
    // Also update in Supabase immediately for important fields
    updateBusinessInDB(id, data).catch(e => console.error('[DB Update] Failed:', e));
  };

  const getBusiness = (id: string) => leads.find(l => l.id === id);

  // Search Actions (Global)
  const performSearch = async (query: string, location: string, count: number) => {
    setIsSearching(true);
    try {
      const discovered = await discoverBusinesses(query, location, count);

      // Map to Business type
      const mapped: Business[] = discovered.map((d, i) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        // Use crypto.randomUUID() for everything initially to ensure DB compatibility.
        // We could use d.placeId if it were a UUID, but it isn't.
        const leadId = crypto.randomUUID();

        return {
          id: leadId,
          name: d.name,
          address: d.address,
          category: d.category || query,
          rating: d.rating,
          reviewCount: d.reviewCount,
          phone: d.phone,
          website: d.website,
          logoUrl: d.imageUrl || undefined,
          status: 'new' as const,
          qualityScore: Math.floor(70 + Math.random() * 30),
          digitalScore: 50,
          seoScore: 50,
          socialScore: 50,
          estimatedValue: 2000 + Math.floor(Math.random() * 3000),
          searchQuery: query,
          searchLocation: location,
          source: 'apify_search',
          projectId: activeProject?.id
        };
      });

      setSearchResults(prev => {
        // Smart Deduplication: Check ID, Name, or Website
        const existingIds = new Set(prev.map(p => p.id));
        const existingNames = new Set(prev.map(p => p.name.toLowerCase()));

        const newResults = mapped.filter(m => {
          if (existingIds.has(m.id)) return false;
          // Also block if name matches exactly (prevent same shop, different ID glitch)
          if (existingNames.has(m.name.toLowerCase())) return false;
          return true;
        });

        return [...prev, ...newResults];
      });
      return mapped;
    } catch (e) {
      console.error("Search failed in App", e);
      throw e;
    } finally {
      setIsSearching(false);
    }
  };

  // DataForSEO Search
  const performRankSearch = async (keyword: string, location: string, count: number) => {
    if (!activeProject) {
      alert("Please create or select a project first.");
      return [];
    }

    setIsSearching(true);
    setDbError(null);
    try {
      const data = await searchRankings(keyword, location, count);
      // Fire and forget save to DB History
      saveRankings(keyword, location, data.results).catch(err => console.error("History save failed", err));

      // Map to Business type
      const newBusinesses: Business[] = data.results.map(biz => {
        const uniqueString = `${biz.name}-${biz.address || biz.website || ''}`;
        const deterministicId = biz.placeId || `biz-${btoa(uniqueString).substring(0, 16)}`;

        return {
          id: deterministicId,
          name: biz.name,
          address: biz.address || 'Unknown',
          category: keyword,
          rating: biz.rating || 0,
          reviewCount: biz.reviewCount || 0,
          phone: biz.phone || '',
          website: biz.website,
          status: 'new',
          qualityScore: Math.max(20, 100 - biz.rank),
          digitalScore: 50,
          seoScore: Math.max(10, 100 - (biz.rank * 2)),
          socialScore: 50,
          estimatedValue: 2000 + Math.floor(Math.random() * 3000),
          searchQuery: keyword,
          searchLocation: location,
          source: 'rank_tracker',
          rank: biz.rank,
          projectId: activeProject.id
        };
      });

      // Inject all into global results
      setSearchResults(prev => {
        const combined = [...newBusinesses, ...prev];
        const uniqueMap = new Map();
        combined.forEach(item => {
          if (!uniqueMap.has(item.id)) {
            uniqueMap.set(item.id, item);
          }
        });
        return Array.from(uniqueMap.values());
      });

      return newBusinesses;
    } catch (error: any) {
      console.error('Rank Search Error:', error);
      setDbError(error.message || 'Rank search failed');
      throw error;
    } finally {
      setIsSearching(false);
    }
  };

  const updateSearchResult = (id: string, partial: Partial<Business>) => {
    setSearchResults(prev => prev.map(r => r.id === id ? { ...r, ...partial } : r));
    // Also update in Supabase
    updateBusinessInDB(id, partial).catch(e => console.error('[DB Update] Failed:', e));
  };


  const clearSearchResults = () => {
    setSearchResults([]);
  };

  const handleDeduplicate = () => {
    setSearchResults(prev => {
      const uniqueMap = new Map();
      prev.forEach(p => {
        const key = `${p.name.toLowerCase()}|${(p.address || '').substring(0, 10)}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, p);
        }
      });
      return Array.from(uniqueMap.values());
    });
  };

  const injectSearchResult = (business: Business) => {
    setSearchResults(prev => [business, ...prev]);
  };

  // Show loading state ONLY if we have no data at all (waiting for initial fetch)
  if (isLoading && searchResults.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50 flex-col md:flex-row pb-16 md:pb-0">
        <Sidebar />
        <main className="md:ml-64 flex-1 flex flex-col overflow-hidden h-screen w-full relative">
          <Topbar />

          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            {/* DB Status Bar */}
            {dbError && (
              <div className="bg-red-100 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
                <span>⚠️ Database error: {dbError}.</span>
                <button onClick={() => window.location.reload()} className="text-red-800 underline hover:no-underline">
                  Reload Data
                </button>
              </div>
            )}

            <Routes>
              <Route path="/" element={
                <BusinessSearch
                  onAddLead={addLead}
                  existingLeads={leads}
                  results={searchResults}
                  isSearching={isSearching}
                  onSearch={performSearch}
                  onRankSearch={performRankSearch}
                  onUpdateResult={updateSearchResult}
                  onInjectResult={injectSearchResult}
                  onClear={clearSearchResults}
                  onDeduplicate={handleDeduplicate}
                  onSyncToDb={syncToSupabase}
                  isSyncing={isSyncing}
                />
              } />
              <Route path="/clients" element={
                <ClientDashboard
                   leads={searchResults}
                   onUpdateClient={updateSearchResult}
                />
              } />
              <Route path="/pipeline" element={<PipelineSearch initialResults={searchResults} projectId={activeProject?.id} onUpdateResult={updateSearchResult} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;