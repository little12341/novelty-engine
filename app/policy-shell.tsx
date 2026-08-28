import Link from "next/link";
import { githubUrl } from "@/lib/site";

export function PolicyShell({ title, eyebrow, intro, children }: { title: string; eyebrow: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="policy-page">
      <header className="policy-header"><div className="page-width"><Link className="brand" href="/">Novelty Engine</Link><nav aria-label="Policy navigation"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a></nav></div></header>
      <article className="policy-article page-width"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="policy-intro">{intro}</p>{children}</article>
      <footer className="policy-footer"><div className="page-width"><p>Novelty Engine V2.2 Public Beta · MIT licensed.</p><Link href="/">Return home</Link></div></footer>
    </main>
  );
}
