import { createMcpHandler } from "mcp-handler";
import { handleMcpHttp } from "@/lib/mcp/http";
import { registerNoveltyTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const mcpHandler = createMcpHandler((server) => registerNoveltyTools(server), {
  serverInfo: { name: "novelty-engine", version: "2.2.0" },
  instructions: "Default to Claude/web search using the user's available web capability, then pass bounded public evidence to research_from_sources. If get_research_requirements reports deficits, search for those evidence families and call add_sources_to_run. Novelty did not search the web when retrievalMode=supplied_sources; preserve that provenance and providerCalls=0. Use research_market or run_research_mode only for explicit optional hosted retrieval. Use list_research_runs/search_research_runs for prior research; find_market_gaps and ordinary inspect_competitors are stored reads. Report only evidence-gate survivors, preserve UNKNOWN and CONTRADICTED facts, and never call a candidate validated without a strict gate plus recorded external validation.",
  maxSubscriptions: 0,
});

const route = (request: Request) => handleMcpHttp(request, mcpHandler);

export { route as GET, route as POST, route as OPTIONS };
