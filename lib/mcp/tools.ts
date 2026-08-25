import type { McpServer } from "@modelcontextprotocol/server";
import { ResearchConfigurationError } from "../research/providers.ts";
import { runResearch } from "../research/pipeline.ts";
import { getResearchResultById } from "../research/store.ts";
import type { ResearchResult } from "../research/types.ts";
import { activelyFalsifyOpportunity } from "./falsify.ts";
import { recordMcpCall } from "./observability.ts";
import {
  falsifyOpportunityInput, findMarketGapsInput, getResearchRunInput, inspectCompetitorsInput, researchMarketInput,
} from "./schemas.ts";
import { summarizeCompetitors, summarizeGaps, summarizeResearch } from "./summaries.ts";

type ToolDependencies = {
  research: typeof runResearch;
  getRun: typeof getResearchResultById;
  falsify: typeof activelyFalsifyOpportunity;
};

const defaults: ToolDependencies = { research: runResearch, getRun: getResearchResultById, falsify: activelyFalsifyOpportunity };

function textResult(value: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Novelty Engine tool failed.";
  const code = error instanceof ResearchConfigurationError ? "RESEARCH_NOT_CONFIGURED"
    : error instanceof RangeError ? "INVALID_OR_MISSING_RUN"
      : "RESEARCH_PROVIDER_ERROR";
  const value: Record<string, unknown> = { error: message, code, fabricatedEvidence: false };
  if (error instanceof ResearchConfigurationError) value.requiredEnvironmentVariables = error.requiredEnvironmentVariables;
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value, isError: true };
}

function errorCode(error: unknown) {
  return error instanceof ResearchConfigurationError ? "RESEARCH_NOT_CONFIGURED"
    : error instanceof RangeError ? "INVALID_OR_MISSING_RUN" : "RESEARCH_PROVIDER_ERROR";
}

function resultMetadata(value: Record<string, unknown>) {
  const provider = value.provider && typeof value.provider === "object" && "id" in value.provider
    ? String((value.provider as { id: unknown }).id) : null;
  const sourceCount = Array.isArray(value.citations) ? value.citations.length
    : value.activeSearch && typeof value.activeSearch === "object" && "sourceCount" in value.activeSearch
      ? Number((value.activeSearch as { sourceCount: unknown }).sourceCount) : null;
  return { provider, sourceCount: Number.isFinite(sourceCount) ? sourceCount : null };
}

async function observed<T extends Record<string, unknown>>(tool: string, work: () => Promise<T>) {
  const started = Date.now();
  try {
    const value = await work();
    const runId = typeof value.runId === "string" ? value.runId : null;
    recordMcpCall({ at: new Date().toISOString(), tool, status: "success", durationMs: Date.now() - started, runId, ...resultMetadata(value), errorCode: null });
    return textResult(value);
  } catch (error) {
    recordMcpCall({ at: new Date().toISOString(), tool, status: "error", durationMs: Date.now() - started, runId: null, provider: null, sourceCount: null, errorCode: errorCode(error) });
    return toolError(error);
  }
}

async function requiredRun(getRun: ToolDependencies["getRun"], id: string): Promise<ResearchResult> {
  const result = await getRun(id);
  if (!result) throw new RangeError(`Research run ${id} was not found or has expired.`);
  return result;
}

export function registerNoveltyTools(server: McpServer, dependencies: Partial<ToolDependencies> = {}) {
  const deps = { ...defaults, ...dependencies };
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

  server.registerTool("research_market", {
    title: "Research a market",
    description: "Run Novelty Engine's complete evidence-backed market research and opportunity-survivor pipeline for one topic or request. Use this first for market-gap, startup, product, or invention research.",
    inputSchema: researchMarketInput,
    annotations,
  }, ({ query }) => observed("research_market", async () => summarizeResearch(await deps.research(query))));

  server.registerTool("find_market_gaps", {
    title: "Find ranked market gaps",
    description: "Return the strongest evidence-backed, plausible, or speculative gaps from a completed Novelty Engine run, with supporting and counter citations and explicit unknowns.",
    inputSchema: findMarketGapsInput,
    annotations,
  }, ({ run_id, limit }) => observed("find_market_gaps", async () => summarizeGaps(await requiredRun(deps.getRun, run_id), limit)));

  server.registerTool("inspect_competitors", {
    title: "Inspect competitors",
    description: "Return the cited competitor map from a completed research run. Unsupported factual fields remain explicit nulls and are listed as unknown.",
    inputSchema: inspectCompetitorsInput,
    annotations,
  }, ({ run_id, limit }) => observed("inspect_competitors", async () => summarizeCompetitors(await requiredRun(deps.getRun, run_id), limit)));

  server.registerTool("falsify_opportunity", {
    title: "Falsify an opportunity",
    description: "Actively search for competitors, failed demand, unfavorable economics, regulatory, liability, trust, and feasibility counterevidence for one candidate. Optionally ground the challenge in a prior run and candidate ID.",
    inputSchema: falsifyOpportunityInput,
    annotations,
  }, (input) => observed("falsify_opportunity", async () => deps.falsify(input)));

  server.registerTool("get_research_run", {
    title: "Get a research run",
    description: "Retrieve a completed run by ID. Returns a concise research summary by default; request the full internal JSON only for detailed debugging or follow-up analysis.",
    inputSchema: getResearchRunInput,
    annotations,
  }, ({ run_id, include_full }) => observed("get_research_run", async () => {
    const result = await requiredRun(deps.getRun, run_id);
    return include_full ? { runId: result.id, fullResearchResult: result } : summarizeResearch(result);
  }));
}
