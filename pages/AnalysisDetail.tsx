import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Business, WebsiteAudit, ActionItem } from '../types';
import {
    ArrowLeft, Upload, Share, LayoutDashboard, Sparkles, TrendingUp, DollarSign,
    Search, Mail, Linkedin, Instagram, Copy, Check, ExternalLink, RefreshCw, Smartphone,
    Palette, MessageCircle, Download, CheckCircle, AlertTriangle
} from 'lucide-react';
import { analyzeDesignQuality, findContactInfo, generateRedesignPreview, generateOutreachMessage } from '../services/geminiService';
import { captureScreenshot, createProposalSlides } from '../services/backendApi';
import ReactMarkdown from 'react-markdown';

interface AnalysisDetailProps {
    getBusiness: (id: string) => Business | undefined;
    onUpdateBusiness: (id: string, data: Partial<Business>) => void;
}

const AnalysisDetail: React.FC<AnalysisDetailProps> = ({ getBusiness, onUpdateBusiness }) => {
    const { id } = useParams<{ id: string }>();
    const business = getBusiness(id || '');

    // URL query params (for direct tab navigation)
    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') as 'audit' | 'solution' | 'outreach' || 'audit';

    // Tabs
    const [activeTab, setActiveTab] = useState<'audit' | 'solution' | 'outreach'>(initialTab);

    // State: Audit
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [belowFoldImage, setBelowFoldImage] = useState<string | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditResult, setAuditResult] = useState<WebsiteAudit | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const belowFoldInputRef = useRef<HTMLInputElement>(null);

    // State: Solution (Visuals)
    const [isGeneratingRedesign, setIsGeneratingRedesign] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('1');

    // State: Outreach
    const [isFindingContacts, setIsFindingContacts] = useState(false);
    const [messagePlatform, setMessagePlatform] = useState<'Email' | 'Instagram' | 'LinkedIn'>('Email');
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [isWritingMessage, setIsWritingMessage] = useState(false);
    const [copied, setCopied] = useState(false);

    // State: Automation
    const [isCapturing, setIsCapturing] = useState(false);
    const [isCreatingSlides, setIsCreatingSlides] = useState(false);
    const [slideUrl, setSlideUrl] = useState<string | null>(null);

    // Initialize with existing data if available
    useEffect(() => {
        if (business) {
            if (business.originalScreenshot && !selectedImage) {
                setSelectedImage(business.originalScreenshot);
            }
            if (business.belowFoldScreenshot && !belowFoldImage) {
                setBelowFoldImage(business.belowFoldScreenshot);
            }
            if (business.auditResult && !auditResult) {
                setAuditResult(business.auditResult);
            }
            if (business.redesignImageUrl && !auditResult && !business.auditResult) {
                // Fallback if we somehow have redesign but no audit record
            }
            if (business.isQualified !== undefined) {
                // Could set an initial audit result state if persisted
            }
        }
    }, [business]);

    if (!business) return <div className="p-8">Business not found. <Link to="/" className="text-brand-600">Back</Link></div>;

    // --- Handlers ---

    const handleAutoCapture = async () => {
        if (!business.website) return;
        setIsCapturing(true);
        try {
            const result = await captureScreenshot(business.website, 'desktop');
            setSelectedImage(result.base64Image);
            onUpdateBusiness(business.id, { originalScreenshot: result.base64Image });
        } catch (e) {
            alert("Screenshot capture failed. Ensure server is running.");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleCreateSlides = async () => {
        if (!selectedImage || !business.redesignImageUrl) return;
        setIsCreatingSlides(true);
        try {
            const result = await createProposalSlides(
                business,
                { aboveFold: selectedImage, belowFold: '' },
                [business.redesignImageUrl]
            );
            setSlideUrl(result.url);
            window.open(result.url, '_blank');
        } catch (e: any) {
            alert("Slide generation failed: " + e.message);
        } finally {
            setIsCreatingSlides(false);
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setSelectedImage(result);
                onUpdateBusiness(business.id, { originalScreenshot: result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleBelowFoldCapture = async () => {
        if (!business.website) return;
        setIsCapturing(true);
        try {
            const result = await captureScreenshot(business.website, 'desktop', true); // belowFold=true
            setBelowFoldImage(result.base64Image);
            onUpdateBusiness(business.id, { belowFoldScreenshot: result.base64Image });
        } catch (e) {
            alert("Below-fold screenshot capture failed.");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleBelowFoldUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setBelowFoldImage(result);
                onUpdateBusiness(business.id, { belowFoldScreenshot: result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCaptureAll = async () => {
        if (!business.website) return;
        setIsCapturing(true);
        try {
            // Run both captures in parallel
            const [topResult, bottomResult] = await Promise.all([
                captureScreenshot(business.website, 'desktop', false),
                captureScreenshot(business.website, 'desktop', true)
            ]);

            setSelectedImage(topResult.base64Image);
            setBelowFoldImage(bottomResult.base64Image);

            onUpdateBusiness(business.id, {
                originalScreenshot: topResult.base64Image,
                belowFoldScreenshot: bottomResult.base64Image
            });
        } catch (e) {
            alert("Full page capture failed. Ensure server is running.");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleRunAudit = async () => {
        if (!selectedImage) return;
        setIsAuditing(true);
        try {
            const base64 = selectedImage.split(',')[1];
            const result = await analyzeDesignQuality(base64);
            setAuditResult(result);

            // Save qualification status AND full audit result
            onUpdateBusiness(business.id, {
                isQualified: result.isBadDesign,
                qualityScore: result.isBadDesign ? Math.max(business.qualityScore, 80) : business.qualityScore,
                auditResult: result
            });

            // Auto-switch to solution tab if qualified
            if (result.isBadDesign) {
                // Optional: toast or slight delay
            }
        } catch (e) {
            alert("Audit failed.");
        } finally {
            setIsAuditing(false);
        }
    };

    const [redesignError, setRedesignError] = useState<string | null>(null);

    // Helper: Compress base64 image to reduce size for localStorage
    const compressImage = async (base64DataUrl: string, quality: number = 0.6): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Keep original dimensions but compress quality
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                // Convert to JPEG for better compression
                const compressed = canvas.toDataURL('image/jpeg', quality);
                console.log(`[Compress] ${Math.round(base64DataUrl.length / 1024)}KB -> ${Math.round(compressed.length / 1024)}KB`);
                resolve(compressed);
            };
            img.src = base64DataUrl;
        });
    };

    const handleGenerateRedesign = async () => {
        if (!selectedImage) return;
        setIsGeneratingRedesign(true);
        setRedesignError(null);

        try {
            // Extract mimetype and base64 data
            // underlying string format: data:image/png;base64,iVBORw0K...
            const matches = selectedImage.match(/^data:(.+);base64,(.+)$/);
            if (!matches) throw new Error("Invalid image format");

            const mimeType = matches[1];
            const base64 = matches[2];

            const belowFoldBase64 = belowFoldImage ? belowFoldImage.split(',')[1] : undefined;

            console.log("[Redesign] Generating with mimeType:", mimeType);

            // Pass selectedTemplate, belowFold and mimeType to the service
            const result = await generateRedesignPreview(base64, business.category, selectedTemplate, belowFoldBase64, mimeType);

            // Log image sizes for debugging
            const topSizeKB = Math.round((result.top?.length || 0) / 1024);
            console.log(`[Redesign] Generated image size: ${topSizeKB}KB`);

            // Compress images if they're too large (>1MB)
            let topImage = result.top;
            if (topSizeKB > 1000) {
                console.log("[Redesign] Image too large, compressing...");
                topImage = await compressImage(result.top, 0.7);
            }

            // Save the generated image(s)
            try {
                onUpdateBusiness(business.id, {
                    redesignImageUrl: topImage,
                    redesignBelowFoldUrl: topImage // Same image for both
                });
                console.log("[Redesign] Successfully saved to state/localStorage");
            } catch (storageError: any) {
                console.error("[Redesign] Failed to save - localStorage may be full:", storageError);
                setRedesignError("Image saved but may not persist on refresh (storage limit). Consider downloading the image.");
            }

        } catch (e: any) {
            console.error("Redesign Gen Error:", e);
            setRedesignError(e.message || "Failed to generate design. Please try again.");
            // Do not use alert() as it's intrusive and can be blocked
        } finally {
            setIsGeneratingRedesign(false);
        }
    };


    const handleFindContacts = async () => {
        setIsFindingContacts(true);
        try {
            const info = await findContactInfo(business.name, business.address);
            onUpdateBusiness(business.id, {
                contactEmail: info.email || undefined,
                instagram: info.instagram || undefined,
                linkedin: info.linkedin || undefined
            });
        } catch (e) {
            // ignore
        } finally {
            setIsFindingContacts(false);
        }
    };

    const handleGenerateMessage = async () => {
        setIsWritingMessage(true);
        try {
            // Create a basic audit result if none exists (for outreach without full audit)
            const effectiveAudit = auditResult || {
                isBadDesign: true,
                qualificationReason: "Initial outreach - no audit performed yet",
                designFlaws: ["Website could benefit from modern design improvements"],
                brandAssetsDetected: [],
                summary: "Business identified as potential lead for web design services",
                actionItems: []
            };
            const msg = await generateOutreachMessage(business, effectiveAudit, messagePlatform);
            setGeneratedMessage(msg);
            setCopied(false);
        } finally {
            setIsWritingMessage(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link to="/analyses" className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                    <ArrowLeft size={20} className="text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
                    <p className="text-slate-500 text-sm">{business.category} • {business.address}</p>
                </div>
                <div className="ml-auto">
                    {business.isQualified && (
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold border border-emerald-200">
                            Qualified Opportunity
                        </span>
                    )}
                    {business.isQualified === false && (
                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-sm font-bold border border-slate-200">
                            Unqualified
                        </span>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-6 gap-8">
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'audit' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                >
                    <Search size={18} /> 1. Audit & Qualify
                </button>
                <button
                    onClick={() => setActiveTab('solution')}
                    disabled={!auditResult && !business.redesignImageUrl}
                    className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'solution' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 disabled:opacity-50'}`}
                >
                    <Palette size={18} /> 2. Visual Pitch (ROI)
                </button>
                <button
                    onClick={() => setActiveTab('outreach')}
                    className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'outreach' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                >
                    <Mail size={18} /> 3. Contact & Outreach
                </button>
            </div>

            {/* TAB 1: AUDIT */}
            {activeTab === 'audit' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                    {/* Left: Upload */}
                    <div className="space-y-6">
                        {business.website && (
                            <button
                                onClick={handleCaptureAll}
                                disabled={isCapturing}
                                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                            >
                                {isCapturing ? <RefreshCw className="animate-spin" /> : <Smartphone size={20} />}
                                Auto-Capture Full Page (Top & Bottom)
                            </button>
                        )}

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-semibold text-lg text-slate-800 mb-2">Website Screenshot</h3>
                            <p className="text-slate-500 text-sm mb-4">Upload a "Top of Fold" screenshot of their homepage.</p>

                            {!selectedImage ? (
                                <div className="space-y-4">
                                    {business.website && (
                                        <button
                                            onClick={handleAutoCapture}
                                            disabled={isCapturing}
                                            className="w-full py-8 border-2 border-dashed border-brand-200 bg-brand-50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-100 transition-all text-brand-700 disabled:opacity-50"
                                        >
                                            {isCapturing ? (
                                                <RefreshCw className="animate-spin mb-2" size={32} />
                                            ) : (
                                                <Smartphone size={32} className="mb-2" />
                                            )}
                                            <p className="font-bold">Auto-Capture from Website</p>
                                            <p className="text-xs opacity-70">{business.website}</p>
                                        </button>
                                    )}

                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-300 rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-brand-400 transition-all group"
                                    >
                                        <Upload size={32} className="text-slate-400 mb-2 group-hover:text-brand-500" />
                                        <p className="font-medium text-slate-700">Upload Screenshot</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 group">
                                    <img src={selectedImage} alt="Current Site" className="w-full h-auto object-cover" />
                                    <button
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

                            {selectedImage && !auditResult && (
                                <button
                                    onClick={handleRunAudit}
                                    disabled={isAuditing}
                                    className="w-full mt-4 bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {isAuditing ? 'Analyzing...' : 'Analyze Design'}
                                </button>
                            )}
                        </div>

                        {/* Below the Fold Screenshot */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-semibold text-lg text-slate-800 mb-2">Below the Fold</h3>
                            <p className="text-slate-500 text-sm mb-4">Optional: Capture content below the initial viewport.</p>

                            {!belowFoldImage ? (
                                <div className="space-y-4">
                                    {business.website && (
                                        <button
                                            onClick={handleBelowFoldCapture}
                                            disabled={isCapturing}
                                            className="w-full py-6 border-2 border-dashed border-amber-200 bg-amber-50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-100 transition-all text-amber-700 disabled:opacity-50"
                                        >
                                            {isCapturing ? (
                                                <RefreshCw className="animate-spin mb-2" size={24} />
                                            ) : (
                                                <Smartphone size={24} className="mb-2" />
                                            )}
                                            <p className="font-bold text-sm">Auto-Capture Below Fold</p>
                                        </button>
                                    )}

                                    <div
                                        onClick={() => belowFoldInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-300 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-brand-400 transition-all group"
                                    >
                                        <Upload size={24} className="text-slate-400 mb-1 group-hover:text-brand-500" />
                                        <p className="text-sm font-medium text-slate-600">Upload Below Fold</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 group">
                                    <img src={belowFoldImage} alt="Below Fold" className="w-full h-auto object-cover" />
                                    <button
                                        onClick={() => setBelowFoldImage(null)}
                                        className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                            )}
                            <input type="file" ref={belowFoldInputRef} onChange={handleBelowFoldUpload} accept="image/*" className="hidden" />
                        </div>
                    </div>

                    {/* Right: Results */}
                    <div className="space-y-6">
                        {auditResult ? (
                            <div className="space-y-6">
                                {/* Qualification Card */}
                                <div className={`p-6 rounded-xl border ${auditResult.isBadDesign ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <div className="flex items-center gap-3 mb-2">
                                        {auditResult.isBadDesign ? <CheckCircle className="text-emerald-600" /> : <AlertTriangle className="text-amber-600" />}
                                        <h3 className={`font-bold text-lg ${auditResult.isBadDesign ? 'text-emerald-800' : 'text-amber-800'}`}>
                                            {auditResult.isBadDesign ? "Qualified Lead" : "Low Opportunity"}
                                        </h3>
                                    </div>
                                    <p className="text-slate-700">{auditResult.qualificationReason}</p>
                                </div>

                                {/* Flaws List */}
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-900 mb-4">Design Flaws Identified</h3>
                                    <ul className="space-y-3">
                                        {auditResult.designFlaws.map((flaw, i) => (
                                            <li key={i} className="flex gap-3 items-start p-3 bg-rose-50 rounded-lg text-sm text-rose-800">
                                                <TrendingUp className="min-w-[16px] mt-0.5 rotate-180" /> {flaw}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Next Step CTA */}
                                {auditResult.isBadDesign && (
                                    <button
                                        onClick={() => setActiveTab('solution')}
                                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 flex justify-center items-center gap-2"
                                    >
                                        <Sparkles className="text-brand-400" /> Generate Visual Pitch
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-12">
                                <Search size={48} className="mb-4 opacity-20" />
                                <p>Upload a screenshot to qualify this lead.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: SOLUTION (VISUAL PITCH) */}
            {activeTab === 'solution' && (
                <div className="animate-fade-in space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Before */}
                        <div>
                            <h3 className="font-bold text-slate-500 mb-2 uppercase text-xs tracking-wider">Current (Problem)</h3>
                            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm opacity-75 grayscale-[30%] mb-4">
                                {selectedImage ? (
                                    <img src={selectedImage} className="w-full" alt="Before" />
                                ) : (
                                    <div className="h-64 bg-slate-100 flex items-center justify-center text-slate-400">Original Screenshot Needed</div>
                                )}
                            </div>

                            {/* Template Selector */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Select Proposal Template
                                </label>
                                <select
                                    value={selectedTemplate}
                                    onChange={(e) => setSelectedTemplate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2.5 outline-none"
                                >
                                    <option value="1">Modern Clean</option>
                                    <option value="2">Corporate Professional</option>
                                    <option value="3">Dark Luxury</option>
                                    <option value="4">Vibrant Creative</option>
                                    <option value="5">SaaS High Conversion</option>
                                </select>
                                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                    This will extract brand assets from the screenshot above and apply them to the selected template layout.
                                </p>
                            </div>
                        </div>

                        {/* After */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-brand-600 mb-2 uppercase text-xs tracking-wider flex items-center gap-2">
                                    <Sparkles size={14} /> Proposed Redesign (Solution)
                                </h3>


                                <button
                                    onClick={handleGenerateRedesign}
                                    disabled={isGeneratingRedesign || !selectedImage}
                                    className="text-xs bg-brand-600 text-white px-3 py-1 rounded-md hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    <RefreshCw size={12} className={isGeneratingRedesign ? "animate-spin" : ""} />
                                    {isGeneratingRedesign ? 'Designing...' : (business.redesignImageUrl ? 'Regenerate' : 'Generate New Look')}
                                </button>
                            </div>

                            {redesignError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                    <span className="font-bold">Error:</span> {redesignError}
                                </div>
                            )}

                            {business.redesignImageUrl ? (
                                <div className="space-y-4">
                                    {/* Success Message */}
                                    {!isGeneratingRedesign && (
                                        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm font-medium border border-emerald-100 flex items-center gap-2">
                                            <CheckCircle className="text-emerald-500" size={16} />
                                            Design updated! Brand assets and services mirrored.
                                        </div>
                                    )}

                                    {/* Unified "Full Page" View */}
                                    <div className="rounded-xl overflow-hidden border-2 border-brand-500 shadow-2xl relative group bg-white">
                                        <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center">
                                            <span className="text-xs font-bold tracking-widest uppercase">Proposed Full-Page Redesign</span>
                                            <span className="text-[10px] opacity-70">2K Resolution • Brand Assets Retained</span>
                                        </div>
                                        <img
                                            src={business.redesignBelowFoldUrl || business.redesignImageUrl}
                                            className="w-full shadow-inner"
                                            alt="Proposed Redesign"
                                        />
                                        <a
                                            href={business.redesignBelowFoldUrl || business.redesignImageUrl}
                                            download={`${business.name.replace(/\s+/g, '_')}_Redesign.png`}
                                            className="absolute bottom-4 right-4 bg-white/95 p-3 rounded-full text-slate-900 hover:text-brand-600 shadow-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                                        >
                                            <Download size={20} />
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-slate-200">
                                    {isGeneratingRedesign ? (
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent"></div>
                                            <p className="text-brand-600 font-bold animate-pulse text-center">Analyzing Brand DNA &<br />Redesigning Full Page...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Palette size={48} className="mb-4 opacity-20" />
                                            <p className="font-medium text-slate-500 text-center">Click "Generate New Look" to create a<br />pixel-perfect brand redesign.</p>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Google Slides Proposal Button */}
                            {business.redesignImageUrl && (
                                <div className="mt-6 flex justify-end">
                                    {slideUrl ? (
                                        <a
                                            href={slideUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-yellow-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-yellow-600 shadow-lg flex items-center gap-2"
                                        >
                                            <ExternalLink size={20} /> View Google Slides Proposal
                                        </a>
                                    ) : (
                                        <button
                                            onClick={handleCreateSlides}
                                            disabled={isCreatingSlides}
                                            className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-900 shadow-lg flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isCreatingSlides ? <RefreshCw className="animate-spin" /> : <LayoutDashboard />}
                                            Generate Google Slides Proposal
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ROI / Money Section */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <DollarSign className="text-emerald-500" /> Financial Impact of Redesign
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(auditResult?.actionItems || []).length > 0 ? (
                                auditResult?.actionItems?.map((item, i) => (
                                    <div key={i} className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold uppercase text-brand-700 tracking-wider">{item.category}</span>
                                            <span className="text-xs font-medium text-slate-500">{item.costEstimate}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 mb-1">{item.title}</h4>
                                        <p className="text-sm text-slate-600 mb-3">{item.description}</p>
                                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                                            <TrendingUp size={14} /> Impact: {item.expectedImpact}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm">ROI data will appear after the audit is complete.</p>
                            )}
                        </div>
                    </div>
                </div>
            )
            }

            {/* TAB 3: OUTREACH */}
            {
                activeTab === 'outreach' && (
                    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Contact Info */}
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-slate-900">Contact Profiles</h3>
                                    <button
                                        onClick={handleFindContacts}
                                        disabled={isFindingContacts}
                                        className="text-sm text-brand-600 hover:underline flex items-center gap-1"
                                    >
                                        {isFindingContacts ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                                        Find Contacts
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Email */}
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-md text-slate-500 shadow-sm"><Mail size={18} /></div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Email</p>
                                                <p className="text-sm font-medium text-slate-900">{business.contactEmail || "Not found"}</p>
                                            </div>
                                        </div>
                                        {business.contactEmail && (
                                            <button onClick={() => setMessagePlatform('Email')} className={`p-2 rounded-full ${messagePlatform === 'Email' ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-200'}`}>
                                                <MessageCircle size={18} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Instagram */}
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-md text-pink-500 shadow-sm"><Instagram size={18} /></div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Instagram</p>
                                                {business.instagram ? (
                                                    <a href={business.instagram} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">
                                                        View Profile <ExternalLink size={12} />
                                                    </a>
                                                ) : <p className="text-sm text-slate-400">Not found</p>}
                                            </div>
                                        </div>
                                        {business.instagram && (
                                            <button onClick={() => setMessagePlatform('Instagram')} className={`p-2 rounded-full ${messagePlatform === 'Instagram' ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-200'}`}>
                                                <MessageCircle size={18} />
                                            </button>
                                        )}
                                    </div>

                                    {/* LinkedIn */}
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-md text-blue-700 shadow-sm"><Linkedin size={18} /></div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">LinkedIn</p>
                                                {business.linkedin ? (
                                                    <a href={business.linkedin} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">
                                                        View Profile <ExternalLink size={12} />
                                                    </a>
                                                ) : <p className="text-sm text-slate-400">Not found</p>}
                                            </div>
                                        </div>
                                        {business.linkedin && (
                                            <button onClick={() => setMessagePlatform('LinkedIn')} className={`p-2 rounded-full ${messagePlatform === 'LinkedIn' ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-200'}`}>
                                                <MessageCircle size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AI Message Generator */}
                        <div className="flex flex-col h-full">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-900">AI Outreach Message</h3>
                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">Platform: {messagePlatform}</span>
                                </div>

                                <div className="flex-1 bg-slate-50 rounded-lg p-4 border border-slate-100 mb-4 overflow-y-auto">
                                    {generatedMessage ? (
                                        <p className="whitespace-pre-wrap text-slate-700 text-sm">{generatedMessage}</p>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <Sparkles size={32} className="mb-2 opacity-30" />
                                            <p className="text-xs">Select a channel and click generate</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 mb-3">
                                    <button
                                        onClick={handleGenerateMessage}
                                        disabled={isWritingMessage}
                                        className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {isWritingMessage ? 'Writing...' : 'Generate Message'}
                                    </button>
                                    <button
                                        onClick={copyToClipboard}
                                        disabled={!generatedMessage}
                                        className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                                    </button>
                                </div>

                                {/* Send Action Buttons */}
                                {generatedMessage && (
                                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                                        {messagePlatform === 'Email' && business.contactEmail && (
                                            <a
                                                href={`mailto:${business.contactEmail}?subject=Website Improvement Opportunity for ${business.name}&body=${encodeURIComponent(generatedMessage)}`}
                                                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 flex justify-center items-center gap-2"
                                            >
                                                <Mail size={18} /> Send Email
                                            </a>
                                        )}
                                        {messagePlatform === 'LinkedIn' && business.linkedin && (
                                            <a
                                                href={business.linkedin}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={() => navigator.clipboard.writeText(generatedMessage)}
                                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 flex justify-center items-center gap-2"
                                            >
                                                <Linkedin size={18} /> Open LinkedIn (msg copied)
                                            </a>
                                        )}
                                        {messagePlatform === 'Instagram' && business.instagram && (
                                            <a
                                                href={business.instagram}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={() => navigator.clipboard.writeText(generatedMessage)}
                                                className="flex-1 bg-pink-600 text-white py-2.5 rounded-lg font-medium hover:bg-pink-700 flex justify-center items-center gap-2"
                                            >
                                                <Instagram size={18} /> Open Instagram (msg copied)
                                            </a>
                                        )}
                                        {!((messagePlatform === 'Email' && business.contactEmail) ||
                                            (messagePlatform === 'LinkedIn' && business.linkedin) ||
                                            (messagePlatform === 'Instagram' && business.instagram)) && (
                                                <p className="text-xs text-slate-500 text-center w-full">
                                                    No {messagePlatform} contact found. Use "Find Contacts" or copy message manually.
                                                </p>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// CheckCircle, AlertTriangle are now imported from lucide-react

export default AnalysisDetail;