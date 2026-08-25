import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;
let reachability: { checkedAt: number; reachable: boolean } | null = null;

function credentials(env: NodeJS.ProcessEnv = process.env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function getDurableRedis(env: NodeJS.ProcessEnv = process.env): Redis | null {
  if (env !== process.env) {
    const value = credentials(env);
    return value ? new Redis({ ...value, enableTelemetry: false }) : null;
  }
  if (redis !== undefined) return redis;
  const value = credentials(env);
  redis = value ? new Redis({ ...value, enableTelemetry: false }) : null;
  return redis;
}

export function durableStoreConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return {
    configured: credentials(env) !== null,
    backend: credentials(env) ? "upstash-redis-rest" as const : "memory-or-local-files" as const,
    distributed: credentials(env) !== null,
    reachable: null as boolean | null,
  };
}

export async function durableStoreHealth(env: NodeJS.ProcessEnv = process.env) {
  const configuration = durableStoreConfiguration(env);
  if (!configuration.configured) return configuration;
  if (env !== process.env) return configuration;
  const now = Date.now();
  if (reachability && now - reachability.checkedAt < 30_000) return { ...configuration, reachable: reachability.reachable };
  const client = getDurableRedis(env);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const ping = client?.ping();
    if (!ping) return configuration;
    const value = await Promise.race([
      ping,
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Redis health check timed out")), 2_000); }),
    ]);
    reachability = { checkedAt: now, reachable: value === "PONG" || value === "OK" };
  } catch {
    reachability = { checkedAt: now, reachable: false };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  return { ...configuration, reachable: reachability.reachable };
}
