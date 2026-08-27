import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runResearch } from "@/lib/research/pipeline";
import { publicProviderConfiguration, ResearchConfigurationError } from "@/lib/research/providers";
import { acquireProtection } from "@/lib/research/protection";
import { durableStoreConfiguration } from "@/lib/research/durable";
import { RESEARCH_ENGINE_VERSION, RESEARCH_SCHEMA_VERSION } from "@/lib/research/types";
import type { ResearchMode, ResearchUserContext } from "@/lib/research/types";
import { CLAUDE_COMMAND_ROUTES, NOVELTY_COMMAND_CATALOG, NoveltyCommandError, parseResearchIntent, RESEARCH_COMMANDS } from "@/lib/research/intents";
import { compareIdeas } from "@/lib/research/comparison";
import { getResearchMemory, mergeResearchContext } from "@/lib/research/memory";
import { sanitizeFounderContext } from "@/lib/research/founder-fit";
import { BoundedJsonError, clientNetworkIdentity, operationalLog, readBoundedJson, safeErrorCategory } from "@/lib/http-safety";

export const runtime = "nodejs";
export const maxDuration = 120;

export function GET() {
  return NextResponse.json({
    service: "Novelty Engine research API",
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    engineVersion: RESEARCH_ENGINE_VERSION,
    provider: publicProviderConfiguration(),
    commands: RESEARCH_COMMANDS,
    commandRoutes: CLAUDE_COMMAND_ROUTES,
    commandCatalog: NOVELTY_COMMAND_CATALOG,
    accepts: { method: "POST", contentType: "application/json", body: { query: "string", mode: "optional ResearchMode", depth: "optional fast|standard|deep", ideas: "2-5 strings for compare_ideas", bypassCache: "optional boolean", memoryProfileId: "optional explicit opt-in profile", userContext: "optional current-run founder constraints" } },
  });
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-vercel-id")?.slice(0, 160) || randomUUID();
  let body: { query?: unknown; mode?: unknown; depth?: unknown; ideas?: unknown; bypassCache?: unknown; memoryProfileId?: unknown; userId?: unknown; userContext?: unknown };
  try {
    body = await readBoundedJson<typeof body>(request, 4_096);
  } catch (error) {
    const bounded = error instanceof BoundedJsonError ? error : new BoundedJsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
    return NextResponse.json({ error: bounded.message, code: bounded.code }, { status: bounded.status, headers: { "X-Request-Id": requestId } });
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
  const identifier = clientNetworkIdentity(request);
  const permit = await acquireProtection(`${identifier}:research-api`, true);
  if (!permit.allowed) {
    operationalLog("warn", "research_rate_limited", { requestId, reason: permit.reason, backend: permit.backend });
    return NextResponse.json({ error: "Research request limit or public budget reached.", code: permit.reason.toUpperCase(), retryAfterSeconds: permit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(permit.retryAfterSeconds), "X-Request-Id": requestId } });
  }
  try {
    if (body.mode === "compare_ideas" || Array.isArray(body.ideas)) {
      const comparison = await compareIdeas(body.ideas as string[]);
      return NextResponse.json(comparison, { headers: { "X-RateLimit-Remaining": String(permit.remaining), "X-Request-Id": requestId, "Cache-Control": "private, no-store" } });
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
    return NextResponse.json(result, { headers: { "X-RateLimit-Remaining": String(permit.remaining), "X-Request-Id": requestId, "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof NoveltyCommandError) {
      return NextResponse.json({ error: error.message, code: error.code, command: error.command, suggestions: error.suggestions }, { status: 400 });
    }
    if (error instanceof ResearchConfigurationError) {
      return NextResponse.json({ error: error.message, code: "RESEARCH_NOT_CONFIGURED", requiredEnvironmentVariables: error.requiredEnvironmentVariables }, { status: 503 });
    }
    if (error instanceof RangeError || error instanceof SyntaxError) return NextResponse.json({ error: error.message, code: "INVALID_QUERY" }, { status: 400 });
    const category = safeErrorCategory(error);
    operationalLog("error", "research_request_failed", { requestId, category });
    return NextResponse.json({ error: "Research failed. Use the request ID to find the privacy-safe server log.", code: category === "RATE_LIMIT" ? "RESEARCH_PROVIDER_RATE_LIMIT" : "RESEARCH_PROVIDER_ERROR", requestId }, { status: 502, headers: { "X-Request-Id": requestId } });
  } finally {
    await permit.release();
  }
}
