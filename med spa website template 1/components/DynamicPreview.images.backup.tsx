"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";


// Type for preview data from Supabase
interface PreviewData {
    id: string;
    slug: string;
    business_name: string;
    tagline: string;
    website_url: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
    };
    services: string[];
    value_props: string[];
    cta_text: string;
    contact_info: {
        phone?: string;
        email?: string;
        address?: string;
    };
    logo_url?: string;
    industry?: string;
    vibe?: string;
    hero_phrases?: string[];
}

interface DynamicPreviewProps {
    data: PreviewData;
}

export default function DynamicPreview({ data }: DynamicPreviewProps) {
    const services = data.services || [];
    const valueProps = data.value_props || [];

    return (
        <main className="bg-black min-h-screen antialiased">
            {/* Hero Scrollytelling */}
            <HeroAnimation data={data} />

            {/* Section: Brand Statement */}
            <section className="bg-black py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-start mb-8">
                        <span className="text-white/30 text-xs font-mono tracking-widest uppercase">
                            {data.industry?.toUpperCase() || "AESTHETICS"}
                        </span>
                        <span className="text-white/30 text-xs font-mono tracking-widest uppercase">
                            PRECISION / RESULTS / CONFIDENCE
                        </span>
                    </div>

                    <h2 className="text-6xl md:text-8xl lg:text-9xl font-bold text-white leading-[0.9] tracking-tight">
                        {data.business_name?.toUpperCase() || "YOUR BRAND"}
                    </h2>
                    <p className="text-white/50 text-xl md:text-2xl mt-8 max-w-2xl">
                        {data.tagline || "Experience the difference of expert care and advanced technology."}
                    </p>
                </div>
            </section>

            {/* Services Bento Grid */}
            <section className="bg-white py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-end mb-12">
                        <h2 className="text-4xl md:text-5xl font-bold text-black">Our Services</h2>
                        <span className="text-black/40 text-xs font-mono tracking-widest uppercase hidden md:block">
                            TREATMENTS
                        </span>
                    </div>

                    <div className="grid grid-cols-12 gap-4 md:gap-6">
                        {/* Primary Service Card */}
                        <motion.div
                            className="col-span-12 md:col-span-6 bg-black rounded-2xl p-8 min-h-[350px] flex flex-col justify-between"
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg border border-white/20 flex items-center justify-center text-sm font-mono text-white/60">
                                    01
                                </div>
                                <span className="text-white/40 text-xs font-mono tracking-widest uppercase">
                                    FEATURED
                                </span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
                                    {services[0] || "Featured Service"}
                                </h3>
                                <p className="text-white/50 text-sm leading-relaxed">
                                    {valueProps[1] || "Advanced solutions tailored to your needs. Experience the difference."}
                                </p>
                            </div>
                        </motion.div>

                        {/* Service Cards Grid */}
                        {services.slice(1, 5).map((service, index) => (
                            <motion.div
                                key={index}
                                className="col-span-6 md:col-span-3 bg-[#F5F5F5] rounded-2xl p-6 min-h-[200px] flex flex-col justify-between"
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1 * (index + 1) }}
                            >
                                <div className="w-8 h-8 rounded-lg border border-black/10 flex items-center justify-center text-xs font-mono text-black/40">
                                    {String(index + 2).padStart(2, '0')}
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-black leading-tight">
                                    {service}
                                </h3>
                            </motion.div>
                        ))}

                        {/* Value Prop Card */}
                        <motion.div
                            className="col-span-12 md:col-span-6 bg-[#E8E4E0] rounded-2xl p-8 flex items-center justify-between"
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.5 }}
                        >
                            <div>
                                <span className="text-black/40 text-xs font-mono tracking-widest uppercase block mb-2">
                                    WHY CHOOSE US
                                </span>
                                <h3 className="text-2xl md:text-3xl font-bold text-black">
                                    {valueProps[0] || "Expert Care & Advanced Technology"}
                                </h3>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="bg-black py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-end mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-white">What Clients Say</h2>
                        <span className="text-white/30 text-xs font-mono tracking-widest uppercase hidden md:block">
                            TESTIMONIALS
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                quote: "The results exceeded my expectations. Professional team and state-of-the-art equipment.",
                                name: "Sarah M.",
                                detail: "Verified Client"
                            },
                            {
                                quote: "Finally found a place that understands what I need. Highly recommend their services!",
                                name: "Lisa K.",
                                detail: "6 Month Client"
                            },
                            {
                                quote: "Clean facility, knowledgeable staff, and amazing results. Worth every penny.",
                                name: "Michelle T.",
                                detail: "Regular Client"
                            }
                        ].map((testimonial, index) => (
                            <motion.div
                                key={index}
                                className="bg-white/5 border border-white/10 rounded-2xl p-8"
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.1 * index }}
                            >
                                <div className="flex gap-1 mb-6">
                                    {[...Array(5)].map((_, i) => (
                                        <svg key={i} className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ))}
                                </div>
                                <p className="text-white/80 text-lg leading-relaxed italic mb-6">
                                    "{testimonial.quote}"
                                </p>
                                <div>
                                    <p className="text-white font-bold">{testimonial.name}</p>
                                    <p className="text-white/40 text-sm">{testimonial.detail}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="bg-white py-32 px-6 relative overflow-hidden">
                {/* Background Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span className="text-[15vw] font-bold text-black/[0.03] whitespace-nowrap tracking-tighter">
                        BOOK NOW
                    </span>
                </div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <motion.h2
                        className="text-5xl md:text-7xl lg:text-8xl font-bold text-black leading-[0.9] tracking-tight mb-6"
                        initial={{ opacity: 0, y: 60 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        READY TO
                        <br />
                        <span className="text-black/60">TRANSFORM?</span>
                    </motion.h2>

                    <motion.p
                        className="text-black/50 text-lg md:text-xl mb-12 max-w-xl mx-auto"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        Book your free consultation today. Experience the {data.business_name || "difference"} difference.
                    </motion.p>

                    {/* Primary CTA Button */}
                    <motion.a
                        href={data.website_url || "#"}
                        className="group inline-flex items-center justify-center gap-3 px-12 py-5 bg-black text-white font-bold text-sm tracking-widest uppercase transition-all duration-300 hover:bg-black/80"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <span>{data.cta_text || "BOOK FREE CONSULTATION"}</span>
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </motion.a>

                    {/* Contact Info */}
                    {data.contact_info?.phone && (
                        <motion.p
                            className="text-black/40 text-sm font-mono tracking-widest uppercase mt-8"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                        >
                            OR CALL: {data.contact_info.phone}
                        </motion.p>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-black py-12 px-6 text-center">
                <span className="text-white/30 text-xs font-mono tracking-widest uppercase">
                    {data.business_name?.toUpperCase()} © 2026
                </span>
            </footer>
        </main>
    );
}


// Hero Animation Component - Canvas Image Sequence
const TOTAL_FRAMES = 192;

// Preloader: loads ALL frames before allowing interaction (parallel batches for speed)
function HeroPreloader({
    onProgress,
    onComplete
}: {
    onProgress: (percent: number) => void;
    onComplete: () => void;
}) {
    useEffect(() => {
        let mounted = true;
        const BATCH_SIZE = 10; // Load 10 images at a time for speed

        const loadAllFrames = async () => {
            let loaded = 0;

            for (let batch = 0; batch < TOTAL_FRAMES; batch += BATCH_SIZE) {
                if (!mounted) return;

                // Create batch of image load promises
                const batchPromises = [];
                for (let i = batch; i < Math.min(batch + BATCH_SIZE, TOTAL_FRAMES); i++) {
                    const img = new Image();
                    img.src = `/frames/frame_${String(i).padStart(3, "0")}.jpg`;
                    batchPromises.push(new Promise((resolve) => {
                        img.onload = () => { loaded++; resolve(null); };
                        img.onerror = () => { loaded++; resolve(null); };
                    }));
                }

                // Wait for entire batch
                await Promise.all(batchPromises);

                if (mounted) {
                    onProgress(Math.round((loaded / TOTAL_FRAMES) * 100));
                }
            }

            if (mounted) {
                onComplete();
            }
        };

        loadAllFrames();

        return () => { mounted = false; };
    }, [onProgress, onComplete]);

    return null; // Invisible preloader
}

function HeroAnimation({ data }: { data: PreviewData }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [images, setImages] = useState<HTMLImageElement[]>([]);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [firstFrameReady, setFirstFrameReady] = useState(false);

    // Load ALL frames in parallel for maximum speed
    useEffect(() => {
        const loadImages = () => {
            const imageArray: HTMLImageElement[] = new Array(TOTAL_FRAMES);
            let loadedCount = 0;

            for (let i = 0; i < TOTAL_FRAMES; i++) {
                const img = new Image();
                img.src = `/frames/frame_${String(i).padStart(3, "0")}.jpg`;
                imageArray[i] = img;

                img.onload = () => {
                    loadedCount++;
                    if (i === 0) {
                        setFirstFrameReady(true);
                    }
                    // Update state when all loaded
                    if (loadedCount === TOTAL_FRAMES) {
                        setImages(imageArray);
                    }
                };
                img.onerror = () => {
                    loadedCount++;
                    if (loadedCount === TOTAL_FRAMES) {
                        setImages(imageArray);
                    }
                };
            }

            // Set initial array immediately so first frames can render
            setImages(imageArray);
        };
        loadImages();
    }, []);

    // Store images in ref for use in scroll handler (avoids stale closure)
    const imagesRef = useRef<HTMLImageElement[]>([]);
    useEffect(() => {
        imagesRef.current = images;
    }, [images]);

    // Combined scroll + draw handler - bypasses React state for smooth animation
    useEffect(() => {
        let lastFrame = -1;

        const drawFrame = (frameIndex: number) => {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext("2d");
            if (!ctx) return;

            const imgs = imagesRef.current;
            if (imgs.length === 0) return;

            const img = imgs[frameIndex];
            if (!img || !img.complete || img.naturalWidth === 0) return;

            const canvas = canvasRef.current;
            const dpr = window.devicePixelRatio || 1;

            // Set canvas size
            if (canvas.width !== canvas.offsetWidth * dpr) {
                canvas.width = canvas.offsetWidth * dpr;
                canvas.height = canvas.offsetHeight * dpr;
                ctx.scale(dpr, dpr);
            }

            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

            // Draw image centered/cover
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const canvasAspect = canvas.offsetWidth / canvas.offsetHeight;
            let destWidth, destHeight, destX, destY;

            if (imgAspect > canvasAspect) {
                destHeight = canvas.offsetHeight;
                destWidth = canvas.offsetHeight * imgAspect;
                destX = (canvas.offsetWidth - destWidth) / 2;
                destY = 0;
            } else {
                destWidth = canvas.offsetWidth;
                destHeight = canvas.offsetWidth / imgAspect;
                destX = 0;
                destY = (canvas.offsetHeight - destHeight) / 2;
            }

            ctx.drawImage(img, destX, destY, destWidth, destHeight);
        };

        const handleScroll = () => {
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const containerHeight = containerRef.current.offsetHeight;

            const scrollableDistance = containerHeight - windowHeight;
            const scrolled = -rect.top;
            const progress = Math.max(0, Math.min(1, scrolled / scrollableDistance));

            // Calculate frame
            const imgs = imagesRef.current;
            const maxLoadedFrame = Math.max(0, imgs.length - 1);
            const targetFrame = Math.round(progress * (TOTAL_FRAMES - 1));
            const frameIndex = Math.min(targetFrame, maxLoadedFrame);

            // Only redraw if frame changed
            if (frameIndex !== lastFrame) {
                lastFrame = frameIndex;
                requestAnimationFrame(() => drawFrame(frameIndex));
            }

            // Update progress for text overlays (this React state is fine - less frequent)
            setCurrentProgress(progress);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });

        // Initial draw
        handleScroll();
        requestAnimationFrame(() => drawFrame(0));

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Dynamic text overlays - uses complete hero_phrases from AI
    const heroPhrases = data.hero_phrases || [];

    const TEXT_OVERLAYS = [
        {
            id: "beat-a",
            startProgress: 0,
            endProgress: 0.25,
            text: heroPhrases[0] || data.tagline?.toUpperCase() || "INNOVATION PERFECTED",
            highlight: true,
        },
        {
            id: "beat-b",
            startProgress: 0.35,
            endProgress: 0.55,
            text: heroPhrases[1] || `${data.business_name?.toUpperCase()} PERFECTED`,
            highlight: true,
        },
        {
            id: "beat-c",
            startProgress: 0.65,
            endProgress: 0.85,
            text: heroPhrases[2] || "EXCELLENCE DELIVERED",
            highlight: true,
        },
    ];

    return (
        <div ref={containerRef} className="relative h-[500vh] bg-black">
            <div className="sticky top-0 h-screen w-full overflow-hidden">
                {/* Canvas for frame sequence */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ background: "#000" }}
                />

                {/* Floating Nav */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
                    <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
                        <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {/* Logo or Business Name */}
                        {data.logo_url ? (
                            <img
                                src={data.logo_url}
                                alt={data.business_name}
                                className="h-6 max-w-[120px] object-contain px-2 brightness-0 invert"
                            />
                        ) : (
                            <span className="text-white text-sm font-medium px-3">
                                {data.business_name || "Home"}
                            </span>
                        )}
                        <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Text Overlays - only show after first frame loads */}
                {firstFrameReady && TEXT_OVERLAYS.map((overlay) => (
                    <TextOverlay
                        key={overlay.id}
                        overlay={overlay}
                        scrollProgress={currentProgress}
                    />
                ))}

                {/* Scroll Indicator */}
                <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-xs font-mono tracking-[0.3em] uppercase"
                    animate={{ opacity: currentProgress > 0.1 ? 0 : 1 }}
                >
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        SCROLL
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}


// Text Overlay Component
function TextOverlay({
    overlay,
    scrollProgress,
}: {
    overlay: any;
    scrollProgress: number;
}) {
    const isInRange = scrollProgress >= overlay.startProgress && scrollProgress <= overlay.endProgress;
    const rangeCenter = (overlay.startProgress + overlay.endProgress) / 2;
    const rangeHalf = (overlay.endProgress - overlay.startProgress) / 2;

    let opacity = 0;
    let translateY = 20;

    if (isInRange) {
        const distanceFromCenter = Math.abs(scrollProgress - rangeCenter);
        opacity = 1 - (distanceFromCenter / rangeHalf) * 0.5;
        opacity = Math.max(0, Math.min(1, opacity));
        translateY = 0;
    }

    return (
        <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity, y: translateY }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white text-center leading-[0.9] tracking-tight px-4">
                {overlay.text}
            </h2>
        </motion.div>
    );
}
