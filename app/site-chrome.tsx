import Image from "next/image";
import Link from "next/link";

const primaryNavigation = [
  ["Home", "/"],
  ["How It Works", "/how-it-works"],
  ["Example", "/example"],
  ["Install", "/install"],
  ["About", "/about"],
  ["Contact", "/contact"],
] as const;

export function BrandMark() {
  return <Image className="brand-wreath" src="/assets/generated/open-laurel-wreath-v3.png" alt="" width={1247} height={1050} preload unoptimized aria-hidden="true" />;
}

export function Arrow({ external = false }: { external?: boolean }) {
  return (
    <svg className="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {external ? <path d="M6 14 14 6M7.2 6H14v6.8" /> : <path d="M2.75 10h13.5M11.2 4.8l5.2 5.2-5.2 5.2" />}
    </svg>
  );
}

export function SiteHeader({ hero = false }: { hero?: boolean }) {
  return (
    <header className={`site-header-wrap ${hero ? "hero-site-header" : "interior-header"}`}>
      <div className="site-header page-width">
        <Link className="brand" href="/" aria-label="Novelty Engine home"><BrandMark /><span>Novelty Engine</span></Link>
        <span className="beta-label">Public Beta</span>
        <nav className="desktop-nav" aria-label="Main navigation">
          {primaryNavigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <details className="mobile-menu">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            {primaryNavigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </details>
        <Link className="header-github glass-control liquid-glass" href="/install">Get Started <Arrow /></Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-width footer-main">
        <Link className="brand" href="/"><BrandMark /><span>Novelty Engine</span></Link>
        <nav aria-label="Footer navigation">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
      <div className="page-width footer-legal">
        <p>V2.2 Public Beta · Open source under the MIT License.</p>
        <p>Research can reduce uncertainty; it cannot guarantee success.</p>
      </div>
    </footer>
  );
}

export function PageIntro({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children?: React.ReactNode }) {
  return (
    <section className="page-intro">
      <div className="page-width page-intro-grid">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="page-intro-copy">
          <p>{intro}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

export function ContentPage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={`content-page ${className}`.trim()}>
      <SiteHeader />
      {children}
      <SiteFooter />
    </main>
  );
}
