import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/research/pipeline";
import { providerConfiguration, ResearchConfigurationError } from "@/lib/research/providers";
import { acquireProtection } from "@/lib/research/protection";
import { durableStoreConfiguration } from "@/lib/research/durable";
import { RESEARCH_ENGINE_VERSION, RESEARCH_SCHEMA_VERSION } from "@/lib/research/types";
import type { ResearchMode, ResearchUserContext } from "@/lib/research/types";
import { CLAUDE_COMMAND_ROUTES, NOVELTY_COMMAND_CATALOG, NoveltyCommandError, parseResearchIntent, RESEARCH_COMMANDS } from "@/lib/research/intents";
import { compareIdeas } from "@/lib/research/comparison";
import { getResearchMemory, mergeResearchContext } from "@/lib/research/memory";
import { sanitizeFounderContext } from "@/lib/research/founder-fit";

export const runtime = "nodejs";
export const maxDuration = 120;

export function GET() {
  return NextResponse.json({
    service: "Novelty Engine research API",
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    engineVersion: RESEARCH_ENGINE_VERSION,
    provider: providerConfiguration(),
    commands: RESEARCH_COMMANDS,
    commandRoutes: CLAUDE_COMMAND_ROUTES,
    commandCatalog: NOVELTY_COMMAND_CATALOG,
    accepts: { method: "POST", contentType: "application/json", body: { query: "string", mode: "optional ResearchMode", depth: "optional fast|standard|deep", ideas: "2-5 strings for compare_ideas", bypassCache: "optional boolean", memoryProfileId: "optional explicit opt-in profile", userContext: "optional current-run founder constraints" } },
  });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4_096) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  let body: { query?: unknown; mode?: unknown; depth?: unknown; ideas?: unknown; bypassCache?: unknown; memoryProfileId?: unknown; userId?: unknown; userContext?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request body must be valid JSON." }, { status: 400 });
  }
  const validModes = new Set<ResearchMode>(Object.values(RESEARCH_COMMANDS));
  if (body.mode !== undefined && (typeof body.mode !== "string" || !validModes.has(body.mode as ResearchMode))) return NextResponse.json({ error: "Unsupported research mode." }, { status: 400 });
  if (body.mode === "compare_ideas" || Array.isArray(body.ideas)) {
    if (!Array.isArray(body.ideas) || body.ideas.some((item) => typeof item !== "string")) return NextResponse.json({ error: "compare_ideas requires an ideas array containing 2–5 strings." }, { status: 400 });
  } else if (typeof body.query !== "string") return NextResponse.json({ error: "Body must include a string query." }, { status: 400 });
  if (body.depth !== undefined && !["fast", "standard", "deep"].includes(String(body.depth))) return NextResponse.json({ error: "depth must be fast, standard, or deep." }, { status: 400 });
  if (process.env.VERCEL && !durableStoreConfiguration().distributed && process.env.MCP_ALLOW_INSTANCE_LOCAL_PUBLIC !== "true") {
    return NextResponse.json({ error: "Distributed rate limiting is required before public research is enabled on Vercel.", code: "DURABLE_PROTECTION_REQUIRED" }, { status: 503 });
  }
  const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const permit = await acquireProtection(`${identifier}:research-api`, true);
  if (!permit.allowed) return NextResponse.json({ error: "Research request limit or public budget reached.", code: permit.reason.toUpperCase(), retryAfterSeconds: permit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(permit.retryAfterSeconds) } });
  try {
    if (body.mode === "compare_ideas" || Array.isArray(body.ideas)) {
      const comparison = await compareIdeas(body.ideas as string[]);
      return NextResponse.json(comparison, { headers: { "X-RateLimit-Remaining": String(permit.remaining), "Cache-Control": "private, no-store" } });
    }
    const intent = parseResearchIntent(body.query as string, body.mode as ResearchMode | undefined);
    if (intent.mode === "compare_ideas") return NextResponse.json({ error: "The /compare-ideas command requires the structured ideas array." }, { status: 400 });
    let memory = null;
    if (typeof body.memoryProfileId === "string") {
      if (typeof body.userId !== "string") return NextResponse.json({ error: "Explicit userId is required to use an opt-in memory profile." }, { status: 400 });
      memory = await getResearchMemory(body.memoryProfileId, body.userId);
      if (!memory) return NextResponse.json({ error: "Memory profile was not found for this user." }, { status: 404 });
    }
    const userContext = sanitizeFounderContext(body.userContext) as ResearchUserContext | undefined;
    const result = await runResearch(intent.query, { bypassCache: body.bypassCache === true, mode: intent.mode, depth: body.depth as "fast" | "standard" | "deep" | undefined, userContext: mergeResearchContext(memory, userContext), signal: request.signal });
    return NextResponse.json(result, { headers: { "X-RateLimit-Remaining": String(permit.remaining), "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof NoveltyCommandError) {
      return NextResponse.json({ error: error.message, code: error.code, command: error.command, suggestions: error.suggestions }, { status: 400 });
    }
    if (error instanceof ResearchConfigurationError) {
      return NextResponse.json({ error: error.message, code: "RESEARCH_NOT_CONFIGURED", requiredEnvironmentVariables: error.requiredEnvironmentVariables }, { status: 503 });
    }
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message, code: "INVALID_QUERY" }, { status: 400 });
    console.error("Research request failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research failed." }, { status: 502 });
  } finally {
    await permit.release();
  }
}
