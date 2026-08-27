import Image from "next/image";
import { productionOrigin } from "@/lib/site";
import { NOVELTY_COMMAND_CATALOG } from "@/lib/research/intents";
import { HeroInstallPanel } from "./install-panel";
import { InstallTransition } from "./install-transition";

const githubUrl = "https://github.com/little12341/novelty-engine";
const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Novelty Engine",
  url: productionOrigin,
  description: "Evidence-driven market-gap research for opportunities worth building.",
};

function HeroMark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 72 60" fill="none" focusable="false">
        <g className="laurel-side">
          <path className="laurel-stem" d="M36 56.7C23.2 54.6 13.5 46.6 9.7 35.8 6.2 25.8 8.4 14.6 16.5 5.1" />
          <path className="laurel-leaf" d="M14.2 44.8C9.1 46.2 4.9 44.2 2.7 39.7c5-1.4 9.2.2 11.5 5.1Z" />
          <path className="laurel-leaf" d="M10.4 38.1C5.3 38.3 1.9 35.5 1.1 30.8c5-.3 8.6 2.1 9.3 7.3Z" />
          <path className="laurel-leaf" d="M8.6 30.7C4 29.5 1.7 26.1 2.1 21.6c4.7 1 7.2 4.1 6.5 9.1Z" />
          <path className="laurel-leaf" d="M8.8 23.2C4.8 20.8 3.5 16.9 5.1 12.8c4.1 2.2 5.7 5.8 3.7 10.4Z" />
          <path className="laurel-leaf" d="M11 16.6C8.1 13.1 8.4 9.1 11.3 5.9c3 3.3 3.1 7.1-.3 10.7Z" />
          <path className="laurel-leaf" d="M16.8 49.9c-4.3 2.5-8.5 1.5-11.3-2.2 4.1-2.6 8.1-2 11.3 2.2Z" />
          <path className="laurel-leaf" d="M22.7 54.3c-3.5 3.4-7.8 3.3-11.2.5 3.4-3.3 7.3-3.7 11.2-.5Z" />
          <path className="laurel-leaf" d="M29.4 56.8c-2.6 3.8-6.7 4.5-10.5 2.5 2.4-3.8 6.1-4.8 10.5-2.5Z" />
          <path className="laurel-leaf laurel-inner-leaf" d="M13.2 41.1c4.8.1 8-2.6 8.9-7.1-4.8-.3-8.1 2-8.9 7.1Z" />
          <path className="laurel-leaf laurel-inner-leaf" d="M10.8 33.6c4.6-.9 7.2-4 7.2-8.4-4.6.7-7.4 3.4-7.2 8.4Z" />
          <path className="laurel-leaf laurel-inner-leaf" d="M11.2 25.4c4-1.9 5.8-5.5 4.8-9.7-4.1 1.7-6.1 4.9-4.8 9.7Z" />
        </g>
        <g className="laurel-side" transform="translate(72 0) scale(-1 1)">
          <path className="laurel-stem" d="M36 56.7C23.2 54.6 13.5 46.6 9.7 35.8 6.2 25.8 8.4 14.6 16.5 5.1" />
          <path className="laurel-leaf" d="M14.2 44.8C9.1 46.2 4.9 44.2 2.7 39.7c5-1.4 9.2.2 11.5 5.1Z" />
          <path className="laurel-leaf" d="M10.4 38.1C5.3 38.3 1.9 35.5 1.1 30.8c5-.3 8.6 2.1 9.3 7.3Z" />
          <path className="laurel-leaf" d="M8.6 30.7C4 29.5 1.7 26.1 2.1 21.6c4.7 1 7.2 4.1 6.5 9.1Z" />
          <path className="laurel-leaf" d="M8.8 23.2C4.8 20.8 3.5 16.9 5.1 12.8c4.1 2.2 5.7 5.8 3.7 10.4Z" />
          <path className="laurel-leaf" d="M11 16.6C8.1 13.1 8.4 9.1 11.3 5.9c3 3.3 3.1 7.1-.3 10.7Z" />
          <path className="laurel-leaf" d="M16.8 49.9c-4.3 2.5-8.5 1.5-11.3-2.2 4.1-2.6 8.1-2 11.3 2.2Z" />
          <path className="laurel-leaf" d="M22.7 54.3c-3.5 3.4-7.8 3.3-11.2.5 3.4-3.3 7.3-3.7 11.2-.5Z" />
          <path className="laurel-leaf" d="M29.4 56.8c-2.6 3.8-6.7 4.5-10.5 2.5 2.4-3.8 6.1-4.8 10.5-2.5Z" />
          <path className="laurel-leaf laurel-inner-leaf" d="M13.2 41.1c4.8.1 8-2.6 8.9-7.1-4.8-.3-8.1 2-8.9 7.1Z" />
          <path className="laurel-leaf laurel-inner-leaf" d="M10.8 33.6c4.6-.9 7.2-4 7.2-8.4-4.6.7-7.4 3.4-7.2 8.4Z" />
          <path className="laurel-leaf laurel-inner-leaf" d="M11.2 25.4c4-1.9 5.8-5.5 4.8-9.7-4.1 1.7-6.1 4.9-4.8 9.7Z" />
        </g>
        <path className="laurel-cross" d="M27.8 54.1c3.2 2.4 5.9 3.7 8.2 4.2 2.3-.5 5-1.8 8.2-4.2M30.8 57.8h10.4" />
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
      <path className="leaf-outline" d="M11.15 20.15a7 7 0 0 1-1.3-13.95c5.58-2.35 10.78-1.67 10.98-1.58.08.21.77 5.38-1.67 9.95a7 7 0 0 1-8.01 5.58Z" />
      <path className="leaf-vein" d="M3 21c.15-3.02 2.03-5.37 5.18-6.9 2.75-1.35 6.2-1.76 10.35-1.25" />
    </svg>
  );
}

function UtilityIcon({ kind }: { kind: "down" | "external" }) {
  return kind === "down" ? <ArrowIcon direction="down" /> : (
    <svg className="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 14 14 6M7.2 6H14v6.8" />
    </svg>
  );
}

const pipeline = [
  ["01", "Map", "Competitors, complaints, workarounds, shifts", "map"],
  ["02", "Find", "Structural holes and underserved workflows", "find"],
  ["03", "Challenge", "Defaults, assumptions, and constraints", "challenge"],
  ["04", "Generate", "Candidates with a traceable lineage", "generate"],
  ["05", "Falsify", "Demand, economics, trust, and feasibility", "falsify"],
  ["06", "Return", "Survivors with a measurable first test", "return"],
] as const;

function EvidenceArtifact({ kind }: { kind: (typeof pipeline)[number][3] }) {
  return (
    <span className={`evidence-artifact evidence-artifact-${kind}`} aria-hidden="true">
      <Image src={`/assets/generated/evidence-${kind}-v3.png`} alt="" width={512} height={512} unoptimized />
    </span>
  );
}

function MethodArtifact({ number }: { number: string }) {
  return (
    <span className={`method-artifact method-artifact-${number}`} aria-hidden="true">
      <Image src={`/assets/generated/method-${number}-v2.png`} alt="" width={500} height={500} unoptimized />
    </span>
  );
}

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c") }}
      />
      <section className="hero-stage" id="overview" aria-labelledby="hero-title">
        <div className="hero-backdrop" aria-hidden="true">
          <Image
            className="hero-image"
            src="/hero-mediterranean.png"
            alt=""
            fill
            preload
            unoptimized
            sizes="100vw"
          />
        </div>
        <div className="hero-tonal-layer" aria-hidden="true" />
        <header className="site-header-wrap">
          <div className="site-header page-width">
            <a className="brand" href="#top" aria-label="Novelty Engine home">
              <HeroMark />
              <span>Novelty Engine</span>
            </a>
            <nav aria-label="Main navigation">
              <a href="#overview">Overview</a>
              <a href="#method">How it works</a>
              <a href="#commands">Commands</a>
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
            <h1 id="hero-title"><span>Discover the gaps.</span><span>Build what’s next.</span></h1>
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

      <InstallTransition />

      <section className="pipeline-section page-width" aria-labelledby="pipeline-title">
        <Image className="pipeline-laurel pipeline-laurel-left" src="/assets/generated/mediterranean-laurel-branch-v3.png" alt="" width={822} height={1745} unoptimized />
        <Image className="pipeline-laurel pipeline-laurel-right" src="/assets/generated/mediterranean-laurel-branch-v3.png" alt="" width={822} height={1745} unoptimized />
        <div className="section-heading pipeline-heading">
          <p className="eyebrow">The evidence loop</p>
          <div>
            <h2 id="pipeline-title">A research method, not a longer prompt.</h2>
            <p>The engine makes the search process inspectable from first source to final experiment.</p>
          </div>
          <Image className="pipeline-halo" src="/assets/generated/open-laurel-wreath-v3.png" alt="" width={1247} height={1050} unoptimized />
        </div>
        <ol className="pipeline-list">
          {pipeline.map(([number, title, description, icon]) => (
            <li key={number}>
              <span>{number}</span>
              <i aria-hidden="true" />
              <EvidenceArtifact kind={icon} />
              <strong>{title}</strong>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="commands-section" id="commands" aria-labelledby="commands-title">
        <div className="page-width">
          <div className="section-heading commands-heading">
            <p className="eyebrow">Command discovery</p>
            <div>
              <h2 id="commands-title">A clear vocabulary for every research move.</h2>
              <p>Type these as plain-text intents with the Novelty Skill enabled. They route to Novelty research or MCP tools; they are not registered native Claude slash commands.</p>
            </div>
          </div>
          <ul className="command-catalog">
            {NOVELTY_COMMAND_CATALOG.map((entry) => (
              <li key={entry.command}>
                <code>{entry.command}</code>
                <p>{entry.description}</p>
              </li>
            ))}
          </ul>
          <p className="command-alias-note"><strong>Safe aliases:</strong> <code>/gaps</code> → <code>/find-gaps</code> and <code>/competitors</code> → <code>/inspect-competitors</code>. Use <code>/help &lt;command&gt;</code> for usage and an example.</p>
        </div>
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

          <div className="example-showcase">
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
        </div>
        <Image className="comparison-column" src="/assets/generated/worked-column-urn-foliage-v3.png" alt="" width={990} height={1536} unoptimized />
        <Image className="comparison-laurel" src="/assets/generated/mediterranean-laurel-branch-v3.png" alt="" width={822} height={1745} unoptimized />
      </section>

      <section className="method-section" id="method">
        <Image className="method-scenery" src="/assets/method-mediterranean-terrace.png" alt="" fill unoptimized loading="eager" sizes="100vw" />
        <div className="method-wash" aria-hidden="true" />
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
                <div className="phase-top"><span>{phase.number}</span><MethodArtifact number={phase.number} /></div>
                <h3>{phase.title}</h3>
                <p>{phase.description}</p>
                <p className="phase-detail">{phase.detail}</p>
              </li>
            ))}
          </ol>
          <div className="research-positioning">
            <div className="positioning-wreath" aria-hidden="true">
              <Image src="/assets/generated/open-laurel-wreath-v3.png" alt="" width={1247} height={1050} unoptimized />
            </div>
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
        <Image className="cta-laurel cta-laurel-left" src="/assets/generated/mediterranean-laurel-branch-v3.png" alt="" width={822} height={1745} unoptimized />
        <Image className="cta-laurel cta-laurel-right" src="/assets/generated/mediterranean-laurel-branch-v3.png" alt="" width={822} height={1745} unoptimized />
        <div className="page-width final-cta-inner">
          <div>
            <p className="eyebrow">Novelty Engine V2.1</p>
            <h2>Make the next idea earn its place.</h2>
          </div>
          <div className="final-actions">
            <a className="button button-light" href="#install">Install locally <UtilityIcon kind="down" /></a>
            <a className="text-link-light" href={githubUrl} target="_blank" rel="noreferrer">View on GitHub <UtilityIcon kind="external" /></a>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="page-width footer-inner">
          <a className="brand" href="#top"><Image className="footer-wreath" src="/assets/generated/open-laurel-wreath-v3.png" alt="" width={1247} height={1050} unoptimized /><span>Novelty Engine</span></a>
          <p>V2.1 · Free and open source under the MIT License.</p>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub <UtilityIcon kind="external" /></a>
        </div>
      </footer>
    </main>
  );
}
