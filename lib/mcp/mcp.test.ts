import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { handleMcpHttp, requestIdentifier } from "./http.ts";
import { mcpHealthSnapshot, publicMcpHealthSnapshot } from "./observability.ts";
import { researchMarketInput, findMarketGapsInput, MCP_TOOL_NAMES } from "./schemas.ts";
import { summarizeResearch } from "./summaries.ts";
import { registerNoveltyTools } from "./tools.ts";
import { runResearch } from "../research/pipeline.ts";
import { ResearchConfigurationError } from "../research/providers.ts";
import { clearMemoryProtection } from "../research/protection.ts";
import { acquireProtection } from "../research/protection.ts";
import type { ProviderSearchResult, ResearchResult, SearchProvider } from "../research/types.ts";

const fixture = JSON.parse(await readFile(new URL("../research/fixtures/v2-market.json", import.meta.url), "utf8")) as ProviderSearchResult[];
const fixtureProvider: SearchProvider = {
  id: "fixture", displayName: "MCP fixture provider",
  async search(query) {
    if (/pricing|competitor|alternative/i.test(query)) return fixture.slice(0, 6);
    if (/complaint|workaround|fragment|integration|underserved/i.test(query)) return fixture.slice(5, 14);
    return fixture.slice(12);
  },
};

let fixtureRun: Promise<ResearchResult> | null = null;
function getFixtureRun() {
  fixtureRun ??= runResearch("Find 4 opportunities for small field service teams", { provider: fixtureProvider, persist: false, bypassCache: true, now: () => new Date("2026-08-24T12:00:00.000Z") });
  return fixtureRun;
}

async function withClient(dependencies: Parameters<typeof registerNoveltyTools>[1], work: (client: Client) => Promise<void>) {
  const server = new McpServer({ name: "novelty-engine-test", version: "2.1.0" });
  registerNoveltyTools(server, dependencies);
  const client = new Client({ name: "fixture-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try { await work(client); } finally { await client.close(); await server.close(); }
}

test("MCP schemas reject malformed and extra arguments", () => {
  assert.equal(researchMarketInput.safeParse({ query: "short" }).success, false);
  assert.equal(researchMarketInput.safeParse({ query: "A sufficiently specific market", extra: true }).success, false);
  assert.equal(findMarketGapsInput.safeParse({ run_id: "bad" }).success, false);
});

test("malformed protocol requests receive an MCP parse error", async () => {
  const protocol = createMcpHandler((server) => registerNoveltyTools(server), { serverInfo: { name: "malformed-test", version: "1.0.0" }, maxSubscriptions: 0 });
  const response = await handleMcpHttp(new Request("https://example.test/api/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: "{not-json",
  }), protocol);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Parse error|Invalid JSON/i);
});

test("MCP fixture path research_market -> pipeline -> survivor opportunities preserves citations", async () => {
  const result = await getFixtureRun();
  await withClient({ research: async () => result, getRun: async (id) => id === result.id ? result : null }, async (client) => {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [...MCP_TOOL_NAMES].sort());
    const called = await client.callTool({ name: "research_market", arguments: { query: "Find 4 opportunities for small field service teams" } });
    assert.equal(called.isError, undefined);
    const structured = called.structuredContent as ReturnType<typeof summarizeResearch>;
    assert.equal(structured.runId, result.id);
    assert.ok(structured.survivors.length > 0);
    assert.ok(structured.citations.length > 0);
    assert.ok(structured.citations.every((item) => item.url.startsWith("https://")));
    assert.equal(structured.stopDecision.status, result.ideationContext.finalOutput.stopDecision.status);
    assert.equal(structured.researchLandscape.coverage.usableSourceCount, result.coverage.usableSourceCount);
    assert.ok(Array.isArray(structured.rejectedIdeas));
    assert.ok(Array.isArray(structured.evidenceLineage));
    assert.ok(Array.isArray(structured.decisiveRisks));
    assert.ok(Array.isArray(structured.validationTests));
  });
});

test("MCP run tools route to gaps and competitors with explicit unknowns", async () => {
  const result = await getFixtureRun();
  await withClient({ getRun: async (id) => id === result.id ? result : null }, async (client) => {
    const gaps = await client.callTool({ name: "find_market_gaps", arguments: { run_id: result.id, limit: 2 } });
    const gapPayload = gaps.structuredContent as { gaps: Array<{ supportingCitations: Array<{ url: string }> }> };
    assert.ok(gapPayload.gaps.length > 0 && gapPayload.gaps.length <= 2);
    assert.ok(gapPayload.gaps.flatMap((item) => item.supportingCitations).every((item) => item.url.startsWith("https://")));
    const competitors = await client.callTool({ name: "inspect_competitors", arguments: { run_id: result.id, limit: 3 } });
    const competitorPayload = competitors.structuredContent as { competitors: Array<{ unknownFields: string[] }> };
    assert.ok(competitorPayload.competitors.every((item) => Array.isArray(item.unknownFields)));
    const retrieved = await client.callTool({ name: "get_research_run", arguments: { run_id: result.id, include_full: true } });
    const retrievedPayload = retrieved.structuredContent as { fullResearchResult: ResearchResult };
    assert.equal(retrievedPayload.fullResearchResult.id, result.id);
  });
});

test("inspect_competitors optionally performs fresh expansion through shared recall logic", async () => {
  const result = await getFixtureRun();
  let expandedCandidate: string | undefined;
  await withClient({
    getRun: async (id) => id === result.id ? result : null,
    expandCompetitors: async (run, candidateId) => { expandedCandidate = candidateId; return { ...run, warnings: [...run.warnings, "fresh expansion fixture"] }; },
  }, async (client) => {
    const candidateId = result.candidates[0].id;
    const called = await client.callTool({ name: "inspect_competitors", arguments: { run_id: result.id, candidate_id: candidateId, fresh_expand: true, limit: 5 } });
    assert.equal(called.isError, undefined);
    assert.equal(expandedCandidate, candidateId);
    const payload = called.structuredContent as { freshExpansion: boolean; candidateId: string; competitorRecall: object };
    assert.equal(payload.freshExpansion, true);
    assert.equal(payload.candidateId, candidateId);
    assert.ok(payload.competitorRecall);
  });
});

test("source-check intent target is the Novelty source_check tool for a completed run", async () => {
  const result = await getFixtureRun();
  await withClient({ getRun: async (id) => id === result.id ? result : null }, async (client) => {
    const called = await client.callTool({ name: "source_check", arguments: { run_id: result.id } });
    assert.equal(called.isError, undefined);
    const payload = called.structuredContent as { runId: string; coverage: object; sources: unknown[] };
    assert.equal(payload.runId, result.id);
    assert.ok(payload.coverage);
    assert.ok(payload.sources.length > 0);
  });
});

test("MCP intent mode reuses the canonical pipeline and preserves mode-specific company output", async () => {
  const result = { ...await getFixtureRun(), mode: "research_company" as const, companyProfile: {
    identity: { id: "claim_company", claim: "FixtureCo", status: "INFERRED" as const, evidenceIds: [], rationale: "Fixture." },
    productsServices: [], targetUsers: [], apparentPositioning: { id: "claim_position", claim: "UNKNOWN", status: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture." },
    pricingBusinessModel: { id: "claim_price", claim: "UNKNOWN", status: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture." },
    directCompetitorIds: [], indirectSubstitutes: [], companyComplaints: [], categoryComplaints: [], competitorStrengthsWeaknesses: [],
    underservedSegments: [], threats: [], differentiationOpportunities: [], adjacentMarkets: [], validationActions: [],
    factsFromCompanyControlledSources: [], thirdPartyEvidenceIds: [], unknowns: ["Fixture unknown."],
  } };
  let receivedMode = "";
  await withClient({ research: async (_query, options) => { receivedMode = options?.mode ?? ""; return result; } }, async (client) => {
    const called = await client.callTool({ name: "run_research_mode", arguments: { mode: "research_company", query: "Research a sufficiently specific company" } });
    assert.equal(called.isError, undefined);
    assert.equal(receivedMode, "research_company");
    assert.equal((called.structuredContent as { mode: string }).mode, "research_company");
    assert.ok((called.structuredContent as { companyProfile: object }).companyProfile);
  });
});

test("falsify_opportunity routes the validated candidate to focused falsification", async () => {
  let received = "";
  await withClient({ falsify: async (input) => {
    received = input.opportunity;
    return {
      candidate: { id: "candidate_test", name: "Test", summary: input.opportunity, targetCustomer: null, mechanism: "test mechanism" },
      priorRunId: null, provider: { id: "fixture", displayName: "Fixture" },
      activeSearch: { requestedQueries: 4, successfulQueries: 4, sourceCount: 4, errors: [] },
      falsification: {
        candidateId: "candidate_test", hypotheses: [], argumentsFor: [], argumentsAgainst: [], survivalScore: 40,
        outcome: "mutate" as const, reason: "Test counterevidence requires mutation.", decisiveRisks: [], unknownCriticalCount: 1,
        residualUnmetDemand: {
          competitorsPresent: true, closestCompetitorSimilarity: .5, sameJobSameUserSubstitute: false,
          signals: {
            repeated_unresolved_complaints: { criterion: "repeated_unresolved_complaints" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            workaround_prevalence: { criterion: "workaround_prevalence" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            switching_behavior: { criterion: "switching_behavior" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            underserved_segments: { criterion: "underserved_segments" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            price_performance_gaps: { criterion: "price_performance_gaps" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            trust_failures: { criterion: "trust_failures" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            distribution_gaps: { criterion: "distribution_gaps" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            missing_integrations: { criterion: "missing_integrations" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            procurement_friction: { criterion: "procurement_friction" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
            tolerated_bad_solutions: { criterion: "tolerated_bad_solutions" as const, present: null, claimStatus: "UNKNOWN" as const, evidenceIds: [], rationale: "Fixture unknown." },
          },
          mechanismMateriallyChangesOutcome: { present: null, claimStatus: "UNKNOWN", evidenceIds: [], rationale: "Fixture unknown." },
          meaningfulResidualGap: false, adequateSameJobSameUserSolution: false,
          conclusion: "residual_gap_uncertain" as const, rationale: "Fixture assessment.", evidenceIds: [],
        },
      },
      citations: [{ id: "ev_test", title: "Counterevidence", url: "https://example.test/counterevidence", confidence: 0.7 }],
      explicitUnknowns: ["economics" as const], warning: "Fixture falsification response.",
    };
  } }, async (client) => {
    const called = await client.callTool({ name: "falsify_opportunity", arguments: { opportunity: "A specific workflow automation candidate" } });
    assert.equal(received, "A specific workflow automation candidate");
    assert.equal((called.structuredContent as { falsification: { outcome: string } }).falsification.outcome, "mutate");
  });
});

test("provider unavailability is a clear MCP tool error and never fixture fallback", async () => {
  await withClient({ research: async () => { throw new ResearchConfigurationError("Live research is unavailable.", ["TAVILY_API_KEY or BRAVE_SEARCH_API_KEY"]); } }, async (client) => {
    const called = await client.callTool({ name: "research_market", arguments: { query: "Research a sufficiently specific market" } });
    assert.equal(called.isError, true);
    const text = called.content[0]?.type === "text" ? called.content[0].text : "";
    assert.match(text, /RESEARCH_NOT_CONFIGURED/);
    assert.match(text, /fabricatedEvidence\":false/);
  });
});

test("unexpected MCP provider errors are categorized without exposing their message", async () => {
  const secret = "super-secret-upstream-detail";
  await withClient({ research: async () => { throw new Error(`provider failed with ${secret}`); } }, async (client) => {
    const called = await client.callTool({ name: "research_market", arguments: { query: "Research a sufficiently specific market" } });
    const text = called.content[0]?.type === "text" ? called.content[0].text : "";
    assert.equal(called.isError, true);
    assert.match(text, /RESEARCH_PROVIDER_ERROR/);
    assert.doesNotMatch(text, new RegExp(secret));
  });
});

test("public identity ignores client headers and query manipulation", () => {
  const first = new Request("https://example.test/api/mcp?client=one", { headers: { "x-forwarded-for": "192.0.2.44", "x-novelty-client-id": "rotated-one" } });
  const second = new Request("https://example.test/api/mcp?client=two", { headers: { "x-forwarded-for": "192.0.2.44", "x-novelty-client-id": "rotated-two" } });
  assert.equal(requestIdentifier(first), requestIdentifier(second));
  assert.equal(requestIdentifier(first), "192.0.2.44");
});

test("MCP enforces actual body size without trusting Content-Length", async () => {
  let called = false;
  const response = await handleMcpHttp(new Request("https://example.test/api/mcp", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload: "x".repeat(17_000) }),
  }), async () => { called = true; return Response.json({ ok: true }); });
  assert.equal(response.status, 413);
  assert.equal(called, false);
  assert.match(await response.text(), /REQUEST_TOO_LARGE/);
});

test("HTTP protection returns explicit 429 after the configured per-client limit", async () => {
  const previous = process.env.MCP_RATE_LIMIT_PER_HOUR;
  process.env.MCP_RATE_LIMIT_PER_HOUR = "1";
  clearMemoryProtection();
  const request = () => new Request("https://example.test/api/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.5" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_research_run", arguments: { run_id: "research_20260824120000_abcd1234" } } }),
  });
  try {
    assert.equal((await handleMcpHttp(request(), async () => Response.json({ ok: true }))).status, 200);
    const denied = await handleMcpHttp(request(), async () => Response.json({ ok: true }));
    assert.equal(denied.status, 429);
    assert.match(await denied.text(), /RATE_LIMIT/);
  } finally {
    if (previous === undefined) delete process.env.MCP_RATE_LIMIT_PER_HOUR; else process.env.MCP_RATE_LIMIT_PER_HOUR = previous;
    clearMemoryProtection();
  }
});

test("global daily/monthly budgets and concurrent research permits are enforced", async () => {
  const previous = {
    hourly: process.env.MCP_RATE_LIMIT_PER_HOUR, daily: process.env.MCP_GLOBAL_DAILY_RESEARCH_LIMIT,
    monthly: process.env.MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT, concurrent: process.env.MCP_MAX_CONCURRENT_RESEARCH,
  };
  process.env.MCP_RATE_LIMIT_PER_HOUR = "20";
  try {
    process.env.MCP_GLOBAL_DAILY_RESEARCH_LIMIT = "1";
    process.env.MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT = "20";
    process.env.MCP_MAX_CONCURRENT_RESEARCH = "2";
    clearMemoryProtection();
    const first = await acquireProtection("daily-a", true);
    assert.equal(first.allowed, true);
    if (first.allowed) await first.release();
    const dailyDenied = await acquireProtection("daily-b", true);
    assert.equal(dailyDenied.allowed, false);
    if (!dailyDenied.allowed) assert.equal(dailyDenied.reason, "daily_budget");

    process.env.MCP_GLOBAL_DAILY_RESEARCH_LIMIT = "20";
    process.env.MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT = "1";
    clearMemoryProtection();
    const monthlyFirst = await acquireProtection("month-a", true);
    if (monthlyFirst.allowed) await monthlyFirst.release();
    const monthlyDenied = await acquireProtection("month-b", true);
    assert.equal(monthlyDenied.allowed, false);
    if (!monthlyDenied.allowed) assert.equal(monthlyDenied.reason, "monthly_budget");

    process.env.MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT = "20";
    process.env.MCP_MAX_CONCURRENT_RESEARCH = "1";
    clearMemoryProtection();
    const held = await acquireProtection("concurrent-a", true);
    const concurrentDenied = await acquireProtection("concurrent-b", true);
    assert.equal(concurrentDenied.allowed, false);
    if (!concurrentDenied.allowed) assert.equal(concurrentDenied.reason, "concurrency");
    if (held.allowed) await held.release();
  } finally {
    const restore = (name: string, value: string | undefined) => value === undefined ? delete process.env[name] : process.env[name] = value;
    restore("MCP_RATE_LIMIT_PER_HOUR", previous.hourly); restore("MCP_GLOBAL_DAILY_RESEARCH_LIMIT", previous.daily);
    restore("MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT", previous.monthly); restore("MCP_MAX_CONCURRENT_RESEARCH", previous.concurrent);
    clearMemoryProtection();
  }
});

test("per-user daily research quotas are distinct from global budgets", async () => {
  const previous = { user: process.env.RESEARCH_PER_USER_DAILY_LIMIT, daily: process.env.MCP_GLOBAL_DAILY_RESEARCH_LIMIT, monthly: process.env.MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT };
  process.env.RESEARCH_PER_USER_DAILY_LIMIT = "1";
  process.env.MCP_GLOBAL_DAILY_RESEARCH_LIMIT = "20";
  process.env.MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT = "20";
  clearMemoryProtection();
  try {
    const first = await acquireProtection("quota-user-a", true);
    assert.equal(first.allowed, true);
    if (first.allowed) await first.release();
    const denied = await acquireProtection("quota-user-a", true);
    assert.equal(denied.allowed, false);
    if (!denied.allowed) assert.equal(denied.reason, "user_daily_budget");
    const differentUser = await acquireProtection("quota-user-b", true);
    assert.equal(differentUser.allowed, true);
    if (differentUser.allowed) await differentUser.release();
  } finally {
    const restore = (name: string, value: string | undefined) => value === undefined ? delete process.env[name] : process.env[name] = value;
    restore("RESEARCH_PER_USER_DAILY_LIMIT", previous.user); restore("MCP_GLOBAL_DAILY_RESEARCH_LIMIT", previous.daily); restore("MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT", previous.monthly);
    clearMemoryProtection();
  }
});

test("optional bearer authentication is enforced outside the tool definitions", async () => {
  const previous = process.env.NOVELTY_MCP_ACCESS_TOKEN;
  process.env.NOVELTY_MCP_ACCESS_TOKEN = "test-access-token";
  try {
    const handler = async () => Response.json({ ok: true });
    const denied = await handleMcpHttp(new Request("https://example.test/api/mcp"), handler);
    assert.equal(denied.status, 401);
    const allowed = await handleMcpHttp(new Request("https://example.test/api/mcp", { headers: { Authorization: "Bearer test-access-token" } }), handler);
    assert.equal(allowed.status, 200);
  } finally {
    if (previous === undefined) delete process.env.NOVELTY_MCP_ACCESS_TOKEN; else process.env.NOVELTY_MCP_ACCESS_TOKEN = previous;
  }
});

test("public cost-bearing MCP calls fail closed on Vercel without distributed protection", async () => {
  const names = ["VERCEL", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "NOVELTY_MCP_ACCESS_TOKEN", "MCP_ALLOW_INSTANCE_LOCAL_PUBLIC"] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.VERCEL = "1";
  for (const name of names.slice(1)) delete process.env[name];
  try {
    const request = new Request("https://example.test/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "research_market", arguments: { query: "Research a sufficiently specific market" } } }) });
    const response = await handleMcpHttp(request, async () => Response.json({ shouldNotRun: true }));
    assert.equal(response.status, 503);
    assert.match(await response.text(), /DURABLE_PROTECTION_REQUIRED/);
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("health and MCP summaries never expose configured secret values", async () => {
  const secret = "super-secret-provider-value";
  const health = mcpHealthSnapshot({ NODE_ENV: "test", TAVILY_API_KEY: secret, NOVELTY_MCP_ACCESS_TOKEN: "another-secret" });
  assert.equal(health.provider.configured, true);
  assert.equal(health.authentication.mode, "bearer-token");
  assert.doesNotMatch(JSON.stringify(health), new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(health), /another-secret/);
  assert.doesNotMatch(JSON.stringify(summarizeResearch(await getFixtureRun())), /TAVILY_API_KEY|BRAVE_SEARCH_API_KEY/);
  const publicHealth = JSON.stringify(await publicMcpHealthSnapshot());
  assert.doesNotMatch(publicHealth, /recentCalls|recentErrors|perClientPerHour|globalDailyResearch|supported|selected/);
});
