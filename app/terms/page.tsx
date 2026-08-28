import type { Metadata } from "next";
import { generalFeedbackUrl, privacyContactUrl } from "@/lib/site";
import { PolicyShell } from "../policy-shell";

export const metadata: Metadata = { title: "Terms — Novelty Engine", description: "Plain-language terms for the Novelty Engine independent public beta.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <PolicyShell eyebrow="Terms of Use" title="Terms for an independent public beta" intro="Effective August 28, 2026. These plain-language terms should receive professional legal review before any commercial launch.">
      <section><h2>Public beta</h2><p>Novelty Engine is an independent open-source research project, not a registered company or professional advisory firm. The service may change, be incomplete, enforce rate limits, lose availability, or stop operating.</p></section>
      <section><h2>Acceptable use</h2><p>Use the service lawfully and only for research you are authorized to perform. Do not probe or bypass security controls, overload the service, submit malicious instructions, scrape restricted sources, infringe rights, impersonate others, or use results to harm, deceive, discriminate against, or unlawfully monitor people.</p></section>
      <section><h2>Sensitive information</h2><p>Do not submit confidential, proprietary, personal, medical, financial, credential, trade-secret, or customer information. Use bounded excerpts from lawful public sources and respect source terms, robots rules, copyrights, and access restrictions.</p></section>
      <section><h2>Research limits and no advice</h2><p>Novelty Engine does not guarantee business success, novelty, patentability, demand, revenue, accuracy, completeness, or fitness for a purpose. It does not provide legal, financial, medical, investment, tax, or patent advice. Users are responsible for checking sources, testing hypotheses, and obtaining qualified advice before acting.</p></section>
      <section><h2>Third-party sources and links</h2><p>Results rely on public third-party sources that may be incorrect, outdated, biased, unavailable, or removed. Links do not imply endorsement. Third-party services and websites have their own terms and privacy practices.</p></section>
      <section><h2>Open-source licensing and intellectual property</h2><p>The repository and downloadable Skill are offered under the MIT License. Third-party content remains subject to its owners’ rights. Research output does not currently have a separate stated repository-wide license; users remain responsible for rights in their inputs and for lawful use of source excerpts and output.</p></section>
      <section><h2>Warranty and liability</h2><p>To the extent permitted by law, the service is provided “as is” and “as available,” without warranties. The project creator is not liable for indirect, incidental, special, consequential, or lost-profit damages arising from use of or reliance on the beta. Any liability that cannot legally be excluded is limited to the amount the user paid directly for the service during the preceding 12 months; the public beta is presently offered without a service fee.</p></section>
      <section><h2>Contact</h2>{privacyContactUrl ? <p>For private legal or privacy contact, <a href={privacyContactUrl}>use the configured contact method</a>. For non-private product reports, use <a href={generalFeedbackUrl} target="_blank" rel="noreferrer">GitHub</a>.</p> : <p>A private public contact method has not been configured. This is a launch blocker. Non-private product reports may use <a href={generalFeedbackUrl} target="_blank" rel="noreferrer">GitHub</a>; do not post private or legal requests there.</p>}</section>
    </PolicyShell>
  );
}
