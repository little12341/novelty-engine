"use client";

import { useEffect, useRef, useState } from "react";
import { githubUrl, productionMcpEndpoint, productionMcpHealthEndpoint, productionSkillDownloadUrl } from "@/lib/site";

const installCommands = "mkdir -p ~/.claude/skills\ncp -R novelty-engine ~/.claude/skills/";

function useCopyFeedback() {
  const [copyState, setCopyState] = useState<{ target: "skill" | "commands" | "mcp" | null; status: "idle" | "copied" | "error" }>({ target: null, status: "idle" });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  async function copyText(target: "skill" | "commands" | "mcp", value: string) {
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

  const label = (target: "skill" | "commands" | "mcp") => copyState.target === target
    ? copyState.status === "copied" ? "Copied" : copyState.status === "error" ? "Copy failed" : "Copy"
    : "Copy";

  return { copyState, copyText, label };
}

function useHeroEffects() {
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
          const x = Math.max(-14, Math.min(114, ((event.clientX - bounds.left) / bounds.width) * 100));
          const y = Math.max(-18, Math.min(118, ((event.clientY - bounds.top) / bounds.height) * 100));
          const dx = event.clientX < bounds.left
            ? bounds.left - event.clientX
            : event.clientX > bounds.right ? event.clientX - bounds.right : 0;
          const dy = event.clientY < bounds.top
            ? bounds.top - event.clientY
            : event.clientY > bounds.bottom ? event.clientY - bounds.bottom : 0;
          const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / 440);
          glass.style.setProperty("--glass-x", `${x}%`);
          glass.style.setProperty("--glass-y", `${y}%`);
          glass.style.setProperty("--glass-light", `${0.48 + proximity * 0.27}`);
        });
      });
    };
    const resetGlass = () => stage.querySelectorAll<HTMLElement>(".liquid-glass").forEach((glass) => {
      glass.style.removeProperty("--glass-x");
      glass.style.removeProperty("--glass-y");
      glass.style.removeProperty("--glass-light");
    });

    stage.addEventListener("pointermove", updateGlass, { passive: true });
    stage.addEventListener("pointerleave", resetGlass);
    return () => {
      window.cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", updateGlass);
      stage.removeEventListener("pointerleave", resetGlass);
    };
  }, []);
}

export function HomeResearchPanel() {
  useHeroEffects();

  return (
    <aside className="hero-install-panel home-summary-panel liquid-glass" aria-label="What Novelty Engine returns">
      <section className="hero-install-row hero-skill-row">
        <span className="terminal-glyph liquid-glass" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" focusable="false">
            <path d="M5 19V9l7-4 7 4v10M8 19v-6h8v6M3 21h18" />
          </svg>
        </span>
        <div className="hero-install-content">
          <h2>Evidence before conclusions</h2>
          <p>Claims stay attached to sources, counterevidence, and visible uncertainty.</p>
        </div>
      </section>
      <section className="hero-install-row hero-mcp-row">
        <span className="terminal-glyph liquid-glass" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" focusable="false">
            <path d="M12 20V8M12 13c-3.6-.1-5.8-2-6.3-5.5 3.5-.2 5.8 1.7 6.3 5.5ZM12 10.7c3.5-.1 5.7-2 6.2-5.4-3.5-.2-5.7 1.6-6.2 5.4Z" />
          </svg>
        </span>
        <div className="hero-install-content">
          <h2>A decision you can test</h2>
          <p>Get the strongest surviving hypothesis, its decisive risk, and a practical next step.</p>
        </div>
      </section>
    </aside>
  );
}

export function HeroInstallPanel() {
  const { copyState, copyText, label } = useCopyFeedback();
  useHeroEffects();

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
          <p><a href="/novelty-engine.zip" download>Download the Skill package</a>, then upload the ZIP under <strong>Customize → Skills</strong>.</p>
          <code className="hero-mcp-url">{productionSkillDownloadUrl}</code>
        </div>
        <button className="hero-copy-button liquid-glass" type="button" onClick={() => copyText("skill", productionSkillDownloadUrl)} aria-label="Copy Skill download URL">
          <svg className="copy-glyph" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="6.2" y="6.2" width="10.2" height="10.2" rx="1.4" />
            <path d="M13.8 6.2V4.8c0-.8-.6-1.4-1.4-1.4H4.8c-.8 0-1.4.6-1.4 1.4v7.6c0 .8.6 1.4 1.4 1.4h1.4" />
          </svg>
          {label("skill")}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState.target === "skill" && copyState.status === "copied" ? "Skill download URL copied to clipboard." : copyState.target === "skill" && copyState.status === "error" ? "Could not copy the Skill download URL." : ""}
        </span>
      </section>

      <section className="hero-install-row hero-mcp-row" aria-labelledby="hero-mcp-title">
        <div className="hero-install-content">
          <h2 id="hero-mcp-title">Connect through MCP</h2>
          <p>Add this custom connector so Claude can send bounded public evidence to Novelty Engine.</p>
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
  const { copyState, copyText, label } = useCopyFeedback();

  useEffect(() => {
    const endpointTimer = window.setTimeout(() => setMcpEndpoint(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? new URL("/api/mcp", window.location.origin).href : productionMcpEndpoint), 0);
    return () => window.clearTimeout(endpointTimer);
  }, []);

  return (
    <div className="install-options">
      <article className="install-option manual-option install-option-primary">
        <header className="install-option-heading">
          <div className="install-option-kicker-row">
            <p className="option-kicker">Claude Skill</p>
            <span className="recommended-label">Recommended</span>
          </div>
          <h3>Install the Claude Skill.</h3>
          <p><a href="/novelty-engine.zip" download>Download the Skill ZIP</a> and upload it in <strong>Customize → Skills</strong>. Claude Code users can install the extracted folder locally.</p>
        </header>
        <div className="command-block">
          <div className="command-header">
            <span>Optional Claude Code install</span>
            <button type="button" onClick={() => copyText("commands", installCommands)} aria-label="Copy both Claude Skill setup commands">
              <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="6" y="6" width="8" height="8" rx="1"/><path d="M12 6V4.8c0-.5-.4-.8-.8-.8H4.8c-.4 0-.8.3-.8.8v6.4c0 .4.4.8.8.8H6"/></svg>
              {label("commands")}
            </button>
          </div>
          <pre><code>{installCommands}</code></pre>
          <p className="archive-contents"><strong>Windows</strong><span>Extract to <code>%USERPROFILE%\.claude\skills\novelty-engine</code></span></p>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState.target === "commands" && copyState.status === "copied" ? "Both install commands copied to clipboard." : copyState.target === "commands" && copyState.status === "error" ? "Could not copy the install commands." : ""}
        </span>
      </article>

      <article className="install-option browser-option">
        <header className="install-option-heading">
          <p className="option-kicker">Claude Connector</p>
          <h3>Connect through MCP.</h3>
          <p>Enable <strong>Code execution and file creation</strong>, then add a custom connector and paste this endpoint.</p>
        </header>
        <div className="command-block mcp-command">
          <div className="command-header">
            <span>Streamable HTTP endpoint</span>
            <button type="button" onClick={() => copyText("mcp", mcpEndpoint)} aria-label="Copy MCP endpoint">
              <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="6" y="6" width="8" height="8" rx="1"/><path d="M12 6V4.8c0-.5-.4-.8-.8-.8H4.8c-.4 0-.8.3-.8.8v6.4c0 .4.4.8.8.8H6"/></svg>
              {label("mcp")}
            </button>
          </div>
          <pre><code>{mcpEndpoint}</code></pre>
          <p className="archive-contents"><span>Test connection</span><a href={productionMcpHealthEndpoint} target="_blank" rel="noreferrer">Open health check</a></p>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {copyState.target === "mcp" && copyState.status === "copied" ? "MCP endpoint copied to clipboard." : copyState.target === "mcp" && copyState.status === "error" ? "Could not copy the MCP endpoint." : ""}
        </span>
      </article>
      <details className="self-hosting-details">
        <summary>Optional self-hosting setup</summary>
        <p>Self-hosting and Brave or Tavily provider adapters are optional. Provider keys are never required for the normal Claude supplied-source flow. See the <a href={`${githubUrl}#optional-self-hosting`} target="_blank" rel="noreferrer">technical README</a> for runtime, environment, and deployment instructions.</p>
      </details>
    </div>
  );
}
