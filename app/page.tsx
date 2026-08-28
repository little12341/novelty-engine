import Image from "next/image";
import Link from "next/link";
import { productionOrigin } from "@/lib/site";
import { ResearchReveal } from "./install-transition";
import { Arrow, SiteFooter, SiteHeader } from "./site-chrome";

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Novelty Engine",
  url: productionOrigin,
  description: "Evidence-backed market research for Claude that checks competitors, customer pain, workarounds, counterevidence, and practical validation tests.",
};

function HeroOverviewPanel() {
  return (
    <aside className="hero-install-panel hero-overview-panel liquid-glass" aria-label="Novelty Engine research summary">
      <section className="hero-install-row hero-skill-row">
        <span className="terminal-glyph liquid-glass" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" focusable="false"><path d="M5 7.5h14M7 12h10M9 16.5h6" /></svg>
        </span>
        <div className="hero-install-content">
          <h2>Evidence before enthusiasm</h2>
          <p>Map customer pain, competitors, workarounds, and counterevidence before treating an idea as an opportunity.</p>
        </div>
        <span className="hero-panel-tag">Find · challenge</span>
      </section>
      <section className="hero-install-row hero-mcp-row">
        <div className="hero-install-content">
          <h2>A decision you can test</h2>
          <p>Keep the sources, rejected conclusions, biggest risk, unknowns, and one practical validation step together.</p>
        </div>
        <span className="hero-panel-tag">Decide · test</span>
      </section>
    </aside>
  );
}

export default function Home() {
  return (
    <main id="top" className="home-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c") }} />

      <section className="hero-stage" aria-labelledby="hero-title">
        <div className="hero-backdrop" aria-hidden="true"><Image className="hero-image" src="/hero-mediterranean.png" alt="" fill preload unoptimized sizes="100vw" /></div>
        <div className="hero-tonal-layer" aria-hidden="true" />
        <SiteHeader hero />

        <div className="hero page-width">
          <div className="hero-copy">
            <p className="eyebrow">Stop guessing what to build</p>
            <h1 id="hero-title">Find business opportunities backed by real evidence.</h1>
            <p className="hero-lede">Novelty Engine helps Claude challenge market ideas with public evidence, competing solutions, and a practical next test.</p>
            <div className="hero-actions">
              <Link className="button glass-control glass-primary liquid-glass" href="/install">Install</Link>
              <Link className="button glass-control liquid-glass" href="/example">See an Example <Arrow /></Link>
            </div>
            <p className="beta-disclaimer">Research can reduce uncertainty, but it cannot guarantee that a business idea will succeed.</p>
          </div>
          <HeroOverviewPanel />
        </div>
      </section>

      <ResearchReveal />
      <SiteFooter />
    </main>
  );
}
