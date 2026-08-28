import type { Metadata } from "next";
import Link from "next/link";
import { generalFeedbackUrl, githubUrl } from "@/lib/site";
import { PolicyShell } from "../policy-shell";

export const metadata: Metadata = { title: "About — Novelty Engine", description: "What Novelty Engine is and why it exists.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <PolicyShell eyebrow="About" title="Research an idea before building the wrong thing." intro="Novelty Engine is an independent open-source research project.">
      <section><h2>What it is</h2><p>Novelty Engine is an open-source public beta for evidence-backed market research with Claude. Claude finds current public sources. Novelty Engine organizes them, separates companies from publishers and directories, checks claims, maps competitors and customer problems, searches for counterevidence, and produces a practical test.</p></section>
      <section><h2>Why it was built</h2><p>Early business ideas are easy to make sound exciting and hard to test honestly. Novelty Engine attempts to make the uncomfortable work visible: finding existing solutions, distinguishing one complaint from recurring pain, leaving missing facts unknown, and stating what could disprove an opportunity.</p></section>
      <section><h2>What it is not</h2><p>It is not a registered company, a market-research firm, a patent search, or a guarantee of demand, revenue, novelty, or success. Results are research hypotheses that require real customer and market validation.</p></section>
      <section><h2>Open source and public beta</h2><p>The repository and downloadable Skill are available under the MIT License. The beta may change, be incomplete, or be temporarily unavailable. Review the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link> before using it.</p></section>
      <section><h2>Report a problem</h2><p>Use the feedback form on the <Link href="/#feedback">homepage</Link> for product reports that contain no sensitive information, or open a public issue on <a href={generalFeedbackUrl} target="_blank" rel="noreferrer">GitHub</a>. Do not put private information in a public GitHub issue. Technical documentation and source code are in the <a href={githubUrl} target="_blank" rel="noreferrer">repository</a>.</p></section>
    </PolicyShell>
  );
}
