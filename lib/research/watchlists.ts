import { randomUUID } from "node:crypto";
import { compareResearchRuns } from "./changes.ts";
import { getPlatformRecord, privateIdentity, putPlatformRecord } from "./platform-store.ts";
import { runResearch } from "./pipeline.ts";
import { getResearchResultById } from "./store.ts";
import type { ChangeDetectionResult, SearchProvider, WatchlistConfig } from "./types.ts";

const DEFAULT_SIGNALS: WatchlistConfig["signals"] = [
  "competitors", "products_features", "pricing", "funding_hiring", "regulation", "patents_research",
  "complaints", "substitutes", "platform_policy", "demand",
];

export async function createWatchlist(input: {
  userId?: string; label: string; query: string; mode: WatchlistConfig["mode"];
  baselineRunId: string; candidateId?: string; signals?: WatchlistConfig["signals"]; now?: Date;
}): Promise<WatchlistConfig> {
  if (!await getResearchResultById(input.baselineRunId)) throw new RangeError("Baseline research run was not found.");
  if (input.query.trim().length < 8) throw new RangeError("Watch query must be at least 8 characters.");
  const createdAt = (input.now ?? new Date()).toISOString();
  const watch: WatchlistConfig = {
    id: `watch_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    userId: input.userId ? privateIdentity(input.userId) : null,
    label: input.label.trim().slice(0, 160), query: input.query.trim().slice(0, 500), mode: input.mode,
    baselineRunId: input.baselineRunId, candidateId: input.candidateId?.trim().slice(0, 120) ?? null,
    signals: [...new Set(input.signals?.length ? input.signals : DEFAULT_SIGNALS)],
    createdAt, lastCheckedAt: null, enabled: true,
  };
  await putPlatformRecord("watchlists", watch.id, watch, new Date(createdAt).getTime());
  return watch;
}

export async function checkWatchlist(id: string, options: { provider?: SearchProvider; now?: Date } = {}): Promise<{ watchlist: WatchlistConfig; change: ChangeDetectionResult }> {
  const watch = await getPlatformRecord<WatchlistConfig>("watchlists", id);
  if (!watch || !watch.enabled) throw new RangeError("Watchlist was not found or is disabled.");
  const baseline = await getResearchResultById(watch.baselineRunId);
  if (!baseline) throw new RangeError("Watchlist baseline run was not found.");
  const comparison = await runResearch(watch.query, {
    provider: options.provider, bypassCache: true, mode: watch.mode === "company" ? "research_company" : "research_market",
  });
  const change = compareResearchRuns(baseline, comparison, options.now ?? new Date());
  const filtered = { ...change, materialChanges: change.materialChanges.filter((item) => item.category === "coverage" || watch.signals.includes(item.category)) };
  filtered.summary = filtered.materialChanges.length ? `${filtered.materialChanges.length} configured material change(s) surfaced.` : "No configured material changes were supported by the new snapshot.";
  watch.lastCheckedAt = filtered.comparedAt;
  watch.baselineRunId = comparison.id;
  await Promise.all([
    putPlatformRecord("watchlists", watch.id, watch, new Date(filtered.comparedAt).getTime()),
    putPlatformRecord("changes", `change_${randomUUID().replaceAll("-", "").slice(0, 16)}`, filtered, new Date(filtered.comparedAt).getTime()),
  ]);
  return { watchlist: watch, change: filtered };
}
