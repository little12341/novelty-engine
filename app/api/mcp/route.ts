import { createMcpHandler } from "mcp-handler";
import { handleMcpHttp } from "@/lib/mcp/http";
import { registerNoveltyTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const mcpHandler = createMcpHandler((server) => registerNoveltyTools(server), {
  serverInfo: { name: "novelty-engine", version: "2.1.0" },
  instructions: "Use research_market first for evidence-backed market research. Follow up with the run-ID tools for gaps, competitors, retrieval, or focused falsification. Never treat unknown fields or absent search results as evidence.",
  maxSubscriptions: 0,
});

const route = (request: Request) => handleMcpHttp(request, mcpHandler);

export { route as GET, route as POST, route as OPTIONS };
