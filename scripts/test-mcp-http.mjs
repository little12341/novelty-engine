#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const expectedTools = ["research_from_sources", "add_sources_to_run", "get_research_requirements", "research_market", "find_market_gaps", "inspect_competitors", "falsify_opportunity", "get_research_run", "run_research_mode", "compare_ideas", "export_research_run", "compare_research_runs", "rerun_research", "source_check", "next_best_action", "record_validation_outcome", "list_research_runs", "search_research_runs", "get_research_budget_info", "compare_run_candidates"].sort();
const suppliedSources = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "research", "fixtures", "v2-market.json"), "utf8"))
  .map((item) => ({ url: item.url, title: item.title, snippet: item.snippet, publication_date: item.publishedAt }));
const port = Number(process.env.NOVELTY_MCP_TEST_PORT ?? 3417);
const origin = `http://127.0.0.1:${port}`;
const endpoint = new URL("/api/mcp", origin);
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const childEnv = {
  ...process.env,
  NODE_ENV: "production",
  SEARCH_PROVIDER: "fixture",
  NOVELTY_MCP_TEST_FIXTURES: "true",
  HOSTED_SEARCH_ENABLED: "false",
  RESEARCH_MAX_QUERIES: "4",
  RESEARCH_MAX_PROVIDER_CALLS: "4",
  RESEARCH_RESULTS_PER_QUERY: "6",
  RESEARCH_RUNS_DIR: path.join(process.cwd(), ".next", "mcp-test-runs"),
  RESEARCH_CACHE_TTL_SECONDS: "1",
  MCP_RATE_LIMIT_PER_HOUR: "20",
  MCP_GLOBAL_DAILY_RESEARCH_LIMIT: "20",
  MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT: "20",
};
delete childEnv.VERCEL;
delete childEnv.NOVELTY_MCP_ACCESS_TOKEN;
delete childEnv.UPSTASH_REDIS_REST_URL;
delete childEnv.UPSTASH_REDIS_REST_TOKEN;
delete childEnv.KV_REST_API_URL;
delete childEnv.KV_REST_API_TOKEN;

const server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: process.cwd(), env: childEnv, stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; process.stdout.write(chunk); });
server.stderr.on("data", (chunk) => { output += chunk; process.stderr.write(chunk); });

async function waitForHealth() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before health became ready.\n${output}`);
    try {
      const response = await fetch(new URL("/api/mcp/health", origin));
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for MCP health.\n${output}`);
}

const client = new Client({ name: "novelty-engine-http-integration", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } });
try {
  const healthResponse = await waitForHealth();
  const health = await healthResponse.json();
  assert.deepEqual(health, { status: "ok", version: "2.2.0" });

  const debug = await fetch(new URL("/research-debug", origin), { redirect: "manual" });
  assert.equal(debug.status, 404, "Production research inspector must remain unavailable");

  const malformedResearch = await fetch(new URL("/api/research", origin), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{not-json",
  });
  assert.equal(malformedResearch.status, 400);
  const malformedPayload = await malformedResearch.json();
  assert.equal(malformedPayload.code, "INVALID_JSON");
  assert.doesNotMatch(JSON.stringify(malformedPayload), /SyntaxError|Unexpected token|stack/i);

  const oversizedResearch = await fetch(new URL("/api/research", origin), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "x".repeat(140_000) }),
  });
  assert.equal(oversizedResearch.status, 413);

  const feedback = await fetch(new URL("/api/research/feedback", origin), {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.88" },
    body: JSON.stringify({ kind: "mcp_failure", note: "Fixture MCP connection failed during setup." }),
  });
  assert.equal(feedback.status, 201);
  assert.equal((await feedback.json()).accepted, true);

  const plainGet = await fetch(endpoint, { headers: { Accept: "application/json, text/event-stream" } });
  assert.equal(plainGet.status, 405, "Stateless MCP GET must be protocol 405, not an application 404");

  const transport = new StreamableHTTPClientTransport(endpoint);
  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), expectedTools);
  const called = await client.callTool({ name: "research_from_sources", arguments: {
    query: "Find 3 underserved workflow opportunities for small field service teams",
    sources: suppliedSources,
  } });
  assert.notEqual(called.isError, true);
  const result = called.structuredContent;
  assert.match(result.runId, /^research_/);
  assert.equal(result.retrievalMode, "supplied_sources");
  assert.equal(result.budgetUsage.providerCalls, 0);
  assert.ok(Array.isArray(result.citations) && result.citations.length > 0);
  assert.ok(result.citations.every((citation) => /^https:\/\//.test(citation.url)));
  const recent = await client.callTool({ name: "list_research_runs", arguments: { limit: 5 } });
  assert.notEqual(recent.isError, true);
  assert.ok(recent.structuredContent.runs.some((run) => run.run_id === result.runId));
  const found = await client.callTool({ name: "search_research_runs", arguments: { query: "field service workflow" } });
  assert.notEqual(found.isError, true);
  assert.ok(found.structuredContent.runs.some((run) => run.run_id === result.runId));
  assert.match(found.structuredContent.rankingMethod, /canonical-token/i);
  const budget = await client.callTool({ name: "get_research_budget_info", arguments: {} });
  assert.equal(budget.structuredContent.depths.fast.relativeCost, "low");
  assert.equal(budget.structuredContent.depths.deep.relativeCost, "high");
  assert.equal(budget.structuredContent.quotaVisibility.remainingCapacityExposed, false);
  const comparableIds = result.candidateIdMapping.canonicalIds.length >= 2
    ? result.candidateIdMapping.canonicalIds.slice(0, 2)
    : result.structuralGaps.slice(0, 2).map((gap) => gap.id);
  assert.equal(comparableIds.length, 2);
  const inRunComparison = await client.callTool({ name: "compare_run_candidates", arguments: { run_id: result.runId, candidate_ids: comparableIds } });
  assert.notEqual(inRunComparison.isError, true);
  assert.equal(inRunComparison.structuredContent.providerCalls, 0);
  assert.equal(inRunComparison.structuredContent.freshExpansion.performed, false);
  const direct = await fetch(new URL("/api/research", origin), {
    method: "POST", headers: { "Content-Type": "application/json", "x-novelty-client-id": "direct-api-e2e" },
    body: JSON.stringify({ query: "Find evidence-backed field service workflow opportunities", retrieval_mode: "supplied_sources", sources: suppliedSources }),
  });
  assert.equal(direct.status, 200);
  const directResult = await direct.json();
  assert.equal(directResult.retrievalMode, "supplied_sources");
  assert.equal(directResult.budgetUsage.providerCalls, 0);
  assert.ok(Array.isArray(directResult.roleOutputs));
  assert.ok(directResult.checkpoints.some((item) => item.name === "citation_validation" && item.status === "passed"));
  assert.ok(directResult.evidenceSnapshot?.capturedAt);
  const hosted = await client.callTool({ name: "research_market", arguments: { query: "This explicit hosted request must be blocked by the deployment kill switch" } });
  assert.equal(hosted.isError, true);
  assert.match(hosted.content?.[0]?.type === "text" ? hosted.content[0].text : "", /HOSTED_SEARCH_DISABLED/);
  console.log(`HTTP MCP verified: protocol=${client.getNegotiatedProtocolVersion()} tools=${listed.tools.length} run=${result.runId} citations=${result.citations.length}`);
} finally {
  await client.close().catch(() => {});
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
