#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const expectedTools = ["research_market", "find_market_gaps", "inspect_competitors", "falsify_opportunity", "get_research_run"].sort();
const port = Number(process.env.NOVELTY_MCP_TEST_PORT ?? 3417);
const origin = `http://127.0.0.1:${port}`;
const endpoint = new URL("/api/mcp", origin);
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const childEnv = {
  ...process.env,
  NODE_ENV: "production",
  SEARCH_PROVIDER: "fixture",
  NOVELTY_MCP_TEST_FIXTURES: "true",
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
  assert.equal(health.ok, true);
  assert.equal(health.endpoint, "/api/mcp");
  assert.equal(health.healthEndpoint, "/api/mcp/health");
  assert.equal(health.providerConfigured, true);
  assert.equal(health.toolCount, 5);

  const plainGet = await fetch(endpoint, { headers: { Accept: "application/json, text/event-stream" } });
  assert.equal(plainGet.status, 405, "Stateless MCP GET must be protocol 405, not an application 404");

  const transport = new StreamableHTTPClientTransport(endpoint);
  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), expectedTools);
  const called = await client.callTool({ name: "research_market", arguments: { query: "Find 3 underserved workflow opportunities for small field service teams" } });
  assert.notEqual(called.isError, true);
  const result = called.structuredContent;
  assert.match(result.runId, /^research_/);
  assert.ok(Array.isArray(result.citations) && result.citations.length > 0);
  assert.ok(result.citations.every((citation) => /^https:\/\//.test(citation.url)));
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
