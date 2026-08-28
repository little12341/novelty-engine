#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

assert.ok(existsSync(path.join(process.cwd(), ".next", "BUILD_ID")), "Run npm run build before the production QA replay.");

const port = Number(process.env.NOVELTY_PRODUCTION_QA_PORT ?? 3421);
const origin = `http://127.0.0.1:${port}`;
const endpoint = new URL("/api/mcp", origin);
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const childEnv = {
  ...process.env,
  NODE_ENV: "production",
  SEARCH_PROVIDER: "fixture",
  NOVELTY_MCP_TEST_FIXTURES: "true",
  RESEARCH_MAX_QUERIES: "12",
  RESEARCH_MAX_PROVIDER_CALLS: "12",
  RESEARCH_RESULTS_PER_QUERY: "8",
  MCP_FALSIFICATION_MAX_QUERIES: "4",
  RESEARCH_RUNS_DIR: path.join(process.cwd(), ".next", "production-qa-runs"),
  RESEARCH_CACHE_TTL_SECONDS: "1",
  MCP_RATE_LIMIT_PER_HOUR: "100",
  MCP_GLOBAL_DAILY_RESEARCH_LIMIT: "50",
  MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT: "50",
  RESEARCH_PER_USER_DAILY_LIMIT: "50",
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
    if (server.exitCode !== null) throw new Error(`Next.js exited before QA readiness.\n${output}`);
    try {
      const response = await fetch(new URL("/api/mcp/health", origin));
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for QA readiness.\n${output}`);
}

const client = new Client({ name: "novelty-engine-production-qa", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } });

async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.notEqual(result.isError, true, `${name} failed: ${JSON.stringify(result.structuredContent ?? result.content)}`);
  assert.ok(result.structuredContent && typeof result.structuredContent === "object", `${name} omitted structured content`);
  return result.structuredContent;
}

function assertBudgetInvariant(payload) {
  const budget = payload.budgetUsage;
  if (!budget) return;
  if (budget.expansionStopReason === "budget_exhausted") assert.equal(budget.exhausted, true);
  if (budget.exhausted === false) assert.notEqual(budget.expansionStopReason, "budget_exhausted");
}

try {
  const healthResponse = await waitForHealth();
  assert.deepEqual(await healthResponse.json(), { status: "ok", version: "2.2.0" });

  const openapiResponse = await fetch(new URL("/api/research/openapi", origin));
  assert.equal(openapiResponse.status, 200);
  const openapi = await openapiResponse.json();
  const feedbackBody = openapi.paths?.["/api/research/feedback"]?.post?.requestBody;
  assert.equal(feedbackBody?.required, true);
  const feedbackSchema = feedbackBody?.content?.["application/json"]?.schema;
  assert.deepEqual(feedbackSchema?.required, ["kind", "note"]);
  assert.equal(feedbackSchema?.additionalProperties, false);

  await client.connect(new StreamableHTTPClientTransport(endpoint));

  const market = await call("research_market", {
    query: "Find 3 workflow opportunities for small US field service contractor teams with manual job-data handoffs",
    depth: "standard",
  });
  assert.match(market.runId, /^research_/);
  assert.ok(Array.isArray(market.citations) && market.citations.length > 0);
  assert.ok(market.citations.every((item) => /^https:\/\//.test(item.url)));
  assert.ok(market.candidateIdMapping && Array.isArray(market.candidateIdMapping.canonicalIds));
  assertBudgetInvariant(market);
  assert.ok((market.candidateLifecycles ?? []).every((item) => item.classification !== "validated"));

  const candidateId = market.survivors?.[0]?.candidateId ?? market.candidateIdMapping.canonicalIds[0];
  assert.match(candidateId, /^candidate_/);

  const competitors = await call("inspect_competitors", { run_id: market.runId, candidate_id: candidateId, limit: 10, fresh_expand: false });
  assert.equal(competitors.candidateId, candidateId);
  assert.ok(competitors.counts.directCompetitors + competitors.counts.substitutes === competitors.counts.normalizedEntities);
  assert.ok((competitors.competitors ?? []).every((item) => ["direct_competitor", "substitute"].includes(item.classification)));
  assert.ok((competitors.competitors ?? []).every((item) => item.similarity === null || Object.keys(item.similarity.dimensionScores).length === 8));

  const gaps = await call("find_market_gaps", { run_id: market.runId, limit: 5, cursor: 0 });
  assert.ok(Array.isArray(gaps.gaps) && gaps.gaps.length > 0);
  assert.ok(gaps.gaps.flatMap((item) => item.supportingCitations).every((item) => /^https:\/\//.test(item.url)));

  const falsified = await call("falsify_opportunity", {
    opportunity: "A job-data exception bridge for small US field service contractor teams using spreadsheets",
    run_id: market.runId,
    candidate_id: candidateId,
  });
  assert.equal(falsified.candidate.id, candidateId);
  assert.ok(falsified.falsification.searchCoverage.failedCompaniesPriorAttempts);
  assert.ok(falsified.falsification.searchCoverage.aiCommoditization);
  assert.ok(["UNKNOWN", "INFERRED", "VERIFIED"].includes(falsified.falsification.searchCoverage.failedCompaniesPriorAttempts.status));
  assert.ok(["UNKNOWN", "INFERRED", "VERIFIED"].includes(falsified.falsification.searchCoverage.aiCommoditization.status));

  const sourceAudit = await call("source_check", { run_id: market.runId });
  assert.equal(sourceAudit.runId, market.runId);
  assert.equal(typeof sourceAudit.citationCoverage.supportedMajorClaims, "number");
  assert.equal(typeof sourceAudit.citationCoverage.totalMajorClaims, "number");
  assert.ok(sourceAudit.citationCoverage.supportedMajorClaims <= sourceAudit.citationCoverage.totalMajorClaims);
  assert.ok(Array.isArray(sourceAudit.supportRoleMismatches) && Array.isArray(sourceAudit.relevanceRejections));
  assert.ok(sourceAudit.claimLineage.every((claim) => claim.supportingEvidenceIds.every((id) => !claim.rejectedEvidenceIds.includes(id))));

  const next = await call("next_best_action", { run_id: market.runId });
  assert.ok(next.nextBestAction.action.length > 20 && next.nextBestAction.killCriterion.length > 20);

  const rerun = await call("rerun_research", { run_id: market.runId, depth: "standard" });
  const rerunId = rerun.result.runId;
  assert.match(rerunId, /^research_/);
  assert.notEqual(rerunId, market.runId);
  assertBudgetInvariant(rerun.result);

  const comparison = await call("compare_research_runs", { baseline_run_id: market.runId, comparison_run_id: rerunId });
  assert.equal(comparison.baselineRunId, market.runId);
  assert.equal(comparison.comparisonRunId, rerunId);
  assert.ok(Array.isArray(comparison.materialChanges));

  const exported = await call("export_research_run", { run_id: market.runId, format: "json" });
  assert.equal(exported.runId, market.runId);
  assert.ok(exported.export.claimLineage && exported.export.citationCoverage && exported.export.candidateIdMapping);
  assert.ok(exported.export.sources.every((source) => Array.isArray(source.supportsClaims) && Array.isArray(source.rejectedForClaims)));

  const company = await call("run_research_mode", {
    mode: "research_company", query: "Research Certificial company products pricing competitors", depth: "standard",
  });
  assert.equal(company.mode, "research_company");
  assert.equal(company.companyProfile.requestedIdentity.name, "Certificial");
  assert.match(company.companyProfile.identity.claim, /^Certificial is the requested company identity\.$/);
  assert.doesNotMatch(company.companyProfile.identity.claim, /benefits of|best .* software|platforms compared/i);
  assert.ok(company.companyProfile.unknowns.some((item) => /not retrieved|unknown/i.test(item)));

  const business = await call("run_research_mode", {
    mode: "find_business", query: "Find a business for small commercial cleaning companies needing proof of service", depth: "standard",
  });
  assert.equal(business.mode, "find_business");
  assertBudgetInvariant(business);
  assert.ok((business.candidateLifecycles ?? []).every((item) => item.classification !== "validated"));

  const invalidValidation = await client.callTool({ name: "record_validation_outcome", arguments: {
    run_id: market.runId, candidate_id: "candidate_missing_qa", experiment_type: "interview", success: true,
    observed_metrics: ["One unverified success report"], artifact_urls: ["http://127.0.0.1/private"],
  } });
  assert.equal(invalidValidation.isError, true);

  if (market.survivors?.some((item) => item.candidateId === candidateId)) {
    const guarded = await call("record_validation_outcome", {
      run_id: market.runId, candidate_id: candidateId, experiment_type: "interview", success: true,
      observed_metrics: ["One interview reported interest; no externally inspectable artifact exists"],
      artifact_urls: ["http://127.0.0.1/private"],
    });
    assert.equal(guarded.decision, "INVESTIGATE");
    assert.equal(guarded.artifactUrls.length, 0);
  }

  console.log(JSON.stringify({
    productionQaReplay: "passed",
    protocol: client.getNegotiatedProtocolVersion(),
    runId: market.runId,
    rerunId,
    candidateId,
    sourceCheck: `${sourceAudit.citationCoverage.supportedMajorClaims}/${sourceAudit.citationCoverage.totalMajorClaims}`,
    health: { status: "ok", version: "2.2.0" },
    claudeUi: "MANUAL_NOT_EXERCISED",
  }, null, 2));
} finally {
  await client.close().catch(() => {});
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
