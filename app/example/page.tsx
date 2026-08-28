import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, PageIntro } from "../site-chrome";

export const metadata: Metadata = {
  title: "Example Report — Novelty Engine",
  description: "A clearly labeled fixture-backed demonstration of a Novelty Engine research report.",
  alternates: { canonical: "/example" },
};

const evidence = [
  ["Fixture discussion excerpts", "Operators repeatedly describe copying job details between scheduling, estimating, and customer-management tools."],
  ["Fixture product pages", "Established field-service platforms advertise integrations and broad all-in-one workflows."],
  ["Fixture pricing snippets", "Smaller teams object to paying for broad suites when they need only a narrow handoff to work."],
  ["Fixture failed-attempt note", "A generic dashboard did not remove re-entry because conflicting systems still required a person to decide which record was correct."],
] as const;

const competitors = [
  ["All-in-one field-service suites", "Broad scheduling, estimating, invoicing, and CRM coverage", "Migration cost and feature breadth can be excessive for small teams."],
  ["Point-to-point integrations", "Move records between specific systems", "They may not resolve conflicting authoritative records or uncommon exceptions."],
  ["Spreadsheets, email, and text", "Flexible and already familiar", "Manual re-entry, weak auditability, and inconsistent ownership remain."],
] as const;

export default function ExamplePage() {
  return (
    <ContentPage className="example-page">
      <PageIntro eyebrow="Example" title="A demonstration report, not live market research." intro="This page uses fixture-backed data to demonstrate report structure. It does not claim that the example proves a current market opportunity, current pricing, or current competitor coverage.">
        <div className="demo-label"><strong>Demonstration only</strong><span>Fixture-backed · not live research</span></div>
      </PageIntro>

      <article className="report-shell page-width" aria-labelledby="report-title">
        <header className="report-header">
          <div><p className="eyebrow">Demonstration report 01</p><h2 id="report-title">Exception bridge for small field-service teams</h2></div>
          <dl><div><dt>Question</dt><dd>Where do small field-service teams still move job data by hand?</dd></div><div><dt>Status</dt><dd>Surviving hypothesis—not validated</dd></div></dl>
        </header>

        <section className="report-section report-summary" aria-labelledby="summary-title">
          <div><p className="eyebrow">Surviving hypothesis</p><h3 id="summary-title">A narrow handoff layer that asks for human review only when systems disagree.</h3></div>
          <p>The proposed product would not replace scheduling, estimating, or CRM systems. It would surface mismatches, show the competing records, and let an operator decide which system should win.</p>
        </section>

        <section className="report-section" aria-labelledby="report-evidence-title">
          <header className="report-section-heading"><p className="eyebrow">Evidence</p><h3 id="report-evidence-title">What the fixture package supports.</h3></header>
          <ol className="report-evidence-list">{evidence.map(([source, finding], index) => <li key={source}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{source}</strong><p>{finding}</p></div></li>)}</ol>
        </section>

        <section className="report-section" aria-labelledby="competitors-title">
          <header className="report-section-heading"><p className="eyebrow">Competitors and alternatives</p><h3 id="competitors-title">The job already has several ways to get done.</h3></header>
          <div className="competitor-table" role="table" aria-label="Demonstration competitor comparison">
            <div className="competitor-row competitor-head" role="row"><span role="columnheader">Alternative</span><span role="columnheader">What it handles</span><span role="columnheader">Possible opening</span></div>
            {competitors.map(([name, handles, opening]) => <div className="competitor-row" role="row" key={name}><strong role="cell">{name}</strong><span role="cell">{handles}</span><span role="cell">{opening}</span></div>)}
          </div>
        </section>

        <section className="report-section report-decision-grid" aria-label="Risks unknowns and validation">
          <article><p className="eyebrow">Decisive risks</p><h3>What could kill it.</h3><ul><li>Exceptions may be too rare to justify another tool.</li><li>Connector maintenance may be uneconomic.</li><li>Teams may refuse the access required to compare systems.</li><li>Existing platforms may already solve the highest-value cases.</li></ul></article>
          <article><p className="eyebrow">Unknowns</p><h3>What the fixture cannot answer.</h3><ul><li>Actual exception frequency.</li><li>Sustainable support cost.</li><li>Access willingness.</li><li>Paid demand and retention.</li></ul></article>
          <article className="validation-card"><p className="eyebrow">72-hour validation step</p><h3>Manually bridge ten real jobs for three teams.</h3><p>Continue only if the intervention cuts re-entry errors by at least half and one team commits to a paid pilot. Record every exception, time spent, access objection, and case an existing integration already solves.</p></article>
        </section>

        <footer className="report-footer"><strong>Conclusion</strong><p>The hypothesis survives this demonstration package, but remains unvalidated. Real customer observation and current market evidence are required before acting.</p></footer>
      </article>

      <section className="page-cta"><div className="page-width"><p className="eyebrow">Run your own question</p><h2>Install the Skill and keep the evidence attached.</h2><Link className="button button-light" href="/install">Install Novelty Engine</Link></div></section>
    </ContentPage>
  );
}
