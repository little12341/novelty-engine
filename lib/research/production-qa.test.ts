import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveSearchAngles } from "./angles.ts";
import { extractCompetitors } from "./analyze.ts";
import { auditClaim, citationCoverageAudit } from "./claim-support.ts";
import { buildCompanyProfile } from "./company.ts";
import { compareIdeas } from "./comparison.ts";
import { buyerSpecificityGate } from "./evidence-gate.ts";
import { compareFingerprints, fingerprintCandidate, fingerprintCompetitor } from "./fingerprints.ts";
import { normalizeResults } from "./normalize.ts";
import { runResearch } from "./pipeline.ts";
import { resolveCandidateId } from "./candidate-ids.ts";
import { validateExternalResearchUrl } from "./url-policy.ts";
import { candidateFromSuppliedOpportunity } from "../mcp/falsify.ts";
import { publicMcpHealthSnapshot } from "../mcp/observability.ts";
import type { ProviderSearchResult, ResearchClaimType, SearchProvider } from "./types.ts";

type Fixture = {
  coi_entities: ProviderSearchResult[];
  certificial_company: ProviderSearchResult[];
  commercial_cleaning: ProviderSearchResult[];
  restaurant_pos: ProviderSearchResult[];
  aquaculture_ozone: ProviderSearchResult[];
  two_ideas: string[];
};

const fixture = JSON.parse(await readFile(new URL("./fixtures/production-qa-cases.json", import.meta.url), "utf8")) as Fixture;
const at = "2026-08-27T12:00:00.000Z";

function evidenceFor(query: string, rows: ProviderSearchResult[]) {
  const angle = deriveSearchAngles(query, 1)[0];
  return normalizeResults([{ angle, results: rows }], at, 50);
}

test("production QA: page identities stay separate from normalized COI companies", () => {
  const evidence = evidenceFor("COI and subcontractor insurance compliance software for US general contractors", fixture.coi_entities);
  const competitors = extractCompetitors(evidence);
  const names = competitors.map((item) => item.name.value ?? "").join(" | ");
  for (const expected of ["SimpleCerts", "SmartCompliance", "Jones", "Certificial", "Billy", "Knowify"]) {
    assert.match(names, new RegExp(expected, "i"), `${expected} should resolve as a real canonical entity`);
  }
  assert.equal(competitors.length, 6);
  assert.equal(new Set(competitors.map((item) => item.canonicalOrganizationId)).size, competitors.length);
  assert.ok(competitors.every((item) => item.classification === "direct_competitor" && item.canonicalDomain));

  const byTitle = new Map(evidence.map((item) => [item.title, item]));
  assert.equal(byTitle.get("Best COI Tracking Software in 2026")?.pageIdentity.relationship, "aggregator_directory");
  assert.equal(byTitle.get("Best COI Tracking Software (2026): 7 Platforms Compared")?.pageIdentity.relationship, "aggregator_directory");
  assert.equal(byTitle.get("Seven COI platforms construction leaders should know")?.pageIdentity.relationship, "publisher_listicle");
  assert.equal(byTitle.get("Benefits of Field Service Management Software")?.pageIdentity.relationship, "publisher_listicle");
  assert.equal(byTitle.get("Construction Software Market Report PDF")?.pageIdentity.pageKind, "report_pdf");
  assert.equal(byTitle.get("Top 10 COI Software Alternatives")?.pageIdentity.relationship, "publisher_listicle");
  for (const source of evidence.filter((item) => !item.pageIdentity.entityEligible)) {
    assert.ok(!competitors.some((item) => item.sourcePageIds.includes(source.id)), `${source.title} leaked into the competitor graph`);
  }

  const candidate = candidateFromSuppliedOpportunity("Certificate-of-insurance exception handling for US general contractors or specialty trades using spreadsheets, bought by an operations manager");
  const candidateFingerprint = fingerprintCandidate(candidate);
  const similarities = competitors.map((item) => compareFingerprints(candidateFingerprint, fingerprintCompetitor(item)));
  assert.ok(similarities.every((item) => Object.keys(item.dimensionScores ?? {}).length === 8));
  assert.ok(similarities.some((item) => (item.dimensionScores?.targetCustomer ?? 0) >= .5 && (item.dimensionScores?.jobToBeDone ?? 0) >= .5));
  assert.ok(similarities.every((item) => item.matchingDimensions.length + (item.nonMatchingDimensions?.length ?? 0) === 8));
});

test("production QA: claim lineage rejects vendor listicles for disallowed support roles", () => {
  const evidence = evidenceFor("COI and subcontractor insurance compliance software for US general contractors", fixture.coi_entities);
  const listicle = evidence.find((item) => item.title === "Top 10 COI Software Alternatives");
  assert.ok(listicle);
  const cases: Array<[ResearchClaimType, string]> = [
    ["customer_pain", "General contractors report first-hand pain chasing COIs."],
    ["customer_workaround", "General contractors use spreadsheets as a workaround."],
    ["willingness_to_pay", "General contractors will pay for automated COI tracking."],
    ["regulation", "A new official regulation changed subcontractor COI duties."],
    ["automation_capability", "Automation can reliably verify every insurance certificate."],
    ["underserved_status", "Specialty trades are underserved by current COI vendors."],
  ];
  const audits = cases.map(([claimType, claim]) => auditClaim({ claimType, claim, evidenceIds: [listicle.id], evidence, marketContext: "US general contractors and specialty trades managing COI compliance" }));
  assert.ok(audits.every((item) => item.status === "UNKNOWN" && item.supportingEvidenceIds.length === 0));
  assert.ok(audits.every((item) => item.evidenceDecisions[0].roleCompatible === false));
  const coverage = citationCoverageAudit(audits);
  assert.deepEqual(coverage, { supportedMajorClaims: 0, totalMajorClaims: 6, roleMismatchedMajorClaims: 6, relevanceRejectedMajorClaims: 0, coverageRatio: 0 });
});

test("production QA: semantic market gates reject broad cross-market evidence", () => {
  const cases = [
    { query: "commercial cleaning proof-of-service workflow", rows: fixture.commercial_cleaning, accepted: "Clients dispute whether crews completed nightly cleaning", rejected: "Benefits of Field Service Management Software" },
    { query: "independent restaurant POS reconciliation", rows: fixture.restaurant_pos, accepted: "Independent restaurant POS close still needs a spreadsheet", rejected: "Ozone treatment in aquaculture" },
    { query: "aquaculture ozone dosing traceability", rows: fixture.aquaculture_ozone, accepted: "Fish farm ozone dosing log is still manual", rejected: "Open-source compliance automation" },
  ];
  for (const item of cases) {
    const evidence = evidenceFor(item.query, item.rows);
    assert.equal(evidence.find((source) => source.title === item.accepted)?.relevanceAssessment.acceptedForMarket, true, item.accepted);
    const rejected = evidence.find((source) => source.title === item.rejected);
    assert.equal(rejected?.relevanceAssessment.acceptedForMarket, false, item.rejected);
    assert.match(rejected?.relevanceAssessment.rationale ?? "", /rejected/i);
  }
});

test("production QA: research-company anchors Certificial and never substitutes article titles", () => {
  const evidence = evidenceFor("Research Certificial company products pricing competitors", fixture.certificial_company);
  const profile = buildCompanyProfile({ query: "Research Certificial company products pricing competitors", evidence, competitors: extractCompetitors(evidence), complaints: [], segments: [], opportunities: [] });
  assert.equal(profile.requestedIdentity?.name, "Certificial");
  assert.equal(profile.requestedIdentity?.normalizedName, "certificial");
  assert.equal(profile.requestedIdentity?.canonicalDomain, "certificial.com");
  assert.match(profile.identity.claim, /^Certificial is the requested company identity\.$/);
  assert.ok(profile.productsServices.length >= 2);
  assert.ok(profile.productsServices.every((item) => item.evidenceIds.every((id) => evidence.find((source) => source.id === id)?.pageIdentity.canonicalDomain === "certificial.com")));
  assert.ok(profile.productsServices.every((item) => !/open-source compliance|platforms compared/i.test(item.claim)));

  for (const name of ["Jones", "TrustLayer", "Billy"]) {
    const preserved = buildCompanyProfile({ query: `Research ${name} company products pricing competitors`, evidence, competitors: extractCompetitors(evidence), complaints: [], segments: [], opportunities: [] });
    assert.equal(preserved.requestedIdentity?.name, name);
    assert.match(preserved.identity.claim, new RegExp(`^${name} is the requested company identity\\.$`, "i"));
    assert.ok(preserved.unknowns.some((item) => /matching .* was not retrieved/i.test(item)));
  }
});

test("production QA: candidate definitions require specificity and preserve supplied US contractor buyers", () => {
  const supplied = candidateFromSuppliedOpportunity("A COI exception workflow for US general contractors or specialty trades using spreadsheets, purchased by the owner or risk lead");
  assert.equal(supplied.targetCustomer, "US general contractors or specialty trades");
  assert.match(supplied.definition?.companyProfile ?? "", /US general contractors or specialty trades/i);
  assert.match(supplied.definition?.decisionMaker ?? "", /owner|operations|risk/i);

  const generic = { ...supplied, targetCustomer: "regulated teams", definition: { ...supplied.definition!, companyProfile: "regulated teams", decisionMaker: "users", buyer: "users" } };
  assert.equal(buyerSpecificityGate(generic).passed, false);
  const evidenced = { ...supplied, evidenceIds: ["ev_buyer_fixture"], definition: {
    ...supplied.definition!, economicConsequence: "Risk staff spend 12 hours per week chasing expired certificates.",
    whyExistingSolutionsFail: "Current tools leave manual exception reconciliation to the risk lead.", evidenceIds: ["ev_buyer_fixture"],
  } };
  assert.equal(buyerSpecificityGate(evidenced).passed, true);
});

test("production QA: canonical candidate IDs, budget metadata, and conservative verdicts are invariant", async () => {
  const provider: SearchProvider = { id: "production-qa-cleaning", displayName: "Production QA cleaning fixture", async search() { return fixture.commercial_cleaning; } };
  const run = await runResearch("Find business opportunities for small commercial cleaning companies needing proof of service", {
    provider, persist: false, bypassCache: true, mode: "find_business", now: () => new Date(at),
  });
  for (const canonical of run.candidateIdMapping.canonicalIds) {
    assert.equal(resolveCandidateId(run, canonical), canonical);
    assert.ok(run.candidates.some((candidate) => candidate.id === canonical));
  }
  for (const [provisional, canonical] of Object.entries(run.candidateIdMapping.provisionalToCanonical)) {
    assert.equal(resolveCandidateId(run, provisional), canonical);
  }
  assert.equal(run.budgetUsage.exhausted, run.budgetUsage.providerCalls >= run.limits.maxProviderCalls);
  assert.equal(run.budgetUsage.expansionStopReason === "budget_exhausted", run.budgetUsage.exhausted);
  assert.ok(run.finalOpportunities.every((item) => item.evidenceGate.classification !== "validated"));
  assert.ok(run.falsificationResults.every((item) => item.searchCoverage.failedCompaniesPriorAttempts && item.searchCoverage.aiCommoditization));
  if (run.searchBranches.length && /adjacent workflow/i.test(run.nextBestAction.action)) {
    assert.doesNotMatch(run.nextBestAction.action, /already searched|repeat the same/i);
  }
});

test("production QA: two-idea comparison remains bounded and never invents validation", async () => {
  const previousCalls = process.env.RESEARCH_MAX_PROVIDER_CALLS;
  const previousComparison = process.env.RESEARCH_COMPARISON_MAX_PROVIDER_CALLS;
  process.env.RESEARCH_MAX_PROVIDER_CALLS = "10";
  process.env.RESEARCH_COMPARISON_MAX_PROVIDER_CALLS = "20";
  const provider: SearchProvider = {
    id: "production-qa-compare", displayName: "Production QA comparison fixture",
    async search(query) { return /aquaculture|ozone/i.test(query) ? fixture.aquaculture_ozone : fixture.commercial_cleaning; },
  };
  try {
    const comparison = await compareIdeas(fixture.two_ideas, { provider, persist: false, now: () => new Date(at) });
    assert.equal(comparison.ideas.length, 2);
    assert.ok(comparison.ideas.every((item) => item.dimensions.length === 13));
    assert.ok(comparison.ideas.every((item) => item.recommendation !== "advance" || item.dimensions.some((dimension) => dimension.status !== "UNKNOWN")));
    assert.match(comparison.recommendation, /validation|not a mathematically precise ranking|fake precision|before choosing/i);
    assert.ok(comparison.budgetUsage.providerCalls <= 20);
  } finally {
    if (previousCalls === undefined) delete process.env.RESEARCH_MAX_PROVIDER_CALLS; else process.env.RESEARCH_MAX_PROVIDER_CALLS = previousCalls;
    if (previousComparison === undefined) delete process.env.RESEARCH_COMPARISON_MAX_PROVIDER_CALLS; else process.env.RESEARCH_COMPARISON_MAX_PROVIDER_CALLS = previousComparison;
  }
});

test("production QA: URL policy is independently isolated from survivor lifecycle", () => {
  const blocked: Array<[string, string]> = [
    ["http://localhost/admin", "private_or_local_destination"],
    ["http://127.0.0.1/admin", "private_or_local_destination"],
    ["http://10.0.0.1/data", "private_or_local_destination"],
    ["http://172.16.1.2/data", "private_or_local_destination"],
    ["http://192.168.1.2/data", "private_or_local_destination"],
    ["http://169.254.169.254/latest/meta-data", "private_or_local_destination"],
    ["https://user:password@example.com/artifact", "url_credentials_not_allowed"],
    ["file:///etc/passwd", "protocol_not_allowed"],
    ["ftp://example.com/result", "protocol_not_allowed"],
    ["https://example.com:8443/result", "non_standard_port"],
  ];
  for (const [url, reason] of blocked) assert.deepEqual(validateExternalResearchUrl(url), { allowed: false, normalizedUrl: null, reason });
  assert.equal(validateExternalResearchUrl("https://example.com/public-validation").allowed, true);
});

test("production QA: public MCP health is exactly coarse readiness", async () => {
  const health = await publicMcpHealthSnapshot();
  assert.deepEqual(Object.keys(health).sort(), ["status", "version"]);
  assert.ok(["ok", "unavailable"].includes(health.status));
  assert.equal(health.version, "2.2.0");
});
