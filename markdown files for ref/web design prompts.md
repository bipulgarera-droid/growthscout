How I vibecode Beautiful $10,000 AI Websites (AntiGravity) by Itsssssjack
Animated Website Resources






1) Start frame


[PROJECT NAME] – First Frame Product Image
Create a high-quality product image using the uploaded photo of [PRODUCT NAME].
Place the product floating in the center of the frame with a slight, natural tilt, similar to premium ads in the [INDUSTRY / NICHE – e.g. beverage, tech, skincare, fitness] space.
Use clean, soft studio lighting with subtle highlights and shadows so the product looks glossy, dimensional, and premium.
Keep all original label, branding, and surface details sharp and fully readable.
STYLE
Match the aesthetic of modern [DTC / PREMIUM / LUXURY] ads in the [INDUSTRY] space
Simple, minimal, distraction-free composition
Flat background with strong subject separation
Clean edges and crisp contrast
Subtle vignette for focus (no visible gradients)
BACKGROUND
Pure solid [BACKGROUND COLOR – e.g. black (#000000), white, brand color]
No reflections
No textures
No environmental elements
FRAMING
[VERTICAL / HORIZONTAL / SQUARE] frame
Product perfectly centered
Generous negative space around the product
Enough margin for later motion-tracking, cropping, or animation
The product should feel “heroed” and dominant in the frame
OUTPUT
High-resolution still image
Clean background for easy masking and compositing
Maintain the exact shape, colors, and proportions of the user-uploaded product
Do not stylize or alter the product itself—only enhance lighting, placement, and presentation
The final image should look like a top-tier commercial ad frame for [PRODUCT NAME]


2) end frame




2. [PROJECT NAME] – End Frame / Reveal Shot
Create a cinematic end-frame image that reveals the inner world of [PRODUCT NAME] in a visually striking way.
Render an exploded technical view of the same [PRODUCT TYPE – e.g. espresso machine, smartwatch, sneaker, bottle, device], with every major component precisely separated and floating in perfect alignment, suspended in mid-air against a deep studio background.
Show the internal structure clearly and beautifully, including [KEY INTERNAL PARTS – e.g. motor, battery, heating element, pump, circuitry, layers, materials], along with precision-machined components and materials that communicate craftsmanship and engineering depth.
This should feel like a luxury engineering render—hyper-real, elegant, and cinematic.
VISUAL STYLE
Hyper-realistic product visualization
Ultra-sharp focus, zero motion blur
Studio rim lighting consistent with the hero frame
Soft highlights tracing the edges of each component
Controlled reflections on metal, glass, plastic, or fabric surfaces
High-contrast, cinematic lighting
Premium, engineered, “Apple-style” industrial design aesthetic
Clean, dramatic, and modern
COMPOSITION
Exploded view with perfect spacing and symmetry
Components aligned along a clear axis
Floating in mid-air, weightless and precise
The assembly should read instantly as [PRODUCT NAME] when viewed as a whole
No clutter, no chaos—order, clarity, and intention
BACKGROUND
Pure solid [BACKGROUND COLOR – e.g. black (#000000), dark graphite, brand color]
No gradients
No textures
No environmental elements
Designed for clean masking and compositing
RULES
No labels
No annotations
No UI
No text
No diagrams or arrows
Do not distort the product’s true proportions
Preserve realistic materials and construction logic
OUTPUT
Ultra-high-resolution still frame
Photorealistic, cinematic quality
Feels like a premium ad end-shot for [PRODUCT NAME]
Should communicate: “This product is engineered, intentional, and world-class.”


3) Google Flow




[PROJECT NAME] – Transition Flow (Assembled → Exploded)
Create a smooth, cinematic transition from the fully assembled hero product frame to the final exploded / deconstructed reveal using the uploaded product images.
Begin with [PRODUCT NAME] in a mid-rotation pose on a pure solid background. The product should feel suspended in space—calm, controlled, and premium.
As the rotation continues:
Gradually introduce [PRIMARY ELEMENTS – e.g. ingredients, layers, components, materials, particles] entering the frame from behind and around the product
Increase the number and density of these elements as the motion progresses
The movement should feel intentional and engineered, not chaotic
Build visual momentum toward a full reveal moment
Halfway through the transition, introduce a subtle [ENERGY EFFECT – e.g. impact wave, liquid arc, air displacement, light pulse] emerging from behind the product and partially wrapping around it, reinforcing the sense of power and transformation.
All elements must remain:
Ultra-sharp
Suspended in mid-air
Free of motion blur
Clearly readable in silhouette and detail
Throughout the transition:
Keep the product well-lit, centered, and unobstructed
Preserve its exact shape, colors, and proportions
Maintain a clean, premium look at all times
The background must remain:
Pure solid [BACKGROUND COLOR – e.g. black (#000000)]
No gradients
No textures
No environmental effects
End the sequence in the fully exploded / deconstructed composition, with all elements perfectly aligned and suspended in a striking final frame.
The motion should feel:
Smooth
Deliberate
High-end
Cinematic
The result should feel like a world-class product reveal—from hero to inner truth in one continuous, elegant movement.






ANTIGRAVITY SYSTEM PROMPT






## ✅ ACT AS
A world-class Creative Developer (Awwwards-level) specializing in:
- Next.js
- Framer Motion
- Scroll-linked canvas animations


---


## 🎯 THE TASK
Build a premium **scrollytelling landing page** for **[PRODUCT / EXPERIENCE / BRAND]**.


**Core mechanic:** 
A scroll-linked animation that plays an **image sequence** of **[OBJECT / PRODUCT / SCENE]** *transforming / assembling / exploding / evolving* as the user scrolls.


Example uses:
- A supercar assembling itself 
- A sneaker breaking into layers 
- A watch revealing its internals 
- A spacecraft deploying 
- A SaaS product visual metaphor 


---


## 🧰 TECH STACK
- **Framework:** Next.js 14 (App Router) 
- **Styling:** Tailwind CSS 
- **Animation:** Framer Motion 
- **Rendering:** HTML5 Canvas (120-frame image sequence)


---


## 🎨 VISUAL DIRECTION & COLOR
- **Seamless Blending (Non-negotiable):** 
 The page background MUST match the image sequence background **exactly**: 
 `#050505` 
 → Image edges should be invisible so **[OBJECT]** floats in a pure void.


- **Color Palette:** 
 - Background: `#050505` 
 - Headings: `text-white/90` 
 - Body: `text-white/60`


- **Typography:** Inter or SF Pro 
 Ultra-clean, tracking-tight, luxury minimalist aesthetic.


---


## 🧩 IMPLEMENTATION DETAILS


### 1) Sticky Canvas Container
- Create: `components/[ComponentName].tsx`
- Wrapper div:
 - `height: 400vh` (4× viewport height for scroll duration)
- Inside wrapper:
 - `<canvas>` must be:
   - `sticky`
   - `top-0`
   - `h-screen`
   - `w-full`
- Canvas must be:
 - perfectly centered 
 - responsively scaled 


---


### 2) Scroll-Linked Image Sequence
- Load **[FRAME_COUNT] images** from: `/public/sequence/`
- Naming convention:
 - `frame_0.webp` → `frame_[N].webp`


**Scroll logic**
- Use Framer Motion `useScroll` to track scroll progress **0.0 → 1.0**
- Use `useSpring` to smooth interpolation (avoid jitter)
- Map scroll progress to frame index:
 - `Math.floor(scrollProgress * FRAME_COUNT)`


**Canvas draw**
- Draw current frame using `drawImage()`
- Scale correctly to fit viewport (mobile + desktop)


**Preloading**
- Preload all images 
- Show a loading UI with progress bar **before** revealing the experience 


---


### 3) Text Overlays (Scrollytelling Beats)


Replace each block with your own story.


#### Beat A — 0–20% Scroll
- Title: **[HERO WORD / PHRASE]** (Centered, huge) 
- Subtitle: [Short emotional promise]


#### Beat B — 25–45% Scroll
- Title: **[FEATURE / IDEA 1]** (Left aligned) 
- Subtitle: [Supporting detail] 
- Visual note: *[Describe visual change]*


#### Beat C — 50–70% Scroll
- Title: **[FEATURE / IDEA 2]** (Right aligned) 
- Subtitle: [Supporting detail] 
- Visual note: *[Describe visual state]*


#### Beat D — 75–95% Scroll
- Title: **[CALL TO ACTION]** (Centered CTA) 
- Subtitle: [Closing line] 
- Visual note: *[Final visual formation]*


All text uses `useTransform` for opacity and position.


---


## ✨ POLISH & PERFORMANCE
- Elegant loading state:
 - animated spinner + progress bar
- “Scroll to Explore” indicator:
 - visible at 0%
 - fades out by 10%
- Mobile scaling:
 - use “contain” fit logic
- Use `useSpring` for buttery smoothness:
 - `stiffness: 100`
 - `damping: 30`
- Cleanup:
 - remove event listeners on unmount
 - dispose of canvas context safely
- Custom scrollbar styling:
 - minimal
 - dark
 - subtle hover effect


---


## ⏱ ANIMATION TIMING RULES
- Text overlays should:
 - fade in over first **10%** of their range 
 - stay visible 
 - fade out over last **10%** 


Opacity mapping:
[start, start + 0.1, end - 0.1, end] → [0, 1, 1, 0]


Add subtle vertical motion:
- enter: `y: 20px → 0`
- exit: `0 → -20px`


---


## 📦 OUTPUT (Generate production-ready code)
1. `app/page.tsx` — main page component 
2. `components/[ComponentName].tsx` — scroll canvas animation 
3. `app/globals.css` — Tailwind base styles + custom scrollbar 


---


## ✅ KEY REQUIREMENTS
- TypeScript throughout 
- Proper cleanup (canvas + listeners) 
- Fully responsive (mobile + desktop) 
- 60fps smooth animation 
- Loading state before animation begins 
- No flicker / no stutter during scroll 
- Seamless blend with `#050505` background 


---


## 🧠 STYLE NOTES
- High-end product aesthetic 
 (Apple / automotive / luxury tech) 
- Huge typography:
 - titles: `text-7xl` → `text-9xl` 
- Generous whitespace 
- Subtle animations only 
- Professional, confident, premium feel 

