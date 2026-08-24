import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://novelty-engine.vercel.app"),
  title: "Novelty Engine V2.1 — Find ideas the market has not made obvious",
  description:
    "An open-source evidence system and Claude Skill that maps markets, finds structural gaps, falsifies candidates, and returns surviving opportunities.",
  openGraph: {
    title: "Novelty Engine V2.1",
    description: "Find ideas the market has not made obvious.",
    type: "website",
    images: [{
      url: "/og.png",
      width: 1731,
      height: 909,
      alt: "Novelty Engine V2.1 — Find ideas the market has not made obvious.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Novelty Engine V2.1",
    description: "Find ideas the market has not made obvious.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f3",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
