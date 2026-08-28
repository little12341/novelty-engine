import Image from "next/image";
import Link from "next/link";
import { NOVELTY_COMMAND_CATALOG } from "@/lib/research/intents";
import { githubUrl, productionOrigin } from "@/lib/site";
import { HeroInstallPanel } from "./install-panel";
import { InstallTransition } from "./install-transition";
import { BetaFeedback } from "./beta-feedback";

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Novelty Engine",
  url: productionOrigin,
  description: "Evidence-backed market research for Claude that checks competitors, customer pain, workarounds, counterevidence, and practical validation tests.",
};

const usefulCommands = new Set(["/research-market", "/find-gaps", "/inspect-competitors", "/customer-pain", "/falsify", "/rerun"]);
const homepageCommands = NOVELTY_COMMAND_CATALOG.filter((entry) => usefulCommands.has(entry.command));

function BrandMark() {
  return <Image className="brand-wreath" src="/assets/generated/open-laurel-wreath-v3.png" alt="" width={1247} height={1050} unoptimized aria-hidden="true" />;
}

function Arrow({ external = false }: { external?: boolean }) {
  return (
    <svg className="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {external ? <path d="M6 14 14 6M7.2 6H14v6.8" /> : <path d="M2.75 10h13.5M11.2 4.8l5.2 5.2-5.2 5.2" />}
    </svg>
  );
}

const steps = [
  ["01", "You ask a question", "For example: “What problems are small roofing companies still solving with spreadsheets?”"],
  ["02", "Claude finds current public evidence", "It searches company websites, public discussions, reviews, documentation, regulations, job postings, and other relevant sources."],
  ["03", "Novelty Engine challenges the idea", "It checks competitors, customer pain, workarounds, weak evidence, hidden costs, and reasons the opportunity may not work."],
  ["04", "You receive the strongest result", "You get the evidence, the opportunity, the biggest risk, and a practical test to run next."],
] as const;

const checks = [
  "Customer problems", "Existing competitors", "Manual workarounds", "Pricing and spending signals",
  "Underserved customers", "Reasons the opportunity may fail", "Source quality", "Missing evidence",
];

const deliverables = [
  "Market overview", "Customer pain signals", "Competitor map", "Potential gaps", "Rejected ideas and why they failed",
  "Strongest surviving opportunities", "Sources", "Biggest unresolved risk", "A 24 to 72 hour validation test", "One recommended next action",
];

const exampleRows = [
  ["Original question", "Find opportunities for small field-service teams that still move job data between tools."],
  ["Market examined", "Small field-service teams using several scheduling, estimating, and customer-management tools."],
  ["Representative sources", "Fixture product pages, public-discussion excerpts, pricing snippets, and a documented failed attempt."],
  ["Customer struggle", "Workers repeatedly copy job details between tools that do not stay in sync."],
  ["Existing alternatives", "All-in-one field-service platforms, another dashboard, spreadsheets, email, and text messages."],
  ["Potential gap", "A narrow handoff layer that resolves mismatches without replacing each existing system."],
  ["Surviving hypothesis", "An exception bridge that asks for human review only when authoritative systems disagree."],
  ["Supporting evidence", "Repeated manual re-entry, spreadsheet workarounds, integration requests, and pricing objections in the fixture evidence package."],
  ["Counterevidence", "Established platforms already offer integrations, and maintaining many connectors may be expensive."],
  ["Decisive risk", "The concept fails if exceptions are too rare, connector maintenance is uneconomic, or teams will not grant system access."],
  ["Validation test", "Manually bridge ten jobs for three teams within 72 hours; continue only if errors fall by half and one team commits to a paid pilot."],
  ["Still unknown", "Actual exception frequency, sustainable support cost, access willingness, and paid demand."],
] as const;

export default function Home() {
  return (
    <main id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c") }} />

      <section className="hero-stage" aria-labelledby="hero-title">
        <div className="hero-backdrop" aria-hidden="true"><Image className="hero-image" src="/hero-mediterranean.png" alt="" fill preload unoptimized sizes="100vw" /></div>
        <div className="hero-tonal-layer" aria-hidden="true" />
        <header className="site-header-wrap">
          <div className="site-header page-width">
            <a className="brand" href="#top" aria-label="Novelty Engine home"><BrandMark /><span>Novelty Engine</span></a>
            <span className="beta-label">Public Beta</span>
            <nav className="desktop-nav" aria-label="Main navigation"><a href="#overview">Overview</a><a href="#how-it-works">How it works</a><a href="#example">Example</a><a href="#commands">Commands</a><a href="#install">Install</a></nav>
            <details className="mobile-menu"><summary>Menu</summary><nav aria-label="Mobile navigation"><a href="#overview">Overview</a><a href="#how-it-works">How it works</a><a href="#example">Example</a><a href="#commands">Commands</a><a href="#install">Install</a><Link href="/privacy">Privacy</Link></nav></details>
            <a className="header-github glass-control liquid-glass" href="#install">Get started <Arrow /></a>
          </div>
        </header>

        <div className="hero page-width">
          <div className="hero-copy">
            <p className="eyebrow">Stop guessing what to build</p>
            <h1 id="hero-title">Find business opportunities backed by real evidence.</h1>
            <p className="hero-lede">Novelty Engine researches customer complaints, competitors, workarounds, and reasons an idea could fail. Then it gives you the strongest supported results, sources, and a test you can run this week.</p>
            <div className="hero-actions"><a className="button glass-control glass-primary liquid-glass" href="#install">Install for Claude</a><a className="button glass-control liquid-glass" href="#example">See an example <Arrow /></a></div>
            <p className="beta-disclaimer">Research can reduce uncertainty, but it cannot guarantee that a business idea will succeed.</p>
          </div>
          <HeroInstallPanel />
        </div>
      </section>

      <section className="plain-section overview-section page-width" id="overview" aria-labelledby="overview-title">
        <p className="eyebrow">What Novelty Engine does</p>
        <div className="plain-intro-grid"><h2 id="overview-title">Research an idea before you waste time building it.</h2><div><p>Tell Novelty Engine a market, customer problem, company, or business idea. Claude finds current public evidence. Novelty Engine organizes that evidence, checks competitors, looks for repeated problems, searches for reasons the idea may fail, and returns the strongest supported results.</p><p>In the normal supplied-source workflow, Claude—or you—provides bounded public evidence and Novelty Engine analyzes it without calling Tavily or Brave. Hosted provider search is optional, disabled by default, and runs only when the deployment enables it and a user explicitly requests it.</p><p>You may provide bounded excerpts or public thread content from Reddit and other public research sources. Novelty Engine does not directly scrape, crawl, or mine Reddit.</p></div></div>
      </section>

      <section className="plain-section steps-section" id="how-it-works" aria-labelledby="steps-title"><div className="page-width"><p className="eyebrow">How it works</p><h2 id="steps-title">Four steps from question to test.</h2><ol className="plain-card-grid step-grid">{steps.map(([number, title, description]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></li>)}</ol></div></section>

      <section className="plain-section checks-section page-width" aria-labelledby="checks-title">
        <div className="split-heading"><div><p className="eyebrow">What it checks</p><h2 id="checks-title">A stronger case needs more than an exciting idea.</h2></div><p>Every important claim is linked to a source or left as unknown. Repeated pages from the same publisher do not become independent proof.</p></div>
        <ul className="plain-card-grid check-grid">{checks.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item}</h3></li>)}</ul>
      </section>

      <section className="plain-section receive-section" aria-labelledby="receive-title"><div className="page-width receive-layout"><div><p className="eyebrow">What you receive</p><h2 id="receive-title">A research record you can inspect and revisit.</h2><p>Sources, uncertainty, counterevidence, and the next test stay attached to the result. Saved runs can be compared later.</p></div><ol>{deliverables.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ol></div></section>

      <section className="plain-section example-section" id="example" aria-labelledby="example-title">
        <Image className="comparison-column" src="/assets/generated/worked-column-urn-foliage-v3.png" alt="" width={990} height={1536} unoptimized aria-hidden="true" />
        <div className="page-width"><div className="example-heading"><div><p className="eyebrow">Illustrative demo</p><h2 id="example-title">From repeated re-entry to a testable opportunity.</h2></div><p className="fixture-note">Fixture-backed pipeline walkthrough—not live market research. It demonstrates output structure without pretending test data proves a market.</p></div><dl className="example-detail-grid">{exampleRows.map(([term, detail]) => <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>)}</dl></div>
      </section>

      <section className="plain-section changes-section page-width" aria-labelledby="changes-title"><p className="eyebrow">User-triggered comparisons</p><div className="plain-intro-grid"><h2 id="changes-title">See how the market changes.</h2><div><p>Run the same research again later and compare what changed. Novelty Engine can show new competitors, changing complaints, pricing updates, stronger evidence, and new reasons an opportunity may no longer be attractive.</p><p>Reruns happen only when you request them. Novelty Engine does not claim automatic month-to-month monitoring.</p></div></div></section>

      <section className="plain-section commands-section" id="commands" aria-labelledby="commands-title"><div className="page-width"><div className="split-heading"><div><p className="eyebrow">Useful commands</p><h2 id="commands-title">Six shortcuts for common research jobs.</h2></div><p>These are Skill intents. Type them as normal messages; they may not appear in Claude’s native slash-command autocomplete. The complete catalog is in the <a href={`${githubUrl}#claude-command-map`} target="_blank" rel="noreferrer">documentation</a>.</p></div><ul className="command-catalog">{homepageCommands.map((entry) => <li key={entry.command}><code>{entry.command}</code><p>{entry.description}</p></li>)}</ul></div></section>

      <InstallTransition />

      <section className="plain-section trust-section page-width" id="trust" aria-labelledby="trust-title"><div className="split-heading"><div><p className="eyebrow">Trust and limitations</p><h2 id="trust-title">Useful research, with the uncertainty left in.</h2></div><p>Novelty Engine is an independent public beta. Public sources can be incomplete or wrong, and market opportunities remain hypotheses until tested.</p></div><ul className="trust-list"><li>Missing evidence remains unknown; an inference is not presented as a verified fact.</li><li>Do not submit private, confidential, personal, medical, financial, or proprietary information.</li><li>Publicly indexed discussions are limited samples, not complete forum or Reddit coverage.</li><li>Novelty Engine does not guarantee novelty, patentability, demand, revenue, or success.</li></ul></section>

      <BetaFeedback />

      <section className="about-teaser"><div className="page-width"><BrandMark /><div><p className="eyebrow">About</p><h2>Independent, open, and built to challenge easy answers.</h2><p>Novelty Engine is an independent open-source research project.</p></div><Link className="button button-light" href="/about">Read about the project <Arrow /></Link></div></section>

      <footer className="site-footer"><div className="page-width footer-main"><a className="brand" href="#top"><BrandMark /><span>Novelty Engine</span></a><nav aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={`${githubUrl}#readme`} target="_blank" rel="noreferrer">Documentation</a><a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a><a href="#feedback">Feedback</a></nav></div><div className="page-width footer-legal"><p>V2.2 Public Beta · Open source under the MIT License.</p><p>Research can reduce uncertainty; it cannot guarantee success.</p></div></footer>
    </main>
  );
}
