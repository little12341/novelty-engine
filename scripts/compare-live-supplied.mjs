#!/usr/bin/env node

import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { runResearch, runResearchFromSources } from "../lib/research/pipeline.ts";
import { hasUsableProviderKey, TavilySearchProvider } from "../lib/research/providers.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (process.env.NOVELTY_LIVE_SMOKE !== "true") {
  throw new Error("Set NOVELTY_LIVE_SMOKE=true to acknowledge that this check makes exactly one live Tavily request.");
}
assert.ok(hasUsableProviderKey(process.env.TAVILY_API_KEY), "A valid local TAVILY_API_KEY is required for this comparison.");

process.env.HOSTED_SEARCH_ENABLED = "true";
Object.assign(process.env, {
  RESEARCH_MAX_QUERIES: "12",
  RESEARCH_MAX_PROVIDER_CALLS: "12",
  RESEARCH_MAX_PROVIDER_SPEND_CREDITS: "12",
  RESEARCH_RESULTS_PER_QUERY: "6",
  RESEARCH_MAX_RETRIES_PER_SEARCH: "0",
  RESEARCH_MAX_EXPANSION_BRANCHES: "0",
  RESEARCH_MAX_COUNTEREVIDENCE_SEARCHES: "1",
  RESEARCH_MAX_RUN_DURATION_MS: "60000",
});

const query = "small field service teams duplicate job data invoice handoffs competitors pricing complaints";
let actualLiveTavilyCalls = 0;
const live = new TavilySearchProvider(process.env.TAVILY_API_KEY.trim());
actualLiveTavilyCalls += 1;
const sourceSet = await live.search(query, { limit: 6, signal: AbortSignal.timeout(30_000) });
assert.ok(sourceSet.length > 0, "The bounded Tavily request returned no usable source records.");

const hostedReplay = {
  id: "tavily-single-call-replay",
  displayName: "Tavily single-call source replay",
  retrievalMode: "hosted",
  usesHostedCredits: true,
  async search() { return structuredClone(sourceSet); },
};

const at = new Date();
const [hostedBoundary, suppliedBoundary] = await Promise.all([
  runResearch(query, { provider: hostedReplay, depth: "fast", persist: false, bypassCache: true, now: () => at }),
  runResearchFromSources(query, sourceSet, { depth: "fast", persist: false, now: () => at }),
]);

const canonicalUrls = (run) => run.sources.map((item) => item.normalizedUrl).sort();
const competitorIds = (run) => run.competitors.map((item) => item.canonicalOrganizationId).sort();
const gapClaims = (run) => run.gaps.map((item) => item.problemStatement).sort();
const mechanisms = (run) => run.candidates.map((item) => item.mechanismFamily).sort();

assert.equal(actualLiveTavilyCalls, 1);
assert.deepEqual(canonicalUrls(suppliedBoundary), canonicalUrls(hostedBoundary));
assert.deepEqual(competitorIds(suppliedBoundary), competitorIds(hostedBoundary));
assert.deepEqual(gapClaims(suppliedBoundary), gapClaims(hostedBoundary));
assert.deepEqual(mechanisms(suppliedBoundary), mechanisms(hostedBoundary));
assert.equal(suppliedBoundary.stopDecision.status, hostedBoundary.stopDecision.status);
assert.equal(suppliedBoundary.budgetUsage.providerCalls, 0);
assert.equal(suppliedBoundary.budgetUsage.estimatedProviderCredits, 0);

console.log(JSON.stringify({
  liveComparison: "passed",
  provider: "tavily",
  actualLiveProviderCalls: actualLiveTavilyCalls,
  sourceSetSize: sourceSet.length,
  parity: {
    normalizedSources: suppliedBoundary.sources.length,
    competitors: suppliedBoundary.competitors.length,
    gaps: suppliedBoundary.gaps.length,
    candidates: suppliedBoundary.candidates.length,
    stopDecision: suppliedBoundary.stopDecision.status,
  },
  suppliedAccounting: {
    retrievalMode: suppliedBoundary.retrievalMode,
    providerCalls: suppliedBoundary.budgetUsage.providerCalls,
    estimatedProviderCredits: suppliedBoundary.budgetUsage.estimatedProviderCredits,
  },
}, null, 2));
