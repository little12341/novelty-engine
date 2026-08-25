import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDurableRedis } from "./durable.ts";

export type PlatformNamespace = "memory" | "feedback" | "watchlists" | "changes" | "comparisons";

const safe = (value: string) => /^[a-zA-Z0-9_-]{3,120}$/.test(value);
const key = (namespace: PlatformNamespace, id: string) => `novelty:platform:${namespace}:${id}`;
const indexKey = (namespace: PlatformNamespace) => `novelty:platform:${namespace}:index`;

function directory(namespace: PlatformNamespace): string | null {
  if (process.env.VERCEL) return null;
  const root = process.env.RESEARCH_RUNS_DIR ? path.resolve(process.env.RESEARCH_RUNS_DIR) : path.join(process.cwd(), ".research-runs");
  return path.join(root, "platform", namespace);
}

export function privateIdentity(value: string): string {
  return `usr_${createHash("sha256").update(value.slice(0, 300)).digest("hex").slice(0, 20)}`;
}

export async function putPlatformRecord<T>(namespace: PlatformNamespace, id: string, value: T, score = Date.now()): Promise<{ durable: boolean }> {
  if (!safe(id)) throw new RangeError("Invalid platform record ID.");
  const redis = getDurableRedis();
  if (redis) {
    await Promise.all([
      redis.set(key(namespace, id), value),
      redis.zadd(indexKey(namespace), { score, member: id }),
    ]);
    return { durable: true };
  }
  const target = directory(namespace);
  if (!target) return { durable: false };
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, `${id}.json`), `${JSON.stringify(value, null, 2)}\n`);
  return { durable: true };
}

export async function getPlatformRecord<T>(namespace: PlatformNamespace, id: string): Promise<T | null> {
  if (!safe(id)) return null;
  const redis = getDurableRedis();
  if (redis) {
    try { return await redis.get<T>(key(namespace, id)); } catch { return null; }
  }
  const target = directory(namespace);
  if (!target) return null;
  try { return JSON.parse(await readFile(path.join(target, `${id}.json`), "utf8")) as T; } catch { return null; }
}

export async function listPlatformRecords<T>(namespace: PlatformNamespace, limit = 50): Promise<T[]> {
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
  const redis = getDurableRedis();
  let ids: string[] = [];
  if (redis) {
    try { ids = await redis.zrange(indexKey(namespace), 0, bounded - 1, { rev: true }) as string[]; } catch { ids = []; }
  } else {
    const target = directory(namespace);
    if (!target) return [];
    try {
      ids = (await readdir(target)).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).reverse().slice(0, bounded);
    } catch { return []; }
  }
  const records = await Promise.all(ids.map((id) => getPlatformRecord<T>(namespace, id)));
  return records.reduce<T[]>((output, item) => {
    if (item !== null) output.push(item as T);
    return output;
  }, []);
}
