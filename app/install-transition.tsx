import Image from "next/image";
import { InstallPanel } from "./install-panel";

type OutcomeKind = "structure" | "evidence" | "outcome";

function OutcomeIcon({ kind }: { kind: OutcomeKind }) {
  const paths: Record<OutcomeKind, React.ReactNode> = {
    structure: <><path d="M6 18V9l6-4 6 4v9"/><path d="M9 18v-6h6v6M4 20h16"/></>,
    evidence: <><path d="M7 5h10v14H7z"/><path d="m9.5 12 1.7 1.8 3.7-4M9.5 7.8h5"/></>,
    outcome: <><path d="M12 20V8M12 13c-3.6-.1-5.8-2-6.3-5.5 3.5-.2 5.8 1.7 6.3 5.5ZM12 10.7c3.5-.1 5.7-2 6.2-5.4-3.5-.2-5.7 1.6-6.2 5.4Z"/><path d="M8 20h8"/></>,
  };

  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{paths[kind]}</svg>;
}

function OutcomeCard({ kind, title, children }: { kind: OutcomeKind; title: string; children: React.ReactNode }) {
  return (
    <article className="research-outcome-card">
      <span aria-hidden="true"><OutcomeIcon kind={kind} /></span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}

export function InstallTransition() {
  return (
    <>
      <section className="install-section" id="install" aria-labelledby="install-title">
        <Image
          className="install-laurel install-laurel-left"
          src="/assets/generated/mediterranean-laurel-branch-v3.png"
          alt=""
          width={822}
          height={1745}
          unoptimized
          aria-hidden="true"
        />
        <Image
          className="install-laurel install-laurel-right"
          src="/assets/generated/mediterranean-laurel-branch-v3.png"
          alt=""
          width={822}
          height={1745}
          unoptimized
          aria-hidden="true"
        />

        <div className="page-width install-section-inner">
          <header className="install-section-heading">
            <Image className="install-crown" src="/assets/generated/open-laurel-wreath-v3.png" alt="" width={1247} height={1050} unoptimized aria-hidden="true" />
            <div>
              <p className="eyebrow">Install</p>
              <h2 id="install-title">Install Novelty Engine.</h2>
              <p>Start with the Claude Skill. Add the connector when you want Claude to send public evidence to the hosted research engine.</p>
            </div>
          </header>

          <InstallPanel />
        </div>
      </section>

      <section className="research-reveal-section" aria-labelledby="research-reveal-title">
        <div className="research-reveal-backdrop" aria-hidden="true">
          <Image src="/greek-reveal.png" alt="" fill unoptimized loading="eager" sizes="100vw" />
        </div>
        <div className="research-reveal-shade" aria-hidden="true" />
        <div className="page-width research-reveal-content">
          <header className="research-reveal-copy">
            <p className="eyebrow">Research with visible limits</p>
            <h2 id="research-reveal-title">Evidence in. Testable answers out.</h2>
            <p>Claude finds current public sources. Novelty Engine checks what those sources can actually support.</p>
          </header>
          <div className="research-outcome-grid">
            <OutcomeCard kind="structure" title="Organized evidence">Keep companies, customer reports, prices, and source roles separate.</OutcomeCard>
            <OutcomeCard kind="evidence" title="Claims checked">Attach the right source to each claim and leave unsupported details unknown.</OutcomeCard>
            <OutcomeCard kind="outcome" title="A practical next test">See the strongest hypothesis, the biggest risk, and what to test next.</OutcomeCard>
          </div>
        </div>
      </section>
    </>
  );
}
