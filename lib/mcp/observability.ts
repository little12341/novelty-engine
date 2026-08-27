import { AsyncLocalStorage } from "node:async_hooks";
import { durableStoreConfiguration, durableStoreHealth } from "../research/durable.ts";
import { protectionConfiguration } from "../research/protection.ts";
import { providerConfiguration } from "../research/providers.ts";
import { MCP_TOOL_CATALOG } from "./schemas.ts";

export interface McpCallRecord {
  requestId: string;
  at: string;
  tool: string;
  status: "success" | "error" | "rate_limited";
  durationMs: number;
  runId: string | null;
  provider: string | null;
  sourceCount: number | null;
  errorCode: string | null;
}

const globalState = globalThis as typeof globalThis & { __noveltyMcpCalls?: McpCallRecord[] };
const calls = globalState.__noveltyMcpCalls ??= [];
const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function withMcpRequestContext<T>(requestId: string, work: () => Promise<T>): Promise<T> {
  return requestContext.run({ requestId }, work);
}

export function currentMcpRequestId(): string {
  return requestContext.getStore()?.requestId ?? "internal";
}

export function recordMcpCall(record: Omit<McpCallRecord, "requestId"> & { requestId?: string }) {
  const safeRecord: McpCallRecord = { ...record, requestId: record.requestId ?? currentMcpRequestId() };
  calls.unshift(safeRecord);
  if (calls.length > 30) calls.length = 30;
  console.info("novelty_mcp_call", JSON.stringify(safeRecord));
}

export function mcpHealthSnapshot(env: NodeJS.ProcessEnv = process.env) {
  const storage = durableStoreConfiguration(env);
  const publicResearchEnabled = !env.VERCEL || storage.distributed || Boolean(env.NOVELTY_MCP_ACCESS_TOKEN) || env.MCP_ALLOW_INSTANCE_LOCAL_PUBLIC === "true";
  return {
    service: "Novelty Engine remote MCP",
    ok: true,
    endpoint: "/api/mcp",
    healthEndpoint: "/api/mcp/health",
    transport: "MCP Streamable HTTP (stateless; 2026-07-28 native with 2025-era compatibility)",
    toolContractVersion: "2.2.0",
    capabilities: { cancellation: true, pagination: true, partialResults: true, resumableRunRecords: true, requestDeduplication: true, progress: "transport-dependent" },
    toolCount: MCP_TOOL_CATALOG.length,
    tools: MCP_TOOL_CATALOG,
    provider: providerConfiguration(env),
    providerConfigured: providerConfiguration(env).configured,
    redisConfigured: storage.configured,
    redisReachable: storage.reachable,
    authentication: { mode: env.NOVELTY_MCP_ACCESS_TOKEN ? "bearer-token" : publicResearchEnabled ? "public-rate-limited" : "public-read-only-until-durable-protection", oauthReadyBoundary: true },
    publicResearchEnabled,
    protection: { ...protectionConfiguration(env), backend: storage.configured ? "upstash-redis-rest" : "memory", distributed: storage.configured },
    storage,
    recentCalls: calls.slice(0, 12),
    recentErrors: calls.filter((item) => item.status !== "success").slice(0, 8),
    secretsExposed: false,
  };
}

export async function mcpHealthSnapshotWithConnectivity() {
  const snapshot = mcpHealthSnapshot();
  const storage = await durableStoreHealth();
  return {
    ...snapshot,
    storage,
    redisReachable: storage.reachable,
    protection: { ...snapshot.protection, reachable: storage.reachable },
  };
}

export function clearMcpObservability() {
  calls.length = 0;
}
