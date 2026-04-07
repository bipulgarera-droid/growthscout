"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";

const TOTAL_FRAMES = 192;
const FRAME_PATH = "/sequence/device_";

// ===========================================
// PERSONALIZATION CONFIG - EXTRACTED FROM ACTUAL WEBSITE
// ===========================================
const BRAND = {
    name: "Rondebosch Laser Hair Removal",
    tagline: "Glow with Confidence",
    location: "Rondebosch, South Africa",
    ctaText: "Book Now",
    ctaLink: "https://laserhairremovalrondebosch.co.za/book-now/",
    phone: "+27 21 XXX XXXX", // To be extracted
    whatsapp: "https://wa.me/27XXXXXXXXX",
    instagram: "https://instagram.com/",
    colors: {
        primary: "#FFD5C2", // Pink/Peach from their actual site
        secondary: "#000000",
        accent: "#F5B5A0", // Darker peach
        text: "#333333",
        background: "#FFFFFF",
    },
};

// ACTUAL SERVICES from their navigation menu
const SERVICES = [
    {
        title: "Laser Hair Removal",
        description: "Permanent solution for smooth, hair-free skin",
    },
    {
        title: "Cosmelan",
        description: "Professional depigmentation treatment",
    },
    {
        title: "Threading & Waxing",
        description: "Precision hair removal for face and body",
    },
    {
        title: "Peels",
        description: "Revitalize and renew your skin",
    },
    {
        title: "Dermaplaning",
        description: "Gentle exfoliation for smoother skin",
    },
    {
        title: "Microneedling",
        description: "Stimulate collagen for youthful skin",
    },
    {
        title: "LED Light Therapy",
        description: "Advanced treatment for skin rejuvenation",
    },
    {
        title: "Tinting & Henna Eyebrow",
        description: "Define and enhance your natural brows",
    },
];

// VALUE PROPS from "Why Choose Us" section
const VALUE_PROPS = [
    {
        title: "State-of-the-Art Technology",
        description: "Our clinic is equipped with the latest laser technology to ensure precise and effective treatments.",
    },
    {
        title: "Experienced Professionals",
        description: "Our highly trained team works with you to understand your skin's needs and provide customized solutions.",
    },
    {
        title: "Safety & Results",
        description: "Equipment regularly serviced and recalibrated to ensure maximum safety and optimal results.",
    },
];

// TESTIMONIALS (to be extracted or placeholder)
const TESTIMONIALS = [
    {
        name: "Sarah M.",
        text: "Amazing results! Finally confident to wear sleeveless tops. The team made me feel so comfortable.",
        rating: 5,
    },
    {
        name: "Lisa K.",
        text: "Professional service and visible results from the first session. Highly recommend!",
        rating: 5,
    },
    {
        name: "Michelle T.",
        text: "Been coming here for 6 months. Best decision I ever made for my skin.",
        rating: 5,
    },
];

// Text overlays for scroll animation - PERSONALIZED
const TEXT_OVERLAYS = [
    {
        id: "beat-a",
        startProgress: 0,
        endProgress: 0.15,
        position: "bottom-center" as const,
        title: "GLOW WITH CONFIDENCE",
        subtitle: "Your trusted destination for professional laser & skincare in Rondebosch.",
    },
    {
        id: "beat-b",
        startProgress: 0.30,
        endProgress: 0.45,
        position: "middle-left" as const,
        title: "ADVANCED TECHNOLOGY",
        subtitle: "State-of-the-art equipment, regularly serviced for maximum safety.",
    },
    {
        id: "beat-c",
        startProgress: 0.55,
        endProgress: 0.70,
        position: "middle-right" as const,
        title: "EXPERT CARE",
        subtitle: "Highly trained professionals. Customized solutions for your unique needs.",
    },
    {
        id: "beat-d",
        startProgress: 0.80,
        endProgress: 1.0,
        position: "center" as const,
        title: "BOOK YOUR SESSION",
        subtitle: "Experience the Rondebosch difference today.",
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
            <p className="text-sm md:text-base lg:text-lg text-white/70 tracking-wide leading-relaxed">
                {overlay.subtitle}
            </p>
            {overlay.hasCta && (
                <motion.a
                    href={BRAND.ctaLink}
                    className="inline-block mt-8 px-8 py-4 text-white uppercase tracking-widest text-sm
                     transition-all duration-300 hover:scale-105"
                    style={{
                        backgroundColor: BRAND.colors.primary,
                        color: BRAND.colors.secondary,
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {BRAND.ctaText}
                </motion.a>
            )}
        </motion.div>
    );
}

// BRANDING SECTION - New
function BrandingSection() {
    return (
        <section className="py-20 px-6" style={{ backgroundColor: BRAND.colors.background }}>
            <div className="max-w-4xl mx-auto text-center">
                {/* Logo placeholder - would be replaced with actual logo */}
                <div className="mb-8 flex justify-center">
                    <div
                        className="w-32 h-32 rounded-full flex items-center justify-center text-lg font-bold uppercase tracking-wide"
                        style={{ backgroundColor: BRAND.colors.primary, color: BRAND.colors.secondary }}
                    >
                        LOGO
                    </div>
                </div>
                <h2
                    className="text-3xl md:text-4xl font-bold mb-4"
                    style={{ color: BRAND.colors.secondary }}
                >
                    {BRAND.name}
                </h2>
                <p
                    className="text-lg md:text-xl italic mb-6"
                    style={{ color: BRAND.colors.accent }}
                >
                    "{BRAND.tagline}"
                </p>
                <p className="text-base max-w-2xl mx-auto" style={{ color: BRAND.colors.text }}>
                    Your trusted destination for high-quality, professional skin and laser hair removal
                    treatments in Rondebosch. We're committed to helping you achieve smooth, glowing
                    skin with advanced techniques and personalised care.
                </p>
            </div>
        </section>
    );
}

// VALUE PROPS SECTION - "Why Choose Us"
function ValuePropsSection() {
    return (
        <section className="py-20 px-6 bg-gray-50">
            <div className="max-w-5xl mx-auto">
                <h2
                    className="text-2xl md:text-3xl font-bold text-center mb-12"
                    style={{ color: BRAND.colors.secondary }}
                >
                    Why Choose {BRAND.name}?
                </h2>
                <div className="grid md:grid-cols-3 gap-8">
                    {VALUE_PROPS.map((prop, idx) => (
                        <motion.div
                            key={idx}
                            className="p-6 bg-white rounded-lg shadow-sm text-center"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <div
                                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-sm font-bold"
                                style={{ backgroundColor: BRAND.colors.primary, color: BRAND.colors.secondary }}
                            >
                                {idx === 0 ? "01" : idx === 1 ? "02" : "03"}
                            </div>
                            <h3
                                className="text-lg font-bold mb-2"
                                style={{ color: BRAND.colors.secondary }}
                            >
                                {prop.title}
                            </h3>
                            <p className="text-sm" style={{ color: BRAND.colors.text }}>
                                {prop.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// SERVICES SECTION - All 8 actual services
function ServicesSection() {
    return (
        <section className="py-20 px-6" style={{ backgroundColor: BRAND.colors.background }}>
            <div className="max-w-6xl mx-auto">
                <h2
                    className="text-2xl md:text-3xl font-bold text-center mb-4"
                    style={{ color: BRAND.colors.secondary }}
                >
                    Our Services
                </h2>
                <p className="text-center mb-12 max-w-2xl mx-auto" style={{ color: BRAND.colors.text }}>
                    From hair removal to skincare, we offer a range of treatments that restore
                    confidence and enhance your natural radiance.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {SERVICES.map((service, idx) => (
                        <motion.div
                            key={idx}
                            className="p-6 rounded-lg text-center cursor-pointer transition-all duration-300 hover:shadow-lg"
                            style={{
                                backgroundColor: BRAND.colors.primary + "30",
                                border: `1px solid ${BRAND.colors.primary}`,
                            }}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileHover={{ scale: 1.03 }}
                        >
                            <h3
                                className="font-bold mb-2 text-sm uppercase tracking-wide"
                                style={{ color: BRAND.colors.secondary }}
                            >
                                {service.title}
                            </h3>
                            <p className="text-xs" style={{ color: BRAND.colors.text }}>
                                {service.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// TESTIMONIALS SECTION
function TestimonialsSection() {
    return (
        <section className="py-20 px-6 bg-gray-50">
            <div className="max-w-5xl mx-auto">
                <h2
                    className="text-2xl md:text-3xl font-bold text-center mb-12"
                    style={{ color: BRAND.colors.secondary }}
                >
                    What Our Clients Say
                </h2>
                <div className="grid md:grid-cols-3 gap-8">
                    {TESTIMONIALS.map((testimonial, idx) => (
                        <motion.div
                            key={idx}
                            className="p-6 bg-white rounded-lg shadow-sm"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <div className="flex mb-3">
                                {[...Array(testimonial.rating)].map((_, i) => (
                                    <span key={i} className="text-yellow-400">★</span>
                                ))}
                            </div>
                            <p className="text-sm mb-4 italic" style={{ color: BRAND.colors.text }}>
                                "{testimonial.text}"
                            </p>
                            <p className="font-bold text-sm" style={{ color: BRAND.colors.secondary }}>
                                — {testimonial.name}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// FINAL CTA SECTION
function CTASection() {
    return (
        <section
            className="py-24 px-6 text-center"
            style={{ backgroundColor: BRAND.colors.primary }}
        >
            <div className="max-w-2xl mx-auto">
                <h2
                    className="text-3xl md:text-4xl font-bold mb-4"
                    style={{ color: BRAND.colors.secondary }}
                >
                    Ready to Glow?
                </h2>
                <p className="text-lg mb-8" style={{ color: BRAND.colors.secondary + "CC" }}>
                    Book your consultation today and take the first step towards
                    smooth, radiant skin.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <motion.a
                        href={BRAND.ctaLink}
                        className="px-8 py-4 text-white uppercase tracking-widest text-sm font-bold rounded"
                        style={{ backgroundColor: BRAND.colors.secondary }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Book Now
                    </motion.a>
                    <motion.a
                        href={BRAND.whatsapp}
                        className="px-8 py-4 uppercase tracking-widest text-sm font-bold rounded border-2"
                        style={{
                            borderColor: BRAND.colors.secondary,
                            color: BRAND.colors.secondary,
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        WhatsApp Us
                    </motion.a>
                </div>
            </div>
        </section>
    );
}

function LoadingScreen({ progress }: { progress: number }) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
            <div className="text-white/50 text-xs tracking-widest uppercase mb-4">
                Loading
            </div>
            <div className="w-48 h-[1px] bg-white/20 relative overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-white/60"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                />
            </div>
            <div className="text-white/30 text-xs mt-3 tracking-widest">
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
            {/* Hero Animation Section */}
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

            {/* Branding Section */}
            <BrandingSection />

            {/* Why Choose Us */}
            <ValuePropsSection />

            {/* All Services */}
            <ServicesSection />

            {/* Testimonials */}
            <TestimonialsSection />

            {/* Final CTA */}
            <CTASection />
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
