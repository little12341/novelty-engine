import { NextRequest, NextResponse } from "next/server";
import { acquireProtection } from "@/lib/research/protection";
import { checkWatchlist } from "@/lib/research/watchlists";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { watchlistId?: unknown } | null;
  if (!body || typeof body.watchlistId !== "string") return NextResponse.json({ error: "watchlistId is required." }, { status: 400 });
  const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const permit = await acquireProtection(`${identifier}:watchlist-check`, true);
  if (!permit.allowed) return NextResponse.json({ error: "Research budget reached.", code: permit.reason.toUpperCase(), retryAfterSeconds: permit.retryAfterSeconds }, { status: 429 });
  try {
    return NextResponse.json(await checkWatchlist(body.watchlistId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Watchlist check failed." }, { status: error instanceof RangeError ? 400 : 502 });
  } finally { await permit.release(); }
}
