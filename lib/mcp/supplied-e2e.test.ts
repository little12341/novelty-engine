import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { registerNoveltyTools } from "./tools.ts";
import type { ProviderSearchResult, ResearchResult } from "../research/types.ts";
import { checkWatchlist, createWatchlist, watchlistProtectionClass } from "../research/watchlists.ts";
import { SuppliedSourcesRequiredError } from "../research/providers.ts";

const fixture = JSON.parse(await readFile(new URL("../research/fixtures/v2-market.json", import.meta.url), "utf8")) as ProviderSearchResult[];
const query = "Find underserved workflow opportunities for small field service teams";

async function withClient(work: (client: Client) => Promise<void>) {
  const server = new McpServer({ name: "novelty-supplied-e2e", version: "2.2.0" });
  registerNoveltyTools(server);
  const client = new Client({ name: "supplied-e2e-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try { await work(client); } finally { await client.close(); await server.close(); }
}

test("supplied-source MCP flow creates, audits, enriches, falsifies, compares, and exports immutable zero-call runs", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "novelty-supplied-e2e-"));
  const previousRuns = process.env.RESEARCH_RUNS_DIR;
  const previousHosted = process.env.HOSTED_SEARCH_ENABLED;
  process.env.RESEARCH_RUNS_DIR = directory;
  process.env.HOSTED_SEARCH_ENABLED = "false";
  try {
    await withClient(async (client) => {
      const created = await client.callTool({ name: "research_from_sources", arguments: { query, depth: "standard", sources: fixture.slice(0, 3).map((item) => ({ url: item.url, title: item.title, snippet: item.snippet, publication_date: item.publishedAt })) } });
      assert.notEqual(created.isError, true);
      const createdPayload = created.structuredContent as { runId: string; retrievalMode: string; budgetUsage: { providerCalls: number }; candidateIdeas: Array<{ candidateId: string; name: string }> };
      assert.equal(createdPayload.retrievalMode, "supplied_sources");
      assert.equal(createdPayload.budgetUsage.providerCalls, 0);

      const gaps = await client.callTool({ name: "find_market_gaps", arguments: { run_id: createdPayload.runId } });
      const competitors = await client.callTool({ name: "inspect_competitors", arguments: { run_id: createdPayload.runId } });
      const audit = await client.callTool({ name: "source_check", arguments: { run_id: createdPayload.runId } });
      const requirements = await client.callTool({ name: "get_research_requirements", arguments: { run_id: createdPayload.runId } });
      assert.notEqual(gaps.isError, true);
      assert.notEqual(competitors.isError, true);
      assert.equal((audit.structuredContent as { providerCalls: number }).providerCalls, 0);
      assert.equal((requirements.structuredContent as { providerCalls: number }).providerCalls, 0);
      assert.ok((requirements.structuredContent as { requirements: unknown[] }).requirements.length > 0);

      const added = await client.callTool({ name: "add_sources_to_run", arguments: { run_id: createdPayload.runId, sources: fixture.slice(3).map((item) => ({ url: item.url, title: item.title, content: item.snippet, publication_date: item.publishedAt })) } });
      assert.notEqual(added.isError, true);
      const addedPayload = added.structuredContent as { runId: string; summary: { baselineRunId: string; historicalSnapshotMutated: boolean; providerCalls: number }; result: { candidateIdeas: Array<{ candidateId: string; name: string }>; retrievalMode: string; budgetUsage: { providerCalls: number } } };
      assert.notEqual(addedPayload.runId, createdPayload.runId);
      assert.equal(addedPayload.summary.baselineRunId, createdPayload.runId);
      assert.equal(addedPayload.summary.historicalSnapshotMutated, false);
      assert.equal(addedPayload.summary.providerCalls, 0);
      assert.equal(addedPayload.result.retrievalMode, "supplied_sources");
      assert.equal(addedPayload.result.budgetUsage.providerCalls, 0);

      const [beforeFullResponse, afterFullResponse] = await Promise.all([
        client.callTool({ name: "get_research_run", arguments: { run_id: createdPayload.runId, include_full: true } }),
        client.callTool({ name: "get_research_run", arguments: { run_id: addedPayload.runId, include_full: true } }),
      ]);
      const before = (beforeFullResponse.structuredContent as { fullResearchResult: ResearchResult }).fullResearchResult;
      const after = (afterFullResponse.structuredContent as { fullResearchResult: ResearchResult }).fullResearchResult;
      const coveredFamilies = (run: ResearchResult) => Object.values(run.coverage.sourceFamilyCoverage).filter((count) => count > 0).length;
      assert.ok(coveredFamilies(after) > coveredFamilies(before));
      assert.ok(after.evidenceGates.filter((item) => item.survivalGatePassed).length > before.evidenceGates.filter((item) => item.survivalGatePassed).length);
      assert.equal(after.runLineage.parentRunId, before.id);
      assert.equal(after.runLineage.version, before.runLineage.version + 1);
      assert.deepEqual(before.evidenceSnapshot.evidence.map((item) => item.id), before.sources.map((item) => item.id), "the baseline snapshot remains intact");

      const watchlist = await createWatchlist({
        label: "Supplied evidence watch",
        query,
        mode: "market",
        baselineRunId: addedPayload.runId,
      });
      assert.equal(await watchlistProtectionClass(watchlist.id), "compute");
      await assert.rejects(checkWatchlist(watchlist.id), SuppliedSourcesRequiredError);

      const candidate = addedPayload.result.candidateIdeas[0];
      assert.ok(candidate);
      const falsified = await client.callTool({ name: "falsify_opportunity", arguments: { opportunity: candidate.name, run_id: addedPayload.runId, candidate_id: candidate.candidateId } });
      assert.notEqual(falsified.isError, true);
      assert.equal((falsified.structuredContent as { providerCalls: number }).providerCalls, 0);

      const compared = await client.callTool({ name: "compare_research_runs", arguments: { baseline_run_id: createdPayload.runId, comparison_run_id: addedPayload.runId } });
      const exported = await client.callTool({ name: "export_research_run", arguments: { run_id: addedPayload.runId, format: "json" } });
      const next = await client.callTool({ name: "next_best_action", arguments: { run_id: addedPayload.runId } });
      assert.notEqual(compared.isError, true);
      assert.notEqual(exported.isError, true);
      assert.notEqual(next.isError, true);

      const rerun = await client.callTool({ name: "rerun_research", arguments: { run_id: addedPayload.runId } });
      assert.equal(rerun.isError, true);
      assert.match(rerun.content[0]?.type === "text" ? rerun.content[0].text : "", /SUPPLIED_SOURCES_REQUIRED/);
      const explicitHostedRerun = await client.callTool({ name: "rerun_research", arguments: { run_id: addedPayload.runId, retrieval_mode: "hosted" } });
      assert.equal(explicitHostedRerun.isError, true);
      assert.match(explicitHostedRerun.content[0]?.type === "text" ? explicitHostedRerun.content[0].text : "", /HOSTED_SEARCH_DISABLED/);
      const freshExpansion = await client.callTool({ name: "inspect_competitors", arguments: { run_id: addedPayload.runId, fresh_expand: true } });
      assert.equal(freshExpansion.isError, true);
      assert.match(freshExpansion.content[0]?.type === "text" ? freshExpansion.content[0].text : "", /SUPPLIED_SOURCES_REQUIRED/);
      const freshComparison = await client.callTool({ name: "compare_run_candidates", arguments: {
        run_id: addedPayload.runId,
        candidate_ids: addedPayload.result.candidateIdeas.slice(0, 2).map((item) => item.candidateId),
        fresh_expand: true,
      } });
      assert.equal(freshComparison.isError, true);
      assert.match(freshComparison.content[0]?.type === "text" ? freshComparison.content[0].text : "", /SUPPLIED_SOURCES_REQUIRED/);
    });
  } finally {
    if (previousRuns === undefined) delete process.env.RESEARCH_RUNS_DIR; else process.env.RESEARCH_RUNS_DIR = previousRuns;
    if (previousHosted === undefined) delete process.env.HOSTED_SEARCH_ENABLED; else process.env.HOSTED_SEARCH_ENABLED = previousHosted;
    await rm(directory, { recursive: true, force: true });
  }
});
