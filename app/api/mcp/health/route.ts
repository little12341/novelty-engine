import { mcpHealthSnapshotWithConnectivity } from "@/lib/mcp/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await mcpHealthSnapshotWithConnectivity(), { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
