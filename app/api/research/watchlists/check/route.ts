import { NextRequest, NextResponse } from "next/server";
import { acquireProtection } from "@/lib/research/protection";
import { checkWatchlist } from "@/lib/research/watchlists";
import { BoundedJsonError, clientNetworkIdentity, operationalLog, readBoundedJson, safeErrorCategory } from "@/lib/http-safety";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { watchlistId?: unknown } | null = null;
  try {
    body = await readBoundedJson<{ watchlistId?: unknown }>(request, 2_048);
  } catch (error) {
    if (error instanceof BoundedJsonError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body.watchlistId !== "string") return NextResponse.json({ error: "watchlistId is required." }, { status: 400 });
  const identifier = clientNetworkIdentity(request);
  const permit = await acquireProtection(`${identifier}:watchlist-check`, true);
  if (!permit.allowed) {
    operationalLog("warn", "watchlist_rate_limited", { reason: permit.reason, backend: permit.backend });
    return NextResponse.json({ error: "Research budget reached.", code: permit.reason.toUpperCase(), retryAfterSeconds: permit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(permit.retryAfterSeconds) } });
  }
  try {
    return NextResponse.json(await checkWatchlist(body.watchlistId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    operationalLog("error", "watchlist_check_failed", { category: safeErrorCategory(error) });
    return NextResponse.json({ error: "Watchlist check failed." }, { status: 502 });
  } finally { await permit.release(); }
}
