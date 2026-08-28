import assert from "node:assert/strict";
import test from "node:test";
import { deriveSearchAngles } from "./angles.ts";
import { detectUnderservedSegments, extractCompetitors } from "./analyze.ts";
import { normalizeResults } from "./normalize.ts";
import type { ProviderSearchResult } from "./types.ts";

const query = "roofing scheduling workflow for small roofing contractors";
const angle = deriveSearchAngles(query, 1)[0];
const evidenceFor = (rows: ProviderSearchResult[]) => normalizeResults([{ angle, results: rows }], "2026-08-28T12:00:00.000Z", 40);

test("entity regression 1: a publisher is not promoted as a competitor", () => {
  const evidence = evidenceFor([{ url: "https://roofingnews.example/articles/scheduling-market", title: "Roofing News | Scheduling market", snippet: "A publisher reports on scheduling software used by small roofing contractors." }]);
  assert.equal(extractCompetitors(evidence).length, 0);
  assert.equal(evidence[0].pageIdentity.sourcePublisher.domain, "roofingnews.example");
});

test("entity regression 2: a listicle title is not treated as a company", () => {
  const evidence = evidenceFor([{ url: "https://publisher.example/blog/top-roofing-scheduling-tools", title: "Top 10 Roofing Scheduling Tools", snippet: "A comparison of roofing scheduling products for small contractors." }]);
  assert.equal(extractCompetitors(evidence).length, 0);
  assert.equal(evidence[0].pageIdentity.claimedCompetitiveRole, "mentioned_only");
});

test("entity regression 3: a generic report is not treated as a product", () => {
  const evidence = evidenceFor([{ url: "https://reports.example/reports/roofing-software-market.pdf", title: "Roofing Software Market Report PDF", snippet: "An industry report about roofing contractor scheduling and workflow categories." }]);
  assert.equal(extractCompetitors(evidence).length, 0);
  assert.equal(evidence[0].pageIdentity.pageKind, "report_pdf");
});

test("entity regression 4: a directory category is not treated as a competitor", () => {
  const evidence = evidenceFor([{ url: "https://sourceforge.net/software/roofing/", title: "Best Roofing Software", snippet: "Directory category listing roofing scheduling software for contractors." }]);
  assert.equal(extractCompetitors(evidence).length, 0);
  assert.equal(evidence[0].pageIdentity.relationship, "aggregator_directory");
});

test("entity regression 5: an unrelated company with overlapping keywords is rejected", () => {
  const evidence = evidenceFor([{ url: "https://dentalcalendar.example/product", title: "DentalCalendar | Scheduling", snippet: "Appointment scheduling software for independent dental clinics and patients." }]);
  assert.equal(evidence[0].relevanceAssessment.acceptedForMarket, false);
  assert.equal(extractCompetitors(evidence).length, 0);
});

test("entity regression 6: spelling variations on one canonical domain resolve to one company", () => {
  const competitors = extractCompetitors(evidenceFor([
    { url: "https://roof-flow.example/product", title: "RoofFlow | Roofing scheduling", snippet: "RoofFlow provides scheduling workflow software for small roofing contractors." },
    { url: "https://roof-flow.example/pricing", title: "Roof Flow pricing", snippet: "Roof Flow roofing contractor scheduling plans start at $49 per month." },
  ]));
  assert.equal(competitors.length, 1);
  assert.ok(competitors[0].aliases.some((name) => /roof.?flow/i.test(name)));
});

test("entity regression 7: similar names on different canonical domains remain separate companies", () => {
  const competitors = extractCompetitors(evidenceFor([
    { url: "https://roof-flow.example/product", title: "RoofFlow | Roofing scheduling", snippet: "RoofFlow provides scheduling workflow software for small roofing contractors." },
    { url: "https://roofflow-pro.example/product", title: "RoofFlow Pro | Roofing scheduling", snippet: "RoofFlow Pro provides scheduling workflow software for small roofing contractors." },
  ]));
  assert.equal(competitors.length, 2);
  assert.notEqual(competitors[0].canonicalDomain, competitors[1].canonicalDomain);
});

test("entity regression 8: product brand and parent company are recorded separately", () => {
  const [competitor] = extractCompetitors(evidenceFor([{ url: "https://rooftrack.example/product", title: "RoofTrack | Roofing scheduling", snippet: "RoofTrack is a scheduling software product for small roofing contractors. RoofTrack is a product by Atlas Holdings." }]));
  assert.equal(competitor.productBrand, "RoofTrack");
  assert.match(competitor.parentCompany ?? "", /Atlas Holdings/i);
});

test("entity regression 9: a price on a non-pricing page does not populate public pricing", () => {
  const [competitor] = extractCompetitors(evidenceFor([{ url: "https://rooftrack.example/product", title: "RoofTrack | Roofing scheduling", snippet: "RoofTrack provides scheduling software for small roofing contractors; a customer project saved $99." }]));
  assert.equal(competitor.pricing.value, null);
  assert.deepEqual(competitor.pricing.evidenceIds, []);
});

test("entity regression 10: complaints about another brand are not attributed", () => {
  const evidence = evidenceFor([
    { url: "https://rooftrack.example/product", title: "RoofTrack | Roofing scheduling", snippet: "RoofTrack provides scheduling workflow software for small roofing contractors." },
    { url: "https://forum.roofers.example/discussions/other-tool", title: "ShingleDesk is unreliable", snippet: "Our roofing company says ShingleDesk is unreliable and difficult; we switched away." },
  ]);
  const [competitor] = extractCompetitors(evidence);
  assert.equal(competitor.likelyWeaknesses.value, null);
});

test("entity regression 11: competitor fields never link to an unrelated source", () => {
  const evidence = evidenceFor([
    { url: "https://rooftrack.example/product", title: "RoofTrack | Roofing scheduling", snippet: "RoofTrack provides scheduling workflow software for small roofing contractors." },
    { url: "https://dentalcalendar.example/product", title: "DentalCalendar | Scheduling", snippet: "Appointment scheduling software for dental clinics and patients." },
  ]);
  const [competitor] = extractCompetitors(evidence);
  const unrelated = evidence.find((item) => item.normalizedUrl.includes("dentalcalendar"))!;
  assert.ok(!competitor.evidenceIds.includes(unrelated.id));
  assert.ok(competitor.name.evidenceIds.every((id) => id !== unrelated.id));
});

test("entity regression 12: a valid competitor with direct identity and job evidence is accepted", () => {
  const [competitor] = extractCompetitors(evidenceFor([{ url: "https://rooftrack.example/product", title: "RoofTrack | Roofing scheduling", snippet: "RoofTrack provides scheduling workflow software for small roofing contractors." }]));
  assert.equal(competitor.classification, "direct_competitor");
  assert.equal(competitor.competitorStatus, "supported");
  assert.equal(competitor.canonicalDomain, "rooftrack.example");
});

test("entity regression 13: a valid substitute with a different mechanism is retained as a substitute", () => {
  const [competitor] = extractCompetitors(evidenceFor([{ url: "https://roofingconcierge.example/services", title: "RoofingConcierge | Scheduling service", snippet: "RoofingConcierge offers a manual consultant and phone-call service for small roofing contractors managing schedules." }]));
  assert.equal(competitor.classification, "substitute");
  assert.equal(competitor.relationship?.value, "substitute");
});

test("entity regression 14: duplicate company pages collapse under one entity fingerprint", () => {
  const competitors = extractCompetitors(evidenceFor([
    { url: "https://rooftrack.example/product", title: "RoofTrack | Roofing scheduling", snippet: "RoofTrack provides scheduling workflow software for small roofing contractors." },
    { url: "https://rooftrack.example/docs", title: "RoofTrack documentation", snippet: "RoofTrack documents scheduling workflows for small roofing contractors." },
    { url: "https://rooftrack.example/pricing", title: "RoofTrack pricing", snippet: "RoofTrack scheduling software for roofing contractors starts at $59 per month." },
  ]));
  assert.equal(competitors.length, 1);
  assert.equal(competitors[0].sourcePageIds.length, 3);
  assert.equal(competitors[0].entityFingerprint, "org:rooftrack.example");
});

test("vendor-authored comparison pages do not promote the publisher as a competitor", () => {
  const evidence = evidenceFor([{
    url: "https://trackmyvendor.example/compare-coi-tracking-software",
    title: "COI Tracking Software Compared: 6 Tools Ranked for SMBs",
    snippet: "A vendor comparison page ranks certificate tracking products for small contractor teams.",
  }]);
  assert.equal(evidence[0].pageIdentity.pageKind, "comparison");
  assert.equal(evidence[0].pageIdentity.relationship, "publisher_listicle");
  assert.equal(evidence[0].pageIdentity.entityEligible, false);
  assert.equal(extractCompetitors(evidence).length, 0);
});

test("a market-research prompt is not treated as evidence of an underserved segment", () => {
  const evidence = evidenceFor([{
    url: "https://www.reddit.com/r/roofing/comments/example/scheduling_research/",
    title: "Trying to understand roofing scheduling",
    snippet: "I am trying to understand scheduling for small roofing contractors and would love to hear what software you use.",
  }]);
  assert.deepEqual(detectUnderservedSegments(evidence), []);
});

test("a normalized government host beginning with gov remains institutional evidence", () => {
  const [evidence] = evidenceFor([{
    url: "https://www.gov.mb.ca/agriculture/aquaculture/maintenance-manual.pdf",
    title: "Aquaculture maintenance manual",
    snippet: "A government manual documents aquaculture equipment maintenance and inspection logs.",
  }]);
  assert.equal(evidence.sourceType, "regulator");
  assert.equal(evidence.sourceAssessment.provenance, "government");
  assert.equal(evidence.sourceAssessment.sourceFamily, "institutional");
});
