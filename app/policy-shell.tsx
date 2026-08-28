import { SiteFooter, SiteHeader } from "./site-chrome";

export function PolicyShell({ title, eyebrow, intro, children }: { title: string; eyebrow: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="policy-page">
      <SiteHeader />
      <article className="policy-article page-width"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="policy-intro">{intro}</p>{children}</article>
      <SiteFooter />
    </main>
  );
}
