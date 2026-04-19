import React, { useState, useMemo } from 'react';
import { Search, Loader2, Play, Building2, MapPin, Database, Filter, ExternalLink, Activity, Mail, Check, RefreshCw, Smartphone, X, User, Globe, ChevronDown, Send, Trash } from 'lucide-react';
import { Business } from '../types';
import { generateWebsite, uploadLogo, enrichBusiness, bulkEnrich, bulkAnalyze, bulkCheckAds, bulkDetectAdsHTML, bulkFallbackEmail, bulkSerperEmail, queueJinaEmail, getJinaQueueStatus, syncBusinessesToDB, updateBusinessInDB } from '../services/backendApi';


export default function PipelineSearch({ initialResults = [], projectId, onUpdateResult }: { initialResults?: any[], projectId?: string, onUpdateResult?: (id: string, data: Partial<Business>) => void }) {
  const [service, setService] = useState('');
  const [city, setCity] = useState('');
  const [targetCount, setTargetCount] = useState('100');
  const [isScraping, setIsScraping] = useState(false);
  const [results, setResults] = useState<any[]>(initialResults);
  const [statusText, setStatusText] = useState('Idle');
  const [customPostalCodes, setCustomPostalCodes] = useState('');
  const [showPostalInput, setShowPostalInput] = useState(false);

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
  const [filterEmailChecked, setFilterEmailChecked] = useState<'both'|'yes'|'no'>('both');
  const [filterPhone, setFilterPhone] = useState<'both'|'yes'|'no'>('both');
  const [filterScore, setFilterScore] = useState<'both'|'below50'|'above50'>('both');
  const [filterReviewCount, setFilterReviewCount] = useState<'both'|'below50'|'above50'>('both');

  // Sort state
  const [sortBy, setSortBy] = useState<'none'|'rating'|'reviews'>('none');
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc');

  const toggleSort = (col: 'rating'|'reviews') => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  // Modal State
  const [selectedContact, setSelectedContact] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<'contact' | 'website'>('contact');
  const [isModalActionLoading, setIsModalActionLoading] = useState(false);
  const [localHeroPhrases, setLocalHeroPhrases] = useState('');

  // Push to Outreach State
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);
  const [outreachProjects, setOutreachProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedOutreachProject, setSelectedOutreachProject] = useState('');
  const [isPushingToOutreach, setIsPushingToOutreach] = useState(false);
  const [isLoadingOutreachProjects, setIsLoadingOutreachProjects] = useState(false);
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
    if (!service || (!city && !customPostalCodes.trim())) return;
    setIsScraping(true);
    setStatusText('Routing directly to background scraper engine...');
    setResults([]);
    setSelectedIds(new Set());
    
    const codesParam = customPostalCodes.trim() ? `&customPostalCodes=${encodeURIComponent(customPostalCodes.split(/[\n,]+/).map(c => c.trim()).filter(Boolean).join(','))}` : '';
    const evtSource = new EventSource(`/api/pipeline/stream?service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}&targetCount=${targetCount}&projectId=${projectId || ''}${codesParam}`);

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
                        const newOnes = resultData.records
                            .filter((r: any) => !existingNames.has(r.name.toLowerCase()))
                            .map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() }));
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
                    pageSpeedMobile: analyzeRes[r.id].pageSpeed?.mobile?.performance || r.pageSpeedMobile,
                    pageSpeedDesktop: analyzeRes[r.id].pageSpeed?.desktop?.performance || r.pageSpeedDesktop,
                    qualityScore: analyzeRes[r.id].overallScore || r.qualityScore,
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

  const extractCity = (address?: string) => {
      if (!address) return '';
      const parts = address.split(',');
      if (parts.length >= 2) {
          return parts[parts.length - 2].trim();
      }
      return address.trim();
  };

  const handleCheckAds = async () => {
    if (results.length === 0) return;
    setStatusText('Checking Google Ads via Serper...');
    setIsScraping(true);
    try {
        const payload = results.map(r => ({ id: r.id, name: r.name, city: city || r.searchLocation || extractCity(r.address) || '' }));
        const adsData = await bulkCheckAds(payload);
        
        const newResults = results.map(r => {
            if (adsData[r.id] !== undefined) {
                return { 
                    ...r, 
                    runningAds: adsData[r.id]
                };
            }
            return r;
        });
        setResults(newResults);
        
        await syncBusinessesToDB(newResults);
        if (onUpdateResult) {
            newResults.forEach(nr => {
                if (adsData[nr.id] !== undefined) onUpdateResult(nr.id, { runningAds: adsData[nr.id] });
            });
        }
        
        setStatusText('Google Ads check complete.');
    } catch (e: any) {
        console.error(e);
        setStatusText('Ads check failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };

  // Deterministic HTML-based Ad Detection (checks raw script tags)
  const handleDetectAdsHTML = async () => {
    if (results.length === 0) return;
    setStatusText('Scanning websites for ad tracking tags (HTML)...');
    setIsScraping(true);
    try {
        const payload = filteredResults
            .filter(r => r.website)
            .map(r => ({ id: r.id, website: r.website }));
        
        if (payload.length === 0) {
            setStatusText('No websites to scan.');
            setIsScraping(false);
            return;
        }

        const adsData = await bulkDetectAdsHTML(payload);
        
        const newResults = results.map(r => {
            if (adsData[r.id]) {
                return { 
                    ...r, 
                    runningAds: adsData[r.id].runningAds,
                    adTags: adsData[r.id].adTags
                };
            }
            return r;
        });
        setResults(newResults);
        
        await syncBusinessesToDB(newResults);
        if (onUpdateResult) {
            newResults.forEach(nr => {
                if (adsData[nr.id]) {
                    onUpdateResult(nr.id, { runningAds: adsData[nr.id].runningAds });
                }
            });
        }
        
        const detected = Object.values(adsData).filter(v => v.runningAds).length;
        setStatusText(`HTML Ad Scan complete. ${detected}/${payload.length} running ads detected.`);
    } catch (e: any) {
        console.error(e);
        setStatusText('HTML Ad scan failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };

  const handleFallbackEmail = async () => {
    if (results.length === 0) return;
    
    const hasSelection = selectedIds.size > 0;
    
    const junkDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com', 'lawnlove.com', 'thumbtack.com', 'angi.com'];
    const payload = filteredResults
        .filter(r => {
            const rowKey = (r as any).place_id || r.name;
            const inSelection = hasSelection ? selectedIds.has(rowKey) : true;
            const needsEmail = !r.contactEmail && !r.email;
            const notAlreadySearched = !r.serperSearched;
            return inSelection && needsEmail && notAlreadySearched && r.website;
        })
        .filter(r => !junkDomains.some(d => r.website?.includes(d)))
        .map(r => ({ id: r.id, website: r.website }));
    
    if (payload.length === 0) {
        setStatusText('No contacts to process (all already searched or missing websites).');
        return;
    }

    const confirmed = window.confirm(
        `Queue ${payload.length} leads for background Jina Email Scraping?\n\nThe server will process them independently — you can close your laptop.`
    );
    if (!confirmed) return;

    setIsScraping(true);
    try {
        const { jobId, message } = await queueJinaEmail(payload);
        setStatusText(`✅ ${message} (Job: ${jobId.slice(0, 12)}...)`);
        
        // Mark all queued leads as "in progress" locally so they show as searched
        setResults(prev => prev.map(r => {
            const wasQueued = payload.some(p => p.id === r.id);
            return wasQueued ? { ...r, serperSearched: true } : r;
        }));
        
        // Start polling for progress updates in the background
        const pollInterval = setInterval(async () => {
            try {
                const status = await getJinaQueueStatus(jobId);
                if (status.status === 'running') {
                    setStatusText(`🔄 Jina Queue: ${status.processed}/${status.total} processed, ${status.found} emails found...`);
                } else if (status.status === 'done') {
                    setStatusText(`✅ Jina Queue Complete! ${status.found}/${status.total} emails found. Refresh to see results.`);
                    clearInterval(pollInterval);
                    setIsScraping(false);
                } else if (status.status === 'error') {
                    setStatusText(`❌ Jina Queue Error: ${status.error}`);
                    clearInterval(pollInterval);
                    setIsScraping(false);
                }
            } catch {
                // Polling failed (maybe laptop was closed) — stop silently
                clearInterval(pollInterval);
                setIsScraping(false);
            }
        }, 5000); // Poll every 5 seconds
        
        // Safety: stop polling after 2 hours max
        setTimeout(() => { clearInterval(pollInterval); setIsScraping(false); }, 2 * 60 * 60 * 1000);
        
    } catch (e: any) {
        console.error(e);
        setStatusText('Failed to queue Jina job: ' + e.message);
        setIsScraping(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.size} contacts? This cannot be undone.`);
    if (!confirmed) return;

    setStatusText('Deleting contacts...');
    setIsScraping(true);
    try {
        const idsToDelete = Array.from(selectedIds);
        // Assuming rowKey in selection maps directly to row.id or row.place_id, we need the DB ids.
        // Convert selectedIds back to DB ids
        const dbIds = filteredResults
            .filter(r => {
                const rowKey = (r as any).place_id || r.name;
                return selectedIds.has(rowKey);
            })
            .map(r => r.id);

        const res = await fetch('/api/pipeline/leads', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: dbIds })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Remove from local state
        setResults(prev => prev.filter(r => !dbIds.includes(r.id)));
        setSelectedIds(new Set());
        setStatusText(`Deleted ${data.count} contacts.`);
    } catch (e: any) {
        console.error(e);
        setStatusText('Deletion failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };

  const handleDDGEmail = async () => {
    if (results.length === 0) return;
    
    const hasSelection = selectedIds.size > 0;
    
    if (!hasSelection) {
        const eligible = results.filter(r => !r.contactEmail && !r.email).length;
        const confirmed = window.confirm(`Run DuckDuckGo Email Search on ${eligible} contacts with missing emails?`);
        if (!confirmed) return;
    }

    setStatusText('Running DuckDuckGo Email Search (site:domain "email" query)...');
    setIsScraping(true);
    try {
        const junkDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com', 'lawnlove.com', 'thumbtack.com', 'angi.com', 'vagaro.com', 'fresha.com', 'booksy.com'];
        const payload = filteredResults
            .filter(r => {
                const rowKey = (r as any).place_id || r.name;
                const inSelection = hasSelection ? selectedIds.has(rowKey) : true;
                const needsEmail = !r.contactEmail && !r.email;
                const notAlreadySearched = !r.serperSearched;
                return inSelection && needsEmail && notAlreadySearched;
            })
            .map(r => {
                const isJunk = r.website && junkDomains.some(d => r.website?.includes(d));
                return { 
                    id: r.id, 
                    website: isJunk ? null : r.website, 
                    name: r.name, 
                    location: extractCity(r.address) || r.searchLocation || r.address, 
                    niche: r.searchQuery || r.category || '' 
                };
            }).filter(r => r.website); // DDG script explicitly uses website

        if (payload.length === 0) {
            setStatusText(hasSelection
                ? 'All selected contacts already have emails or lack a valid domain.'
                : 'No new contacts to process with valid domains.');
            setIsScraping(false);
            return;
        }

        setStatusText(`DuckDuckGo searching ${payload.length} lead(s) in batches...`);

        const BATCH_SIZE = 50;
        let currentResults = [...results];
        let totalFound = 0;

        for (let i = 0; i < payload.length; i += BATCH_SIZE) {
            const batch = payload.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(payload.length / BATCH_SIZE);
            setStatusText(`DDG batch ${batchNum}/${totalBatches} (${i + 1}–${Math.min(i + BATCH_SIZE, payload.length)} of ${payload.length})...`);

            try {
                const response = await fetch('/api/pipeline/ddg-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leads: batch })
                });

                if (!response.ok) throw new Error(await response.text());
                const data = await response.json();
                const emailData = data.results || {};

                currentResults = currentResults.map(r => {
                    const wasInBatch = batch.some(p => p.id === r.id);
                    if (!wasInBatch) return r;
                    const foundEmail = emailData[r.id] && emailData[r.id] !== 'NULL' ? emailData[r.id] : undefined;
                    if (foundEmail) totalFound++;
                    return { ...r, serperSearched: true, ...(foundEmail ? { contactEmail: foundEmail } : {}) };
                });
                
                setResults([...currentResults]);
                
                // Save this batch's changes immediately to DB — don't wait for all batches
                const batchBusinesses = currentResults.filter(r => batch.some(p => p.id === r.id));
                await syncBusinessesToDB(batchBusinesses);

                if (onUpdateResult) {
                    batchBusinesses.forEach(nr => {
                        onUpdateResult(nr.id, { serperSearched: true, ...(nr.contactEmail ? { contactEmail: nr.contactEmail } : {}) });
                    });
                }
            } catch (err) {
                console.error(`DDG Batch ${batchNum} error:`, err);
            }
            // Polite delay between batches
            await new Promise(r => setTimeout(r, 1000));
        }

        setStatusText(`DuckDuckGo Email Search Complete! Found ${totalFound} new emails.`);
    } catch (e: any) {
        setStatusText('DDG Email Search Failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };

  const handleSerperEmail = async () => {
    if (results.length === 0) return;
    
    const hasSelection = selectedIds.size > 0;
    
    if (!hasSelection) {
        const eligible = results.filter(r => !r.contactEmail && !r.email && !r.serperSearched).length;
        const confirmed = window.confirm(`Run Serper Email Search on ${eligible} contacts with missing emails (already-searched contacts will be skipped)?`);
        if (!confirmed) return;
    }

    setStatusText('Running Serper Email Search (domain + "email" query)...');
    setIsScraping(true);
    try {
        const junkDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'yelp.com', 'lawnlove.com', 'thumbtack.com', 'angi.com', 'vagaro.com', 'fresha.com', 'booksy.com'];
        const payload = filteredResults
            .filter(r => {
                const rowKey = (r as any).place_id || r.name;
                const inSelection = hasSelection ? selectedIds.has(rowKey) : true;
                const needsEmail = !r.contactEmail && !r.email;
                // ALWAYS skip contacts already searched — never re-spend Serper credits
                const notAlreadySearched = !r.serperSearched;
                return inSelection && needsEmail && notAlreadySearched;
            })
            .map(r => {
                const isJunk = r.website && junkDomains.some(d => r.website?.includes(d));
                return { 
                    id: r.id, 
                    website: isJunk ? null : r.website, 
                    name: r.name, 
                    location: extractCity(r.address) || r.searchLocation || r.address, 
                    niche: r.searchQuery || r.category || '' 
                };
            });

        if (payload.length === 0) {
            setStatusText(hasSelection
                ? 'All selected contacts have already been searched via Serper.'
                : 'No new contacts to process.');
            setIsScraping(false);
            return;
        }

        setStatusText(`Serper searching ${payload.length} lead(s) in batches...`);

        const BATCH_SIZE = 50;
        let currentResults = [...results];
        let totalFound = 0;

        for (let i = 0; i < payload.length; i += BATCH_SIZE) {
            const batch = payload.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(payload.length / BATCH_SIZE);
            setStatusText(`Serper batch ${batchNum}/${totalBatches} (${i + 1}–${Math.min(i + BATCH_SIZE, payload.length)} of ${payload.length})...`);

            try {
                const emailData = await bulkSerperEmail(batch);

                // Apply results from this batch
                currentResults = currentResults.map(r => {
                    const wasInBatch = batch.some(p => p.id === r.id);
                    if (!wasInBatch) return r;
                    const foundEmail = emailData[r.id] && emailData[r.id] !== 'NULL' ? emailData[r.id] : undefined;
                    if (foundEmail) totalFound++;
                    return { ...r, serperSearched: true, ...(foundEmail ? { contactEmail: foundEmail } : {}) };
                });

                setResults([...currentResults]);

                // Save this batch's changes immediately to DB — don't wait for all batches
                const batchBusinesses = currentResults.filter(r => batch.some(p => p.id === r.id));
                await syncBusinessesToDB(batchBusinesses);

                if (onUpdateResult) {
                    batchBusinesses.forEach(nr => {
                        onUpdateResult(nr.id, { serperSearched: true, ...(nr.contactEmail ? { contactEmail: nr.contactEmail } : {}) });
                    });
                }
            } catch (batchErr: any) {
                console.error(`Batch ${batchNum} failed:`, batchErr);
                // Continue with remaining batches even if one fails
            }
        }

        setStatusText(`Serper Email complete. Found ${totalFound}/${payload.length} emails across ${Math.ceil(payload.length / BATCH_SIZE)} batches.`);

    } catch (e: any) {
        console.error(e);
        setStatusText('Serper Email failed: ' + e.message);
    } finally {
        setIsScraping(false);
    }
  };


  const filteredResults = useMemo(() => {
    let list = results.filter(r => {
        if (filterWebsite === 'has' && !r.website) return false;
        if (filterWebsite === 'doesnt' && r.website) return false;
        
        if (filterAds === 'yes' && !r.ads) return false;
        if (filterAds === 'no' && r.ads) return false;

        if (filterEmail === 'yes' && !(r.contactEmail || r.email)) return false;
        if (filterEmail === 'no' && (r.contactEmail || r.email)) return false;
        
        if (filterEmailChecked === 'yes' && !r.serperSearched) return false;
        if (filterEmailChecked === 'no' && r.serperSearched) return false;
        
        if (filterPhone === 'yes' && !r.phone) return false;
        if (filterPhone === 'no' && r.phone) return false;

        if (filterScore === 'below50' && r.score >= 50) return false;
        if (filterScore === 'above50' && r.score < 50) return false;

        const revCount = r.reviewCount || r.reviews || 0;
        if (filterReviewCount === 'below50' && revCount >= 50) return false;
        if (filterReviewCount === 'above50' && revCount < 50) return false;

        return true;
    });
    if (sortBy !== 'none') {
        list = [...list].sort((a, b) => {
            const aVal = sortBy === 'rating' ? (a.rating || a.score || 0) : (a.reviewCount || a.reviews || 0);
            const bVal = sortBy === 'rating' ? (b.rating || b.score || 0) : (b.reviewCount || b.reviews || 0);
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }
    return list;
  }, [results, filterWebsite, filterAds, filterEmail, filterEmailChecked, filterPhone, filterScore, filterReviewCount, sortBy, sortDir]);

  const averageReviews = useMemo(() => {
      if (results.length === 0) return 0;
      const total = results.reduce((sum, r) => sum + (r.reviewCount || r.reviews || 0), 0);
      return Math.round(total / results.length);
  }, [results]);

  return (
    <div className="flex-1 overflow-auto bg-slate-50 flex flex-col h-full h-screen relative">
      <div className="bg-white border-b sticky top-0 z-10 px-4 md:px-6 py-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="text-brand-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Mass Pipeline</h1>
            <p className="text-sm text-slate-500">Local automated scraping and enrichment engine</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 min-w-[140px] md:flex-none">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Service (e.g. Plumber)"
              className="pl-10 pr-4 py-2 border rounded-xl text-sm w-full md:w-48 focus:ring-2 focus:ring-brand-500 outline-none"
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </div>
          <div className="relative flex-1 min-w-[140px] md:flex-none">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="City (e.g. Austin, TX)"
              className="pl-10 pr-4 py-2 border rounded-xl text-sm w-full md:w-48 focus:ring-2 focus:ring-brand-500 outline-none"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          
          <div className="relative flex-1 min-w-[120px] md:flex-none">
            <select value={targetCount} onChange={(e) => setTargetCount(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-700 w-full md:w-32 appearance-none">
                <option value="50">Limit: 50</option>
                <option value="100">Limit: 100</option>
                <option value="250">Limit: 250</option>
                <option value="500">Limit: 500</option>
                <option value="1000">Limit: 1000</option>
                <option value="2000">Limit: 2000</option>
                <option value="5000">Limit: 5000</option>
                <option value="10000">Limit: 10000</option>
                <option value="999999">Unlimited</option>
            </select>
          </div>
          <button
            onClick={startPipeline}
            disabled={isScraping || !service.trim() || (!city.trim() && !customPostalCodes.trim())}
            className="w-full md:w-auto bg-brand-600 justify-center text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all shadow-brand-500/20 active:scale-95"
          >
            {isScraping ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isScraping ? 'Running...' : 'Fetch Base Pipeline Data'}
          </button>
        </div>
      </div>

      {/* Custom Postal Codes Input */}
      <div className="bg-white border-b px-4 md:px-6 py-2">
        <button
          onClick={() => setShowPostalInput(!showPostalInput)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          <MapPin size={14} />
          <span>Custom Postal Codes (International)</span>
          <ChevronDown size={14} className={`transition-transform ${showPostalInput ? 'rotate-180' : ''}`} />
          {customPostalCodes.trim() && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{customPostalCodes.split(/[\n,]+/).filter(c => c.trim()).length} codes</span>}
        </button>
        {showPostalInput && (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={customPostalCodes}
              onChange={(e) => setCustomPostalCodes(e.target.value)}
              placeholder={"Paste postal codes here, one per line or comma-separated.\nExamples:\n8001\n8005\n7441\n\nOr: 8001, 8005, 7441"}
              className="w-full md:w-96 h-28 text-sm border border-slate-200 rounded-xl p-3 font-mono focus:ring-2 focus:ring-purple-400 outline-none resize-y bg-slate-50"
            />
            <p className="text-[11px] text-slate-400">When provided, the scraper will use these codes instead of auto-fetching US ZIP codes. Paste one code per line or comma-separated.</p>
          </div>
        )}
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
                <button onClick={handleDetectAdsHTML} disabled={isScraping || results.length === 0} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium hover:bg-red-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                    <Search size={14} /> Detect Ads (HTML Scan)
                </button>
                <button onClick={handleDDGEmail} disabled={isScraping || results.length === 0} className="bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg border border-purple-200 text-xs font-medium hover:bg-purple-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                    <Search size={14} /> DuckDuckGo Email Search (Free)
                </button>
                <button onClick={handleFallbackEmail} disabled={isScraping || results.length === 0} className="bg-cyan-50 text-cyan-600 px-3 py-1.5 rounded-lg border border-cyan-200 text-xs font-medium hover:bg-cyan-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                    <Mail size={14} /> Fallback Email Search (Jina Scraper)
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={handleDeleteSelected} disabled={isScraping} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium hover:bg-red-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                      <Trash size={14} /> Delete Selected
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button
                    onClick={async () => {
                      setIsLoadingOutreachProjects(true);
                      setIsOutreachModalOpen(true);
                      try {
                        const res = await fetch('/api/outreach/projects');
                        const data = await res.json();
                        if (data.error) { alert('Error loading projects: ' + data.error); setIsOutreachModalOpen(false); return; }
                        setOutreachProjects(data.projects || []);
                      } catch (e: any) { alert('Cannot connect to Outreach: ' + e.message); setIsOutreachModalOpen(false); }
                      finally { setIsLoadingOutreachProjects(false); }
                    }}
                    className="bg-orange-500 text-white px-3 py-1.5 rounded-lg border border-orange-600 text-xs font-medium hover:bg-orange-600 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Send size={14} /> Push to Outreach ({selectedIds.size})
                  </button>
                )}
                <button onClick={handleSerperEmail} disabled={isScraping || results.length === 0} className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-medium hover:bg-emerald-100 flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors">
                    <Database size={14} /> Email Search (Serper)
                </button>
            </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
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

              <select className="text-sm border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" value={filterEmailChecked} onChange={e=>setFilterEmailChecked(e.target.value as any)}>
                  <option value="both">Email Checked: Both</option>
                  <option value="yes">Is Checked</option>
                  <option value="no">Not Checked</option>
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

              <select className="text-sm border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500" value={filterReviewCount} onChange={e=>setFilterReviewCount(e.target.value as any)}>
                  <option value="both">Reviews: Both</option>
                  <option value="below50">Below 50</option>
                  <option value="above50">50 or Above</option>
              </select>
            </div>

            {/* Result Count */}
            {results.length > 0 && (
              <div className="text-sm font-semibold text-slate-600">
                Showing <span className="text-brand-600">{filteredResults.length}</span> of <span className="text-brand-600">{results.length}</span> businesses
                {selectedIds.size > 0 && <span className="ml-2 text-emerald-600">({selectedIds.size} selected)</span>}
                <span className="ml-4 px-2 py-1 bg-brand-50 text-brand-700 rounded-md">Avg Reviews: {averageReviews}</span>
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
                  <th className="px-4 py-3 cursor-pointer select-none hover:text-brand-600" onClick={() => toggleSort('rating')}>
                    ⭐ Rating {sortBy === 'rating' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:text-brand-600" onClick={() => toggleSort('reviews')}>
                    Reviews {sortBy === 'reviews' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
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
                        {r.contactEmail || r.email ? (
                            <span className="text-emerald-700">{r.contactEmail || r.email}</span>
                        ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-amber-600 italic text-xs">Missing</span>
                                {r.serperSearched && <span title="OSINT Checked" className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">(Searched)</span>}
                            </div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={() => openContactModal(r)}>
                        {r.runningAds === true ? (
                          <span className="text-emerald-600 font-bold">Yes</span>
                        ) : r.runningAds === false ? (
                          <span className="text-slate-400 font-bold">No</span>
                        ) : (
                          <span className="text-slate-300 italic text-xs">Not checked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium" onClick={() => openContactModal(r)}>
                        {(r.rating || r.score) ? (
                          <span className="text-amber-600">{Number(r.rating || r.score).toFixed(1)} ★</span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500" onClick={() => openContactModal(r)}>
                        {(r.reviewCount || r.reviews) ? (
                          <span>{(r.reviewCount || r.reviews).toLocaleString()}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3" onClick={() => openContactModal(r)}>
                        {r.qualityScore && r.qualityScore > 0 ? (
                            <span className={`font-bold ${r.qualityScore < 50 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.qualityScore}</span>
                        ) : <span className="text-slate-300">-</span>}
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

      {/* Push to Outreach Modal */}
      {isOutreachModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !isPushingToOutreach && setIsOutreachModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Push to Outreach</h3>
                <p className="text-sm text-slate-500 mt-1">Send {selectedIds.size} lead(s) to your email outreach pipeline</p>
              </div>
              <button onClick={() => !isPushingToOutreach && setIsOutreachModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            {isLoadingOutreachProjects ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="animate-spin text-brand-600" size={24} />
                <span className="ml-2 text-slate-600">Loading Outreach projects...</span>
              </div>
            ) : outreachProjects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No projects found in Outreach.</p>
                <p className="text-sm text-slate-400 mt-1">Create a project in the Outreach app first.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Outreach Project</label>
                  <select
                    value={selectedOutreachProject}
                    onChange={e => setSelectedOutreachProject(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  >
                    <option value="">Choose a project...</option>
                    {outreachProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-orange-800">
                    <strong>{selectedIds.size}</strong> leads will be imported with status <strong>enriched</strong> — they'll skip enrichment and go straight to icebreaker generation.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsOutreachModalOpen(false)} disabled={isPushingToOutreach} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                  <button
                    onClick={async () => {
                      if (!selectedOutreachProject) { alert('Please select an Outreach project'); return; }
                      // Build leadIds from selectedIds (which stores place_id||name keys) → resolve to DB IDs
                      const selectedLeadIds = results
                        .filter(r => selectedIds.has((r as any).place_id || r.name))
                        .map(r => r.id)
                        .filter(Boolean);
                      if (selectedLeadIds.length === 0) return;
                      setIsPushingToOutreach(true);
                      try {
                        const res = await fetch('/api/push-to-outreach', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadIds: selectedLeadIds, outreachProjectId: selectedOutreachProject })
                        });
                        const data = await res.json();
                        if (data.error) { alert('Push failed: ' + data.error); }
                        else { alert(data.message || `Pushed ${data.imported} leads to Outreach!`); setIsOutreachModalOpen(false); setSelectedOutreachProject(''); }
                      } catch (e: any) { alert('Push to Outreach failed: ' + e.message); }
                      finally { setIsPushingToOutreach(false); }
                    }}
                    disabled={isPushingToOutreach || !selectedOutreachProject}
                    className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                  >
                    {isPushingToOutreach ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                    {isPushingToOutreach ? 'Pushing...' : 'Push Leads'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
