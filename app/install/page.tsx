import type { Metadata } from "next";
import { NOVELTY_COMMAND_CATALOG } from "@/lib/research/intents";
import { githubUrl } from "@/lib/site";
import { InstallTransition } from "../install-transition";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const metadata: Metadata = {
  title: "Install — Novelty Engine",
  description: "Download the Claude Skill, connect the Novelty Engine MCP endpoint, and use the research command catalog.",
  alternates: { canonical: "/install" },
};

const usefulCommands = new Set(["/research-market", "/find-gaps", "/inspect-competitors", "/customer-pain", "/falsify", "/rerun"]);
const installCommands = NOVELTY_COMMAND_CATALOG.filter((entry) => usefulCommands.has(entry.command));

export default function InstallPage() {
  return (
    <div className="site-page install-page">
      <SiteHeader />
      <main>
        <InstallTransition />

        <section className="content-section commands-section" aria-labelledby="commands-title">
          <div className="page-width">
            <header className="section-intro">
              <p className="eyebrow">Useful commands</p>
              <h2 id="commands-title">Six shortcuts for common research jobs.</h2>
              <p>These are Skill intents. Type them as normal messages; they may not appear in Claude’s native slash-command autocomplete. The complete command catalog and MCP tool reference remain in the <a href={`${githubUrl}#claude-command-map`} target="_blank" rel="noreferrer">documentation</a>.</p>
            </header>
            <ul className="command-catalog">
              {installCommands.map((entry) => <li key={entry.command}><code>{entry.command}</code><p>{entry.description}</p></li>)}
            </ul>
            <div className="documentation-links">
              <a href={`${githubUrl}#readme`} target="_blank" rel="noreferrer">Read the documentation</a>
              <a href={`${githubUrl}#optional-self-hosting`} target="_blank" rel="noreferrer">Optional self-hosting</a>
              <a href={githubUrl} target="_blank" rel="noreferrer">View source on GitHub</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
