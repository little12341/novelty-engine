import type { Metadata } from "next";
import { generalFeedbackUrl, privacyContactUrl } from "@/lib/site";
import { BetaFeedback } from "../beta-feedback";
import { ContentPage, PageIntro } from "../site-chrome";

export const metadata: Metadata = {
  title: "Contact — Novelty Engine",
  description: "Send general product feedback or use the configured private contact for a Novelty Engine privacy request.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <ContentPage className="contact-page">
      <PageIntro eyebrow="Contact" title="Feedback in public. Privacy requests in private." intro="Choose the route that matches your request, and do not include secrets, customer data, or other sensitive information in public reports." />
      <section className="content-section contact-options" aria-label="Contact options">
        <div className="contact-grid page-width">
          <article>
            <p className="eyebrow">General feedback</p>
            <h2>Product questions and public reports</h2>
            <p>Use the beta form below for research, source, installation, MCP, or website feedback. You can also open a public GitHub issue.</p>
            <a className="button button-secondary" href={generalFeedbackUrl} target="_blank" rel="noreferrer">Open a GitHub issue</a>
          </article>
          <article>
            <p className="eyebrow">Privacy requests</p>
            <h2>Use the configured private contact</h2>
            {privacyContactUrl ? (
              <><p>Deletion, access, and other privacy requests should use the private contact configured through <code>NEXT_PUBLIC_PRIVACY_CONTACT_URL</code>.</p><a className="button button-primary" href={privacyContactUrl}>Open privacy contact</a></>
            ) : (
              <p>A private contact route is not configured. The operator must set <code>NEXT_PUBLIC_PRIVACY_CONTACT_URL</code> to a public HTTPS contact form or working contact method before launch. Do not post a private request to GitHub.</p>
            )}
          </article>
        </div>
      </section>
      <BetaFeedback />
    </ContentPage>
  );
}
