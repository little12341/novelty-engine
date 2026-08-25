import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResearchResult } from "./types.ts";
import { querySimilarity } from "./normalize.ts";
import { getDurableRedis } from "./durable.ts";

interface CacheEntry { result: ResearchResult; expiresAt: number }

const globalState = globalThis as typeof globalThis & { __noveltyResearchCache?: Map<string, CacheEntry> };
const memoryCache = globalState.__noveltyResearchCache ??= new Map<string, CacheEntry>();

function hasCurrentShape(result: ResearchResult): boolean {
  return Array.isArray(result.finalOpportunities) && Array.isArray(result.opportunityGraph?.nodes) && Array.isArray(result.falsificationResults);
}

function cacheKey(canonicalQuery: string, providerId: string): string {
  return createHash("sha256").update(`${providerId}:${canonicalQuery}`).digest("hex");
}

const runKey = (id: string) => `novelty:research:run:${id}`;
const durableCacheKey = (key: string) => `novelty:research:cache:${key}`;

function runsDirectory(): string | null {
  if (process.env.RESEARCH_RUNS_DIR) return path.resolve(process.env.RESEARCH_RUNS_DIR);
  if (process.env.VERCEL) return null;
  return path.join(process.cwd(), ".research-runs");
}

export async function findCachedResearch(canonicalQuery: string, providerId: string, ttlSeconds: number): Promise<ResearchResult | null> {
  const now = Date.now();
  const exactKey = cacheKey(canonicalQuery, providerId);
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
      continue;
    }
    if (hasCurrentShape(entry.result) && (key === exactKey || (entry.result.provider.id === providerId && querySimilarity(canonicalQuery, entry.result.canonicalQuery) >= 0.88))) {
      return structuredClone(entry.result);
    }
  }

  const durable = getDurableRedis();
  if (durable) {
    try {
      const stored = await durable.get<ResearchResult>(durableCacheKey(exactKey));
      if (stored && hasCurrentShape(stored)) {
        memoryCache.set(exactKey, { result: stored, expiresAt: now + ttlSeconds * 1000 });
        return structuredClone(stored);
      }
    } catch (error) {
      console.error("Durable research cache lookup failed", error instanceof Error ? error.message : "unknown error");
    }
  }

  const directory = runsDirectory();
  if (!directory) return null;
  try {
    const stored = JSON.parse(await readFile(path.join(directory, `cache-${exactKey}.json`), "utf8")) as ResearchResult;
    const age = now - new Date(stored.completedAt).getTime();
    if (age <= ttlSeconds * 1000 && hasCurrentShape(stored)) {
      memoryCache.set(exactKey, { result: stored, expiresAt: now + ttlSeconds * 1000 - age });
      return structuredClone(stored);
    }
  } catch {
    // A cache miss or malformed local file must never become fabricated evidence.
  }
  return null;
}

export async function saveResearchResult(result: ResearchResult, ttlSeconds: number): Promise<{ durable: boolean }> {
  const key = cacheKey(result.canonicalQuery, result.provider.id);
  memoryCache.set(key, { result: structuredClone(result), expiresAt: Date.now() + ttlSeconds * 1000 });
  const durable = getDurableRedis();
  if (durable) {
    try {
      await Promise.all([
        durable.set(runKey(result.id), result, { ex: ttlSeconds }),
        durable.set(durableCacheKey(key), result, { ex: ttlSeconds }),
      ]);
      return { durable: true };
    } catch (error) {
      console.error("Durable research save failed", error instanceof Error ? error.message : "unknown error");
    }
  }
  const directory = runsDirectory();
  if (!directory) return { durable: false };
  await mkdir(directory, { recursive: true });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  await Promise.all([
    writeFile(path.join(directory, `${result.id}.json`), serialized, { flag: "wx" }),
    writeFile(path.join(directory, `cache-${key}.json`), serialized),
  ]);
  return { durable: true };
}

export async function getResearchResultById(id: string): Promise<ResearchResult | null> {
  if (!/^research_[a-zA-Z0-9_]{8,80}$/.test(id)) return null;
  for (const entry of memoryCache.values()) {
    if (entry.result.id === id && hasCurrentShape(entry.result)) return structuredClone(entry.result);
  }
  const durable = getDurableRedis();
  if (durable) {
    try {
      const stored = await durable.get<ResearchResult>(runKey(id));
      if (stored && hasCurrentShape(stored)) return structuredClone(stored);
    } catch (error) {
      console.error("Durable research run lookup failed", error instanceof Error ? error.message : "unknown error");
    }
  }
  const directory = runsDirectory();
  if (!directory) return null;
  try {
    const stored = JSON.parse(await readFile(path.join(directory, `${id}.json`), "utf8")) as ResearchResult;
    return hasCurrentShape(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function clearMemoryResearchCache(): void {
  memoryCache.clear();
}
