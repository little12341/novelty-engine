import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { acquireProtection } from "../research/protection.ts";
import { durableStoreConfiguration } from "../research/durable.ts";
import { recordMcpCall, withMcpRequestContext } from "./observability.ts";
import { compareIdeasInput, falsifyOpportunityInput, rerunResearchInput, researchMarketInput, runResearchModeInput } from "./schemas.ts";

const COSTLY_TOOLS = new Set(["research_market", "falsify_opportunity", "run_research_mode", "compare_ideas", "rerun_research"]);
type McpPayload = { id?: unknown; method?: unknown; params?: { name?: unknown; arguments?: unknown } };

export function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown-ip";
  const client = request.headers.get("x-novelty-client-id")?.slice(0, 120) || "mcp-client";
  return `${ip}:${client}`;
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
      "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, x-novelty-client-id",
      "Access-Control-Expose-Headers": "mcp-protocol-version, mcp-session-id, retry-after, x-ratelimit-remaining",
      "Access-Control-Max-Age": "86400",
    } });
  }
  if (!bearerAuthorized(request)) {
    return jsonRpcError(null, 401, "Unauthorized Novelty Engine MCP request.", { code: "MCP_UNAUTHORIZED" }, { "WWW-Authenticate": "Bearer" });
  }
  if (request.method !== "POST") return handler(request);
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 16_384) return jsonRpcError(null, 413, "MCP request body is too large.", { code: "REQUEST_TOO_LARGE" });

  let payload: McpPayload | null = null;
  try {
    const body = await request.clone().text();
    if (new TextEncoder().encode(body).byteLength > 16_384) return jsonRpcError(null, 413, "MCP request body is too large.", { code: "REQUEST_TOO_LARGE" });
    payload = JSON.parse(body) as McpPayload;
  } catch {
    // Let the MCP protocol handler return its standard parse/validation error.
  }
  const tool = payload?.method === "tools/call" && typeof payload.params?.name === "string" ? payload.params.name : null;
  if (!tool) return handler(request);

  const validCostlyRequest = tool === "research_market" ? researchMarketInput.safeParse(payload?.params?.arguments).success
    : tool === "falsify_opportunity" ? falsifyOpportunityInput.safeParse(payload?.params?.arguments).success
      : tool === "run_research_mode" ? runResearchModeInput.safeParse(payload?.params?.arguments).success
        : tool === "compare_ideas" ? compareIdeasInput.safeParse(payload?.params?.arguments).success
          : tool === "rerun_research" ? rerunResearchInput.safeParse(payload?.params?.arguments).success
      : false;
  const costly = COSTLY_TOOLS.has(tool) && validCostlyRequest;
  const unsafePublicServerless = costly && Boolean(process.env.VERCEL) && !durableStoreConfiguration().distributed
    && !process.env.NOVELTY_MCP_ACCESS_TOKEN && process.env.MCP_ALLOW_INSTANCE_LOCAL_PUBLIC !== "true";
  if (unsafePublicServerless) {
    return jsonRpcError(payload?.id, 503, "Distributed rate limiting is required before public research is enabled on Vercel.", {
      code: "DURABLE_PROTECTION_REQUIRED", requiredEnvironmentVariables: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    });
  }
  const permit = await acquireProtection(`${requestIdentifier(request)}:${tool}`, costly);
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
  const response = await withMcpRequestContext(requestId, () => handleMcpHttpInner(request, handler));
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", "mcp-protocol-version, mcp-session-id, retry-after, x-ratelimit-remaining, x-request-id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
