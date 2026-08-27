import { NextRequest, NextResponse } from "next/server";
import { createWatchlist } from "@/lib/research/watchlists";
import type { WatchlistConfig } from "@/lib/research/types";
import { BoundedJsonError, operationalLog, readBoundedJson, safeErrorCategory } from "@/lib/http-safety";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readBoundedJson<Record<string, unknown>>(request, 8_192);
    if (typeof body.label !== "string" || typeof body.query !== "string" || typeof body.baselineRunId !== "string" || !['opportunity', 'company', 'market'].includes(String(body.mode))) return NextResponse.json({ error: "label, query, baselineRunId, and mode are required." }, { status: 400 });
    const watch = await createWatchlist({ label: body.label, query: body.query, baselineRunId: body.baselineRunId, mode: body.mode as WatchlistConfig["mode"], userId: typeof body.userId === "string" ? body.userId : undefined, candidateId: typeof body.candidateId === "string" ? body.candidateId : undefined, signals: Array.isArray(body.signals) ? body.signals as WatchlistConfig["signals"] : undefined });
    return NextResponse.json(watch, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof BoundedJsonError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    operationalLog("error", "watchlist_create_failed", { category: safeErrorCategory(error) });
    return NextResponse.json({ error: "Invalid watchlist." }, { status: 500 });
  }
}
