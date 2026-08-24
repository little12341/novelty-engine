import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://novelty-engine.vercel.app"),
  title: "Novelty Engine — Stop getting the same AI ideas",
  description:
    "A free, open-source Claude Skill that rejects obvious concepts, explores distant domains, and returns fewer, more differentiated ideas.",
  openGraph: {
    title: "Novelty Engine",
    description: "Stop getting the same AI ideas.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Novelty Engine",
    description: "Stop getting the same AI ideas.",
  },
};

export const viewport: Viewport = {
  themeColor: "#080a08",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
