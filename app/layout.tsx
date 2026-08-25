import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./landing-refinement.css";
import "./install-transition.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://novelty-engine.vercel.app"),
  title: "Novelty Engine — Discover the gaps. Build what’s next.",
  description:
    "Evidence-driven market-gap research that maps markets, finds structural gaps, falsifies candidates, and returns opportunities worth building.",
  openGraph: {
    title: "Novelty Engine — Discover the gaps. Build what’s next.",
    description: "Evidence-driven market-gap research for opportunities worth building.",
    type: "website",
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
};

export const viewport: Viewport = {
  themeColor: "#f2efe6",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
