import type { Metadata } from "next";
import Link from "next/link";
import { githubUrl } from "@/lib/site";
import { PolicyShell } from "../policy-shell";

export const metadata: Metadata = { title: "About — Novelty Engine", description: "What Novelty Engine is and why it exists.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <PolicyShell eyebrow="About" title="Research an idea before building the wrong thing." intro="Novelty Engine is an independent open-source research project operated by its project maintainer.">
      <section><h2>Who operates it</h2><p>Novelty Engine is operated and maintained as an independent public-beta project. It is not a registered company or a professional advisory firm. Product questions and private requests use the public contact routes on this site; the website does not publish the operator’s private details.</p></section>
      <section><h2>Its purpose</h2><p>Early business ideas are easy to make sound exciting and hard to test honestly. Novelty Engine makes the uncomfortable work visible: finding existing solutions, distinguishing one complaint from recurring pain, leaving missing facts unknown, and stating what could disprove an opportunity.</p></section>
      <section><h2>What it does</h2><p>Claude finds or receives current public sources. Novelty Engine organizes them, separates companies from publishers and directories, checks claims, maps competitors and customer problems, searches for counterevidence, and produces a practical test.</p></section>
      <section><h2>What it is not</h2><p>It is not a registered company, a market-research firm, a patent search, or a guarantee of demand, revenue, novelty, or success. Results are research hypotheses that require real customer and market validation.</p></section>
      <section><h2>Open source and public beta</h2><p>The repository and downloadable Skill are available under the MIT License. The beta may change, be incomplete, or be temporarily unavailable. Review the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link> before using it.</p></section>
      <section><h2>Documentation and contact</h2><p>Use the <Link href="/contact">Contact page</Link> for feedback or privacy requests. Technical documentation and source code remain available in the <a href={githubUrl} target="_blank" rel="noreferrer">repository</a>.</p></section>
    </PolicyShell>
  );
}
