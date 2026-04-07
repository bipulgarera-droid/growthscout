"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

const TOTAL_FRAMES = 192;
const FRAME_PATH = "/sequence/device_";

// ===========================================
// PERSONALIZATION CONFIG - EDIT THIS FOR EACH PROSPECT
// ===========================================
const BRAND = {
    name: "LASER HAIR REMOVAL RONDEBOSCH",
    tagline: "Glow with Confidence",
    location: "Rondebosch, South Africa",
    ctaText: "Book Consultation",
    ctaLink: "tel:+27211234567",
    accentColor: "#4FD1C5", // Teal - can be swapped per brand
};

const SERVICES = [
    { title: "Laser Hair Removal", description: "Permanent solution to unwanted hair" },
    { title: "Skin Rejuvenation", description: "Restore your natural radiance" },
    { title: "Personalised Care", description: "Treatments tailored to you" },
];

// Text overlay content - PERSONALIZED FOR RONDEBOSCH
const TEXT_OVERLAYS = [
    {
        id: "beat-a",
        startProgress: 0,
        endProgress: 0.15,
        position: "bottom-center" as const,
        title: "GLOW WITH CONFIDENCE",
        subtitle: "Professional laser precision for silky, hair-free skin.",
    },
    {
        id: "beat-b",
        startProgress: 0.30,
        endProgress: 0.45,
        position: "middle-left" as const,
        title: "ADVANCED TECHNOLOGY",
        subtitle: "State-of-the-art laser systems for permanent results.",
    },
    {
        id: "beat-c",
        startProgress: 0.55,
        endProgress: 0.70,
        position: "middle-right" as const,
        title: "PERSONALISED CARE",
        subtitle: "Every treatment tailored to your unique skin needs.",
    },
    {
        id: "beat-d",
        startProgress: 0.80,
        endProgress: 1.0,
        position: "center" as const,
        title: "BOOK YOUR CONSULTATION",
        subtitle: `Experience the ${BRAND.location.split(',')[0]} difference today.`,
        hasCta: true,
    },
];
// ===========================================

interface TextOverlayProps {
    overlay: typeof TEXT_OVERLAYS[0];
    scrollProgress: number;
}

function TextOverlay({ overlay, scrollProgress }: TextOverlayProps) {
    const isInRange = scrollProgress >= overlay.startProgress && scrollProgress <= overlay.endProgress;
    const rangeCenter = (overlay.startProgress + overlay.endProgress) / 2;
    const rangeHalf = (overlay.endProgress - overlay.startProgress) / 2;

    let opacity = 0;
    if (isInRange) {
        const distanceFromCenter = Math.abs(scrollProgress - rangeCenter);
        opacity = 1 - (distanceFromCenter / rangeHalf) * 0.5;
        opacity = Math.max(0, Math.min(1, opacity));
    }

    const translateY = isInRange ? 0 : 20;

    const positionClasses = {
        "bottom-center": "bottom-[10%] left-1/2 -translate-x-1/2 text-center",
        "middle-left": "top-1/2 left-[5%] md:left-[10%] -translate-y-1/2 text-left",
        "middle-right": "top-1/2 right-[5%] md:right-[10%] -translate-y-1/2 text-right",
        "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center",
    };

    return (
        <motion.div
            className={`absolute z-20 max-w-md md:max-w-lg px-6 ${positionClasses[overlay.position]}`}
            animate={{
                opacity,
                y: translateY,
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-ultra-wide text-white mb-4 uppercase">
                {overlay.title}
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-text-secondary tracking-wide leading-relaxed">
                {overlay.subtitle}
            </p>
            {overlay.hasCta && (
                <motion.a
                    href={BRAND.ctaLink}
                    className="inline-block mt-8 px-8 py-4 border border-white/30 text-white uppercase tracking-widest text-sm
                     hover:border-accent hover:text-accent transition-all duration-300
                     hover:shadow-[0_0_30px_rgba(79,209,197,0.3)]"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {BRAND.ctaText}
                </motion.a>
            )}
        </motion.div>
    );
}

// Services Section - NEW
function ServicesSection() {
    return (
        <section className="bg-black py-20 px-6">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-accent text-xs tracking-ultra-wide uppercase mb-8 text-center">
                    Our Services
                </h2>
                <div className="grid md:grid-cols-3 gap-8">
                    {SERVICES.map((service, idx) => (
                        <div key={idx} className="text-center p-6 border border-white/10 hover:border-accent/50 transition-colors">
                            <h3 className="text-white text-lg font-bold mb-2 uppercase tracking-wide">
                                {service.title}
                            </h3>
                            <p className="text-text-secondary text-sm">
                                {service.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function LoadingScreen({ progress }: { progress: number }) {
    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
            <div className="text-accent text-sm tracking-ultra-wide uppercase mb-4 animate-pulse-glow">
                {BRAND.name}
            </div>
            <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                />
            </div>
            <div className="text-white/50 text-xs mt-3 tracking-widest">
                {Math.round(progress)}%
            </div>
        </div>
    );
}

// Main scrollytelling component
function ScrollytellingContent({ images }: { images: HTMLImageElement[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [currentFrame, setCurrentFrame] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const containerHeight = containerRef.current.offsetHeight;

            const scrollableDistance = containerHeight - windowHeight;
            const scrolled = -rect.top;
            const progress = Math.max(0, Math.min(1, scrolled / scrollableDistance));

            setCurrentProgress(progress);
            const targetFrame = Math.round(progress * (TOTAL_FRAMES - 1));
            setCurrentFrame(targetFrame);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current) {
                const dpr = window.devicePixelRatio || 1;
                const rect = canvasRef.current.getBoundingClientRect();
                canvasRef.current.width = rect.width * dpr;
                canvasRef.current.height = rect.height * dpr;
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const drawFrame = useCallback(
        (index: number) => {
            if (!canvasRef.current || images.length === 0) return;

            const ctx = canvasRef.current.getContext("2d");
            if (!ctx) return;

            const frameIdx = Math.min(Math.max(0, Math.round(index)), images.length - 1);
            const img = images[frameIdx];
            if (!img) return;

            const canvas = canvasRef.current;

            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const cropPercent = 0.08;
            const srcWidth = img.naturalWidth;
            const srcHeight = img.naturalHeight * (1 - cropPercent);

            const imgAspect = srcWidth / srcHeight;
            const canvasAspect = canvas.width / canvas.height;

            let destWidth: number, destHeight: number, destX: number, destY: number;

            if (imgAspect > canvasAspect) {
                destWidth = canvas.width;
                destHeight = canvas.width / imgAspect;
                destX = 0;
                destY = (canvas.height - destHeight) / 2;
            } else {
                destHeight = canvas.height;
                destWidth = canvas.height * imgAspect;
                destX = (canvas.width - destWidth) / 2;
                destY = 0;
            }

            ctx.drawImage(
                img,
                0, 0, srcWidth, srcHeight,
                destX, destY, destWidth, destHeight
            );
        },
        [images]
    );

    useEffect(() => {
        drawFrame(currentFrame);
    }, [currentFrame, drawFrame]);

    useEffect(() => {
        if (images.length > 0) {
            drawFrame(0);
        }
    }, [images, drawFrame]);

    return (
        <>
            <div ref={containerRef} className="relative h-[500vh] bg-black">
                <div className="sticky top-0 h-screen w-full overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full object-contain"
                        style={{ background: "#000000" }}
                    />

                    {TEXT_OVERLAYS.map((overlay) => (
                        <TextOverlay
                            key={overlay.id}
                            overlay={overlay}
                            scrollProgress={currentProgress}
                        />
                    ))}
                </div>
            </div>

            {/* Services Section - Added below hero */}
            <ServicesSection />
        </>
    );
}

export default function DeviceScrollyTelling() {
    const [images, setImages] = useState<HTMLImageElement[]>([]);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadImages = async () => {
            const imagePromises: Promise<HTMLImageElement>[] = [];

            for (let i = 0; i < TOTAL_FRAMES; i++) {
                const promise = new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        setLoadingProgress((prev) => {
                            const newProgress = ((i + 1) / TOTAL_FRAMES) * 100;
                            return Math.max(prev, newProgress);
                        });
                        resolve(img);
                    };
                    img.onerror = reject;
                    img.src = `${FRAME_PATH}${String(i).padStart(3, "0")}.jpg`;
                });
                imagePromises.push(promise);
            }

            try {
                const loadedImages = await Promise.all(imagePromises);
                setImages(loadedImages);
                setIsLoaded(true);
            } catch (error) {
                console.error("Failed to load images:", error);
            }
        };

        loadImages();
    }, []);

    if (!isLoaded) {
        return <LoadingScreen progress={loadingProgress} />;
    }

    return <ScrollytellingContent images={images} />;
}
