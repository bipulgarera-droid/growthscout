import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BusinessSearch from './pages/BusinessSearch';
import LeadBoard from './pages/LeadBoard';
import AnalysisList from './pages/AnalysisList';
import AnalysisDetail from './pages/AnalysisDetail';
import RankTracker from './pages/RankTracker';
import { Business } from './types';
import { discoverBusinesses, enrichBusiness, loadBusinessesFromDB, syncBusinessesToDB, saveBusinessToDB, updateBusinessInDB } from './services/backendApi';

// LocalStorage keys (kept as fallback)
const LEADS_STORAGE_KEY = 'growthscout_leads';
const SEARCH_RESULTS_STORAGE_KEY = 'growthscout_search_results';

// Default lead for demo
const DEFAULT_LEADS: Business[] = [
  {
    id: 'lead-1',
    name: 'Shawn Paul Salon',
    address: '2000 Example Rd, Cleveland, OH',
    category: 'Hair Salon',
    rating: 4.8,
    reviewCount: 420,
    phone: '216-555-1234',
    status: 'contacted',
    qualityScore: 92,
    digitalScore: 80,
    seoScore: 65,
    socialScore: 85,
    estimatedValue: 3500,
    isQualified: true,
    redesignImageUrl: 'https://images.unsplash.com/photo-1560060141-7b9018741ced?q=80&w=2938&auto=format&fit=crop'
  }
];

// Helper to load/save localStorage (fallback)
const loadFromStorage = <T,>(key: string, defaultVal: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
  }
  return defaultVal;
};

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
  }
};

const App = () => {
  // Search Store (Global State to survive navigation)
  const [searchResults, setSearchResults] = useState<Business[]>(() => {
    // 1. Recover from Search Results Storage
    const localSearch = loadFromStorage<Business[]>(SEARCH_RESULTS_STORAGE_KEY, []);
    // 2. Recover from Leads Storage (Pipeline)
    const localLeads = loadFromStorage<Business[]>(LEADS_STORAGE_KEY, []);

    // Merge immediately on startup to prevent flash of empty content
    const combined = [...localSearch];
    const ids = new Set(localSearch.map(b => b.id));

    localLeads.forEach(l => {
      if (!ids.has(l.id)) {
        combined.push(l);
        ids.add(l.id);
      }
    });

    return combined;
  });

  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Leads Store (Unified)
  const leads = searchResults;
  const setLeads = setSearchResults;

  // MERGE data from ALL sources on startup
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Get ALL LocalStorage Data again (Source of Truth)
        const localSearch = loadFromStorage<Business[]>(SEARCH_RESULTS_STORAGE_KEY, []);
        const localLeads = loadFromStorage<Business[]>(LEADS_STORAGE_KEY, []);

        console.log(`[App] Storage Report: ${localSearch.length} search results, ${localLeads.length} pipeline leads`);

        // 2. Load from Supabase
        console.log('[App] Loading businesses from Supabase...');
        const dbBusinesses = await loadBusinessesFromDB();
        console.log(`[App] Found ${dbBusinesses.length} businesses in Supabase`);

        // 3. MASTER MERGE strategy
        // Priority: Local updates > DB updates (for now), but we want UNION of all
        const masterMap = new Map<string, Business>();

        // Add DB items first
        dbBusinesses.forEach(b => masterMap.set(b.id, b));

        // Overlay Local Search Results (preserves recent searches)
        localSearch.forEach(b => masterMap.set(b.id, b));

        // Overlay Local Leads (preserves pipeline status)
        localLeads.forEach(b => masterMap.set(b.id, b));

        const merged = Array.from(masterMap.values());
        console.log(`[App] Master Merge Total: ${merged.length} unique businesses`);

        setSearchResults(merged);

        // 4. Auto-Sync missing items to Supabase
        // If we have more items in memory than came from DB, we need to push updates
        const memoryCount = localSearch.length + localLeads.length;
        if (memoryCount > 0 && merged.length > dbBusinesses.length) {
          console.log(`[App] Auto-syncing merged data (${merged.length} items) to Supabase...`);
          await syncBusinessesToDB(merged);
        }

        setDbError(null);
      } catch (error: any) {
        console.error('[App] Failed to load/sync from Supabase:', error);
        setDbError(error.message);
        // We already loaded local data in useState initializer, so we're good
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // NOTE: localStorage backup removed - now only used as fallback when Supabase fails
  // This prevents localStorage from filling up with large screenshot data

  // Supabase-first sync with localStorage fallback
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    if (searchResults.length === 0 || isLoading) return;

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce: sync after 2 seconds of no changes
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`[App] Auto-syncing ${searchResults.length} businesses to Supabase...`);
        await syncBusinessesToDB(searchResults);
        console.log('[App] Auto-sync complete');
        setOfflineMode(false); // Supabase is working, clear offline mode
        setDbError(null);
      } catch (error: any) {
        console.error('[App] Auto-sync failed, falling back to localStorage:', error);
        // FALLBACK: Only save to localStorage when Supabase fails
        try {
          saveToStorage(SEARCH_RESULTS_STORAGE_KEY, searchResults);
          console.log('[App] Saved to localStorage as fallback');
        } catch (storageError) {
          console.error('[App] localStorage fallback also failed:', storageError);
        }
        setOfflineMode(true);
        setDbError(error.message);
      }
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [searchResults, isLoading]);

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
        // Deterministic ID generation to prevent duplicates
        const uniqueString = `${d.name}-${d.address || d.website || ''}`;
        const deterministicId = d.placeId || `biz-${btoa(uniqueString).substring(0, 16)}`;

        return {
          id: deterministicId,
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

  const updateSearchResult = (id: string, data: Partial<Business>) => {
    setSearchResults(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    // Also update in Supabase
    updateBusinessInDB(id, data).catch(e => console.error('[DB Update] Failed:', e));
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
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="ml-64 flex-1 overflow-x-hidden">
          {/* DB Status Bar */}
          {dbError && (
            <div className="bg-red-100 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
              <span>⚠️ Database error: {dbError}. Using local storage.</span>
              <button onClick={syncToSupabase} className="text-red-800 underline hover:no-underline">
                Retry Sync
              </button>
            </div>
          )}

          {/* DEBUG: Storage Status Banner */}
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-800 font-mono flex items-center justify-between">
            <span>
              📊 DEBUG: LocalStorage Status |
              search_results: {(() => {
                try {
                  const val = localStorage.getItem('growthscout_search_results');
                  return val ? JSON.parse(val).length : 0;
                } catch { return 'ERROR'; }
              })()} items |
              leads: {(() => {
                try {
                  const val = localStorage.getItem('growthscout_leads');
                  return val ? JSON.parse(val).length : 0;
                } catch { return 'ERROR'; }
              })()} items |
              In Memory: {searchResults.length} items
            </span>
            <button
              onClick={syncToSupabase}
              disabled={isSyncing}
              className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700 disabled:opacity-50"
            >
              {isSyncing ? '⏳ Syncing...' : '🔄 Sync to DB'}
            </button>
          </div>

          <Routes>
            <Route path="/" element={
              <BusinessSearch
                onAddLead={addLead}
                existingLeads={leads}
                results={searchResults}
                isSearching={isSearching}
                onSearch={performSearch}
                onUpdateResult={updateSearchResult}
                onInjectResult={injectSearchResult}
                onClear={clearSearchResults}
                onDeduplicate={handleDeduplicate}
                onSyncToDb={syncToSupabase}
                isSyncing={isSyncing}
              />
            } />
            <Route path="/rankings" element={
              <RankTracker
                onAddLead={addLead}
                existingLeads={leads}
              />
            } />
            <Route path="/leads" element={<LeadBoard leads={leads} updateStatus={updateLeadStatus} updateBusiness={updateBusiness} />} />
            <Route path="/analyses" element={<AnalysisList businesses={leads} />} />
            <Route path="/analysis/:id" element={<AnalysisDetail getBusiness={getBusiness} onUpdateBusiness={updateBusiness} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;