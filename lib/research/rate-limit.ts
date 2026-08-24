interface Bucket { count: number; resetsAt: number }
const state = globalThis as typeof globalThis & { __noveltyRateLimits?: Map<string, Bucket> };
const buckets = state.__noveltyRateLimits ??= new Map<string, Bucket>();

export function consumeResearchLimit(identifier: string, now = Date.now()): { allowed: boolean; remaining: number; resetsAt: number } {
  const configured = Number.parseInt(process.env.RESEARCH_RATE_LIMIT_PER_HOUR ?? "10", 10);
  const limit = Number.isFinite(configured) ? Math.min(100, Math.max(1, configured)) : 10;
  const existing = buckets.get(identifier);
  const bucket = !existing || existing.resetsAt <= now ? { count: 0, resetsAt: now + 3_600_000 } : existing;
  if (bucket.count >= limit) return { allowed: false, remaining: 0, resetsAt: bucket.resetsAt };
  bucket.count += 1;
  buckets.set(identifier, bucket);
  return { allowed: true, remaining: limit - bucket.count, resetsAt: bucket.resetsAt };
}
