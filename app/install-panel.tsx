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
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await Promise.race([
            navigator.clipboard.writeText(value),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Clipboard write timed out")), 350)),
          ]);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (!copied) {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.setAttribute("readonly", "");
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand("copy");
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

  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".hero-stage");
    const cover = document.querySelector<HTMLElement>(".principle-strip");
    if (!stage || !cover) return;

    const controls = Array.from(stage.querySelectorAll<HTMLElement>("a, button"));
    let frame = 0;
    const updateCoveredControls = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const layered = window.getComputedStyle(stage).position === "sticky";
        const coverTop = cover.getBoundingClientRect().top;
        controls.forEach((control) => {
          const covered = layered && control.getBoundingClientRect().bottom > coverTop;
          control.toggleAttribute("inert", covered);
          if (covered) {
            control.setAttribute("aria-hidden", "true");
            control.setAttribute("tabindex", "-1");
          } else {
            control.removeAttribute("aria-hidden");
            control.removeAttribute("tabindex");
          }
        });
      });
    };

    updateCoveredControls();
    window.addEventListener("scroll", updateCoveredControls, { passive: true });
    window.addEventListener("resize", updateCoveredControls, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateCoveredControls);
      window.removeEventListener("resize", updateCoveredControls);
      controls.forEach((control) => {
        control.removeAttribute("inert");
        control.removeAttribute("aria-hidden");
        control.removeAttribute("tabindex");
      });
    };
  }, []);

  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".hero-stage");
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const updateGlass = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        stage.querySelectorAll<HTMLElement>(".liquid-glass").forEach((glass) => {
          const bounds = glass.getBoundingClientRect();
          const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
          const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
          glass.style.setProperty("--glass-x", `${x}%`);
          glass.style.setProperty("--glass-y", `${y}%`);
        });
      });
    };
    const resetGlass = () => stage.querySelectorAll<HTMLElement>(".liquid-glass").forEach((glass) => {
      glass.style.removeProperty("--glass-x");
      glass.style.removeProperty("--glass-y");
    });

    stage.addEventListener("pointermove", updateGlass, { passive: true });
    stage.addEventListener("pointerleave", resetGlass);
    return () => {
      window.cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", updateGlass);
      stage.removeEventListener("pointerleave", resetGlass);
    };
  }, []);

  return (
    <aside className="hero-install-panel liquid-glass" aria-label="Install Novelty Engine">
      <section className="hero-install-row hero-skill-row" aria-labelledby="hero-skill-title">
        <span className="terminal-glyph liquid-glass" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" focusable="false">
            <path d="m6.2 7.4 4.1 4.1-4.1 4.1M12.7 16.1h5.1" />
          </svg>
        </span>
        <div className="hero-install-content">
          <h2 id="hero-skill-title">Install as a Claude Skill</h2>
          <p>Creates the skills folder and copies Novelty Engine into it.</p>
          <pre><code>{installCommands}</code></pre>
        </div>
        <button className="hero-copy-button liquid-glass" type="button" onClick={() => copyText("commands", installCommands)} aria-label="Copy both Claude Skill setup commands">
          <svg className="copy-glyph" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="6.2" y="6.2" width="10.2" height="10.2" rx="1.4" />
            <path d="M13.8 6.2V4.8c0-.8-.6-1.4-1.4-1.4H4.8c-.8 0-1.4.6-1.4 1.4v7.6c0 .8.6 1.4 1.4 1.4h1.4" />
          </svg>
          {label("commands")}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState.target === "commands" && copyState.status === "copied" ? "Both install commands copied to clipboard." : copyState.target === "commands" && copyState.status === "error" ? "Could not copy the install commands." : ""}
        </span>
      </section>

      <section className="hero-install-row hero-mcp-row" aria-labelledby="hero-mcp-title">
        <div className="hero-install-content">
          <h2 id="hero-mcp-title">Connect through MCP</h2>
          <p>Connects your AI client directly to the Novelty Engine MCP server.</p>
          <code className="hero-mcp-url">{productionMcpEndpoint}</code>
        </div>
        <button className="hero-copy-button liquid-glass" type="button" onClick={() => copyText("mcp", productionMcpEndpoint)} aria-label="Copy MCP endpoint">
          <svg className="copy-glyph" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="6.2" y="6.2" width="10.2" height="10.2" rx="1.4" />
            <path d="M13.8 6.2V4.8c0-.8-.6-1.4-1.4-1.4H4.8c-.8 0-1.4.6-1.4 1.4v7.6c0 .8.6 1.4 1.4 1.4h1.4" />
          </svg>
          {label("mcp")}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState.target === "mcp" && copyState.status === "copied" ? "MCP endpoint copied to clipboard." : copyState.target === "mcp" && copyState.status === "error" ? "Could not copy the MCP endpoint." : ""}
        </span>
      </section>
    </aside>
  );
}

export function InstallPanel() {
  const [mcpEndpoint, setMcpEndpoint] = useState(productionMcpEndpoint);

  useEffect(() => {
    const endpointTimer = window.setTimeout(() => setMcpEndpoint(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? new URL("/api/mcp", window.location.origin).href : productionMcpEndpoint), 0);
    return () => window.clearTimeout(endpointTimer);
  }, []);

  return (
    <div className="install-options">
      <article className="install-option manual-option">
        <div className="option-number">Option 01</div>
        <div>
          <p className="option-kicker">Claude Skill</p>
          <h3>Install the local Skill.</h3>
          <p>Run both commands beside the Novelty Engine folder to add it to Claude’s local skills directory.</p>
        </div>
        <div className="command-block">
          <div className="command-header">
            <span>Manual install</span>
            <span className="command-meta">Two commands</span>
          </div>
          <pre><code>{installCommands}</code></pre>
        </div>
      </article>

      <article className="install-option browser-option">
        <div className="option-number">Option 02</div>
        <div>
          <p className="option-kicker">Claude browser</p>
          <h3>Connect live research once.</h3>
          <p>Install the Skill, then open <strong>Settings → Connectors → Add custom connector</strong> and paste the deployed MCP endpoint. No Tavily key or local environment variable is needed.</p>
        </div>
        <div className="command-block mcp-command">
          <div className="command-header">
            <span>Streamable HTTP endpoint</span>
            <span className="command-meta">Remote connection</span>
          </div>
          <pre><code>{mcpEndpoint}</code></pre>
          <p className="archive-contents"><span>Test connection</span><a href={productionHealthEndpoint} target="_blank" rel="noreferrer">Open health check</a></p>
        </div>
      </article>
    </div>
  );
}
