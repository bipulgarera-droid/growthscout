import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "LUMINA PRO | Clinical Skin Rejuvenation Device",
  description: "Professional-grade rejuvenation technology. Experience the future of clinical skincare with precision-engineered design and deep tissue therapy.",
  keywords: ["skin rejuvenation", "medical spa", "clinical device", "skincare technology", "beauty device"],
  openGraph: {
    title: "LUMINA PRO | Clinical Skin Rejuvenation Device",
    description: "Professional-grade rejuvenation technology. Experience the future of clinical skincare.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-black">
      <body
        className={`${manrope.variable} font-sans antialiased bg-black text-white`}
      >
        {children}
      </body>
    </html>
  );
}
