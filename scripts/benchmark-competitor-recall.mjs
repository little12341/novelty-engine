#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { extractCompetitors } from "../lib/research/analyze.ts";
import { planCompetitorDiscovery } from "../lib/research/competitor-discovery.ts";
import { compareFingerprints, fingerprintCandidate, fingerprintCompetitor } from "../lib/research/fingerprints.ts";
import { normalizeResults } from "../lib/research/normalize.ts";

const cases = JSON.parse(await readFile(new URL("../evals/competitor-recall-benchmark.json", import.meta.url), "utf8"));
if (cases.length < 20 || cases.length > 50) throw new Error(`Competitor-recall benchmark requires 20–50 markets; found ${cases.length}.`);

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normalizedName = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const legacyTokens = (value) => (value ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((token) => token.length > 2 && !["the", "and", "for", "with", "that", "from", "into"].includes(token));
const legacyJaccard = (left, right) => {
  const a = new Set(left); const b = new Set(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
};
const legacySimilarity = (left, right) => {
  const dimensions = ["targetCustomer", "jobToBeDone", "mechanism", "interface", "technology", "businessModel", "distribution", "dataSource", "ownershipModel", "workflowPosition", "coreDifferentiator"];
  const matching = dimensions.filter((key) => legacyJaccard(legacyTokens(left.dimensions[key]), legacyTokens(right.dimensions[key])) >= .35).length;
  return Math.min(1, legacyJaccard(left.tokens, right.tokens) * .55 + matching / 11 * .45);
};
const result = (market, name, index, source = "official") => ({
  url: source === "g2" ? `https://g2.com/products/${slug(name)}/reviews`
    : source === "producthunt" ? `https://producthunt.com/products/${slug(name)}`
      : `https://${slug(market.id)}-${index}.example/product`,
  title: `${name} | ${market.query}`,
  snippet: `Purpose-built software for ${market.buyer} to ${market.job}. Workflow automation, integrations, reporting, and subscription pricing.`,
  publishedAt: "2026-06-01",
});

function candidateFor(market) {
  return {
    id: `candidate_${slug(market.id).replaceAll("-", "_")}`, name: "Benchmark candidate", summary: market.query,
    targetCustomer: market.buyer, payer: "operations buyer", jobToBeDone: market.job,
    mechanism: "workflow automation and exception handling", interface: "workflow software", technology: "integrations",
    businessModel: "subscription", distribution: "direct and partner channels", dataSource: "existing systems",
    ownershipModel: "customer-controlled", workflowPosition: "inside the existing operational workflow",
    differentiator: `improve the outcome of ${market.job}`, sourceGapIds: ["gap_benchmark"], sourceGraphHoleIds: [],
    sourceContradictionIds: [], sourceStitchingIds: [], sourceSignalIds: [], sourceFailedAttemptIds: [], evidenceIds: ["ev_benchmark"],
    iteration: 0, rootCandidateId: `candidate_${slug(market.id).replaceAll("-", "_")}`, mechanismFamily: "workflow automation", crossDomainTransfer: null,
    definition: { industry: market.query, companyProfile: market.buyer, buyer: "operations buyer", decisionMaker: "operations buyer",
      specificProblem: market.job, currentWorkaround: market.referenceSubstitutes[0], economicConsequence: `cost and risk from failing to ${market.job}`,
      proposedMechanism: "workflow automation and exception handling", whyExistingSolutionsFail: "benchmark calibration hypothesis", evidenceIds: ["ev_benchmark"] },
  };
}

function batchesFor(market, mode) {
  const candidate = candidateFor(market);
  const gap = { id: "gap_benchmark", problemStatement: market.job, affectedSegment: market.buyer, currentWorkaround: market.referenceSubstitutes[0], gapType: "product" };
  const plan = planCompetitorDiscovery([candidate], [gap], 2);
  if (mode === "baseline") return [{
    angle: { id: `baseline_${market.id}`, kind: "direct_competitors", query: `${market.query} products services companies pricing features customers`, purpose: "Legacy generic competitor query", targetedDomains: [] },
    results: [result(market, market.referenceDirect[0], 0), result(market, market.referenceDirect[1], 1), result(market, "Generic Market Guide", 90)],
  }];
  const rows = new Map([
    [plan.primaryAngles[0].id, [result(market, market.referenceDirect[0], 0), result(market, market.referenceDirect[1], 1)]],
    [plan.primaryAngles[1].id, [result(market, market.referenceDirect[2], 2, "g2"), result(market, "Generic Market Guide", 90)]],
    [plan.crossCheckAngles[0].id, [result(market, market.referenceDirect[3], 3), {
      url: `https://${slug(market.id)}-manual-substitute.example/guide`, title: market.referenceSubstitutes[0],
      snippet: `Manual substitute used by ${market.buyer}: ${market.referenceSubstitutes[0]}. The work is handled by people and documents.`, publishedAt: "2026-05-01",
    }]],
    [plan.crossCheckAngles[1].id, [result(market, market.referenceDirect[4], 4, "producthunt")]],
    ...plan.escalationAngles.map((angle) => [angle.id, []]),
  ]);
  return [...plan.primaryAngles, ...plan.crossCheckAngles, ...plan.escalationAngles].map((angle) => ({ angle, results: rows.get(angle.id) ?? [] }));
}

function evaluate(mode) {
  const totals = { reference: 0, hits: 0, discovered: 0, correct: 0, major: 0, majorMisses: 0, sourceDiversity: 0, classified: 0, classificationCorrect: 0, calibrated: 0 };
  for (const market of cases) {
    const evidence = normalizeResults(batchesFor(market, mode), "2026-08-27T12:00:00Z", 100);
    const competitors = extractCompetitors(evidence);
    const direct = new Set(market.referenceDirect.map(normalizedName));
    const substitutes = new Set(market.referenceSubstitutes.map(normalizedName));
    const names = competitors.map((item) => normalizedName(item.name.value ?? ""));
    const matches = (name, set) => [...set].some((expected) => name.includes(expected) || expected.includes(name));
    totals.reference += direct.size;
    totals.hits += market.referenceDirect.filter((name) => names.some((found) => matches(found, new Set([normalizedName(name)])))).length;
    totals.discovered += names.length;
    totals.correct += names.filter((name) => matches(name, direct) || matches(name, substitutes)).length;
    const majors = market.referenceDirect.slice(0, 3);
    totals.major += majors.length;
    totals.majorMisses += majors.filter((name) => !names.some((found) => matches(found, new Set([normalizedName(name)])))).length;
    totals.sourceDiversity += new Set(evidence.map((item) => item.sourceType)).size;
    for (const competitor of competitors) {
      const name = normalizedName(competitor.name.value ?? "");
      if (matches(name, direct)) { totals.classified += 1; if (competitor.relationship?.value === "direct") totals.classificationCorrect += 1; }
      else if (matches(name, substitutes)) { totals.classified += 1; if (competitor.relationship?.value === "substitute") totals.classificationCorrect += 1; }
    }
    const candidate = candidateFor(market);
    const candidateFingerprint = fingerprintCandidate(candidate);
    const closest = competitors.map((item) => {
      const competitorFingerprint = fingerprintCompetitor(item);
      return mode === "baseline" ? legacySimilarity(candidateFingerprint, competitorFingerprint) : compareFingerprints(candidateFingerprint, competitorFingerprint).score;
    }).sort((a, b) => b - a)[0] ?? 0;
    if (closest >= .42) totals.calibrated += 1;
  }
  const pct = (value) => Math.round(value * 1000) / 10;
  return {
    markets: cases.length,
    recall: pct(totals.hits / totals.reference),
    precision: pct(totals.correct / totals.discovered),
    majorPlayerMissRate: pct(totals.majorMisses / totals.major),
    averageSourceTypes: Math.round(totals.sourceDiversity / cases.length * 100) / 100,
    directVsSubstituteAccuracy: pct(totals.classificationCorrect / totals.classified),
    collisionCalibrationPassRate: pct(totals.calibrated / cases.length),
  };
}

const report = { benchmark: "competitor-recall", fixtureBased: true, baseline: evaluate("baseline"), highRecall: evaluate("high-recall") };
if (report.highRecall.recall < 90 || report.highRecall.majorPlayerMissRate > 5 || report.highRecall.collisionCalibrationPassRate < 90) {
  throw new Error(`Competitor-recall benchmark failed: ${JSON.stringify(report)}`);
}
console.log(JSON.stringify(report, null, 2));
