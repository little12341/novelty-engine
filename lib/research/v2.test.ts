import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clusterComplaints, detectUnderservedSegments, extractCompetitors } from "./analyze.ts";
import { deriveSearchAngles } from "./angles.ts";
import { extractAssumptions, generateContradictions } from "./contradictions.ts";
import { mineFailedAttempts } from "./failures.ts";
import { falsifyCandidate } from "./falsification.ts";
import { compareFingerprints, fingerprintCandidate } from "./fingerprints.ts";
import { detectGaps } from "./gaps.ts";
import { buildOpportunityGraph, detectGraphHoles } from "./graph.ts";
import { buildLineage } from "./lineage.ts";
import { mutateCandidate } from "./mutations.ts";
import { normalizeResults } from "./normalize.ts";
import { runOpportunityPipeline } from "./opportunity-pipeline.ts";
import { researchLimits } from "./pipeline.ts";
import { scoreOpportunity } from "./scoring.ts";
import { normalizeWeakSignals } from "./signals.ts";
import { detectWorkflowStitching } from "./stitching.ts";
import { generateValidationExperiment } from "./validation.ts";
import type { IdeaCandidate, ProviderSearchResult } from "./types.ts";

const fixture = JSON.parse(await readFile(new URL("./fixtures/v2-market.json", import.meta.url), "utf8")) as ProviderSearchResult[];
const angle = deriveSearchAngles("Find 4 opportunities for small field service teams", 1)[0];
const sources = normalizeResults([{ angle, results: fixture }], "2026-08-24T12:00:00.000Z", 40);
const competitors = extractCompetitors(sources);
const complaints = clusterComplaints(sources);
const segments = detectUnderservedSegments(sources);
const gaps = detectGaps(sources, competitors, complaints, segments);
const graph = buildOpportunityGraph(sources, competitors, complaints, segments, gaps);
const holes = detectGraphHoles(graph);
const stitching = detectWorkflowStitching(sources, complaints);
const signals = normalizeWeakSignals(sources, new Date("2026-08-24T12:00:00.000Z"));
const failures = mineFailedAttempts(sources, signals);
const assumptions = extractAssumptions(sources, competitors);
const contradictions = generateContradictions(assumptions);

const baseCandidate: IdeaCandidate = {
  id: "candidate_base", name: "Exception Bridge", summary: "Moves job data between existing tools only when systems disagree.",
  targetCustomer: "small businesses", payer: "downstream beneficiary", jobToBeDone: "move job data between tools",
  mechanism: "event bridge with exception review", interface: "message-based exception inbox", technology: "event-driven connectors",
  businessModel: "per verified outcome", distribution: "workflow partners", dataSource: "existing source systems",
  ownershipModel: "customer-controlled", workflowPosition: "between existing tools", differentiator: "no new system of record",
  sourceGapIds: gaps.slice(0, 1).map((item) => item.id), sourceGraphHoleIds: holes.slice(0, 1).map((item) => item.id),
  sourceContradictionIds: contradictions.slice(0, 1).map((item) => item.id), sourceStitchingIds: stitching.slice(0, 1).map((item) => item.id),
  sourceSignalIds: signals.slice(0, 1).map((item) => item.id), sourceFailedAttemptIds: failures.slice(0, 1).map((item) => item.id),
  evidenceIds: [...new Set([...gaps.slice(0, 1).flatMap((item) => item.supportingEvidenceIds), ...stitching.slice(0, 1).flatMap((item) => item.evidenceIds)])], iteration: 0,
};

test("opportunity graph constructs typed nodes, cited edges, and structural holes", () => {
  assert.equal(graph.schemaVersion, "1.0");
  assert.ok(graph.nodes.some((item) => item.type === "competitor"));
  assert.ok(graph.nodes.some((item) => item.type === "complaint"));
  assert.ok(graph.nodes.some((item) => item.type === "regulation"));
  assert.ok(graph.edges.every((item) => graph.nodes.some((node) => node.id === item.from) && graph.nodes.some((node) => node.id === item.to)));
  assert.ok(holes.some((item) => ["complaint_workaround_pattern", "regulatory_shift", "technology_unlock"].includes(item.kind)));
  assert.ok(holes.every((item) => item.evidenceIds.every((id) => sources.some((source) => source.id === id))));
});

test("contradiction extraction retains evidence and produces systematic operations", () => {
  assert.ok(assumptions.some((item) => item.dimension === "pricing"));
  assert.ok(assumptions.every((item) => item.evidenceIds.length > 0));
  assert.ok(contradictions.some((item) => ["invert", "remove", "automate", "reverse_payer"].includes(item.operation)));
});

test("constraint mutation records the changed dimension and lineage-safe parent", () => {
  const { candidate, mutation } = mutateCandidate(baseCandidate, 1, 1);
  assert.equal(mutation.parentCandidateId, baseCandidate.id);
  assert.equal(mutation.resultCandidateId, candidate.id);
  assert.equal(candidate.iteration, 1);
  assert.notEqual(mutation.before, mutation.after);
});

test("missing-product detection scores tool stitching without duplicate source inflation", () => {
  assert.ok(stitching.length > 0);
  assert.ok(stitching[0].tools.length >= 2);
  assert.ok(stitching[0].manualSteps.length >= 1);
  assert.ok(stitching[0].scoreFactors.errorRisk >= 7);
  assert.equal(new Set(stitching[0].evidenceIds).size, stitching[0].evidenceIds.length);
});

test("weak signals preserve dates and mark acceleration as approximation or unknown", () => {
  assert.ok(signals.some((item) => item.kind === "regulatory_change"));
  assert.ok(signals.every((item) => item.firstSeen === null || /^\d{4}-\d{2}-\d{2}$/.test(item.firstSeen)));
  assert.ok(signals.every((item) => item.accelerationProxy === null ? !item.accelerationIsApproximation : item.accelerationIsApproximation));
});

test("failed-attempt mining only resurrects when an evidenced blocker changed", () => {
  const legacy = failures.find((item) => /LegacySync/i.test(item.name));
  assert.ok(legacy);
  assert.equal(legacy.blocker, "technology");
  assert.equal(legacy.blockerStillExists, false);
  assert.equal(legacy.resurrectionEligible, true);
  assert.ok(legacy.changedConditionEvidenceIds.length > 0);
});

test("novelty fingerprints and similarity scores are transparent heuristics", () => {
  const first = fingerprintCandidate(baseCandidate);
  const clone = fingerprintCandidate({ ...baseCandidate, id: "candidate_clone", name: "Renamed Bridge" });
  const distinct = fingerprintCandidate({ ...baseCandidate, id: "candidate_distinct", targetCustomer: "hospitals", mechanism: "physical deposit-return container", interface: "mechanical latch", technology: null, businessModel: "deposit", workflowPosition: "before disposal", differentiator: "material recirculation" });
  const same = compareFingerprints(first, clone);
  const different = compareFingerprints(first, distinct);
  assert.ok(same.score > different.score);
  assert.equal(same.heuristic, true);
  assert.match(same.explanation, /55% token overlap/);
});

test("lineage exposes concise provenance without private reasoning", () => {
  const lineage = buildLineage(baseCandidate, { gaps, complaints, holes, contradictions, stitching, signals, failedAttempts: failures, mutations: [] });
  assert.ok(lineage.steps.length >= 3);
  assert.match(lineage.summary, /complaint|workaround|graph hole/);
  assert.doesNotMatch(lineage.summary, /chain.of.thought/i);
});

test("falsification separates evidence for and against and penalizes unknown risks", () => {
  const fingerprint = fingerprintCandidate(baseCandidate);
  const falsification = falsifyCandidate(baseCandidate, { evidence: sources, gaps, similarities: [compareFingerprints(fingerprint, fingerprintCandidate({ ...baseCandidate, id: "competitor_like" }))] });
  assert.equal(falsification.hypotheses.length, 11);
  assert.ok(falsification.hypotheses.some((item) => item.unknown));
  assert.ok(Array.isArray(falsification.argumentsFor) && Array.isArray(falsification.argumentsAgainst));
  assert.ok(falsification.survivalScore <= 100);
});

test("survivor loop respects iteration, candidate, and requested-count budgets", () => {
  const limits = { ...researchLimits({ NODE_ENV: "test" }), maxCandidates: 18, maxSurvivorIterations: 1 };
  const output = runOpportunityPipeline({ query: "Find 4 opportunities for small field service teams", sources, competitors, complaints, segments, gaps, limits, now: new Date("2026-08-24") });
  assert.ok(output.budgetUsage.survivorIterations <= 1);
  assert.ok(output.candidates.length <= 18);
  assert.ok(output.finalOpportunities.length <= 4);
  assert.ok(output.finalOpportunities.length > 0);
});

test("opportunity score exposes factor-level heuristic scoring", () => {
  const fingerprint = fingerprintCandidate(baseCandidate);
  const similarities = [compareFingerprints(fingerprint, fingerprintCandidate({ ...baseCandidate, id: "other", mechanism: "manual concierge", differentiator: "human delivery" }))];
  const falsification = falsifyCandidate(baseCandidate, { evidence: sources, gaps, similarities });
  const score = scoreOpportunity(baseCandidate, { gaps, holes, stitching, signals, similarities, falsification });
  assert.equal(score.heuristic, true);
  assert.equal(Object.keys(score.factors).length, 13);
  assert.ok(score.score >= 0 && score.score <= 100);
});

test("validation generator creates a measurable 24–72 hour ethical test", () => {
  const experiment = generateValidationExperiment(baseCandidate);
  assert.match(experiment.estimatedTime, /24–72 hours/);
  assert.match(experiment.successThreshold, /At least|cases succeed/);
  assert.match(experiment.failureThreshold, /Fewer|failure/);
  if (experiment.ethicsNote) assert.match(experiment.ethicsNote, /Do not/);
});

test("all structured factual references preserve valid citation provenance", () => {
  const known = new Set(sources.map((item) => item.id));
  const referenced = [...graph.nodes.flatMap((item) => item.evidenceIds), ...graph.edges.flatMap((item) => item.evidenceIds), ...assumptions.flatMap((item) => item.evidenceIds), ...signals.flatMap((item) => item.evidenceIds), ...failures.flatMap((item) => [...item.allEvidenceIds, ...item.changedConditionEvidenceIds])];
  assert.ok(referenced.every((id) => known.has(id)));
});

test("limits enforce hard caps and unknown fields remain explicit", () => {
  const limits = researchLimits({ NODE_ENV: "test", RESEARCH_MAX_QUERIES: "999", RESEARCH_RESULTS_PER_QUERY: "999", RESEARCH_MAX_CANDIDATES: "999", RESEARCH_MAX_SURVIVOR_ITERATIONS: "99", RESEARCH_TIMEOUT_MS: "999999" });
  assert.equal(limits.maxSearchQueries, 12);
  assert.equal(limits.resultsPerQuery, 10);
  assert.equal(limits.maxCandidates, 48);
  assert.equal(limits.maxSurvivorIterations, 2);
  assert.equal(limits.timeoutMs, 30_000);
  const unknownFailure = mineFailedAttempts(normalizeResults([{ angle, results: [{ url: "https://news.example/dead", title: "Mystery product shut down", snippet: "The product shut down." }] }], "2026-08-24T00:00:00Z", 5), []);
  assert.equal(unknownFailure[0].blocker, "unknown");
  assert.equal(unknownFailure[0].blockerStillExists, null);
  assert.equal(unknownFailure[0].resurrectionEligible, false);
});
