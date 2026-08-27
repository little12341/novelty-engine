#!/usr/bin/env node

import assert from "node:assert/strict";
import { runResearch } from "../lib/research/pipeline.ts";
import { getConfiguredProvider, providerConfiguration } from "../lib/research/providers.ts";
import { buildCompetitorRecallReport, planCompetitorDiscovery } from "../lib/research/competitor-discovery.ts";
import { buildProviderQuery } from "../lib/research/angles.ts";
import { extractCompetitors } from "../lib/research/analyze.ts";
import { normalizeResults } from "../lib/research/normalize.ts";

if (process.env.NOVELTY_LIVE_SMOKE !== "true") {
  throw new Error("Set NOVELTY_LIVE_SMOKE=true to acknowledge that this check uses live provider credits.");
}

Object.assign(process.env, {
  RESEARCH_MAX_QUERIES: "10",
  RESEARCH_MAX_PROVIDER_CALLS: "10",
  RESEARCH_MAX_PROVIDER_SPEND_CREDITS: "10",
  RESEARCH_RESULTS_PER_QUERY: "4",
  RESEARCH_MAX_CONCURRENCY: "2",
  RESEARCH_MAX_RETRIES_PER_SEARCH: "0",
  RESEARCH_MAX_EXPANSION_BRANCHES: "0",
  RESEARCH_COMPETITOR_QUERIES_PER_CANDIDATE: "1",
  RESEARCH_MAX_COUNTEREVIDENCE_SEARCHES: "1",
  RESEARCH_MAX_CANDIDATES: "15",
  RESEARCH_MAX_RUN_DURATION_MS: "60000",
});

const markets = [
  "case scheduling and handoff failures for independent dental laboratories",
  "controlled-substance inventory workflows for small rural veterinary clinics",
  "unit-turnover coordination for apartment managers with fewer than 300 units",
  "console localization quality assurance for independent game studios",
  "record and reminder handoffs for small alpaca farms coordinating mobile hoof-trimming services",
];

const configured = providerConfiguration();
assert.equal(configured.configured, true, "A valid local Brave or Tavily key is required for the live smoke test.");
const summaries = [];
let recallCandidates = 0;
let completedCrossChecks = 0;
let honestWeakEvidenceRuns = 0;

for (const query of markets) {
  const result = await runResearch(query, { depth: "fast", bypassCache: true, persist: false });
  assert.ok(result.sources.length > 0, `Live provider returned no usable citations for: ${query}`);
  assert.ok(result.sources.every((source) => source.sourceUrl.startsWith("https://")), `Non-HTTPS citation returned for: ${query}`);
  const evidenceIds = new Set(result.sources.map((source) => source.id));
  for (const opportunity of result.finalOpportunities) {
    assert.equal(opportunity.falsification.outcome, "survived", `Non-survivor was reported for: ${query}`);
    assert.ok(opportunity.candidate.evidenceIds.length > 0, `Survivor lacks evidence for: ${query}`);
    assert.ok(opportunity.candidate.evidenceIds.every((id) => evidenceIds.has(id)), `Survivor cites missing evidence for: ${query}`);
  }
  if (result.stopDecision.status === "insufficient_evidence") assert.equal(result.finalOpportunities.length, 0, `Insufficient-evidence run fabricated a survivor for: ${query}`);
  recallCandidates += result.competitorRecall.candidates.length;
  completedCrossChecks += result.competitorRecall.candidates.filter((candidate) => candidate.crossCheckComplete).length;
  if (result.finalOpportunities.length === 0 || result.stopDecision.status !== "proceed" || result.coverage.coverageStatus !== "sufficient") honestWeakEvidenceRuns += 1;
  summaries.push({
    market: query,
    provider: result.provider.id,
    sources: result.sources.length,
    competitors: result.competitors.length,
    recallCandidates: result.competitorRecall.candidates.length,
    completedCrossChecks: result.competitorRecall.candidates.filter((candidate) => candidate.crossCheckComplete).length,
    survivors: result.finalOpportunities.length,
    stopStatus: result.stopDecision.status,
    coverage: result.coverage.coverageStatus,
    providerCalls: result.budgetUsage.providerCalls,
    fabricatedEvidence: false,
  });
}

let dedicatedRecall = null;
if (completedCrossChecks === 0) {
  const candidate = {
    id: "candidate_live_recall_smoke", iteration: 0, sourceGapIds: [], targetCustomer: "small construction companies using subcontractors",
    jobToBeDone: "collect and verify subcontractor certificates of insurance before site access",
    workflowPosition: "between subcontractor onboarding and site access approval", mechanism: "exception-based certificate verification",
    interface: "compliance operations workflow", technology: "document verification", businessModel: "subscription",
    distribution: "construction insurance brokers", dataSource: "certificate and policy records", ownershipModel: "contractor-owned",
    differentiator: "verify coverage exceptions before site access", summary: "A bounded compliance workflow for subcontractor insurance records.",
    definition: { industry: "construction compliance", companyProfile: "small construction companies using subcontractors", specificProblem: "manual subcontractor COI collection and verification", currentWorkaround: "email spreadsheets and insurance brokers", economicConsequence: "reduce uninsured site access and administrative rework" },
  };
  const plan = planCompetitorDiscovery([candidate], [], 2);
  const provider = getConfiguredProvider();
  const angles = [plan.primaryAngles[0], plan.crossCheckAngles[0]];
  const batches = [];
  for (const angle of angles) batches.push({ angle, results: await provider.search(buildProviderQuery(angle), { limit: 4 }) });
  const evidence = normalizeResults(batches, new Date().toISOString(), 20);
  const competitors = extractCompetitors(evidence);
  const report = buildCompetitorRecallReport({ query: "construction compliance software", plan, candidates: [candidate], competitors, evidence, successfulAngleIds: angles.map((angle) => angle.id), minimumCredibleCompetitors: 3 });
  assert.equal(report.candidates[0]?.crossCheckComplete, true, "Dedicated live recall cross-check did not complete.");
  dedicatedRecall = { primaryQueries: 1, crossCheckQueries: 1, sources: evidence.length, competitors: competitors.length, crossCheckComplete: true };
}
assert.ok(honestWeakEvidenceRuns > 0, "Live suite did not exercise an honest weak/partial-evidence outcome.");
console.log(JSON.stringify({ liveProvider: true, fixtureBased: false, pipelineRecallCandidates: recallCandidates, completedPipelineCrossChecks: completedCrossChecks, dedicatedRecall, markets: summaries }, null, 2));
