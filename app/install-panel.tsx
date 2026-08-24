"use client";

import { useEffect, useRef, useState } from "react";

const installCommands = "mkdir -p ~/.claude/skills\ncp -R novelty-engine ~/.claude/skills/";

export function InstallPanel() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copyCommands() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(installCommands);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = installCommands;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy command was unavailable");
      }
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2200);
  }

  return (
    <div className="install-options">
      <article className="install-option download-option">
        <div className="option-number">Option 01</div>
        <div>
          <p className="option-kicker">Download ZIP</p>
          <h3>Get the complete skill folder.</h3>
          <p>Download the packaged skill, then extract the <code>novelty-engine</code> folder before installing it.</p>
        </div>
        <a className="button button-primary download-button" href="/novelty-engine.zip" download="novelty-engine.zip">
          Download novelty-engine.zip <span aria-hidden="true">↓</span>
        </a>
        <p className="archive-contents"><span>Includes</span><code>novelty-engine/SKILL.md</code></p>
      </article>

      <article className="install-option manual-option">
        <div className="option-number">Option 02</div>
        <div>
          <p className="option-kicker">Install locally</p>
          <h3>Copy the extracted folder into Claude.</h3>
          <p>Run both commands from the directory that contains the extracted <code>novelty-engine</code> folder.</p>
        </div>
        <div className="command-block">
          <div className="command-header">
            <span>Manual install</span>
            <button type="button" onClick={copyCommands} aria-label="Copy local install commands">
              <span aria-hidden="true" className="copy-icon">{copyState === "copied" ? "✓" : "□"}</span>
              {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}
            </button>
          </div>
          <pre><code>{installCommands}</code></pre>
          <span className="sr-only" role="status" aria-live="polite">
            {copyState === "copied" ? "Install commands copied to clipboard." : copyState === "error" ? "Could not copy the install commands." : ""}
          </span>
        </div>
      </article>
    </div>
  );
}
