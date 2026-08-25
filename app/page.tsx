import Image from "next/image";
import { HeroInstallPanel, InstallPanel } from "./install-panel";

const githubUrl = "https://github.com/little12341/novelty-engine";

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 52 46" fill="none" focusable="false">
        <path d="M19.8 39.5C12 36.4 7 30.1 6.2 22.1M16.4 36.6l-6.1.6M12.3 32.2l-5.9-1.1M9.5 27l-5-2.6M8.1 21.4l-3.8-4.1M8.6 16l-2.1-4.7M10.8 11.3l-.4-4.6M32.2 39.5c7.8-3.1 12.8-9.4 13.6-17.4M35.6 36.6l6.1.6M39.7 32.2l5.9-1.1M42.5 27l5-2.6M43.9 21.4l3.8-4.1M43.4 16l2.1-4.7M41.2 11.3l.4-4.6" />
        <path d="M18.7 40.5c2.2 1.2 4.6 1.8 7.3 1.8s5.1-.6 7.3-1.8" />
      </svg>
    </span>
  );
}

function ArrowIcon({ direction = "right" }: { direction?: "right" | "down" }) {
  return direction === "down" ? (
    <svg className="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.75v13.5M4.8 11.2 10 16.4l5.2-5.2" />
    </svg>
  ) : (
    <svg className="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.75 10h13.5M11.2 4.8l5.2 5.2-5.2 5.2" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg className="leaf-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17.8 3.1c-.2 4.9-2.4 8.7-6.6 11.2M19.4 7.3c-2.6 2.7-5.6 4.4-9 5.2M13.6 2.7c.2 2.2-.3 4.3-1.4 6.2M8.4 7.5c.3 2 .9 3.5 2 4.8M5.3 11.9c.9 1.6 2.3 2.7 4.1 3.2M3.9 16.4c1.8.9 3.6 1.1 5.4.7M8.6 20.8c-.1-2.5.6-4.8 2.1-6.8" />
    </svg>
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
      <section className="hero-stage" id="overview" aria-labelledby="hero-title">
        <Image
          className="hero-image"
          src="/hero-mediterranean.png"
          alt=""
          fill
          preload
          unoptimized
          sizes="100vw"
          aria-hidden="true"
        />
        <div className="hero-tonal-layer" aria-hidden="true" />
        <svg className="glass-filters" width="0" height="0" aria-hidden="true" focusable="false">
          <defs>
            <filter id="glass-refraction" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.038" numOctaves="1" seed="8" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.35" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>

        <header className="site-header-wrap">
          <div className="site-header page-width">
            <a className="brand" href="#top" aria-label="Novelty Engine home">
              <Mark />
              <span>Novelty Engine</span>
            </a>
            <nav aria-label="Main navigation">
              <a href="#overview">Overview</a>
              <a href="#method">How it works</a>
              <a href={`${githubUrl}#readme`} target="_blank" rel="noreferrer">Docs</a>
            </nav>
            <a className="header-github glass-control liquid-glass" href="#install">
              Get started <ArrowIcon />
            </a>
          </div>
        </header>

        <div className="hero page-width">
          <div className="hero-copy">
            <p className="eyebrow">Find what others miss</p>
            <h1 id="hero-title">Discover the gaps.<br />Build what’s next.</h1>
            <p className="hero-lede">
              Novelty Engine uses research, signals, and reasoning to uncover real market gaps and generate opportunities worth building.
            </p>
            <div className="hero-actions">
              <a className="button glass-control glass-primary liquid-glass" href="#install">
                <LeafIcon /> Install skill
              </a>
              <a className="button glass-control liquid-glass" href="#comparison">
                Learn more <ArrowIcon />
              </a>
            </div>
          </div>

          <HeroInstallPanel />

          <a className="scroll-cue" href="#principles" aria-label="Scroll to explore">
            <span className="liquid-glass" aria-hidden="true"><ArrowIcon direction="down" /></span>
            <small>Scroll to explore</small>
          </a>
        </div>
      </section>

      <div className="principle-strip" id="principles">
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
