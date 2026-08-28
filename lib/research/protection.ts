import { createHash } from "node:crypto";
import { getDurableRedis } from "./durable.ts";
import { operationalLog, safeErrorCategory } from "../http-safety.ts";

type Counter = { count: number; resetsAt: number };
type ProtectionState = {
  hourly: Map<string, Counter>;
  daily: Map<string, Counter>;
  monthly: Map<string, Counter>;
  userDaily: Map<string, Counter>;
  userMonthly: Map<string, Counter>;
  concurrent: number;
};

const globalState = globalThis as typeof globalThis & { __noveltyProtection?: ProtectionState };
const state = globalState.__noveltyProtection ??= {
  hourly: new Map(), daily: new Map(), monthly: new Map(), userDaily: new Map(), userMonthly: new Map(), concurrent: 0,
};
state.userDaily ??= new Map(); state.userMonthly ??= new Map();

const boundedInt = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function protectionConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return {
    perClientPerHour: boundedInt(env.MCP_RATE_LIMIT_PER_HOUR ?? env.RESEARCH_RATE_LIMIT_PER_HOUR, 20, 1, 200),
    perClientDailyResearch: boundedInt(env.RESEARCH_PER_USER_DAILY_LIMIT, 10, 1, 1_000),
    perClientMonthlyResearch: boundedInt(env.RESEARCH_PER_USER_MONTHLY_LIMIT, 100, 1, 10_000),
    globalDailyResearch: boundedInt(env.MCP_GLOBAL_DAILY_RESEARCH_LIMIT, 50, 1, 10_000),
    globalMonthlyResearch: boundedInt(env.MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT, 500, 1, 100_000),
    maxConcurrentResearch: boundedInt(env.MCP_MAX_CONCURRENT_RESEARCH, 2, 1, 20),
    concurrencyLeaseSeconds: boundedInt(env.MCP_CONCURRENCY_LEASE_SECONDS, 90, 30, 300),
  };
}

export type ProtectionDenial = "rate_limit" | "user_daily_budget" | "user_monthly_budget" | "daily_budget" | "monthly_budget" | "concurrency";
export type ProtectionClass = "read" | "compute" | "provider";
export type ProtectionPermit = {
  allowed: true;
  remaining: number;
  backend: "upstash-redis-rest" | "memory";
  release: () => Promise<void>;
} | {
  allowed: false;
  reason: ProtectionDenial;
  retryAfterSeconds: number;
  backend: "upstash-redis-rest" | "memory";
};

const redisAcquireScript = `
local hourly = tonumber(redis.call('GET', KEYS[1]) or '0')
if hourly >= tonumber(ARGV[1]) then return {'rate_limit', redis.call('TTL', KEYS[1])} end
local mode = ARGV[9]
local providerCost = mode == 'provider'
local concurrentWork = providerCost or mode == 'compute'
if providerCost then
  local userDaily = tonumber(redis.call('GET', KEYS[5]) or '0')
  if userDaily >= tonumber(ARGV[10]) then return {'user_daily_budget', redis.call('TTL', KEYS[5])} end
  local userMonthly = tonumber(redis.call('GET', KEYS[6]) or '0')
  if userMonthly >= tonumber(ARGV[11]) then return {'user_monthly_budget', redis.call('TTL', KEYS[6])} end
  local daily = tonumber(redis.call('GET', KEYS[2]) or '0')
  if daily >= tonumber(ARGV[2]) then return {'daily_budget', redis.call('TTL', KEYS[2])} end
  local monthly = tonumber(redis.call('GET', KEYS[3]) or '0')
  if monthly >= tonumber(ARGV[3]) then return {'monthly_budget', redis.call('TTL', KEYS[3])} end
end
if concurrentWork then
  local concurrent = tonumber(redis.call('GET', KEYS[4]) or '0')
  if concurrent >= tonumber(ARGV[4]) then return {'concurrency', math.max(1, redis.call('TTL', KEYS[4]))} end
end
local h = redis.call('INCR', KEYS[1])
if h == 1 then redis.call('EXPIRE', KEYS[1], ARGV[5]) end
if providerCost then
  local ud = redis.call('INCR', KEYS[5]); if ud == 1 then redis.call('EXPIRE', KEYS[5], ARGV[6]) end
  local um = redis.call('INCR', KEYS[6]); if um == 1 then redis.call('EXPIRE', KEYS[6], ARGV[7]) end
  local d = redis.call('INCR', KEYS[2]); if d == 1 then redis.call('EXPIRE', KEYS[2], ARGV[6]) end
  local m = redis.call('INCR', KEYS[3]); if m == 1 then redis.call('EXPIRE', KEYS[3], ARGV[7]) end
end
if concurrentWork then
  local c = redis.call('INCR', KEYS[4]); if c == 1 then redis.call('EXPIRE', KEYS[4], ARGV[8]) end
end
return {'ok', tonumber(ARGV[1]) - h}
`;

const redisReleaseScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current <= 1 then redis.call('DEL', KEYS[1]); return 0 end
return redis.call('DECR', KEYS[1])
`;

function windows(now: number) {
  const date = new Date(now);
  const hourEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours() + 1);
  const dayEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  const monthEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return {
    hourKey: date.toISOString().slice(0, 13), dayKey: date.toISOString().slice(0, 10), monthKey: date.toISOString().slice(0, 7),
    hourSeconds: Math.max(1, Math.ceil((hourEnd - now) / 1000)),
    daySeconds: Math.max(1, Math.ceil((dayEnd - now) / 1000)),
    monthSeconds: Math.max(1, Math.ceil((monthEnd - now) / 1000)),
    hourEnd, dayEnd, monthEnd,
  };
}

function identifierHash(identifier: string) {
  return createHash("sha256").update(identifier.slice(0, 300)).digest("hex").slice(0, 24);
}

function consume(bucket: Map<string, Counter>, key: string, limit: number, resetsAt: number, now: number): { allowed: boolean; remaining: number } {
  const existing = bucket.get(key);
  const current = !existing || existing.resetsAt <= now ? { count: 0, resetsAt } : existing;
  if (current.count >= limit) return { allowed: false, remaining: 0 };
  current.count += 1;
  bucket.set(key, current);
  return { allowed: true, remaining: limit - current.count };
}

function available(bucket: Map<string, Counter>, key: string, limit: number, now: number) {
  const existing = bucket.get(key);
  return !existing || existing.resetsAt <= now || existing.count < limit;
}

export async function acquireProtection(identifier: string, protection: boolean | ProtectionClass, now = Date.now()): Promise<ProtectionPermit> {
  const protectionClass: ProtectionClass = typeof protection === "boolean" ? protection ? "provider" : "read" : protection;
  const providerCost = protectionClass === "provider";
  const concurrentWork = protectionClass === "provider" || protectionClass === "compute";
  const config = protectionConfiguration();
  const window = windows(now);
  const identity = identifierHash(identifier || "anonymous");
  const redis = getDurableRedis();
  if (redis) {
    const keys = [
      `novelty:limit:hour:${window.hourKey}:${identity}`,
      `novelty:budget:day:${window.dayKey}`,
      `novelty:budget:month:${window.monthKey}`,
      "novelty:concurrent:research",
      `novelty:budget:user-day:${window.dayKey}:${identity}`,
      `novelty:budget:user-month:${window.monthKey}:${identity}`,
    ];
    try {
      const raw = await redis.eval(redisAcquireScript, keys, [
        config.perClientPerHour, config.globalDailyResearch, config.globalMonthlyResearch,
        config.maxConcurrentResearch, window.hourSeconds, window.daySeconds, window.monthSeconds,
        config.concurrencyLeaseSeconds, protectionClass,
        config.perClientDailyResearch, config.perClientMonthlyResearch,
      ]) as [string, number];
      if (raw[0] !== "ok") {
        return { allowed: false, reason: raw[0] as ProtectionDenial, retryAfterSeconds: Math.max(1, Number(raw[1]) || 1), backend: "upstash-redis-rest" };
      }
      return {
        allowed: true, remaining: Number(raw[1]), backend: "upstash-redis-rest",
        release: concurrentWork ? async () => { await redis.eval(redisReleaseScript, [keys[3]], []); } : async () => {},
      };
    } catch (error) {
      operationalLog("error", "distributed_protection_unavailable", { category: safeErrorCategory(error), protectionClass });
      if (concurrentWork) return { allowed: false, reason: "concurrency", retryAfterSeconds: 30, backend: "upstash-redis-rest" };
      // Read-only requests may use the conservative instance-local limiter when Redis has a transient fault.
    }
  }

  const hourly = consume(state.hourly, `${window.hourKey}:${identity}`, config.perClientPerHour, window.hourEnd, now);
  if (!hourly.allowed) return { allowed: false, reason: "rate_limit", retryAfterSeconds: window.hourSeconds, backend: "memory" };
  if (concurrentWork) {
    if (state.concurrent >= config.maxConcurrentResearch) return { allowed: false, reason: "concurrency", retryAfterSeconds: 30, backend: "memory" };
  }
  if (providerCost) {
    if (!available(state.userDaily, `${window.dayKey}:${identity}`, config.perClientDailyResearch, now)) return { allowed: false, reason: "user_daily_budget", retryAfterSeconds: window.daySeconds, backend: "memory" };
    if (!available(state.userMonthly, `${window.monthKey}:${identity}`, config.perClientMonthlyResearch, now)) return { allowed: false, reason: "user_monthly_budget", retryAfterSeconds: window.monthSeconds, backend: "memory" };
    if (!available(state.daily, window.dayKey, config.globalDailyResearch, now)) return { allowed: false, reason: "daily_budget", retryAfterSeconds: window.daySeconds, backend: "memory" };
    if (!available(state.monthly, window.monthKey, config.globalMonthlyResearch, now)) return { allowed: false, reason: "monthly_budget", retryAfterSeconds: window.monthSeconds, backend: "memory" };
    consume(state.daily, window.dayKey, config.globalDailyResearch, window.dayEnd, now);
    consume(state.monthly, window.monthKey, config.globalMonthlyResearch, window.monthEnd, now);
    consume(state.userDaily, `${window.dayKey}:${identity}`, config.perClientDailyResearch, window.dayEnd, now);
    consume(state.userMonthly, `${window.monthKey}:${identity}`, config.perClientMonthlyResearch, window.monthEnd, now);
  }
  if (concurrentWork) state.concurrent += 1;
  let released = false;
  return {
    allowed: true, remaining: hourly.remaining, backend: "memory",
    release: async () => {
      if (concurrentWork && !released) { state.concurrent = Math.max(0, state.concurrent - 1); released = true; }
    },
  };
}

export function clearMemoryProtection(): void {
  state.hourly.clear(); state.daily.clear(); state.monthly.clear(); state.userDaily.clear(); state.userMonthly.clear(); state.concurrent = 0;
}
