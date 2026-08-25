import { NextRequest, NextResponse } from "next/server";
import { listResearchRuns } from "@/lib/research/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  return NextResponse.json({ runs: await listResearchRuns(Number.isFinite(limit) ? limit : 20) }, { headers: { "Cache-Control": "private, no-store" } });
}
