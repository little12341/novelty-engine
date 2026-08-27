import { createMcpHandler } from "mcp-handler";
import { handleMcpHttp } from "@/lib/mcp/http";
import { registerNoveltyTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const mcpHandler = createMcpHandler((server) => registerNoveltyTools(server), {
  serverInfo: { name: "novelty-engine", version: "2.2.0" },
  instructions: "Use research_market first. Report only evidence-gate survivors, preserve UNKNOWN and CONTRADICTED facts, and never call a candidate validated without a strict gate plus recorded external validation. Use run-ID tools for pagination, source audits, next action, reruns, validation outcomes, and exports.",
  maxSubscriptions: 0,
});

const route = (request: Request) => handleMcpHttp(request, mcpHandler);

export { route as GET, route as POST, route as OPTIONS };
