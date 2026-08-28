import { NextRequest, NextResponse } from "next/server";
import { discoverResearchRuns, searchResearchRunPage } from "@/lib/research/store";
import { clientNetworkIdentity } from "@/lib/http-safety";
import { privateIdentity } from "@/lib/research/platform-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const query = request.nextUrl.searchParams.get("query")?.trim();
  const bounded = Number.isFinite(limit) ? limit : 20;
  const status = request.nextUrl.searchParams.get("status");
  const stopStatus = request.nextUrl.searchParams.get("stop_status");
  const mode = request.nextUrl.searchParams.get("mode");
  const depth = request.nextUrl.searchParams.get("depth");
  const validModes = new Set(["find_business", "research_market", "research_company", "find_competitors", "find_gaps", "falsify", "validate_idea"]);
  if (bounded < 1 || bounded > 50 || query && (query.length < 2 || query.length > 200)
    || status && !["complete", "partial"].includes(status)
    || stopStatus && !["proceed", "partial_research", "insufficient_evidence"].includes(stopStatus)
    || mode && !validModes.has(mode) || depth && !["fast", "standard", "deep"].includes(depth)) {
    return NextResponse.json({ error: "Malformed run-history query, limit, status, stop_status, mode, or depth filter.", code: "INVALID_HISTORY_FILTER" }, { status: 400 });
  }
  const ownerScope = privateIdentity(`research:${clientNetworkIdentity(request)}`);
  const filters = {
    limit: bounded,
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
    createdAfter: request.nextUrl.searchParams.get("created_after") ?? undefined,
    createdBefore: request.nextUrl.searchParams.get("created_before") ?? undefined,
    updatedAfter: request.nextUrl.searchParams.get("updated_after") ?? undefined,
    updatedBefore: request.nextUrl.searchParams.get("updated_before") ?? undefined,
    status: status as "complete" | "partial" | undefined,
    stopStatus: stopStatus as "proceed" | "partial_research" | "insufficient_evidence" | undefined,
    mode: mode as "find_business" | "research_market" | "research_company" | "find_competitors" | "find_gaps" | "falsify" | "validate_idea" | undefined,
    depth: depth as "fast" | "standard" | "deep" | undefined,
    ownerScope,
  };
  try {
    const page = query ? await searchResearchRunPage(query, filters) : await discoverResearchRuns(filters);
    return NextResponse.json({ ...page, query: query ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid run-history filters.", code: "INVALID_HISTORY_FILTER" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
