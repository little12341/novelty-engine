#!/usr/bin/env node

import assert from "node:assert/strict";
import { runResearchFromSources } from "../lib/research/pipeline.ts";

const retrievedAt = "2026-08-28T16:00:00.000Z";

const cases = [
  {
    id: "established-roofing-field-service",
    description: "Established market with obvious, directly inspectable competitors and a limited customer-discussion sample.",
    query: "small roofing contractor scheduling invoicing field service software complaints and manual handoffs",
    expectedCompetitors: ["Jobber", "Housecall Pro", "ServiceTitan"],
    forbiddenCompetitors: ["TechRadar", "Reddit", "Contractor"],
    sources: [
      {
        url: "https://www.getjobber.com/industries/roofing-software/",
        title: "Roofing Contractor Software | Estimating, Scheduling & CRM",
        excerpt: "Jobber offers roofing contractors proposals, scheduling, field documentation, invoicing, payments, job costing, and customer records.",
      },
      {
        url: "https://www.getjobber.com/pricing/",
        title: "Jobber Pricing: Plans and Free Trial",
        excerpt: "Jobber publishes plan and team-size pricing; the current page lists a Plus plan for teams with included users.",
      },
      {
        url: "https://www.housecallpro.com/pricing/",
        title: "Housecall Pro Pricing & Plans",
        excerpt: "Housecall Pro lists scheduling, dispatch, estimates, invoicing, payments, and online booking for home-service businesses.",
      },
      {
        url: "https://help.housecallpro.com/en/articles/7919484-settings-page-overview",
        title: "Housecall Pro Settings Page Overview",
        publicationDate: "2026-07-01T00:00:00.000Z",
        excerpt: "Housecall Pro documentation describes scheduling, customer communications, job settings, progressive invoicing, and payment options.",
      },
      {
        url: "https://www.servicetitan.com/industries/roofing-software",
        title: "ServiceTitan Roofing Business Software",
        excerpt: "ServiceTitan describes an end-to-end roofing product for estimating, project information, materials, payments, and contractor operations.",
      },
      {
        url: "https://www.reddit.com/r/Contractor/comments/1o8hq6p/which_one_would_you_pick_housecall_pro_or_jobber/",
        title: "Which one would you pick? Housecall Pro or Jobber?",
        publicationDate: "2025-10-17T00:00:00.000Z",
        excerpt: "The author says: I spent considerable time comparing estimating, scheduling, mobile, and payments, and I worry Jobber may be expensive if it does not fit.",
      },
      {
        url: "https://www.reddit.com/r/Contractor/comments/1fmrr7o/is_anyone_using_housecall_pro_is_it_worth_it/",
        title: "Is anyone using Housecall Pro? Is it worth it?",
        publicationDate: "2024-09-24T00:00:00.000Z",
        excerpt: "One participant says: I compared Housecall Pro, ServiceTitan, and Jobber, and I am considering returning to paper invoices.",
      },
      {
        url: "https://www.techradar.com/pro/software-services/jobber-crm-review",
        title: "Jobber CRM review",
        publicationDate: "2026-06-02T08:58:24.000Z",
        excerpt: "TechRadar describes Jobber as field-service software and says value becomes more complicated as team size and plan cost increase.",
      },
    ],
  },
  {
    id: "narrow-aquaculture-ozone-maintenance",
    description: "Narrow market with operational documentation and vendor pages but no independent complaint or purchasing evidence.",
    query: "aquaculture hatchery ozone generator maintenance log software for small recirculating fish farms",
    expectedCompetitors: ["YSI", "EcoQuant Systems", "ELDI", "aquaManager"],
    forbiddenCompetitors: ["Manitoba Agriculture", "EPA", "Hatchery Manual"],
    sources: [
      {
        url: "https://www.gov.mb.ca/agriculture/livestock/aquaculture/pubs/fishfarmtechtrain-manual.pdf",
        title: "Fish Farm Technical Training Manual: Maintenance Logs",
        publicationDate: "2014-05-01T00:00:00.000Z",
        excerpt: "A Manitoba government manual provides maintenance-log fields for ozone generators, blowers, pumps, warning lights, output, flow, and inspection notes.",
      },
      {
        url: "https://www.ysi.com/aquamanager",
        title: "AquaManager Software",
        excerpt: "YSI AquaManager controls supported monitoring instruments, manages set points and alarms, and displays aquaculture facility data; the product reached end-of-life.",
      },
      {
        url: "https://www.ecoquantsystems.com/aquaculture",
        title: "Digital ARK Aquaculture Platform",
        excerpt: "EcoQuant describes aquaculture work orders, maintenance schedules, equipment libraries, and monitoring for pumps, blowers, ultraviolet systems, and ozone systems.",
      },
      {
        url: "https://www.eldi.com/products/Aquacom",
        title: "Aquacom Digital Aquaculture Operations",
        excerpt: "ELDI presents Aquacom for aquaculture asset maintenance, work orders, certification, quality assurance, planning, and documentation.",
      },
      {
        url: "https://www.aqua-manager.com/platform/",
        title: "aquaManager Aquaculture Management Platform",
        excerpt: "aquaManager describes production, feeding, inventory, costing, reporting, sensors, and environmental monitoring across hatchery and grow-out operations.",
      },
      {
        url: "https://am.sites.asterias.gr/software/i-maint/",
        title: "i-Maint AquaManager Maintenance",
        excerpt: "i-Maint is described for RAS and hatchery maintenance planning, task tracking, equipment performance, failures, inventory, and purchasing.",
      },
      {
        url: "https://www.gu.se/sites/default/files/2020-05/Hatchery%20manual.pdf",
        title: "Hatchery Manual Appendix: Ozone System",
        publicationDate: "2020-05-01T00:00:00.000Z",
        excerpt: "A university-hosted hatchery manual documents ozone generators, pumps, probes, ORP control, cleaning, and residual-ozone measurement.",
      },
    ],
  },
  {
    id: "misleading-coi-listicles",
    description: "Market intentionally seeded with vendor-authored rankings, comparison pages, article titles, and duplicated discussion prompts.",
    query: "certificate of insurance tracking software for construction contractors vendor compliance complaints alternatives",
    expectedCompetitors: ["Certificial", "Jones"],
    forbiddenCompetitors: ["Best myCOI Alternatives", "CoiLoop", "TrackMyVendor", "Indie Hackers", "Reddit"],
    sources: [
      {
        url: "https://www.certificial.com/",
        title: "Certificial Smart COI Platform",
        excerpt: "Certificial presents a product that connects parties in a Smart COI network for certificate and policy monitoring.",
      },
      {
        url: "https://getjones.com/jones-network/",
        title: "Jones Network: Insurance Verification for Real Estate and Construction",
        excerpt: "Jones offers insurance-compliance software that checks coverage data against the requirements of a property or construction project.",
      },
      {
        url: "https://www.certificial.com/blog-post/best-mycoi-alternatives-2026",
        title: "Best myCOI Alternatives in 2026: 9 COI Tracking Platforms Compared",
        publicationDate: "2026-04-22T00:00:00.000Z",
        excerpt: "A Certificial-authored ranking lists Certificial, Jones, Billy, TrustLayer, SmartCompliance, and others as myCOI alternatives.",
      },
      {
        url: "https://www.coiloop.com/compare/best-coi-tracking-software",
        title: "Best COI Tracking Software for General Contractors (2026)",
        excerpt: "A comparison page ranks certificate-tracking tools and publishes estimated prices and buyer-fit claims.",
      },
      {
        url: "https://trackmyvendor.com/compare-coi-tracking-software",
        title: "COI Tracking Software Compared: 6 Tools Ranked for SMBs",
        excerpt: "A vendor comparison page defines COI software and lists TrackMyVendor, spreadsheets, myCOI, Billy, TrustLayer, and Jones.",
      },
      {
        url: "https://www.indiehackers.com/post/best-coi-tracking-software-2026-i-compared-10-platforms-and-ranked-every-option-for-vendor-insurance-compliance-0c694b2679",
        title: "Best COI Tracking Software 2026: I Compared 10 Platforms",
        publicationDate: "2026-07-01T00:00:00.000Z",
        excerpt: "An Indie Hackers comparison post ranks ten products and describes Certificial as a pick for real-time COI data.",
      },
      {
        url: "https://www.reddit.com/r/PptyMgmtSoftware/comments/1v9tz8k/how_is_everyone_actually_tracking/",
        title: "How is everyone actually tracking subcontractor and vendor insurance?",
        publicationDate: "2026-07-29T00:00:00.000Z",
        excerpt: "A market-research prompt asks whether teams use spreadsheets, shared drives, reminders, or COI software; it supplies no firsthand answer.",
      },
      {
        url: "https://www.reddit.com/r/Insurance_Companies/comments/1vaa2rv/how_is_everyone_actually_tracking/",
        title: "How is everyone actually tracking subcontractor and vendor insurance?",
        publicationDate: "2026-07-29T00:00:00.000Z",
        excerpt: "A duplicated market-research prompt asks whether teams use spreadsheets, shared drives, reminders, or COI software; it supplies no firsthand answer.",
      },
      {
        url: "https://www.reddit.com/r/ConstructionManagers/comments/1om1rn7/new_pm_here_am_i_crazy_or_is_tracking_sub/",
        title: "New PM: is tracking subcontractor insurance a nightmare?",
        publicationDate: "2025-11-01T00:00:00.000Z",
        excerpt: "A project coordinator reports: I manage a master spreadsheet and spend much of my workday manually chasing subcontractor certificates.",
      },
    ],
  },
];

function normalized(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function nameMatches(name, candidate) {
  const left = normalized(name);
  const right = normalized(candidate);
  const compactLeft = left.replaceAll(" ", "");
  const compactRight = right.replaceAll(" ", "");
  return left === right || left.includes(right) || right.includes(left)
    || compactLeft === compactRight || compactLeft.includes(compactRight) || compactRight.includes(compactLeft);
}

function summarize(testCase, run) {
  const evidenceIds = new Set(run.sources.map((source) => source.id));
  const competitors = run.competitors.map((competitor) => competitor.name.value ?? competitor.canonicalOrganizationId);
  const expectedFound = testCase.expectedCompetitors.filter((expected) => competitors.some((name) => nameMatches(name, expected)));
  const expectedSet = new Set(expectedFound.map(normalized));
  const unexpectedCompetitors = competitors.filter((name) => ![...expectedSet].some((expected) => nameMatches(name, expected)));
  const forbiddenFound = testCase.forbiddenCompetitors.filter((forbidden) => competitors.some((name) => nameMatches(name, forbidden)));
  const brokenCompetitorCitations = run.competitors.flatMap((competitor) => competitor.evidenceIds.filter((id) => !evidenceIds.has(id)));
  const brokenClaimCitations = run.claimLineage.flatMap((claim) => claim.supportingEvidenceIds.filter((id) => !evidenceIds.has(id)));
  const relationshipCounts = Object.groupBy(run.sources, (source) => source.pageIdentity.relationship);
  const provenanceCounts = Object.groupBy(run.sources, (source) => source.sourceAssessment.provenance);
  const averageSourceWeight = run.sources.length
    ? run.sources.reduce((sum, source) => sum + source.sourceAssessment.overallWeight, 0) / run.sources.length
    : 0;
  const recurringComplaints = run.complaintClusters.filter((cluster) => cluster.independentSourceCount >= 2 && !cluster.isIsolated);
  const duplicateDiscussionEvidence = run.sources.filter((source) => source.duplicateSourceUrls.length > 0);
  const counterEvidenceCount = run.claimLineage.filter((claim) => claim.status === "CONTRADICTED").length
    + run.falsificationResults.reduce((count, result) => count + result.hypotheses.filter((item) => item.counterEvidenceIds.length > 0).length, 0);
  const unknownClaims = run.claimLineage.filter((claim) => claim.status === "UNKNOWN").length;

  assert.equal(run.retrievalMode, "supplied_sources");
  assert.equal(run.budgetUsage.providerCalls, 0);
  assert.equal(run.budgetUsage.estimatedProviderCredits, 0);
  assert.deepEqual(brokenCompetitorCitations, []);
  assert.deepEqual(brokenClaimCitations, []);
  assert.deepEqual(forbiddenFound, []);

  return {
    id: testCase.id,
    description: testCase.description,
    input: { sourceCount: testCase.sources.length, retrievedAt, sourceUrls: testCase.sources.map((source) => source.url) },
    providerAccounting: {
      retrievalMode: run.retrievalMode,
      provider: run.provider,
      providerCalls: run.budgetUsage.providerCalls,
      estimatedProviderCredits: run.budgetUsage.estimatedProviderCredits,
    },
    competitorPrecision: {
      identified: competitors,
      expectedFound,
      expectedNotFound: testCase.expectedCompetitors.filter((expected) => !expectedFound.includes(expected)),
      unexpectedCompetitors,
      forbiddenFalseCompetitors: forbiddenFound,
      precisionAgainstExpectedSet: competitors.length ? Number((expectedFound.length / competitors.length).toFixed(3)) : null,
    },
    sourceQuality: {
      acceptedForMarket: run.sources.filter((source) => source.relevanceAssessment.acceptedForMarket).length,
      averageOverallWeight: Number(averageSourceWeight.toFixed(3)),
      relationshipCounts: Object.fromEntries(Object.entries(relationshipCounts).map(([key, value]) => [key, value.length])),
      provenanceCounts: Object.fromEntries(Object.entries(provenanceCounts).map(([key, value]) => [key, value.length])),
      coverageStatus: run.coverage.coverageStatus,
      missingCriticalSourceFamilies: run.coverage.missingCriticalSourceFamilies,
    },
    citationCorrectness: {
      brokenCompetitorCitations,
      brokenClaimCitations,
      audit: run.citationCoverage,
    },
    complaintRecurrence: {
      clusters: run.complaintClusters.map((cluster) => ({
        label: cluster.label,
        independentSourceCount: cluster.independentSourceCount,
        evidenceCount: cluster.evidenceCount,
        isolated: cluster.isIsolated,
      })),
      recurringClusterCount: recurringComplaints.length,
      duplicateOrSyndicatedPagesCollapsed: duplicateDiscussionEvidence.length,
    },
    counterevidence: { count: counterEvidenceCount },
    unknownClaims,
    stopDecision: run.stopDecision,
    outputClarity: {
      hasMarketOverview: Boolean(run.output.researchLandscape),
      hasDecisiveRisks: Array.isArray(run.output.decisiveRisks),
      hasValidationTests: Array.isArray(run.output.validationTests),
      hasNextAction: Boolean(run.nextBestAction?.action),
      warningCount: run.warnings.length,
    },
  };
}

const results = [];
for (const testCase of cases) {
  const run = await runResearchFromSources(testCase.query, testCase.sources.map((source) => ({ ...source, retrievedAt })), {
    depth: "standard",
    persist: false,
    now: () => new Date(retrievedAt),
  });
  results.push(summarize(testCase, run));
}

console.log(JSON.stringify({
  validation: "passed",
  recordedSourcePacketDate: "2026-08-28",
  networkRetrievalPerformedByScript: false,
  checkedInResearchFixtureUsed: false,
  hostedProviderAdaptersCalled: false,
  cases: results,
}, null, 2));
