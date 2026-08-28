import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { getResearchBudgetInfo } from "./budget-info.ts";
import { normalizeCompanyResearchRequest } from "./company-identity.ts";
import { IDEATION_CONTEXT_FIELD_GUIDE } from "./ideation-context.ts";
import { runResearch } from "./pipeline.ts";
import { privateIdentity } from "./platform-store.ts";
import { compareRunCandidates } from "./run-candidate-comparison.ts";
import {
  clearMemoryResearchCache, discoverResearchRuns, getResearchResultById, saveResearchResult, searchResearchRunPage,
} from "./store.ts";
import type { ProviderSearchResult, ResearchResult, SearchProvider } from "./types.ts";

const fixture = JSON.parse(await readFile(new URL("./fixtures/v2-market.json", import.meta.url), "utf8")) as ProviderSearchResult[];
const fixtureProvider: SearchProvider = { id: "usability-fixture", displayName: "Usability fixture", async search() { return fixture; } };
let fixtureRun: Promise<ResearchResult> | null = null;
const baseRun = () => fixtureRun ??= runResearch("Find workflow opportunities for small field service teams", {
  provider: fixtureProvider, persist: false, bypassCache: true, now: () => new Date("2026-08-26T12:00:00.000Z"),
});

function clonedRun(base: ResearchResult, id: string, query: string, completedAt: string): ResearchResult {
  const clone = structuredClone(base);
  clone.id = id;
  clone.query = query;
  clone.canonicalQuery = query.toLowerCase();
  clone.startedAt = new Date(new Date(completedAt).getTime() - 60_000).toISOString();
  clone.completedAt = completedAt;
  clone.cache = { hit: false, matchedRunId: null };
  return clone;
}

test("structured company identity accepts supported identifiers and rejects ambiguity, conflicts, and unsafe domains", () => {
  const byName = normalizeCompanyResearchRequest({ companyName: "Certificial" });
  assert.equal(byName.identity?.companyName, "Certificial");
  const byDomain = normalizeCompanyResearchRequest({ domain: "WWW.Certificial.com." });
  assert.equal(byDomain.identity?.canonicalDomain, "certificial.com");
  const combined = normalizeCompanyResearchRequest({ query: "Research Certificial and its competitors", companyName: "Certificial", domain: "certificial.com", country: "United States" });
  assert.match(combined.query, /domain=certificial\.com/);
  assert.equal(combined.identity?.country, "United States");
  const ticker = normalizeCompanyResearchRequest({ ticker: "aapl", country: "US" });
  assert.equal(ticker.identity?.ticker, "AAPL");
  assert.throws(() => normalizeCompanyResearchRequest({ companyName: "Mercury" }), /ambiguous company name/i);
  assert.throws(() => normalizeCompanyResearchRequest({ companyName: "Unrelated Holdings", domain: "certificial.com" }), /conflicts with domain/i);
  for (const domain of ["https://certificial.com", "certificial.com/path", "user@certificial.com", "localhost", "127.0.0.1", "certificial.com:443"]) {
    assert.throws(() => normalizeCompanyResearchRequest({ domain }), /domain|hostname/i);
  }
});

test("structured domain remains the authoritative company identity in research_company output", async () => {
  const request = normalizeCompanyResearchRequest({ query: "Research Certificial", companyName: "Certificial", domain: "certificial.com" });
  const result = await runResearch(request.query, {
    provider: fixtureProvider, persist: false, bypassCache: true, mode: "research_company", companyIdentity: request.identity ?? undefined,
    now: () => new Date("2026-08-26T13:00:00.000Z"),
  });
  assert.equal(result.companyProfile?.requestedIdentity?.name, "Certificial");
  assert.equal(result.companyProfile?.requestedIdentity?.canonicalDomain, "certificial.com");
  assert.deepEqual(result.companyProfile?.requestedIdentity?.authoritativeIdentifiers, ["company_name", "domain"]);
});

test("run discovery is isolated by automatic owner scope and supports search, filters, and opaque pagination", async () => {
  const previousDirectory = process.env.RESEARCH_RUNS_DIR;
  const directory = await mkdtemp(path.join(tmpdir(), "novelty-run-discovery-"));
  const ownerA = privateIdentity("research:user-a");
  const ownerB = privateIdentity("research:user-b");
  process.env.RESEARCH_RUNS_DIR = directory;
  clearMemoryResearchCache();
  try {
    const base = await baseRun();
    const a1 = clonedRun(base, "research_20260826120000_aaaa1111", "COI compliance research for regional brokers", "2026-08-26T12:00:00.000Z");
    const a2 = clonedRun(base, "research_20260827120000_aaaa2222", "Field service dispatch research", "2026-08-27T12:00:00.000Z");
    const b1 = clonedRun(base, "research_20260827130000_bbbb1111", "Private healthcare workflow research", "2026-08-27T13:00:00.000Z");
    await saveResearchResult(a1, 3_600, ownerA);
    await saveResearchResult(a2, 3_600, ownerA);
    await saveResearchResult(b1, 3_600, ownerB);

    const first = await discoverResearchRuns({ ownerScope: ownerA, limit: 1 });
    assert.deepEqual(first.runs.map((item) => item.id), [a2.id]);
    assert.ok(first.page.nextCursor);
    const second = await discoverResearchRuns({ ownerScope: ownerA, limit: 1, cursor: first.page.nextCursor! });
    assert.deepEqual(second.runs.map((item) => item.id), [a1.id]);
    assert.equal(second.page.nextCursor, null);
    assert.equal((await discoverResearchRuns({ ownerScope: ownerB })).runs[0]?.id, b1.id);
    assert.ok(!(await discoverResearchRuns({ ownerScope: ownerA })).runs.some((item) => item.id === b1.id));
    assert.ok(!(await searchResearchRunPage("healthcare", { ownerScope: ownerA })).runs.some((item) => item.id === b1.id));

    const coi = await searchResearchRunPage("COI research", { ownerScope: ownerA, updatedAfter: "2026-08-26T00:00:00.000Z", updatedBefore: "2026-08-26T23:59:59.999Z" });
    assert.equal(coi.runs[0]?.id, a1.id);
    assert.match(coi.rankingMethod, /canonical-token/i);
    await assert.rejects(() => discoverResearchRuns({ ownerScope: ownerA, cursor: "rrc_not-a-real-cursor" }), /Malformed research-run cursor/i);
    await assert.rejects(() => discoverResearchRuns({ ownerScope: ownerA, createdAfter: "2026-08-28T00:00:00Z", createdBefore: "2026-08-20T00:00:00Z" }), /created_after/i);

    const legacy = clonedRun(base, "research_20260825120000_legacy11", "Legacy unscoped research", "2026-08-25T12:00:00.000Z");
    await saveResearchResult(legacy, 3_600);
    assert.equal((await getResearchResultById(legacy.id))?.id, legacy.id, "existing unscoped stored runs remain readable by ID");
    assert.ok(!(await discoverResearchRuns({ ownerScope: ownerA })).runs.some((item) => item.id === legacy.id), "legacy unscoped runs are not leaked into scoped enumeration");
  } finally {
    clearMemoryResearchCache();
    if (previousDirectory === undefined) delete process.env.RESEARCH_RUNS_DIR; else process.env.RESEARCH_RUNS_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  }
});

test("budget expectations are deterministic, coarse, and secret-free", () => {
  const budget = getResearchBudgetInfo({ NODE_ENV: "test", TAVILY_API_KEY: "secret-value", RESEARCH_MAX_PROVIDER_CALLS: "20", RESEARCH_COMPARISON_MAX_PROVIDER_CALLS: "24" });
  assert.equal(budget.depths.fast.relativeCost, "low");
  assert.equal(budget.depths.standard.relativeCost, "medium");
  assert.equal(budget.depths.deep.relativeCost, "high");
  assert.ok(budget.depths.deep.hardCaps.retrievalCalls >= budget.depths.fast.hardCaps.retrievalCalls);
  assert.equal(budget.comparison.hardCap, 24);
  assert.equal(budget.falsification.hardCap, 4);
  assert.equal(budget.quotaVisibility.remainingCapacityExposed, false);
  assert.doesNotMatch(JSON.stringify(budget), /secret-value|TAVILY|BRAVE|provider plan/i);
});

test("ideationContext guide documents every user-safe field and excludes hidden reasoning", () => {
  const fields = IDEATION_CONTEXT_FIELD_GUIDE.fields;
  for (const name of ["finalOpportunities", "graphHoles", "contradictions", "stitchingPatterns", "weakSignals", "resurrectionOpportunities", "competitors", "evidence"] as const) {
    assert.ok(fields[name].description.length > 20);
    assert.ok(fields[name].exampleShape);
  }
  assert.match(IDEATION_CONTEXT_FIELD_GUIDE.visibility, /does not expose chain-of-thought/i);
});

test("stored-run candidate comparison handles survivors, killed candidates, unknown IDs, and insufficient evidence without fresh calls", async () => {
  const run = structuredClone(await baseRun());
  assert.ok(run.candidates.length >= 2, "fixture must produce at least two canonical candidates");
  const ids = run.candidates.slice(0, Math.min(3, run.candidates.length)).map((item) => item.id);
  const valid = compareRunCandidates(run, ids);
  assert.equal(valid.providerCalls, 0);
  assert.equal(valid.targets.length, ids.length);
  assert.ok(valid.dimensions.some((item) => item.dimension === "next_validation_action"));
  assert.ok(valid.dimensions.flatMap((item) => item.cells).every((item) => ["KNOWN", "INFERRED", "UNKNOWN", "CONTRADICTED"].includes(item.state)));

  const killedId = ids[0];
  const killed = structuredClone(run);
  const lifecycle = killed.candidateLifecycles.find((item) => item.candidateId === killedId);
  if (lifecycle) { lifecycle.classification = "killed"; lifecycle.currentState = "KILLED"; lifecycle.exactKillReason = "Fixture decisive counterevidence."; }
  else killed.candidateLifecycles.push({ candidateId: killedId, currentState: "KILLED", classification: "killed", exactKillReason: "Fixture decisive counterevidence.", failureFeedback: [], events: [] });
  const killedComparison = compareRunCandidates(killed, ids.slice(0, 2));
  assert.equal(killedComparison.targets.find((item) => item.id === killedId)?.killed, true);
  assert.match(killedComparison.targets.find((item) => item.id === killedId)?.killReason ?? "", /decisive counterevidence/i);
  assert.match(killedComparison.uncertaintyNotes.join(" "), /not resurrected/i);

  assert.throws(() => compareRunCandidates(run, [ids[0], "candidate_from_another_run"]), /not found in run|do not mix/i);
  const thin = structuredClone(run);
  thin.finalOpportunities = [];
  thin.opportunityScores = [];
  thin.evidenceGates = [];
  thin.falsificationResults = [];
  thin.assumptionLedger = [];
  thin.validationExperiments = [];
  const insufficient = compareRunCandidates(thin, ids.slice(0, 2));
  assert.match(insufficient.conclusion, /insufficient/i);
  assert.ok(insufficient.dimensions.flatMap((item) => item.cells).some((item) => item.state === "UNKNOWN"));
});
