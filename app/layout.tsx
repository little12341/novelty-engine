import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { productionOrigin } from "@/lib/site";
import "./globals.css";
import "./landing-refinement.css";
import "./install-transition.css";
import "./product-correction.css";

export const metadata: Metadata = {
  metadataBase: new URL(productionOrigin),
  title: "Novelty Engine — Find opportunities backed by evidence",
  description:
    "Research customer problems, competitors, workarounds, counterevidence, and practical validation tests with Claude.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Novelty Engine — Find opportunities backed by evidence",
    description: "Research customer problems, competitors, workarounds, and reasons an idea could fail.",
    type: "website",
    url: "/",
    siteName: "Novelty Engine",
    images: [{
      url: "/og.png",
      width: 1731,
      height: 909,
      alt: "Novelty Engine — evidence-backed business opportunity research",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Novelty Engine — Find opportunities backed by evidence",
    description: "Research customer problems, competitors, workarounds, and reasons an idea could fail.",
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
