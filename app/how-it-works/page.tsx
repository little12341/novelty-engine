import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, PageIntro } from "../site-chrome";

export const metadata: Metadata = {
  title: "How It Works — Novelty Engine",
  description: "How Novelty Engine turns supplied public evidence into challengeable research conclusions.",
  alternates: { canonical: "/how-it-works" },
};

const steps = [
  ["01", "Ask a focused question", "Name the market, customer, problem, company, or idea you want to investigate."],
  ["02", "Gather public evidence", "Claude or you collect bounded excerpts from relevant public sources and keep each source URL and title attached."],
  ["03", "Challenge the conclusion", "Novelty Engine checks competitors, recurring pain, workarounds, source quality, counterevidence, and missing facts."],
  ["04", "Return a testable result", "Only supported conclusions survive. The report keeps the decisive risk, unknowns, sources, and a practical validation step visible."],
] as const;

export default function HowItWorksPage() {
  return (
    <ContentPage className="how-page">
      <PageIntro eyebrow="How it works" title="From a market question to a result you can challenge." intro="Novelty Engine is a research and elimination system. It organizes evidence, tests what that evidence can support, and leaves uncertainty visible instead of filling gaps with confident language." />

      <section className="content-section content-section-tinted" aria-labelledby="process-title">
        <div className="page-width">
          <header className="section-intro"><p className="eyebrow">The process</p><h2 id="process-title">Four compact steps.</h2></header>
          <ol className="compact-card-grid process-grid">
            {steps.map(([number, title, description]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="content-section" aria-labelledby="supplied-title">
        <div className="page-width two-column-section">
          <div><p className="eyebrow">Supplied-source research</p><h2 id="supplied-title">Claude finds the sources. Novelty Engine examines the case.</h2></div>
          <div className="prose-stack">
            <p>The normal workflow uses sources supplied by Claude or by you. Each item includes a public URL, a title, and a bounded evidence-bearing excerpt. Novelty Engine analyzes that package without calling Tavily or Brave.</p>
            <p>Optional hosted search remains available only when a deployment enables it and a user explicitly requests it. The report preserves which retrieval path was used, so supplied evidence is never described as Novelty Engine having searched the web.</p>
          </div>
        </div>
      </section>

      <section className="content-section content-section-dark" aria-labelledby="evidence-title">
        <div className="page-width evidence-layout">
          <header><p className="eyebrow">Evidence requirements</p><h2 id="evidence-title">A claim survives only when the evidence earns it.</h2></header>
          <div className="evidence-rules">
            <article><span>Required</span><h3>Traceable support</h3><p>Important claims stay linked to relevant source material. URL and title alone are not evidence; the excerpt must support the claim being made.</p></article>
            <article><span>Required</span><h3>Independent signal</h3><p>Repeated pages from the same publisher do not become independent proof. Source role, company identity, and publisher identity stay separate.</p></article>
            <article><span>Rejected</span><h3>Unsupported conclusions</h3><p>A weak idea is rejected when the pain is isolated, competitors already solve the job, the evidence contradicts the claim, or the decisive facts remain missing.</p></article>
            <article><span>Preserved</span><h3>Unknowns and counterevidence</h3><p>Missing facts remain unknown. Rejected conclusions and reasons for rejection stay in the record instead of disappearing from the final answer.</p></article>
          </div>
        </div>
      </section>

      <section className="content-section" aria-labelledby="reddit-title">
        <div className="page-width source-notice">
          <div><p className="eyebrow">Public discussions</p><h2 id="reddit-title">Reddit can be supplied; Novelty Engine does not scrape it.</h2></div>
          <p>You or Claude may provide bounded excerpts or public thread content from Reddit and other lawful public research sources. Novelty Engine does not directly scrape, crawl, or mine Reddit, and a supplied discussion is treated as a limited sample—not complete forum coverage.</p>
        </div>
      </section>

      <section className="page-cta"><div className="page-width"><p className="eyebrow">See the output</p><h2>Read one fixture-backed demonstration report.</h2><Link className="button button-light" href="/example">Open the example</Link></div></section>
    </ContentPage>
  );
}
