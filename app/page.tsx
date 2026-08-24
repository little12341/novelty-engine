const githubUrl = "https://github.com/little12341/novelty-engine";

function ArrowIcon({ down = false }: { down?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={down ? "icon icon-down" : "icon"}>
      <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="icon">
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span>N</span>
      <i />
    </span>
  );
}

const pipeline = [
  ["01", "Obvious ideas", "Map the defaults"],
  ["02", "Reject", "Create distance"],
  ["03", "Cross-domain", "Borrow mechanisms"],
  ["04", "Candidates", "Generate 15+"],
  ["05", "Similarity attack", "Find the lookalikes"],
  ["06", "Mutate", "Change assumptions"],
  ["07", "Final ideas", "Keep only survivors"],
];

export default function Home() {
  return (
    <main>
      <header className="site-header shell">
        <a className="brand" href="#top" aria-label="Novelty Engine home">
          <Mark />
          <span>Novelty Engine</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#comparison">Example</a>
          <a href="#how-it-works">Method</a>
          <a href="#install">Install</a>
        </nav>
        <a className="github-link" href={githubUrl} target="_blank" rel="noreferrer">
          GitHub <ArrowIcon />
        </a>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow fade-up"><span className="status-dot" /> A free skill for Claude</div>
          <h1 className="fade-up delay-1">
            Stop getting the<br />
            <span>same AI ideas.</span>
          </h1>
          <p className="hero-lede fade-up delay-2">
            Novelty Engine pushes Claude past the obvious—rejecting defaults, crossing distant domains, mutating the strongest candidates, and attacking similarity before you see a result.
          </p>
          <div className="hero-actions fade-up delay-3">
            <a className="button button-primary" href="/novelty-engine.zip" download="novelty-engine.zip">
              <DownloadIcon /> Download Skill <span className="button-meta">.ZIP</span>
            </a>
            <a className="button button-secondary" href={githubUrl} target="_blank" rel="noreferrer">
              View on GitHub <ArrowIcon />
            </a>
          </div>
          <p className="compatibility fade-up delay-3">No account · No API key · Works without web access</p>
        </div>

        <div className="engine-visual fade-up delay-2" aria-label="Novelty Engine process visualization">
          <div className="visual-grid" />
          <div className="visual-topline">
            <span>NE / PROCESS 01</span><span>RUNNING</span>
          </div>
          <div className="idea-stream stream-muted">
            <span>meal planner</span><span>recipe generator</span><span>expiry tracker</span>
          </div>
          <div className="reject-line"><span>DEFAULT CLUSTER</span><i /><strong>REJECTED ×</strong></div>
          <div className="domain-orbit">
            <span className="orbit-label orbit-a">ecology</span>
            <span className="orbit-label orbit-b">logistics</span>
            <span className="orbit-label orbit-c">behavior</span>
            <span className="orbit-label orbit-d">materials</span>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="engine-core"><Mark /><small>MUTATE</small></div>
          </div>
          <div className="output-card">
            <span className="output-index">01</span>
            <div><small>SURVIVOR</small><strong>Ripeness Relay</strong><p>Food storage that sequences meals from biological decay signals—not expiry dates.</p></div>
            <span className="score">8.7</span>
          </div>
        </div>
      </section>

      <div className="proof-strip">
        <div className="shell proof-inner">
          <span>Not a bigger brainstorm.</span>
          <span className="proof-emphasis">A better selection pressure.</span>
          <span className="proof-rule" />
          <span>15+ candidates in</span>
          <span>3–5 survivors out</span>
        </div>
      </div>

      <section className="section shell" id="comparison">
        <div className="section-heading">
          <div><span className="section-index">01</span><span className="kicker">The difference</span></div>
          <h2>Familiar in.<br /><span>Familiar out.</span></h2>
          <p>Ask the same question. Change the process between prompt and answer.</p>
        </div>

        <div className="prompt-bar">
          <span>PROMPT</span>
          <p>“Give me product ideas that reduce food waste at home.”</p>
        </div>

        <div className="comparison-grid">
          <article className="comparison-card baseline-card">
            <div className="card-label"><span className="card-dot gray" /> NORMAL CLAUDE <span>FIRST-PASS ANSWERS</span></div>
            <div className="baseline-list">
              <div><span>01</span><p><strong>AI Recipe Generator</strong>Suggest recipes from ingredients you already have.</p></div>
              <div><span>02</span><p><strong>Expiry Date Tracker</strong>Scan groceries and get reminders before food expires.</p></div>
              <div><span>03</span><p><strong>Food Donation App</strong>Connect households with nearby people who need food.</p></div>
            </div>
            <div className="card-verdict"><span>Pattern</span><strong>Existing category + AI</strong></div>
          </article>

          <article className="comparison-card novelty-card">
            <div className="card-label"><span className="card-dot green" /> WITH NOVELTY ENGINE <span>AFTER SELECTION</span></div>
            <div className="novel-idea">
              <div className="novel-title"><span>01</span><div><small>BIOLOGY × QUEUEING</small><h3>Ripeness Relay</h3></div><span className="survivor-tag">SURVIVOR</span></div>
              <p>A countertop sensor listens for tiny acoustic and gas changes from produce, then builds a meal sequence around what is biologically turning—not what an expiry label predicts.</p>
              <div className="novel-meta"><span><small>DIFFERENT BECAUSE</small>Schedules behavior from decay signals</span><span><small>FIRST TEST</small>Signal accuracy across 10 foods</span></div>
            </div>
            <div className="novel-idea compact">
              <div className="novel-title"><span>02</span><div><small>COMMITMENT DESIGN × RETAIL</small><h3>Leftover Futures</h3></div></div>
              <p>Households pre-commit tomorrow’s leftovers to a specific lunch format at the moment they cook—before “unclaimed food” exists.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section method-section" id="how-it-works">
        <div className="shell">
          <div className="section-heading horizontal">
            <div><span className="section-index">02</span><span className="kicker">The method</span></div>
            <h2>Novelty is a<br /><span>process, not a vibe.</span></h2>
            <p>The skill creates distance from predictable answers, then applies pressure until only useful differentiation remains.</p>
          </div>

          <div className="pipeline" role="list" aria-label="Novelty Engine pipeline">
            {pipeline.map(([number, title, note], index) => (
              <div className={`pipeline-step step-${index + 1}`} role="listitem" key={number}>
                <div className="pipeline-number">{number}</div>
                <div className="pipeline-node"><span>{index === 1 || index === 4 ? "×" : index === 6 ? "✓" : "·"}</span></div>
                <strong>{title}</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>

          <div className="method-notes">
            <div><span>A</span><p><strong>Map the obvious</strong>The usual answers become an exclusion zone, not a starting menu.</p></div>
            <div><span>B</span><p><strong>Transfer mechanisms</strong>Borrow how distant systems work—not merely how their language sounds.</p></div>
            <div><span>C</span><p><strong>Attack resemblance</strong>If an idea collapses into a familiar product, mutate it or remove it.</p></div>
          </div>
        </div>
      </section>

      <section className="section shell why-section" id="why">
        <div className="why-index">03 / WHY IT EXISTS</div>
        <div className="why-copy">
          <p className="why-lede">Language models are trained to predict what comes next.</p>
          <h2>The statistically likely answer is often the one <span>you have already heard.</span></h2>
          <div className="why-body">
            <p>Novelty Engine adds a deliberate structure between the first association and the final answer. It identifies default patterns, steps outside them, generates broadly, and then selects ruthlessly.</p>
            <p>It does not promise globally new ideas. It produces concepts that are more unusual, more specific, and easier to compare against what already exists.</p>
          </div>
        </div>
        <div className="probability-visual" aria-hidden="true">
          <div className="curve-label"><span>LIKELIHOOD</span><span>ORIGINALITY</span></div>
          <svg viewBox="0 0 440 220" preserveAspectRatio="none">
            <path className="curve-grid" d="M0 180H440M0 135H440M0 90H440M0 45H440M88 0V220M176 0V220M264 0V220M352 0V220" />
            <path className="curve-main" d="M0 187 C55 186 68 172 96 109 C126 40 168 24 205 93 C239 158 263 177 440 187" />
            <path className="curve-tail" d="M250 170 C298 142 343 133 428 128" />
          </svg>
          <span className="default-label">DEFAULT<br />CLUSTER</span>
          <span className="novelty-label">SEARCH<br />HERE →</span>
        </div>
      </section>

      <section className="section install-section" id="install">
        <div className="shell install-grid">
          <div className="install-copy">
            <div><span className="section-index">04</span><span className="kicker">Get the skill</span></div>
            <h2>Install once.<br /><span>Ideate differently.</span></h2>
            <p>One small folder. No dependencies, API key, account, or configuration.</p>
            <a className="button button-primary button-large" href="/novelty-engine.zip" download="novelty-engine.zip">
              <DownloadIcon /> Download novelty-engine.zip <span>↓</span>
            </a>
            <div className="file-proof"><span>PACKAGE</span><code>novelty-engine/SKILL.md</code><strong>READY</strong></div>
          </div>

          <div className="install-steps">
            <div className="install-step">
              <span>01</span><div><h3>Download and unzip</h3><p>The ZIP contains the complete <code>novelty-engine</code> skill folder.</p></div>
            </div>
            <div className="install-step">
              <span>02</span><div><h3>Add it to Claude</h3><p>Upload the skill in Claude settings, or copy the folder into your Claude Code skills directory:</p><pre><code>mkdir -p ~/.claude/skills{`\n`}cp -R novelty-engine ~/.claude/skills/</code></pre></div>
            </div>
            <div className="install-step">
              <span>03</span><div><h3>Ask for ideas</h3><p>Use a normal prompt. Claude activates the skill automatically when the task calls for ideation.</p><blockquote>“Design unusual ways for apartment buildings to share tools without a staffed library.”</blockquote></div>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <a className="brand" href="#top"><Mark /><span>Novelty Engine</span></a>
          <p>Better ideas need better selection pressure.</p>
          <div><a href={githubUrl} target="_blank" rel="noreferrer">GitHub <ArrowIcon /></a><span>Free &amp; open source</span></div>
        </div>
      </footer>
    </main>
  );
}
