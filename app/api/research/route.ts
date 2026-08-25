import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/research/pipeline";
import { providerConfiguration, ResearchConfigurationError } from "@/lib/research/providers";
import { acquireProtection } from "@/lib/research/protection";
import { durableStoreConfiguration } from "@/lib/research/durable";

export const runtime = "nodejs";
export const maxDuration = 60;

export function GET() {
  return NextResponse.json({
    service: "Novelty Engine research API",
    schemaVersion: "2.0.0",
    provider: providerConfiguration(),
    accepts: { method: "POST", contentType: "application/json", body: { query: "string", bypassCache: "optional boolean" } },
  });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4_096) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  let body: { query?: unknown; bypassCache?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.query !== "string") return NextResponse.json({ error: "Body must include a string query." }, { status: 400 });
  if (process.env.VERCEL && !durableStoreConfiguration().distributed && process.env.MCP_ALLOW_INSTANCE_LOCAL_PUBLIC !== "true") {
    return NextResponse.json({ error: "Distributed rate limiting is required before public research is enabled on Vercel.", code: "DURABLE_PROTECTION_REQUIRED" }, { status: 503 });
  }
  const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const permit = await acquireProtection(`${identifier}:research-api`, true);
  if (!permit.allowed) return NextResponse.json({ error: "Research request limit or public budget reached.", code: permit.reason.toUpperCase(), retryAfterSeconds: permit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(permit.retryAfterSeconds) } });
  try {
    const result = await runResearch(body.query, { bypassCache: body.bypassCache === true });
    return NextResponse.json(result, { headers: { "X-RateLimit-Remaining": String(permit.remaining), "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ResearchConfigurationError) {
      return NextResponse.json({ error: error.message, code: "RESEARCH_NOT_CONFIGURED", requiredEnvironmentVariables: error.requiredEnvironmentVariables }, { status: 503 });
    }
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Research request failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research failed." }, { status: 502 });
  } finally {
    await permit.release();
  }
}
