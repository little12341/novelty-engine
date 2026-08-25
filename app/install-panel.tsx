"use client";

import { useEffect, useRef, useState } from "react";

const installCommands = "mkdir -p ~/.claude/skills\ncp -R novelty-engine ~/.claude/skills/";
const productionMcpEndpoint = "https://novelty-engine.vercel.app/api/mcp";
const productionHealthEndpoint = "https://novelty-engine.vercel.app/api/mcp/health";

function useCopyFeedback() {
  const [copyState, setCopyState] = useState<{ target: "commands" | "mcp" | null; status: "idle" | "copied" | "error" }>({ target: null, status: "idle" });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  async function copyText(target: "commands" | "mcp", value: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy command was unavailable");
      }
      setCopyState({ target, status: "copied" });
    } catch {
      setCopyState({ target, status: "error" });
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState({ target: null, status: "idle" }), 2200);
  }

  const label = (target: "commands" | "mcp") => copyState.target === target
    ? copyState.status === "copied" ? "Copied" : copyState.status === "error" ? "Copy failed" : "Copy"
    : "Copy";

  return { copyState, copyText, label };
}

export function HeroInstallPanel() {
  const { copyState, copyText, label } = useCopyFeedback();

  return (
    <aside className="hero-install-panel" aria-label="Quick installation options">
      <section>
        <div className="hero-install-heading">
          <span className="terminal-glyph" aria-hidden="true">›_</span>
          <div><small>Claude Code</small><strong>Local install</strong></div>
          <button type="button" onClick={() => copyText("commands", installCommands)} aria-label="Copy local install commands">
            <span aria-hidden="true">▢</span> {label("commands")}
          </button>
        </div>
        <pre><code>{installCommands}</code></pre>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState.target === "commands" && copyState.status === "copied" ? "Install commands copied to clipboard." : copyState.target === "commands" && copyState.status === "error" ? "Could not copy the install commands." : ""}
        </span>
      </section>
      <section>
        <div className="hero-install-heading">
          <span className="connector-glyph" aria-hidden="true">◎</span>
          <div><small>Claude Browser</small><strong>MCP connector</strong></div>
          <button type="button" onClick={() => copyText("mcp", productionMcpEndpoint)} aria-label="Copy remote MCP endpoint">
            <span aria-hidden="true">▢</span> {label("mcp")}
          </button>
        </div>
        <code className="hero-mcp-url">{productionMcpEndpoint}</code>
        <p>Add this URL as a custom connector in Claude.</p>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState.target === "mcp" && copyState.status === "copied" ? "MCP endpoint copied to clipboard." : copyState.target === "mcp" && copyState.status === "error" ? "Could not copy the MCP endpoint." : ""}
        </span>
      </section>
    </aside>
  );
}

export function InstallPanel() {
  const { copyState, copyText, label } = useCopyFeedback();
  const [mcpEndpoint, setMcpEndpoint] = useState(productionMcpEndpoint);

  useEffect(() => {
    const endpointTimer = window.setTimeout(() => setMcpEndpoint(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? new URL("/api/mcp", window.location.origin).href : productionMcpEndpoint), 0);
    return () => window.clearTimeout(endpointTimer);
  }, []);

  return (
    <div className="install-options">
      <article className="install-option download-option">
        <div className="option-number">Option 01</div>
        <div>
          <p className="option-kicker">Skill package</p>
          <h3>Get the complete skill folder.</h3>
          <p>Upload the ZIP from <strong>Customize → Skills → + → Create skill</strong>, or extract it for Claude Code.</p>
        </div>
        <a className="button button-primary download-button" href="/novelty-engine.zip" download="novelty-engine.zip">
          Download novelty-engine.zip <span aria-hidden="true">↓</span>
        </a>
        <p className="archive-contents"><span>Includes</span><code>novelty-engine/SKILL.md</code></p>
      </article>

      <article className="install-option manual-option">
        <div className="option-number">Option 02</div>
        <div>
          <p className="option-kicker">Claude Code</p>
          <h3>Install the local Skill.</h3>
          <p>Run these commands beside the extracted folder. The direct API helper remains available as a fallback.</p>
        </div>
        <div className="command-block">
          <div className="command-header">
            <span>Manual install</span>
            <button type="button" onClick={() => copyText("commands", installCommands)} aria-label="Copy local install commands">
              <span aria-hidden="true" className="copy-icon">{copyState.target === "commands" && copyState.status === "copied" ? "✓" : "□"}</span>
              {label("commands")}
            </button>
          </div>
          <pre><code>{installCommands}</code></pre>
          <span className="sr-only" role="status" aria-live="polite">
            {copyState.target === "commands" && copyState.status === "copied" ? "Install commands copied to clipboard." : copyState.target === "commands" && copyState.status === "error" ? "Could not copy the install commands." : ""}
          </span>
        </div>
      </article>

      <article className="install-option browser-option">
        <div className="option-number">Option 03</div>
        <div>
          <p className="option-kicker">Claude browser</p>
          <h3>Connect live research once.</h3>
          <p>Install the Skill, then open <strong>Settings → Connectors → Add custom connector</strong> and paste the deployed MCP endpoint. No Tavily key or local environment variable is needed.</p>
        </div>
        <div className="command-block mcp-command">
          <div className="command-header">
            <span>Streamable HTTP endpoint</span>
            <button type="button" onClick={() => copyText("mcp", mcpEndpoint)} aria-label="Copy remote MCP endpoint">
              <span aria-hidden="true" className="copy-icon">{copyState.target === "mcp" && copyState.status === "copied" ? "✓" : "□"}</span>
              {label("mcp")}
            </button>
          </div>
          <pre><code>{mcpEndpoint}</code></pre>
          <p className="archive-contents"><span>Test connection</span><a href={productionHealthEndpoint} target="_blank" rel="noreferrer">Open health check</a></p>
          <span className="sr-only" role="status" aria-live="polite">
            {copyState.target === "mcp" && copyState.status === "copied" ? "MCP endpoint copied to clipboard." : copyState.target === "mcp" && copyState.status === "error" ? "Could not copy the MCP endpoint." : ""}
          </span>
        </div>
      </article>
    </div>
  );
}
