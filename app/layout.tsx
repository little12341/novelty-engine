import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { productionOrigin } from "@/lib/site";
import "./globals.css";
import "./landing-refinement.css";
import "./install-transition.css";

export const metadata: Metadata = {
  metadataBase: new URL(productionOrigin),
  title: "Novelty Engine — Discover the gaps. Build what’s next.",
  description:
    "Evidence-driven market-gap research that maps markets, finds structural gaps, falsifies candidates, and returns opportunities worth building.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Novelty Engine — Discover the gaps. Build what’s next.",
    description: "Evidence-driven market-gap research for opportunities worth building.",
    type: "website",
    url: "/",
    siteName: "Novelty Engine",
    images: [{
      url: "/og.png",
      width: 1731,
      height: 909,
      alt: "Novelty Engine — Discover the gaps. Build what’s next.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Novelty Engine — Discover the gaps. Build what’s next.",
    description: "Evidence-driven market-gap research for opportunities worth building.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#f2efe6",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
