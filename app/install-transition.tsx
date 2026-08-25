"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { InstallPanel } from "./install-panel";

const wingSequence = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function LaurelBranch({ side }: { side: "left" | "right" }) {
  return (
    <Image
      className={`install-laurel install-laurel-${side}`}
      src="/assets/generated/mediterranean-laurel-branch-v3.png"
      alt=""
      width={822}
      height={1745}
      unoptimized
      aria-hidden="true"
    />
  );
}

type OrnamentKind = "install" | "connect" | "ask" | "structure" | "evidence" | "outcome";

function OrnamentIcon({ kind }: { kind: OrnamentKind }) {
  const paths: Record<OrnamentKind, React.ReactNode> = {
    install: <><path d="M12 3.2v11.1m0 0 3.5-3.5M12 14.3l-3.5-3.5"/><path d="M5.2 16.4v2.4h13.6v-2.4"/></>,
    connect: <><circle cx="7" cy="8" r="2.2"/><circle cx="17" cy="8" r="2.2"/><path d="M9.2 8h5.6M6.2 10l-1.7 6.5h15L17.8 10"/></>,
    ask: <><path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="3.1"/></>,
    structure: <><path d="M6 18V9l6-4 6 4v9"/><path d="M9 18v-6h6v6M4 20h16"/></>,
    evidence: <><path d="M7 5h10v14H7z"/><path d="m9.5 12 1.7 1.8 3.7-4M9.5 7.8h5"/></>,
    outcome: <><path d="M12 20V8M12 13c-3.6-.1-5.8-2-6.3-5.5 3.5-.2 5.8 1.7 6.3 5.5ZM12 10.7c3.5-.1 5.7-2 6.2-5.4-3.5-.2-5.7 1.6-6.2 5.4Z"/><path d="M8 20h8"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{paths[kind]}</svg>;
}

function InstallStepIcon({ kind }: { kind: "install" | "connect" | "ask" }) {
  return (
    <Image
      src={`/assets/generated/install-step-${kind}-v3.png`}
      alt=""
      width={512}
      height={512}
      unoptimized
      aria-hidden="true"
    />
  );
}

function PrincipleStrip() {
  return (
    <div className="transition-principles" aria-label="Novelty Engine principles">
      <div className="transition-principles-inner">
        <p><span>01</span> Novelty without demand is a curiosity.</p>
        <p><span>02</span> Demand without differentiation is a crowded category.</p>
        <p><span>03</span> Evidence without falsification is just a story.</p>
      </div>
    </div>
  );
}

function InstallViewport() {
  return (
    <div className="transition-install-viewport">
      <PrincipleStrip />
      <div className="transition-install-surface">
        <LaurelBranch side="left" />
        <LaurelBranch side="right" />
        <div className="transition-install-content">
          <header className="transition-install-heading">
            <Image className="transition-install-crown" src="/assets/generated/open-laurel-wreath-v3.png" alt="" width={1247} height={1050} unoptimized aria-hidden="true" />
            <p className="eyebrow">Install</p>
            <h2>Install once. Connect the<br />research path that fits.</h2>
            <p>Install the Claude Skill locally, or connect the deployed <code>/api/mcp</code><br className="desktop-break" /> endpoint for live research without local configuration.</p>
          </header>
          <InstallPanel />
          <ol className="transition-install-flow" aria-label="Research connection steps">
            <li><span aria-hidden="true"><InstallStepIcon kind="install" /></span><div><strong>Install the Skill</strong><p>Copy the folder into Claude’s local skills directory.</p></div></li>
            <li><span aria-hidden="true"><InstallStepIcon kind="connect" /></span><div><strong>Connect research</strong><p>Add the MCP URL in Claude browser, or set the direct helper URL in Claude Code.</p></div></li>
            <li><span aria-hidden="true"><InstallStepIcon kind="ask" /></span><div><strong>Ask normally</strong><p>Invoke <code>/novelty-engine</code> or request market-gap research.</p></div></li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function RevealCard({ kind, title, children }: { kind: "structure" | "evidence" | "outcome"; title: string; children: React.ReactNode }) {
  return (
    <article className="greek-reveal-card">
      <span aria-hidden="true"><OrnamentIcon kind={kind} /></span>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

function GreekScene() {
  return (
    <section className="greek-reveal-scene" aria-labelledby="greek-reveal-title">
      <div className="greek-reveal-backdrop" aria-hidden="true">
        <Image src="/greek-reveal.png" alt="" fill unoptimized loading="eager" sizes="100vw" />
      </div>
      <div className="greek-distant-haze" aria-hidden="true" />
      <div className="greek-particles greek-particles-far" aria-hidden="true" />
      <div className="greek-particles greek-particles-near" aria-hidden="true" />
      <PrincipleStrip />
      <div className="greek-reveal-copy">
        <p className="eyebrow">About</p>
        <h2 id="greek-reveal-title">Novelty Engine<br />Research System</h2>
        <p className="greek-reveal-lede">A system for discovering real product-market gaps<br />through structured, falsifiable research.</p>
      </div>
      <div className="greek-reveal-cards">
        <RevealCard kind="structure" title="Structured Research">Define a gap, collect evidence, and build a falsifiable case.</RevealCard>
        <RevealCard kind="evidence" title="Falsifiable Evidence">Every claim is tested against verifiable, real-world data.</RevealCard>
        <RevealCard kind="outcome" title="Clear Outcomes">From insight to opportunity with execution-ready clarity.</RevealCard>
      </div>
    </section>
  );
}

export function InstallTransition() {
  const shellRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const hawkRef = useRef<HTMLDivElement>(null);
  const hawkFrameRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const stage = stageRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    const reveal = revealRef.current;
    const backdrop = backdropRef.current;
    const far = farRef.current;
    const near = nearRef.current;
    const hawk = hawkRef.current;
    const hawkFrame = hawkFrameRef.current;
    if (!shell || !stage || !left || !right || !reveal || !backdrop || !far || !near || !hawk || !hawkFrame) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let start = 0;
    let distance = 1;
    let frame = 0;
    let previousWing = -1;

    const measure = () => {
      start = shell.getBoundingClientRect().top + window.scrollY;
      distance = Math.max(1, shell.offsetHeight - window.innerHeight);
    };

    const render = () => {
      frame = 0;
      if (reducedMotion.matches) return;

      const progress = clamp((window.scrollY - start) / distance);
      const opening = smoothstep((progress - 0.15) / 0.6);
      const revealProgress = smoothstep((progress - 0.08) / 0.78);
      const fly = clamp((progress - 0.3) / 0.62);
      const flyEase = Math.pow(fly, 1.42);
      const copyReveal = smoothstep((progress - 0.45) / 0.31);
      const cardReveal = smoothstep((progress - 0.53) / 0.3);

      stage.style.setProperty("--transition-progress", progress.toFixed(4));
      stage.style.setProperty("--greek-copy-reveal", copyReveal.toFixed(4));
      stage.style.setProperty("--greek-card-reveal", cardReveal.toFixed(4));
      left.style.transform = `translate3d(${-52 * opening}vw,0,0) rotate(${-0.7 * opening}deg) scale(${1 + 0.012 * opening})`;
      right.style.transform = `translate3d(${52 * opening}vw,0,0) rotate(${0.7 * opening}deg) scale(${1 + 0.012 * opening})`;
      reveal.style.opacity = `${0.28 + revealProgress * 0.72}`;
      reveal.style.transform = `scale(${0.86 + revealProgress * 0.14})`;
      reveal.style.filter = `blur(${(1 - revealProgress) * 9}px)`;
      backdrop.style.transform = `scale(${1.045 - revealProgress * 0.045}) translate3d(0,${(1 - revealProgress) * 2.2}vh,0)`;
      far.style.transform = `translate3d(${(revealProgress - 0.5) * -1.8}vw,${(1 - revealProgress) * 1.6}vh,0)`;
      near.style.transform = `translate3d(${(revealProgress - 0.5) * 3.2}vw,${(1 - revealProgress) * -2.4}vh,0)`;

      const hawkOpacity = fly < 0.06 ? fly / 0.06 : fly > 0.9 ? (1 - fly) / 0.1 : 1;
      const hawkScale = 0.08 + flyEase * 2.08;
      hawk.style.opacity = `${clamp(hawkOpacity)}`;
      hawk.style.transform = `translate3d(calc(-50% + ${flyEase * 24}vw),calc(-50% + ${5 - flyEase * 20}vh),0) rotate(${-4 + flyEase * 10}deg) scale(${hawkScale})`;

      const wingStep = wingSequence[Math.floor(fly * 35) % wingSequence.length] ?? 0;
      if (wingStep !== previousWing) {
        previousWing = wingStep;
        const column = wingStep % 4;
        const row = Math.floor(wingStep / 4);
        hawkFrame.style.transform = `translate3d(${-column * 25}%,${-row * 50}%,0)`;
      }
    };

    const requestRender = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    const syncAccessibleCopy = () => {
      const reduced = reducedMotion.matches;
      left.toggleAttribute("aria-hidden", !reduced);
      left.inert = false;
      left.querySelectorAll<HTMLElement>("a, button").forEach((control) => {
        if (reduced) control.removeAttribute("tabindex");
        else control.setAttribute("tabindex", "-1");
      });
      right.toggleAttribute("aria-hidden", reduced);
      right.inert = reduced;
    };
    const handleMotionChange = () => {
      syncAccessibleCopy();
      requestRender();
    };
    const resize = new ResizeObserver(() => {
      measure();
      requestRender();
    });

    measure();
    syncAccessibleCopy();
    render();
    resize.observe(shell);
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender, { passive: true });
    reducedMotion.addEventListener("change", handleMotionChange);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      reducedMotion.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <section className="install-transition-shell" ref={shellRef} id="install" aria-label="Install Novelty Engine and enter the research system">
      <span className="transition-anchor" id="principles" aria-hidden="true" />
      <div className="install-transition-sticky" ref={stageRef}>
        <div className="install-reveal-layer" ref={revealRef}>
          <div className="install-reveal-backdrop-motion" ref={backdropRef}>
            <GreekScene />
          </div>
          <div className="transition-ambient transition-ambient-far" ref={farRef} aria-hidden="true" />
          <div className="transition-ambient transition-ambient-near" ref={nearRef} aria-hidden="true" />
        </div>

        <div className="install-split-half install-split-left" ref={leftRef} aria-hidden="true">
          <InstallViewport />
        </div>
        <div className="install-split-half install-split-right" ref={rightRef}>
          <InstallViewport />
        </div>

        <div className="transition-hawk" ref={hawkRef} aria-hidden="true">
          <Image ref={hawkFrameRef} src="/assets/hawk-flight-sprite-v2.png" alt="" width={1774} height={887} unoptimized />
        </div>
        <div className="transition-seam" aria-hidden="true" />
      </div>
    </section>
  );
}
