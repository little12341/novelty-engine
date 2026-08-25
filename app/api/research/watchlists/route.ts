import { NextRequest, NextResponse } from "next/server";
import { createWatchlist } from "@/lib/research/watchlists";
import type { WatchlistConfig } from "@/lib/research/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.label !== "string" || typeof body.query !== "string" || typeof body.baselineRunId !== "string" || !['opportunity', 'company', 'market'].includes(String(body.mode))) return NextResponse.json({ error: "label, query, baselineRunId, and mode are required." }, { status: 400 });
    const watch = await createWatchlist({ label: body.label, query: body.query, baselineRunId: body.baselineRunId, mode: body.mode as WatchlistConfig["mode"], userId: typeof body.userId === "string" ? body.userId : undefined, candidateId: typeof body.candidateId === "string" ? body.candidateId : undefined, signals: Array.isArray(body.signals) ? body.signals as WatchlistConfig["signals"] : undefined });
    return NextResponse.json(watch, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid watchlist." }, { status: error instanceof RangeError ? 400 : 500 });
  }
}
