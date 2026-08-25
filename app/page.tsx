import { InstallPanel } from "./install-panel";

const githubUrl = "https://github.com/little12341/novelty-engine";

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span>N</span>
      <i />
    </span>
  );
}

const pipeline = [
  ["01", "Map", "Competitors, complaints, workarounds, shifts"],
  ["02", "Find", "Structural holes and underserved workflows"],
  ["03", "Challenge", "Defaults, assumptions, and constraints"],
  ["04", "Generate", "Candidates with a traceable lineage"],
  ["05", "Falsify", "Demand, economics, trust, and feasibility"],
  ["06", "Return", "Survivors with a measurable first test"],
];

const phases = [
  {
    number: "01",
    title: "Build the landscape",
    description: "Map competitors, products, complaints, workarounds, technologies, and rules into an opportunity graph.",
    detail: "Look for repeated friction, sparse combinations, underserved segments, failed attempts, and early change signals.",
  },
  {
    number: "02",
    title: "Contradict the category",
    description: "Extract the assumptions a market treats as fixed, then systematically invert or remove the consequential ones.",
    detail: "Transfer mechanisms from distant domains without simply borrowing their language or aesthetics.",
  },
  {
    number: "03",
    title: "Generate with lineage",
    description: "Create a broad candidate field from evidence-backed holes, then reject ideas that collapse into familiar products.",
    detail: "Every candidate keeps a compact record of the evidence, contradiction, and mutation that produced it.",
  },
  {
    number: "04",
    title: "Try to kill the ideas",
    description: "Pressure-test demand, economics, distribution, feasibility, behavior, trust, regulation, and defensibility.",
    detail: "Promising failures get at most two bounded mutations. Survivors leave with a 24–72 hour validation test.",
  },
];

export default function Home() {
  return (
    <main id="top">
      <header className="site-header-wrap">
        <div className="site-header page-width">
          <a className="brand" href="#top" aria-label="Novelty Engine home">
            <Mark />
            <span>Novelty Engine</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#comparison">Example</a>
            <a href="#method">Method</a>
            <a href="#install">Install</a>
          </nav>
          <a className="header-github" href={githubUrl} target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow"><span>V2.1</span> Open-source Claude Skill</p>
          <h1>Find the ideas the market has <em>not made obvious.</em></h1>
          <p className="hero-lede">
            Novelty Engine maps what exists, looks for structural gaps, and tries to disprove each candidate before it reaches you.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#install">
              Install the skill <span aria-hidden="true">↓</span>
            </a>
            <a className="button button-secondary" href={githubUrl} target="_blank" rel="noreferrer">
              Read the source <span aria-hidden="true">↗</span>
            </a>
          </div>
          <ul className="hero-facts" aria-label="Product facts">
            <li>Free and open source</li>
            <li>Works locally</li>
            <li>No account required</li>
          </ul>
        </div>

        <aside className="research-card" aria-label="Novelty Engine research flow">
          <div className="research-card-header">
            <span>Research model</span>
            <span className="status-pill"><i /> Evidence first</span>
          </div>
          <div className="research-question">
            <span>Question</span>
            <p>Where is the market poorly served—and what mechanism could change that?</p>
          </div>
          <ol className="mini-flow">
            <li><span>Landscape</span><strong>What exists?</strong></li>
            <li><span>Gap</span><strong>What remains hard?</strong></li>
            <li><span>Candidate</span><strong>What is meaningfully different?</strong></li>
            <li><span>Test</span><strong>What would prove it wrong?</strong></li>
          </ol>
          <div className="survivor-note">
            <span>Output</span>
            <p><strong>Surviving opportunities</strong> with evidence lineage, decisive risks, and a measurable next test.</p>
          </div>
        </aside>
      </section>

      <div className="principle-strip">
        <div className="page-width principle-grid">
          <p><span>01</span> Novelty without demand is a curiosity.</p>
          <p><span>02</span> Demand without differentiation is a crowded category.</p>
          <p><span>03</span> Evidence without falsification is just a story.</p>
        </div>
      </div>

      <section className="install-section" id="install">
        <div className="page-width">
          <div className="section-heading install-heading">
            <p className="eyebrow">Install</p>
            <div>
              <h2>Install once. Connect the research path that fits.</h2>
              <p>Keep the ZIP and Claude Code workflow, or connect the deployed <code>/api/mcp</code> endpoint in Claude browser for live research without local configuration.</p>
            </div>
          </div>
          <InstallPanel />
          <ol className="install-flow" aria-label="Research connection steps">
            <li><span>1</span><div><strong>Install the Skill</strong><p>Upload the ZIP or copy the folder locally.</p></div></li>
            <li><span>2</span><div><strong>Connect research</strong><p>Add the MCP URL in Claude browser, or set the direct helper URL in Claude Code.</p></div></li>
            <li><span>3</span><div><strong>Ask normally</strong><p>Invoke <code>/novelty-engine</code> or request market-gap research.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="pipeline-section page-width" aria-labelledby="pipeline-title">
        <div className="section-heading pipeline-heading">
          <p className="eyebrow">The evidence loop</p>
          <div>
            <h2 id="pipeline-title">A research method, not a longer prompt.</h2>
            <p>The engine makes the search process inspectable from first source to final experiment.</p>
          </div>
        </div>
        <ol className="pipeline-list">
          {pipeline.map(([number, title, description]) => (
            <li key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="comparison-section" id="comparison">
        <div className="page-width">
          <div className="section-heading comparison-heading">
            <p className="eyebrow">A worked example</p>
            <div>
              <h2>From a common prompt to a specific opening.</h2>
              <p>V2.1 records how an idea was derived, what resembles it, what could kill it, and the cheapest test that should come next.</p>
            </div>
          </div>

          <blockquote className="example-prompt">
            <span>Prompt</span>
            <p>“Find opportunities for small field-service teams that still move job data between tools.”</p>
          </blockquote>

          <div className="comparison-grid">
            <article className="baseline-card">
              <header><p className="card-label">First-pass brainstorming</p><h3>Familiar answers</h3></header>
              <ol>
                <li><span>01</span><div><strong>All-in-one CRM</strong><p>Replace every current tool with one larger system.</p></div></li>
                <li><span>02</span><div><strong>AI dispatcher</strong><p>Add a chat assistant on top of the existing workflow.</p></div></li>
                <li><span>03</span><div><strong>Scheduling dashboard</strong><p>Show another view of data workers already maintain.</p></div></li>
              </ol>
              <p className="card-note">The subject changed. The underlying mechanisms did not.</p>
            </article>

            <article className="survivor-card">
              <header>
                <div><p className="card-label">With Novelty Engine</p><h3>Exception Bridge</h3></div>
                <span className="survivor-badge">Survivor</span>
              </header>
              <p className="idea-summary">A local-first event bridge keeps existing systems authoritative and asks a worker to intervene only when their records disagree—without introducing another CRM.</p>
              <dl>
                <div><dt>Evidence lineage</dt><dd>Duplicate entry → spreadsheets and messages → small-team pricing mismatch → remove the central database → local event capability.</dd></div>
                <div><dt>Decisive risk</dt><dd>It fails if connectors are expensive to maintain, exceptions are too rare, or teams will not grant source-system access.</dd></div>
                <div><dt>Validate first</dt><dd>Manually bridge ten real jobs for three teams in 72 hours. Continue only if errors fall by half and one team commits to a paid pilot.</dd></div>
              </dl>
              <p className="fixture-note">Illustrative, fixture-backed pipeline walkthrough—not a claim about a live market.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="method-section" id="method">
        <div className="page-width">
          <div className="section-heading method-heading">
            <p className="eyebrow">The method</p>
            <div>
              <h2>Research. Structure. Contradict. Falsify.</h2>
              <p>Compact provenance and visible tradeoffs replace vague claims of uniqueness.</p>
            </div>
          </div>
          <ol className="method-grid">
            {phases.map((phase) => (
              <li key={phase.number}>
                <span>{phase.number}</span>
                <h3>{phase.title}</h3>
                <p>{phase.description}</p>
                <p className="phase-detail">{phase.detail}</p>
              </li>
            ))}
          </ol>
          <div className="research-positioning">
            <div>
              <p className="eyebrow">Built for honest research</p>
              <h3>No competitor found does not mean a good opportunity was found.</h3>
            </div>
            <div>
              <p>When web access is configured, the backend searches competitors, reviews, forums, GitHub, directories, regulations, failed attempts, and counterevidence.</p>
              <p>Missing evidence stays unknown. Novel proposals are hypotheses until a real market test says otherwise.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="page-width final-cta-inner">
          <div>
            <p className="eyebrow">Novelty Engine V2.1</p>
            <h2>Make the next idea earn its place.</h2>
          </div>
          <div className="final-actions">
            <a className="button button-light" href="#install">Install locally <span aria-hidden="true">↓</span></a>
            <a className="text-link-light" href={githubUrl} target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="page-width footer-inner">
          <a className="brand" href="#top"><Mark /><span>Novelty Engine</span></a>
          <p>V2.1 · Free and open source under the MIT License.</p>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </footer>
    </main>
  );
}
