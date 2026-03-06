import React, { useState } from 'react';
import { Search, MapPin, Filter, Download, ExternalLink, RefreshCw, Smartphone, Mail, Linkedin, Instagram, Eye, UserPlus, X, User, Save, Check, PlusCircle } from 'lucide-react';
import { Business } from '../types';
import { useNavigate } from 'react-router-dom';
import { enrichBusiness, bulkAnalyze, bulkGenerateMessages, bulkSendOutreach, analyzeWebsite, generateWebsite, bulkGenerateWebsites, addManualLead, bulkVerifyWhatsApp, AnalysisResult, OutreachMessages } from '../services/backendApi';

interface BusinessSearchProps {
  onAddLead: (b: Business) => void;
  existingLeads: Business[];
  results: Business[]; // From Global Store
  isSearching: boolean; // From Global Store
  onSearch: (query: string, location: string, count: number) => Promise<any>;
  onRankSearch: (query: string, location: string, count: number) => Promise<any>;
  onUpdateResult: (id: string, data: Partial<Business>) => void;
  onInjectResult: (b: Business) => void;
  onClear: () => void;
  onDeduplicate: () => void;
  onSyncToDb?: () => Promise<void>;
  isSyncing?: boolean;
}

const BusinessSearch: React.FC<BusinessSearchProps> = ({
  onAddLead,
  existingLeads,
  results,
  isSearching,
  onSearch,
  onRankSearch,
  onUpdateResult,
  onInjectResult,
  onClear,
  onDeduplicate,
  onSyncToDb,
  isSyncing = false
}) => {
  const [resultCount, setResultCount] = useState(5);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [searchCategory, setSearchCategory] = useState<string>(''); // Used to be Hair Salon, but empty is better for user flow
  const [searchSource, setSearchSource] = useState<'apify' | 'rank_tracker'>('apify');
  const [sortBy, setSortBy] = useState<'default' | 'rank_asc' | 'rank_desc' | 'rating_desc' | 'rating_asc' | 'reviews_desc' | 'reviews_asc'>('default');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Operation States
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isBulkBuilding, setIsBulkBuilding] = useState(false);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isBulkVerifyingWA, setIsBulkVerifyingWA] = useState(false);

  // Modal State
  const [selectedContact, setSelectedContact] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<'contact' | 'analysis' | 'outreach' | 'website'>('contact');
  const [isModalActionLoading, setIsModalActionLoading] = useState(false);

  // Manual Add State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualInput, setManualInput] = useState({ url: '', name: '', city: '' });
  const [isManualAdding, setIsManualAdding] = useState(false);

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    cityFilter: string;
    stateFilter: string;
    category: string;
    hasWebsite: boolean;
    websiteNotCreated: boolean;
    contactsNurtured: boolean;
    contactsNotNurtured: boolean;
    hasScreenshots: boolean;
    analyzed: boolean;
    emailsGenerated: boolean;
    qualifiedOnly: boolean;
    whatsappVerifiedOnly: boolean;
    contactedOnly: boolean;
    notContactedOnly: boolean;
    rankFilter: 'all' | 'top10' | '11plus';
  }>({
    cityFilter: '',
    stateFilter: '',
    category: '',
    hasWebsite: false,
    websiteNotCreated: false,
    contactsNurtured: false,
    contactsNotNurtured: false,
    hasScreenshots: false,
    analyzed: false,
    emailsGenerated: false,
    qualifiedOnly: false,
    whatsappVerifiedOnly: false,
    contactedOnly: false,
    notContactedOnly: false,
    rankFilter: 'all',
  });

  const navigate = useNavigate();

  // Bulk Analyze Handler
  const handleBulkAnalyze = async () => {
    const selected = results.filter(r => selectedIds.has(r.id) && r.website);
    if (selected.length === 0) {
      alert('No businesses with websites selected');
      return;
    }
    setIsBulkAnalyzing(true);
    try {
      const leads = selected.map(r => ({ id: r.id, url: r.website!, name: r.name }));
      const analysisResults = await bulkAnalyze(leads);

      // Update each result with analysis data
      for (const [id, analysis] of Object.entries(analysisResults)) {
        // Create readable summary from sales bullets
        const summary = analysis.analysisBullets && analysis.analysisBullets.length > 0
          ? `**Why Re-Design?**\n${analysis.analysisBullets.join('\n')}` // Already has bullets in string
          : 'No analysis available.';

        onUpdateResult(id, {
          // Scores - prioritizing Mobile Performance for seoScore
          qualityScore: analysis.overallScore,
          digitalScore: analysis.designScore,
          seoScore: analysis.pageSpeed.mobile.performance,

          // Detailed PageSpeed
          pageSpeedMobile: analysis.pageSpeed.mobile.performance,
          pageSpeedDesktop: analysis.pageSpeed.desktop.performance,

          // Sales Analysis
          analysisBullets: analysis.analysisBullets,

          // Screenshot (save just base64, UI adds prefix)
          originalScreenshot: analysis.screenshotBase64 || undefined,

          // Qualification
          isQualified: analysis.isQualified,

          // Audit result structure
          auditResult: {
            isBadDesign: analysis.designScore > 60,
            qualificationReason: analysis.designScore > 60
              ? `Qualify Score ${analysis.designScore}/100 - Highly Outdated (Qualified)`
              : `Qualify Score ${analysis.designScore}/100 - Modern/Stylized (Unqualified)`,
            designFlaws: [], // Deprecated in favor of bullets
            brandAssetsDetected: [], // Deprecated
            summary,
            actionItems: []
          },
        });
      }
      alert(`Analyzed ${Object.keys(analysisResults).length} websites!`);
    } catch (e: any) {
      alert('Analysis failed: ' + e.message);
    } finally {
      setIsBulkAnalyzing(false);
    }
  };

  // Bulk Generate Handler
  const handleBulkGenerate = async () => {
    const selected = results.filter(r => selectedIds.has(r.id) && r.website);
    if (selected.length === 0) {
      alert('No businesses with websites selected');
      return;
    }
    setIsBulkGenerating(true);
    try {
      const leads = selected.map(r => ({
        businessName: r.name,
        contactName: r.founderName,
        websiteUrl: r.website || '',
        previewUrl: r.previewSiteUrl || `https://medspa-website.vercel.app/preview/${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        speedScore: r.seoScore,
        flaws: []
      }));
      const messageResults = await bulkGenerateMessages(leads);

      // Update each result with messages
      for (const [name, messages] of Object.entries(messageResults)) {
        const biz = selected.find(s => s.name === name);
        if (biz) {
          onUpdateResult(biz.id, {
            outreachMessages: messages
          } as any);
        }
      }
      alert(`Generated messages for ${Object.keys(messageResults).length} businesses!`);
    } catch (e: any) {
      alert('Message generation failed: ' + e.message);
    } finally {
      setIsBulkGenerating(false);
    }
  };

  // Bulk Create Websites Handler
  const handleBulkCreateWebsites = async () => {
    const selected = results.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) {
      alert('No businesses selected');
      return;
    }
    setIsBulkBuilding(true);
    try {
      const leads = selected.map(r => ({
        id: r.id,
        businessName: r.name,
        phone: r.phone,
        email: r.email,
        contactEmail: r.contactEmail,
        address: r.address,
        logoUrl: r.logoUrl,
        website: r.website
      }));

      const buildResults = await bulkGenerateWebsites(leads);

      // Update results
      for (const [name, result] of Object.entries(buildResults)) {
        if (result.success) {
          const biz = selected.find(s => s.name === name);
          if (biz) {
            onUpdateResult(biz.id, {
              previewSiteUrl: result.previewUrl
            } as any);
          }
        }
      }
      alert(`Websites created for ${Object.keys(buildResults).length} leads!`);
    } catch (e: any) {
      alert('Bulk build failed: ' + e.message);
    } finally {
      setIsBulkBuilding(false);
    }
  };

  // Bulk Send Handler
  const handleBulkSend = async () => {
    const selected = results.filter(r => selectedIds.has(r.id) && r.outreachMessages);
    if (selected.length === 0) {
      alert('No businesses with generated messages selected. Run "Generate" first.');
      return;
    }

    if (!window.confirm(`Send outreach to ${selected.length} leads? This will mark them as Contacted.`)) {
      return;
    }

    setIsBulkSending(true);
    try {
      const leadIds = selected.map(r => r.id);
      await bulkSendOutreach(leadIds, 'email');

      // Update status locally
      leadIds.forEach(id => {
        onUpdateResult(id, { status: 'contacted' });
      });

      alert(`Sent outreach to ${selected.length} leads!`);
    } catch (e: any) {
      alert('Failed to send outreach: ' + e.message);
    } finally {
      setIsBulkSending(false);
    }
  };

  // Bulk Verify WhatsApp Handler
  const handleBulkVerifyWA = async () => {
    const selected = results.filter(r => selectedIds.has(r.id) && r.phone);
    if (selected.length === 0) {
      alert('No businesses with phone numbers selected');
      return;
    }
    setIsBulkVerifyingWA(true);
    try {
      const leadsPayload = selected.map(r => ({
        id: r.id,
        phone: r.phone as string,
        location: r.searchLocation || r.address
      }));
      const validationResults = await bulkVerifyWhatsApp(leadsPayload);

      for (const [id, isValid] of Object.entries(validationResults)) {
        onUpdateResult(id, { whatsappVerified: isValid });
      }
      alert(`Verified WhatsApp for ${Object.keys(validationResults).length} numbers!`);
    } catch (e: any) {
      alert('Verify WA failed: ' + e.message);
    } finally {
      setIsBulkVerifyingWA(false);
    }
  };

  // Manual Add Handler (Client-Side Only)
  const handleManualAdd = () => {
    if (!manualInput.url) {
      alert('URL is required');
      return;
    }

    try {
      let hostname = manualInput.url;
      try { hostname = new URL(manualInput.url).hostname; } catch (e) { }

      const name = manualInput.name || hostname.replace('www.', '');

      const newLead: Business = {
        id: `manual-${Date.now()}`,
        name: name,
        address: manualInput.city || 'Unknown Location',
        website: manualInput.url,
        phone: '',
        category: 'Manual Lead',
        status: 'new',
        rating: 0,
        reviewCount: 0,
        logoUrl: undefined,
        qualityScore: 0,
        digitalScore: 0,
        seoScore: 0,
        socialScore: 0,
        estimatedValue: 0,
        isQualified: false,
        auditResult: undefined,
        previewSiteUrl: undefined,
        outreachMessages: undefined
      };

      onInjectResult(newLead);
      setIsManualModalOpen(false);
      setManualInput({ url: '', name: '', city: '' });

    } catch (e: any) {
      alert('Invalid URL');
    }
  };

  // Search execution from manual trigger
  const handleSearchClick = async () => {
    // Build search query from inputs
    const cityInput = (document.getElementById('city-input') as HTMLInputElement)?.value;
    const stateInput = (document.getElementById('state-input') as HTMLInputElement)?.value || 'OH';

    // Logic: If city is provided, use "City, State". If completely empty, use just "State".
    // If state is also empty (unlikely with default), it relies on query.
    const locationStr = cityInput && cityInput.trim().length > 0
      ? `${cityInput}, ${stateInput}`
      : stateInput;

    try {
      if (searchSource === 'apify') {
        await onSearch(searchCategory, locationStr, resultCount);
      } else {
        await onRankSearch(searchCategory, locationStr, resultCount);
      }
      setSelectedIds(new Set()); // Reset selection on new search
    } catch (e) {
      // Error handled in App.tsx
    }
  };

  const handleClear = () => {
    if (window.confirm("Clear all search results?")) {
      onClear();
      setSelectedIds(new Set());
    }
  };

  const handleFindFounder = async (biz: Business) => {
    setEnrichingId(biz.id);
    try {
      const data = await enrichBusiness(biz.name, biz.address, biz.website);

      // Update Result in Global Store
      onUpdateResult(biz.id, {
        founderName: data.founderName || 'Not Found',
        linkedin: data.linkedin || biz.linkedin,
        contactEmail: data.email || biz.contactEmail,
        instagram: data.instagram || biz.instagram,
        phone: data.phone || biz.phone,
        address: data.address || biz.address,
      });

      // Also update the modal view if it's the same business
      if (selectedContact && selectedContact.id === biz.id) {
        setSelectedContact({
          ...selectedContact,
          founderName: data.founderName || 'Not Found',
          linkedin: data.linkedin || biz.linkedin,
          contactEmail: data.email || biz.contactEmail,
          instagram: data.instagram || biz.instagram,
          phone: data.phone || biz.phone,
          address: data.address || biz.address,
        });
      }

    } catch (e) {
      console.error('Enrichment failed:', e);
      alert('Find Founder failed. Check if Serper API key is set.');
    } finally {
      setEnrichingId(null);
    }
  };

  const isAlreadyLead = (id: string) => existingLeads.some(l => l.id === id);



  // Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(sortedResults.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSaveSelected = async () => {
    const selectedBusinesses = results.filter(r => selectedIds.has(r.id));

    // Process one by one (or Promise.all)
    for (const biz of selectedBusinesses) {
      if (!isAlreadyLead(biz.id)) {
        onAddLead(biz);
      }
    }
  };


  // derived unique categories
  const uniqueCategories = Array.from(new Set(results.map(b => b.category || b.searchQuery).filter(Boolean))).sort();

  // Primary filtering pipeline
  const filteredResults = results.filter(business => {
    // 1. Source filter (CRITICAL)
    if (searchSource === 'apify' && business.source === 'rank_tracker') return false;
    if (searchSource === 'rank_tracker' && business.source !== 'rank_tracker') return false;

    // Search Category input
    if (searchCategory && !business.category?.toLowerCase().includes(searchCategory.toLowerCase()) && !business.searchQuery?.toLowerCase().includes(searchCategory.toLowerCase())) return false;

    // Explicit Location Filters (From Filter Panel)
    if (activeFilters.cityFilter && business.address.toLowerCase().indexOf(activeFilters.cityFilter.toLowerCase()) === -1) return false;
    if (activeFilters.stateFilter && business.address.toLowerCase().indexOf(activeFilters.stateFilter.toLowerCase()) === -1) return false;

    // Category filter: Must match 'category' or 'searchQuery'
    if (activeFilters.category &&
      business.category !== activeFilters.category &&
      business.searchQuery !== activeFilters.category) return false;

    // Check if selected (Sticky Selection for Workflow Filters)
    const isSelected = selectedIds.has(business.id);

    // Website created filter
    if (activeFilters.hasWebsite && !business.previewSiteUrl && !isSelected) return false;

    // Website NOT created filter
    if (activeFilters.websiteNotCreated && business.previewSiteUrl && !isSelected) return false;

    // Contacts nurtured filter
    if (activeFilters.contactsNurtured && !business.outreachMessages && !isSelected) return false;

    // Contacts NOT nurtured filter
    if (activeFilters.contactsNotNurtured && business.outreachMessages && !isSelected) return false;

    // Screenshots filter
    if (activeFilters.hasScreenshots && !business.originalScreenshot) return false;

    // PageSpeed analyzed filter
    if (activeFilters.analyzed && !business.auditResult) return false;

    // Emails generated filter
    if (activeFilters.emailsGenerated && !business.outreachMessages?.email) return false;

    // Qualify Score filter (60+)
    if (activeFilters.qualifiedOnly && (business.digitalScore || 0) < 60) return false;

    // Verified WhatsApp filter
    if (activeFilters.whatsappVerifiedOnly && business.whatsappVerified !== true) return false;

    // Contacted Only filter
    if (activeFilters.contactedOnly && business.isContacted !== true) return false;

    // NOT Contacted Only filter
    if (activeFilters.notContactedOnly && business.isContacted === true) return false;

    // Rank tier filter (Rank Target source only)
    if (searchSource === 'rank_tracker') {
      if (activeFilters.rankFilter === 'top10') {
        if (!business.rank || business.rank > 10) return false;
      }
      if (activeFilters.rankFilter === '11plus') {
        if (!business.rank || business.rank <= 10) return false;
      }
    }

    return true;
  });

  // Apply Sorting
  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortBy === 'rank_asc') {
      return (a.rank ?? 999) - (b.rank ?? 999); // Ascending (1 to 100)
    }
    if (sortBy === 'rank_desc') {
      return (b.rank ?? -1) - (a.rank ?? -1); // Descending (100 to 1)
    }
    if (sortBy === 'rating_desc') {
      return (b.rating || 0) - (a.rating || 0); // Descending (5 to 1)
    }
    if (sortBy === 'rating_asc') {
      return (a.rating || 0) - (b.rating || 0); // Ascending (1 to 5)
    }
    if (sortBy === 'reviews_desc') {
      return (b.reviewCount || 0) - (a.reviewCount || 0); // Descending (Most to Least)
    }
    if (sortBy === 'reviews_asc') {
      return (a.reviewCount || 0) - (b.reviewCount || 0); // Ascending (Least to Most)
    }
    return 0; // Default
  });

  // Selection state (must be after filteredResults)
  const allSelected = sortedResults.length > 0 && selectedIds.size === sortedResults.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < sortedResults.length;

  // Count active filters
  const activeFilterCount =
    (activeFilters.category ? 1 : 0) +
    (activeFilters.cityFilter ? 1 : 0) +
    (activeFilters.stateFilter ? 1 : 0) +
    (activeFilters.hasWebsite ? 1 : 0) +
    (activeFilters.websiteNotCreated ? 1 : 0) +
    (activeFilters.contactsNurtured ? 1 : 0) +
    (activeFilters.contactsNotNurtured ? 1 : 0) +
    (activeFilters.hasScreenshots ? 1 : 0) +
    (activeFilters.analyzed ? 1 : 0) +
    (activeFilters.emailsGenerated ? 1 : 0) +
    (activeFilters.whatsappVerifiedOnly ? 1 : 0) +
    (activeFilters.contactedOnly ? 1 : 0) +
    (activeFilters.notContactedOnly ? 1 : 0) +
    (activeFilters.rankFilter !== 'all' ? 1 : 0);

  // Clear all filters
  const handleClearFilters = () => {
    setActiveFilters({
      cityFilter: '',
      stateFilter: '',
      category: '',
      hasWebsite: false,
      websiteNotCreated: false,
      contactsNurtured: false,
      contactsNotNurtured: false,
      hasScreenshots: false,
      analyzed: false,
      emailsGenerated: false,
      qualifiedOnly: false,
      whatsappVerifiedOnly: false,
      contactedOnly: false,
      notContactedOnly: false,
      rankFilter: 'all',
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Google Business Scraper</h1>
        <p className="text-slate-500">Search for businesses by location and category, then export data or add to CRM.</p>
      </div>

      {/* Search Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="bg-brand-100 p-2 rounded-lg text-brand-600">
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Prospecting Search</h3>
              <p className="text-sm text-slate-500">Find businesses locally</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setSearchSource('apify')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${searchSource === 'apify'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Apify (Broad)
            </button>
            <button
              onClick={() => setSearchSource('rank_tracker')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${searchSource === 'rank_tracker'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              DataForSEO (Rank Target)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input id="city-input" type="text" defaultValue="Cleveland" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Enter city name (Empty for Statewide)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
            <input id="state-input" type="text" defaultValue="OH" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none" placeholder="State code" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Business Category / Keyword</label>
            <input
              id="category-input"
              type="text"
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="e.g. Coffee Shop, Dentist, Plumber"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-6">
          <div className="flex items-center gap-4 w-1/2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Max Results</span>
              <select
                value={resultCount}
                onChange={(e) => setResultCount(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5"
              >
                <option value={3}>3 Results</option>
                <option value={5}>5 Results</option>
                <option value={10}>10 Results</option>
                <option value={20}>20 Results</option>
                <option value={50}>50 Results</option>
                <option value={100}>100 Results</option>
                <option value={200}>200 Results</option>
                <option value={400}>400 Results (Slow)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5"
              >
                <option value="default">Default</option>
                {searchSource === 'rank_tracker' && (
                  <>
                    <option value="rank_asc">SEO Rank (1 to 100)</option>
                    <option value="rank_desc">SEO Rank (100 to 1)</option>
                  </>
                )}
                <option value="rating_desc">Rating (High to Low)</option>
                <option value="rating_asc">Rating (Low to High)</option>
                <option value="reviews_desc">Reviews (Most to Least)</option>
                <option value="reviews_asc">Reviews (Least to Most)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClear}
              disabled={results.length === 0}
              className="text-slate-500 hover:text-red-600 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-30 disabled:hover:text-slate-500"
            >
              Clear Results
            </button>
            <button
              onClick={onDeduplicate}
              disabled={results.length === 0}
              className="text-slate-500 hover:text-brand-600 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-30 disabled:hover:text-slate-500 flex items-center gap-2"
            >
              <Check size={18} /> Dedupe
            </button>
            {onSyncToDb && (
              <button
                onClick={onSyncToDb}
                disabled={results.length === 0 || isSyncing}
                className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-30 flex items-center gap-2"
              >
                {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                {isSyncing ? 'Syncing...' : 'Sync to DB'}
              </button>
            )}
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <PlusCircle size={20} /> Add by URL
            </button>
            <button
              onClick={handleSearchClick}
              disabled={isSearching}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {isSearching ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
              {isSearching ? 'Searching...' : 'Search Businesses'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-800">Search Results {isSearching && '(Updating...)'}</h2>
              <span className="bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full">
                {sortedResults.length === results.length
                  ? `${results.length} businesses`
                  : `${sortedResults.length} of ${results.length} businesses`
                }
              </span>

            </div>
            <div className="flex gap-2">
              {/* Bulk Enrich Button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={async () => {
                    const selected = results.filter(r => selectedIds.has(r.id));
                    // Process sequentially or in parallel? Parallel is better for speed but might hit rate limits.
                    // Let's do parallel with Promise.all
                    await Promise.all(selected.map(biz => handleFindFounder(biz)));
                  }}
                  className="flex items-center gap-2 text-white bg-indigo-600 border border-indigo-600 px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 shadow-sm transition-colors animate-fade-in font-medium"
                >
                  <UserPlus size={16} /> Enrich
                </button>
              )}

              {/* Bulk Analyze Button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkAnalyze}
                  disabled={isBulkAnalyzing}
                  className="flex items-center gap-2 text-white bg-purple-600 border border-purple-600 px-4 py-2 rounded-lg text-sm hover:bg-purple-700 shadow-sm transition-colors animate-fade-in font-medium disabled:opacity-50"
                >
                  {isBulkAnalyzing ? <RefreshCw className="animate-spin" size={16} /> : <Eye size={16} />}
                  {isBulkAnalyzing ? 'Analyzing...' : 'Analyze'}
                </button>
              )}

              {/* Bulk Build Websites Button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkCreateWebsites}
                  disabled={isBulkBuilding}
                  className="flex items-center gap-2 text-white bg-blue-500 border border-blue-500 px-4 py-2 rounded-lg text-sm hover:bg-blue-600 shadow-sm transition-colors animate-fade-in font-medium disabled:opacity-50"
                >
                  {isBulkBuilding ? <RefreshCw className="animate-spin" size={16} /> : <Smartphone size={16} />}
                  {isBulkBuilding ? 'Building...' : 'Build Websites'}
                </button>
              )}

              {/* Bulk Verify WhatsApp Button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkVerifyWA}
                  disabled={isBulkVerifyingWA}
                  className="flex items-center gap-2 text-white font-medium bg-green-600 border border-green-600 px-4 py-2 rounded-lg text-sm hover:bg-green-700 shadow-sm transition-colors animate-fade-in disabled:opacity-50"
                >
                  {isBulkVerifyingWA ? <RefreshCw className="animate-spin" size={16} /> : <Smartphone size={16} />}
                  {isBulkVerifyingWA ? 'Verifying...' : 'Verify in Apify'}
                </button>
              )}

              {/* Bulk Generate Messages Button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkGenerate}
                  disabled={isBulkGenerating}
                  className="flex items-center gap-2 text-white bg-amber-600 border border-amber-600 px-4 py-2 rounded-lg text-sm hover:bg-amber-700 shadow-sm transition-colors animate-fade-in font-medium disabled:opacity-50"
                >
                  {isBulkGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Mail size={16} />}
                  {isBulkGenerating ? 'Generating...' : 'Generate Messages'}
                </button>
              )}

              {/* Bulk Send Button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkSend}
                  disabled={isBulkSending}
                  className="flex items-center gap-2 text-white bg-blue-600 border border-blue-600 px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shadow-sm transition-colors animate-fade-in font-medium disabled:opacity-50"
                >
                  {isBulkSending ? <RefreshCw className="animate-spin" size={16} /> : <Mail size={16} />}
                  {isBulkSending ? 'Sending...' : 'Send All'}
                </button>
              )}

              {/* Save Selected Button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleSaveSelected}
                  className="flex items-center gap-2 text-white bg-emerald-600 border border-emerald-600 px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 shadow-sm transition-colors animate-fade-in font-medium"
                >
                  <Save size={16} /> Save Selected ({selectedIds.size})
                </button>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors relative ${showFilters
                  ? 'text-brand-600 bg-brand-50 border border-brand-200'
                  : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <Filter size={16} /> Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button className="flex items-center gap-2 text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">
                <Download size={16} /> Export
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Filter Results</h3>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Category/Niche
                  </label>
                  <select
                    value={activeFilters.category}
                    onChange={(e) => setActiveFilters({ ...activeFilters, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 mb-4"
                  >
                    <option value="">All Categories</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {searchSource === 'rank_tracker' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Rank Performance
                      </label>
                      <select
                        value={activeFilters.rankFilter}
                        onChange={(e) => setActiveFilters({ ...activeFilters, rankFilter: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      >
                        <option value="all">Any Rank</option>
                        <option value="top10">Top 10 (Winning)</option>
                        <option value="11plus">Rank 11+ (Needs SEO)</option>
                      </select>
                    </div>
                  )}

                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Location Filter
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Filter City"
                      value={activeFilters.cityFilter || ''}
                      onChange={(e) => setActiveFilters({ ...activeFilters, cityFilter: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Filter State"
                      value={activeFilters.stateFilter || ''}
                      onChange={(e) => setActiveFilters({ ...activeFilters, stateFilter: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>

                {/* Checkbox Filters */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pipeline Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.hasWebsite}
                        onChange={(e) => setActiveFilters({ ...activeFilters, hasWebsite: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">Website Created</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.websiteNotCreated}
                        onChange={(e) => setActiveFilters({ ...activeFilters, websiteNotCreated: e.target.checked })}
                        className="rounded border-slate-300 text-red-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700 font-medium text-red-700">Website NOT Created</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.contactsNurtured}
                        onChange={(e) => setActiveFilters({ ...activeFilters, contactsNurtured: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">Contacts Nurtured</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.contactsNotNurtured}
                        onChange={(e) => setActiveFilters({ ...activeFilters, contactsNotNurtured: e.target.checked })}
                        className="rounded border-slate-300 text-red-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700 font-medium text-red-700">Contacts NOT Nurtured</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.hasScreenshots}
                        onChange={(e) => setActiveFilters({ ...activeFilters, hasScreenshots: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">Screenshots Taken</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.analyzed}
                        onChange={(e) => setActiveFilters({ ...activeFilters, analyzed: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">PageSpeed Analyzed</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.emailsGenerated}
                        onChange={(e) => setActiveFilters({ ...activeFilters, emailsGenerated: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">Emails Generated</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.qualifiedOnly}
                        onChange={(e) => setActiveFilters({ ...activeFilters, qualifiedOnly: e.target.checked })}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700 font-medium text-brand-700">Qualify Score 60+</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.whatsappVerifiedOnly}
                        onChange={(e) => setActiveFilters({ ...activeFilters, whatsappVerifiedOnly: e.target.checked })}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-slate-700 font-medium text-green-700">Verified WA Only</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.contactedOnly}
                        onChange={(e) => setActiveFilters({ ...activeFilters, contactedOnly: e.target.checked, notContactedOnly: e.target.checked ? false : activeFilters.notContactedOnly })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 font-medium text-indigo-700">Contacted</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.notContactedOnly}
                        onChange={(e) => setActiveFilters({ ...activeFilters, notContactedOnly: e.target.checked, contactedOnly: e.target.checked ? false : activeFilters.contactedOnly })}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-sm text-slate-700 font-medium text-rose-700">Not Contacted Yet</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 focus:ring-brand-500 h-4 w-4 text-brand-600 cursor-pointer"
                      checked={allSelected}
                      ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Business Info</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacts</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Analysis Scores</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pipeline Status</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedResults.map((biz) => {
                  const added = isAlreadyLead(biz.id);
                  const isAnalyzed = biz.seoScore !== undefined || biz.digitalScore !== undefined;
                  const isReady = biz.outreachMessages !== undefined;

                  return (
                    <tr key={biz.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(biz.id) ? 'bg-brand-50/30' : ''}`}>
                      <td className="p-4 align-top pt-6">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 focus:ring-brand-500 h-4 w-4 text-brand-600 cursor-pointer"
                          checked={selectedIds.has(biz.id)}
                          onChange={() => handleSelectOne(biz.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setSelectedContact(biz)}
                            className="font-semibold text-slate-900 hover:text-brand-600 hover:underline text-left transition-colors"
                          >
                            {biz.name}
                          </button>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-100">{biz.category || 'Business'}</span>
                            {biz.rank ? (
                              <span className={`px-2 py-0.5 rounded border ${biz.rank <= 10 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                biz.rank <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                Rank #{biz.rank}
                              </span>
                            ) : null}
                            <span className="flex items-center gap-1 text-amber-500 font-medium">★ {biz.rating} ({biz.reviewCount})</span>
                          </div>
                          <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                            <MapPin size={14} /> {biz.address}
                          </div>
                          {biz.founderName && (
                            <div className="mt-2 inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-1 rounded text-xs font-semibold border border-violet-100 animate-fade-in">
                              <User size={12} /> Founder: {biz.founderName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          {/* Restored Clickable Contacts */}
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => setSelectedContact(biz)}
                              className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 group text-left"
                            >
                              <span className="bg-slate-100 text-slate-600 p-1.5 rounded group-hover:bg-slate-200 transition-colors"><Mail size={14} /></span>
                              <span className={biz.contactEmail || biz.email ? "font-medium" : "text-slate-400 italic"}>
                                {biz.contactEmail || biz.email ? "View Email" : "No Email"}
                              </span>
                            </button>
                            <button
                              onClick={() => setSelectedContact(biz)}
                              className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 group text-left"
                            >
                              <span className="bg-blue-50 text-blue-700 p-1.5 rounded group-hover:bg-blue-100 transition-colors"><Linkedin size={14} /></span>
                              <span className={biz.linkedin ? "font-medium" : "text-slate-400 italic"}>
                                {biz.linkedin ? "View LinkedIn" : "No LinkedIn"}
                              </span>
                            </button>
                            <button
                              onClick={() => setSelectedContact(biz)}
                              className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 group text-left"
                            >
                              <span className="bg-pink-50 text-pink-600 p-1.5 rounded group-hover:bg-pink-100 transition-colors"><Instagram size={14} /></span>
                              <span className={biz.instagram ? "font-medium" : "text-slate-400 italic"}>
                                {biz.instagram ? "View Instagram" : "No Instagram"}
                              </span>
                            </button>
                            <div className="flex items-center gap-2 text-sm text-slate-600 group text-left">
                              <span className="bg-green-50 text-green-600 p-1.5 rounded group-hover:bg-green-100 transition-colors cursor-pointer" onClick={() => setSelectedContact(biz)}><Smartphone size={14} /></span>
                              <span className={biz.phone ? "font-medium cursor-pointer hover:text-brand-600" : "text-slate-400 italic"} onClick={() => setSelectedContact(biz)}>
                                {biz.phone ? biz.phone : "No Phone"}
                              </span>
                              {biz.whatsappVerified === true && (
                                <span className="ml-1 flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full" title="Active on WhatsApp">
                                  WA
                                </span>
                              )}
                              {biz.whatsappVerified === false && (
                                <span className="ml-1 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full" title="Not on WhatsApp">
                                  No WA
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {isAnalyzed ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Speed</span>
                              <span className={`font-bold ${biz.seoScore && biz.seoScore < 50 ? 'text-red-500' : 'text-slate-700'}`}>
                                {biz.seoScore || '?'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Design</span>
                              <span className={`font-bold ${biz.digitalScore && biz.digitalScore < 50 ? 'text-red-500' : 'text-slate-700'}`}>
                                {biz.digitalScore || '?'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-t pt-1 mt-1">
                              <span className="text-slate-500">Overall</span>
                              <span className="font-bold text-slate-900">{biz.qualityScore || 0}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not analyzed</span>
                        )}
                      </td>
                      <td className="p-4">
                        {/* Pipeline Status Indicator */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {isReady ? 'READY' : isAnalyzed ? 'ANALYZED' : biz.founderName ? 'ENRICHED' : 'SCRAPED'}
                          </span>
                          <div className="flex gap-1">
                            <div className={`h-1.5 w-6 rounded-full ${true ? 'bg-blue-500' : 'bg-slate-200'}`} title="Scraped"></div>
                            <div className={`h-1.5 w-6 rounded-full ${biz.founderName ? 'bg-blue-500' : 'bg-slate-200'}`} title="Enriched"></div>
                            <div className={`h-1.5 w-6 rounded-full ${isAnalyzed ? 'bg-blue-500' : 'bg-slate-200'}`} title="Analyzed"></div>
                            <div className={`h-1.5 w-6 rounded-full ${isReady ? 'bg-green-500' : 'bg-slate-200'}`} title="Ready for Outreach"></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          <button
                            onClick={() => handleFindFounder(biz)}
                            disabled={enrichingId === biz.id}
                            className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded font-medium hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50"
                          >
                            {enrichingId === biz.id ? <RefreshCw className="animate-spin" size={12} /> : <UserPlus size={14} />}
                            {biz.founderName ? 'Re-check' : 'Find Founder'}
                          </button>

                          <div className="h-4 w-px bg-slate-200 mx-1"></div>

                          <button
                            onClick={() => {
                              if (!added) {
                                onAddLead(biz);
                              }
                            }}
                            disabled={added}
                            className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors flex items-center gap-1 ${added
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                          >
                          </button>

                          {/* Quick Contact Toggle */}
                          <div className="h-4 w-px bg-slate-200 mx-1"></div>
                          <button
                            onClick={() => onUpdateResult(biz.id, { isContacted: !biz.isContacted })}
                            className={`text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-colors ${biz.isContacted
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
                            title={biz.isContacted ? "Mark as Not Contacted" : "Mark as Contacted"}
                          >
                            {biz.isContacted ? <><Check size={14} /> Contacted</> : 'Mark Contacted'}
                          </button>
                          <button
                            onClick={() => {
                              if (!added) onAddLead(biz);
                              navigate(`/analysis/${biz.id}`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors"
                            title="Detailed Analysis"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Contact Info Modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{selectedContact.name}</h3>
                <p className="text-slate-500 text-sm">{selectedContact.category} • {selectedContact.address}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 shrink-0">
              <button
                onClick={() => setActiveTab('contact')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'contact' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Contact Info
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'analysis' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Analysis & Scores
              </button>
              <button
                onClick={() => setActiveTab('outreach')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'outreach' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Outreach
              </button>
              <button
                onClick={() => setActiveTab('website')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'website' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Create Website
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar grow">
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
                        <span className="font-medium text-slate-900">{selectedContact.founderName || "Not detected"}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Email</label>
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-slate-400" />
                        <span className="font-medium text-slate-900">{selectedContact.contactEmail || selectedContact.email || "Not available"}</span>
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
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">LinkedIn</label>
                      <div className="flex items-center gap-2">
                        <Linkedin size={16} className="text-blue-700" />
                        {selectedContact.linkedin ? (
                          <a href={selectedContact.linkedin} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline truncate max-w-[150px]">
                            View Profile
                          </a>
                        ) : <span className="text-slate-400 italic">Not detected</span>}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Instagram</label>
                      <div className="flex items-center gap-2">
                        <Instagram size={16} className="text-pink-600" />
                        {selectedContact.instagram ? (
                          <a href={selectedContact.instagram} target="_blank" rel="noreferrer" className="font-medium text-pink-600 hover:underline truncate max-w-[150px]">
                            View Profile
                          </a>
                        ) : <span className="text-slate-400 italic">Not detected</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!selectedContact) return;
                      setIsModalActionLoading(true);
                      try {
                        const data = await enrichBusiness(selectedContact.name, selectedContact.address, selectedContact.website);
                        // Update local modal state + global store
                        const updated = {
                          ...selectedContact,
                          founderName: data.founderName || 'Not Found',
                          linkedin: data.linkedin || selectedContact.linkedin,
                          contactEmail: data.email || selectedContact.contactEmail,
                          instagram: data.instagram || selectedContact.instagram,
                          phone: data.phone || selectedContact.phone,
                        };
                        setSelectedContact(updated);
                        onUpdateResult(updated.id, updated);
                      } catch (e) { alert('Enrich failed'); }
                      finally { setIsModalActionLoading(false); }
                    }}
                    disabled={isModalActionLoading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isModalActionLoading ? <RefreshCw className="animate-spin" size={16} /> : <UserPlus size={16} />}
                    Enrich Contact Data
                  </button>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-1/3">
                      {/* Full Page Screenshot (Scrollable) */}
                      <div className="w-full bg-slate-100 rounded-lg border border-slate-300 overflow-hidden relative group">
                        <div className="h-[400px] overflow-y-auto custom-scrollbar relative">
                          {selectedContact.originalScreenshot ? (
                            <img
                              src={selectedContact.originalScreenshot.startsWith('data:')
                                ? selectedContact.originalScreenshot
                                : `data:image/png;base64,${selectedContact.originalScreenshot}`
                              }
                              className="w-full h-auto object-cover block"
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-xs">No Screenshot</div>
                          )}
                        </div>

                        {/* Overlay Hint */}
                        <div className="absolute bottom-2 right-4 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                          Scroll to view full page
                        </div>
                      </div>
                      <div className="text-center mt-2">
                        <a href={selectedContact.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                          View Live Site
                        </a>
                      </div>
                    </div>
                    <div className="w-2/3 space-y-4">
                      {/* Scores Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-slate-50 rounded border">
                          <div className="text-xs text-slate-500 mb-1">Mobile Speed</div>
                          <div className={`text-2xl font-bold ${!selectedContact.pageSpeedMobile ? 'text-slate-400' :
                            selectedContact.pageSpeedMobile < 50 ? 'text-red-500' :
                              selectedContact.pageSpeedMobile < 90 ? 'text-amber-500' : 'text-green-500'
                            }`}>
                            {selectedContact.pageSpeedMobile || '-'}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-slate-50 rounded border">
                          <div className="text-xs text-slate-500 mb-1">Desktop Speed</div>
                          <div className={`text-2xl font-bold ${!selectedContact.pageSpeedDesktop ? 'text-slate-400' :
                            selectedContact.pageSpeedDesktop < 50 ? 'text-red-500' :
                              selectedContact.pageSpeedDesktop < 90 ? 'text-amber-500' : 'text-green-500'
                            }`}>
                            {selectedContact.pageSpeedDesktop || '-'}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-slate-50 rounded border">
                          <div className="text-xs text-slate-500 mb-1">Qualify Score</div>
                          <div className={`text-2xl font-bold ${!selectedContact.digitalScore ? 'text-slate-400' :
                            selectedContact.digitalScore < 60 ? 'text-slate-400' : 'text-green-600'
                            }`}>
                            {selectedContact.digitalScore || '-'}
                          </div>
                        </div>
                      </div>

                      {/* Sales Analysis Bullets */}
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2">Pitch Analysis</h4>
                        {selectedContact.analysisBullets && selectedContact.analysisBullets.length > 0 ? (
                          <ul className="space-y-2">
                            {selectedContact.analysisBullets.map((bullet, idx) => (
                              <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                <span>{bullet.replace(/^•\s*/, '')}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-blue-600 italic">Run analysis to see template comparison...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'outreach' && (
                <div className="space-y-4">
                  {!selectedContact.outreachMessages ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500 mb-4">No messages generated yet.</p>
                      {!selectedContact.previewSiteUrl && (
                        <div className="bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded mb-4 inline-block border border-amber-200">
                          ⚠️ Create a website first to include a customized demo link.
                        </div>
                      )}
                      <br />
                      <button
                        onClick={async () => {
                          if (!selectedContact) return;
                          setIsModalActionLoading(true);
                          try {
                            const leads = [{
                              businessName: selectedContact.name,
                              contactName: selectedContact.founderName,
                              websiteUrl: selectedContact.website || '',
                              previewUrl: selectedContact.previewSiteUrl || `https://medspa-website.vercel.app/preview/${selectedContact.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
                              speedScore: selectedContact.seoScore,
                            }];
                            const results = await bulkGenerateMessages(leads);
                            const msgs = results[selectedContact.name];

                            const updated = { ...selectedContact, outreachMessages: msgs };
                            setSelectedContact(updated);
                            onUpdateResult(updated.id, { outreachMessages: msgs } as any);
                          } catch (e: any) { alert('Generation failed:' + e.message); }
                          finally { setIsModalActionLoading(false); }
                        }}
                        disabled={isModalActionLoading}
                        className="bg-amber-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-amber-700"
                      >
                        {isModalActionLoading ? 'Generating...' : 'Generate Messages'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <button
                          onClick={async () => {
                            if (!selectedContact) return;
                            setIsModalActionLoading(true);
                            try {
                              const leads = [{
                                businessName: selectedContact.name,
                                contactName: selectedContact.founderName,
                                websiteUrl: selectedContact.website || '',
                                previewUrl: selectedContact.previewSiteUrl || `https://medspa-website.vercel.app/preview/${selectedContact.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
                                speedScore: selectedContact.seoScore,
                              }];
                              const results = await bulkGenerateMessages(leads);
                              const msgs = results[selectedContact.name];

                              const updated = { ...selectedContact, outreachMessages: msgs };
                              setSelectedContact(updated);
                              onUpdateResult(updated.id, { outreachMessages: msgs } as any);
                            } catch (e: any) { alert('Regeneration failed:' + e.message); }
                            finally { setIsModalActionLoading(false); }
                          }}
                          disabled={isModalActionLoading}
                          className="flex items-center gap-2 text-amber-600 hover:text-amber-700 text-sm font-medium"
                        >
                          <RefreshCw size={14} className={isModalActionLoading ? "animate-spin" : ""} /> Regenerate Messages
                        </button>
                      </div>

                      <div className="flex justify-end mt-2 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-2 rounded-md border border-slate-200 hover:bg-slate-200 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!selectedContact.isContacted}
                            onChange={(e) => {
                              const updated = { ...selectedContact, isContacted: e.target.checked };
                              setSelectedContact(updated);
                              onUpdateResult(updated.id, { isContacted: e.target.checked });
                            }}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                          />
                          <span className="text-sm font-medium text-slate-700">Mark as Contacted</span>
                        </label>
                      </div>

                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="text-xs font-bold text-slate-500 mb-1">EMAIL</div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedContact.outreachMessages.email}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="text-xs font-bold text-slate-500 mb-1">LINKEDIN</div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedContact.outreachMessages.linkedin}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="text-xs font-bold text-slate-500 mb-1">INSTAGRAM</div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedContact.outreachMessages.instagram}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="text-xs font-bold text-green-600 mb-1">WHATSAPP</div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedContact.outreachMessages.whatsapp}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'website' && (
                <div className="space-y-6 flex flex-col items-center justify-center py-8">
                  {!selectedContact.previewSiteUrl ? (
                    <>
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
                        <ExternalLink size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">Generate Preview Website</h3>
                      <p className="text-slate-500 text-center max-w-sm mb-6">
                        Create a custom, high-speed landing page for {selectedContact.name} to showcase in your outreach.
                      </p>
                      <button
                        onClick={async () => {
                          if (!selectedContact) return;
                          setIsModalActionLoading(true);
                          try {
                            const result = await generateWebsite(selectedContact);

                            const updated = { ...selectedContact, previewSiteUrl: result.previewUrl };
                            setSelectedContact(updated);
                            onUpdateResult(updated.id, updated);
                          } catch (e: any) { alert('Site generation failed: ' + e.message); }
                          finally { setIsModalActionLoading(false); }
                        }}
                        disabled={isModalActionLoading}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all flex items-center gap-2"
                      >
                        {isModalActionLoading ? <RefreshCw className="animate-spin" size={20} /> : <Smartphone size={20} />}
                        {isModalActionLoading ? 'Building Site...' : 'Generate Preview Site'}
                      </button>
                    </>
                  ) : (
                    <div className="w-full space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full text-green-600"><Check size={20} /></div>
                        <div className="flex-1">
                          <h4 className="font-bold text-green-800">Website Generated!</h4>
                          <p className="text-green-700 text-sm">Ready to share with the client.</p>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Preview URL</label>
                        <div className="flex gap-2">
                          <input
                            readOnly
                            value={selectedContact.previewSiteUrl}
                            className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 outline-none"
                          />
                          <a
                            href={selectedContact.previewSiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-slate-900 text-white px-4 py-2 rounded font-medium text-sm hover:bg-slate-800 flex items-center"
                          >
                            Open <ExternalLink size={14} className="ml-2" />
                          </a>
                        </div>
                      </div>

                      <div className="flex justify-center pt-2">
                        <button
                          onClick={async () => {
                            if (!selectedContact) return;
                            setIsModalActionLoading(true);
                            try {
                              const result = await generateWebsite(selectedContact);
                              const updated = { ...selectedContact, previewSiteUrl: result.previewUrl };
                              setSelectedContact(updated);
                              onUpdateResult(updated.id, updated);
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
      {/* Manual Add Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Add Lead Manually</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Website URL <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={manualInput.url}
                  onChange={e => setManualInput({ ...manualInput, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Business Name (Optional)</label>
                <input
                  type="text"
                  value={manualInput.name}
                  onChange={e => setManualInput({ ...manualInput, name: e.target.value })}
                  placeholder="e.g. Salon Luxe"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City (Optional)</label>
                <input
                  type="text"
                  value={manualInput.city}
                  onChange={e => setManualInput({ ...manualInput, city: e.target.value })}
                  placeholder="e.g. Miami, FL"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleManualAdd}
                disabled={isManualAdding || !manualInput.url}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                {isManualAdding ? <RefreshCw className="animate-spin" size={18} /> : <PlusCircle size={18} />}
                {isManualAdding ? 'Processing...' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessSearch;