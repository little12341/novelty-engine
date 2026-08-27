import { NextRequest, NextResponse } from "next/server";
import { listResearchRuns, searchResearchRuns } from "@/lib/research/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const query = request.nextUrl.searchParams.get("query")?.trim();
  const bounded = Number.isFinite(limit) ? limit : 20;
  return NextResponse.json({ runs: query ? await searchResearchRuns(query, bounded) : await listResearchRuns(bounded), query: query ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
