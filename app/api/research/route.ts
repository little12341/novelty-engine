import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/research/pipeline";
import { providerConfiguration, ResearchConfigurationError } from "@/lib/research/providers";
import { consumeResearchLimit } from "@/lib/research/rate-limit";

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
  const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const rate = consumeResearchLimit(identifier);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Research request limit reached. Try again after the reset time.", resetsAt: new Date(rate.resetsAt).toISOString() }, { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetsAt - Date.now()) / 1000)) } });
  }
  try {
    const body = await request.json() as { query?: unknown; bypassCache?: unknown };
    if (typeof body.query !== "string") return NextResponse.json({ error: "Body must include a string query." }, { status: 400 });
    const result = await runResearch(body.query, { bypassCache: body.bypassCache === true });
    return NextResponse.json(result, { headers: { "X-RateLimit-Remaining": String(rate.remaining), "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ResearchConfigurationError) {
      return NextResponse.json({ error: error.message, code: "RESEARCH_NOT_CONFIGURED", requiredEnvironmentVariables: error.requiredEnvironmentVariables }, { status: 503 });
    }
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Research request failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research failed." }, { status: 502 });
  }
}
