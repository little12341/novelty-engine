import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clusterComplaints, extractCompetitors } from "./analyze.ts";
import { deriveSearchAngles } from "./angles.ts";
import { scoreGap } from "./gaps.ts";
import { normalizeResults, normalizeUrl } from "./normalize.ts";
import { runResearch } from "./pipeline.ts";
import { getConfiguredProvider, ResearchConfigurationError } from "./providers.ts";
import { clearMemoryResearchCache } from "./store.ts";
import type { ProviderSearchResult, SearchProvider } from "./types.ts";

const fixture = JSON.parse(await readFile(new URL("./fixtures/contractor-search.json", import.meta.url), "utf8")) as ProviderSearchResult[];

const provider: SearchProvider = {
  id: "fixture",
  displayName: "Test fixture (never used in production)",
  async search(query) {
    if (/pricing|cost|competitor|software tools companies/i.test(query)) return fixture.slice(0, 2);
    if (/complaint|workaround|fragment|integration|underserved|currently handle/i.test(query)) return fixture.slice(2, 7);
    if (/regulation|trend|technology/i.test(query)) return fixture.slice(7);
    return fixture.slice(5, 7);
  },
};

test("source URL normalization removes trackers and fragments", () => {
  assert.equal(normalizeUrl("http://WWW.Example.com/a/?utm_source=x&b=2#frag"), "https://example.com/a?b=2");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
});

test("missing provider credentials fail explicitly instead of selecting fixtures", () => {
  assert.throws(() => getConfiguredProvider({ NODE_ENV: "test" }), (error) => error instanceof ResearchConfigurationError && /not configured/i.test(error.message));
});

test("deduplication prevents repeated URLs from inflating evidence", () => {
  const angles = deriveSearchAngles("find AI tools for contractors", 2);
  const sources = normalizeResults([
    { angle: angles[0], results: fixture.slice(0, 1) },
    { angle: angles[1], results: fixture.slice(1, 2) },
  ], "2026-08-24T00:00:00.000Z", 20);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].searchAngleIds.length, 2);
});

test("claim deduplication prevents syndicated copies at different URLs from inflating evidence", () => {
  const angles = deriveSearchAngles("find AI tools for contractors", 2);
  const repeated = { title: "Same complaint copied", snippet: "Users manually copy the same job data between three tools." };
  const sources = normalizeResults([
    { angle: angles[0], results: [{ ...repeated, url: "https://forum-one.example/post" }] },
    { angle: angles[1], results: [{ ...repeated, url: "https://forum-two.example/mirror" }] },
  ], "2026-08-24T00:00:00.000Z", 20);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].searchAngleIds.length, 2);
});

test("competitor extraction only fills fields supported by evidence", () => {
  const angle = deriveSearchAngles("contractor software", 1)[0];
  const sources = normalizeResults([{ angle, results: fixture.slice(0, 2) }], "2026-08-24T00:00:00.000Z", 20);
  const [competitor] = extractCompetitors(sources);
  assert.match(competitor.name.value ?? "", /FieldFlow/i);
  assert.match(competitor.pricing.value ?? "", /\$89/);
  assert.match(competitor.targetCustomer.value ?? "", /contractors/i);
  assert.equal(competitor.likelyWeaknesses.value, null);
  const unknownSource = normalizeResults([{ angle, results: [{ url: "https://unknown.example", title: "UnknownCo", snippet: "Workflow software." }] }], "2026-08-24T00:00:00.000Z", 20);
  const [unknown] = extractCompetitors(unknownSource);
  assert.equal(unknown.pricing.value, null);
  assert.equal(unknown.targetCustomer.value, null);
  assert.deepEqual(unknown.targetCustomer.evidenceIds, []);
});

test("complaint mining clusters duplicates and flags isolated complaints", () => {
  const angle = deriveSearchAngles("contractor complaints", 3)[2];
  const sources = normalizeResults([{ angle, results: fixture.slice(2, 7) }], "2026-08-24T00:00:00.000Z", 20);
  const clusters = clusterComplaints(sources);
  const integration = clusters.find((cluster) => cluster.label.includes("integrations"));
  assert.ok(integration);
  assert.ok(integration.evidenceCount >= 2);
  assert.equal(integration.isIsolated, false);
  assert.ok(clusters.some((cluster) => cluster.currentWorkaround === "spreadsheet" || cluster.currentWorkaround === "copy and paste"));
});

test("gap scoring transparently penalizes weak, one-off, absence-only cases", () => {
  const factors = {
    painSeverity: 8, complaintRecurrence: 3, currentSolutionWeakness: 6, competitiveWhitespace: 8,
    differentiationPotential: 5, willingnessToPay: 2, timing: 4, implementationFeasibility: 7,
    distributionAccessibility: 5, defensibility: 3,
  };
  const weak = scoreGap(factors, { evidenceCount: 1, independentSourceCount: 1, competitorCount: 0, absenceOnly: true });
  const supported = scoreGap(factors, { evidenceCount: 5, independentSourceCount: 3, competitorCount: 3 });
  assert.ok(weak.score < supported.score);
  assert.deepEqual(weak.penalties.map((item) => item.code), ["absence_only", "weak_evidence", "one_off"]);
});

test("the fixture pipeline returns citations, unknowns, scores, and structured ideation context", async () => {
  clearMemoryResearchCache();
  const result = await runResearch("Find AI tools for small contractors", { provider, persist: false, bypassCache: true });
  assert.equal(result.provider.id, "fixture");
  assert.ok(result.sources.length >= 6);
  assert.ok(result.gaps.length > 0);
  assert.ok(result.ideationContext.evidence.every((item) => item.sourceUrl.startsWith("https://")));
  assert.ok(result.competitors.some((item) => item.pricing.value?.includes("$89")));
  assert.ok(result.competitors.some((item) => item.likelyWeaknesses.value?.some((value) => /integration/i.test(value))));
  assert.ok(result.gaps.every((item) => item.penalties.every((penalty) => penalty.reason.length > 10)));
});
