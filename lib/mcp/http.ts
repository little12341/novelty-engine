import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { clientNetworkIdentity } from "../http-safety.ts";
import { acquireProtection } from "../research/protection.ts";
import { durableStoreConfiguration } from "../research/durable.ts";
import { privateIdentity } from "../research/platform-store.ts";
import { recordMcpCall, withMcpRequestContext } from "./observability.ts";
import { addSourcesToRunInput, compareIdeasInput, compareRunCandidatesInput, falsifyOpportunityInput, inspectCompetitorsInput, rerunResearchInput, researchFromSourcesInput, researchMarketInput, runResearchModeInput } from "./schemas.ts";
import { getResearchResultById } from "../research/store.ts";
import { hostedSearchEnabled } from "../research/providers.ts";

const PROVIDER_TOOLS = new Set(["research_market", "inspect_competitors", "falsify_opportunity", "run_research_mode", "compare_ideas", "rerun_research", "compare_run_candidates"]);
const COMPUTE_TOOLS = new Set(["research_from_sources", "add_sources_to_run"]);
const DEFAULT_BODY_LIMIT = 16_384;
const SUPPLIED_SOURCE_BODY_LIMIT = 262_144;
type McpPayload = { id?: unknown; method?: unknown; params?: { name?: unknown; arguments?: unknown } };

export function requestIdentifier(request: Request): string {
  return clientNetworkIdentity(request);
}

function bearerAuthorized(request: Request): boolean {
  const expected = process.env.NOVELTY_MCP_ACCESS_TOKEN;
  if (!expected) return true;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const left = createHash("sha256").update(supplied).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function jsonRpcError(id: unknown, status: number, message: string, data?: Record<string, unknown>, headers?: HeadersInit) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code: status === 429 ? -32029 : -32001, message, data } }, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

async function handleMcpHttpInner(request: Request, handler: (request: Request) => Promise<Response>): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
      "Access-Control-Expose-Headers": "mcp-protocol-version, mcp-session-id, retry-after, x-ratelimit-remaining",
      "Access-Control-Max-Age": "86400",
    } });
  }
  if (!bearerAuthorized(request)) {
    return jsonRpcError(null, 401, "Unauthorized Novelty Engine MCP request.", { code: "MCP_UNAUTHORIZED" }, { "WWW-Authenticate": "Bearer" });
  }
  if (request.method !== "POST") return handler(request);
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > SUPPLIED_SOURCE_BODY_LIMIT) return jsonRpcError(null, 413, "MCP request body is too large.", { code: "REQUEST_TOO_LARGE" });

  let payload: McpPayload | null = null;
  let bodyBytes = 0;
  try {
    const body = await request.clone().text();
    bodyBytes = new TextEncoder().encode(body).byteLength;
    if (bodyBytes > SUPPLIED_SOURCE_BODY_LIMIT) return jsonRpcError(null, 413, "MCP request body is too large.", { code: "REQUEST_TOO_LARGE" });
    payload = JSON.parse(body) as McpPayload;
  } catch {
    // Let the MCP protocol handler return its standard parse/validation error.
  }
  const tool = payload?.method === "tools/call" && typeof payload.params?.name === "string" ? payload.params.name : null;
  if (!tool) return bodyBytes > DEFAULT_BODY_LIMIT
    ? jsonRpcError(payload?.id, 413, "MCP request body is too large.", { code: "REQUEST_TOO_LARGE" })
    : handler(request);
  if (!COMPUTE_TOOLS.has(tool) && bodyBytes > DEFAULT_BODY_LIMIT) return jsonRpcError(payload?.id, 413, "MCP request body is too large.", { code: "REQUEST_TOO_LARGE" });

  const validProtectedRequest = tool === "research_market" ? researchMarketInput.safeParse(payload?.params?.arguments).success
    : tool === "inspect_competitors" ? (() => { const parsed = inspectCompetitorsInput.safeParse(payload?.params?.arguments); return parsed.success && parsed.data.fresh_expand; })()
    : tool === "falsify_opportunity" ? falsifyOpportunityInput.safeParse(payload?.params?.arguments).success
      : tool === "run_research_mode" ? runResearchModeInput.safeParse(payload?.params?.arguments).success
        : tool === "compare_ideas" ? compareIdeasInput.safeParse(payload?.params?.arguments).success
          : tool === "rerun_research" ? rerunResearchInput.safeParse(payload?.params?.arguments).success
            : tool === "compare_run_candidates" ? (() => { const parsed = compareRunCandidatesInput.safeParse(payload?.params?.arguments); return parsed.success && parsed.data.fresh_expand; })()
              : tool === "research_from_sources" ? researchFromSourcesInput.safeParse(payload?.params?.arguments).success
                : tool === "add_sources_to_run" ? addSourcesToRunInput.safeParse(payload?.params?.arguments).success
      : false;
  const args = payload?.params?.arguments as Record<string, unknown> | undefined;
  const runSensitive = new Set(["inspect_competitors", "falsify_opportunity", "rerun_research", "compare_run_candidates"]);
  const baseline = runSensitive.has(tool) && typeof args?.run_id === "string" ? await getResearchResultById(args.run_id) : null;
  const hostedAllowed = hostedSearchEnabled();
  const providerIntended = hostedAllowed && (
    tool === "research_market" || tool === "run_research_mode" || tool === "compare_ideas"
    || tool === "falsify_opportunity" && (!baseline || baseline.retrievalMode === "hosted")
    || tool === "inspect_competitors" && args?.fresh_expand === true && baseline?.retrievalMode !== "supplied_sources"
    || tool === "compare_run_candidates" && args?.fresh_expand === true && baseline?.retrievalMode !== "supplied_sources"
    || tool === "rerun_research" && (args?.retrieval_mode === "hosted" || args?.retrieval_mode !== "hosted" && baseline?.retrievalMode !== "supplied_sources")
  );
  const protectionClass = validProtectedRequest && COMPUTE_TOOLS.has(tool) ? "compute" as const
    : validProtectedRequest && PROVIDER_TOOLS.has(tool) ? providerIntended ? "provider" as const : "compute" as const : "read" as const;
  const unsafePublicServerless = protectionClass !== "read" && Boolean(process.env.VERCEL) && !durableStoreConfiguration().distributed
    && !process.env.NOVELTY_MCP_ACCESS_TOKEN && process.env.MCP_ALLOW_INSTANCE_LOCAL_PUBLIC !== "true";
  if (unsafePublicServerless) {
    return jsonRpcError(payload?.id, 503, "Distributed rate limiting is required before public research is enabled on Vercel.", {
      code: "DURABLE_PROTECTION_REQUIRED", requiredEnvironmentVariables: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    });
  }
  const permit = await acquireProtection(`${requestIdentifier(request)}:${tool}`, protectionClass);
  if (!permit.allowed) {
    const message = permit.reason === "rate_limit" ? "Per-client MCP request limit reached."
      : permit.reason === "user_daily_budget" ? "This client's daily research quota is exhausted."
        : permit.reason === "user_monthly_budget" ? "This client's monthly research quota is exhausted."
      : permit.reason === "daily_budget" ? "Novelty Engine's global daily research budget is exhausted."
        : permit.reason === "monthly_budget" ? "Novelty Engine's global monthly research budget is exhausted."
          : "Novelty Engine is already running the maximum number of concurrent research jobs.";
    recordMcpCall({ at: new Date().toISOString(), tool, status: "rate_limited", durationMs: 0, runId: null, provider: null, sourceCount: null, errorCode: permit.reason.toUpperCase() });
    return jsonRpcError(payload?.id, 429, message, {
      code: permit.reason.toUpperCase(), retryAfterSeconds: permit.retryAfterSeconds,
      protectionBackend: permit.backend,
    }, { "Retry-After": String(permit.retryAfterSeconds) });
  }
  try {
    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-RateLimit-Remaining", String(permit.remaining));
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } finally {
    await permit.release();
  }
}

export async function handleMcpHttp(request: Request, handler: (request: Request) => Promise<Response>): Promise<Response> {
  const requestId = request.headers.get("x-vercel-id")?.slice(0, 160) || randomUUID();
  const ownerScope = privateIdentity(`research:${requestIdentifier(request)}`);
  const response = await withMcpRequestContext(requestId, ownerScope, () => handleMcpHttpInner(request, handler));
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", "mcp-protocol-version, mcp-session-id, retry-after, x-ratelimit-remaining, x-request-id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
