import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResearchResult } from "./types.ts";
import { RESEARCH_ENGINE_VERSION, RESEARCH_SCHEMA_VERSION } from "./types.ts";
import { querySimilarity } from "./normalize.ts";
import { getDurableRedis } from "./durable.ts";

interface CacheEntry { result: ResearchResult; expiresAt: number }

const globalState = globalThis as typeof globalThis & { __noveltyResearchCache?: Map<string, CacheEntry> };
const memoryCache = globalState.__noveltyResearchCache ??= new Map<string, CacheEntry>();

function normalizeStoredResult(raw: ResearchResult): ResearchResult {
  const result = structuredClone(raw);
  result.engineVersion ??= RESEARCH_ENGINE_VERSION;
  result.depth ??= "standard";
  result.mode ??= "research_market";
  result.sources = (result.sources ?? []).map((source) => ({
    ...source,
    security: source.security ?? { treatedAsUntrustedData: true, promptInjectionDetected: false, ignoredDirectiveCategories: [] },
    sourceAssessment: {
      ...source.sourceAssessment,
      sourceFamily: source.sourceAssessment.sourceFamily ?? "general",
      provenance: source.sourceAssessment.provenance ?? (source.sourceAssessment.isPrimary ? "company_controlled" : "independent_secondary"),
      commercialBiasRisk: source.sourceAssessment.commercialBiasRisk ?? "unknown",
      observationKind: source.sourceAssessment.observationKind ?? "mixed",
    },
  }));
  result.coverage = {
    ...result.coverage,
    sourceFamilyAttempts: result.coverage.sourceFamilyAttempts ?? Object.fromEntries(Object.entries(result.coverage.sourceFamilyCoverage).map(([family, count]) => [family, count > 0 ? "covered" : "not_attempted"])) as ResearchResult["coverage"]["sourceFamilyAttempts"],
    commercialEvidenceThin: result.coverage.commercialEvidenceThin ?? result.coverage.sourceFamilyCoverage.commercial < 2,
    counterevidenceBudgetExhausted: result.coverage.counterevidenceBudgetExhausted ?? false,
  };
  result.budgetUsage = {
    ...result.budgetUsage,
    counterevidenceSearches: result.budgetUsage.counterevidenceSearches ?? 0,
    agentCalls: result.budgetUsage.agentCalls ?? 0,
    estimatedProviderCredits: result.budgetUsage.estimatedProviderCredits ?? result.budgetUsage.providerCalls,
    gracefulDegradation: result.budgetUsage.gracefulDegradation ?? (result.stopDecision.status === "insufficient_evidence" ? "insufficient_evidence" : "none"),
  };
  result.roleOutputs ??= [];
  result.checkpoints ??= [{
    name: "final_persistence", status: "not_applicable", completedAt: result.completedAt,
    details: "Historical V2.1 record predates explicit checkpoint recording; no skipped gate is retroactively claimed as passed.",
  }];
  result.evidenceSnapshot ??= {
    schemaVersion: "1.0", capturedAt: result.completedAt, evidence: structuredClone(result.sources),
    normalizedClaims: result.sources.map((source) => ({ evidenceId: source.id, claim: source.summary, status: "UNKNOWN", sourceAssessment: source.sourceAssessment })),
    duplicateWarnings: result.sources.filter((source) => source.duplicateSourceUrls.length).map((source) => ({ evidenceId: source.id, duplicateSourceUrls: source.duplicateSourceUrls })),
    missingSourceFamilyWarnings: result.coverage.missingCriticalSourceFamilies,
  };
  result.companyProfile ??= null;
  result.searchBranches ??= [];
  result.candidateLifecycles ??= [];
  result.evidenceGates ??= [];
  result.assumptionLedger ??= [];
  result.adversarialReviews ??= [];
  result.taskGraph ??= {
    depth: result.depth, resumable: true, checkpointId: `checkpoint_legacy_${result.id.slice(-12)}`,
    cancelled: false, agents: [], dependencies: [],
  };
  result.nextBestAction ??= {
    candidateId: result.finalOpportunities[0]?.candidate.id ?? null,
    action: result.finalOpportunities[0]?.validationExperiment.action ?? "Run a new incremental research pass to resolve the missing evidence.",
    reason: "This historical record predates explicit next-best-action ranking.", resolvesAssumptionIds: [],
    expectedInformationGain: 0, estimatedCost: "unknown", estimatedTime: "unknown",
    successCriterion: result.finalOpportunities[0]?.validationExperiment.successThreshold ?? "New independent evidence resolves a critical unknown.",
    killCriterion: result.finalOpportunities[0]?.validationExperiment.failureThreshold ?? "The configured hard research budget is exhausted without a survivor.",
  };
  return result;
}

function hasCurrentShape(result: ResearchResult): boolean {
  return result.schemaVersion === RESEARCH_SCHEMA_VERSION
    && result.engineVersion === RESEARCH_ENGINE_VERSION
    && Array.isArray(result.finalOpportunities) && Array.isArray(result.opportunityGraph?.nodes)
    && Array.isArray(result.falsificationResults) && Boolean(result.coverage) && Boolean(result.stopDecision) && Boolean(result.output)
    && Array.isArray(result.roleOutputs) && Array.isArray(result.checkpoints) && Boolean(result.evidenceSnapshot);
}

function cacheKey(canonicalQuery: string, providerId: string): string {
  return createHash("sha256").update(`${providerId}:${canonicalQuery}`).digest("hex");
}

const runKey = (id: string) => `novelty:research:run:${id}`;
const durableCacheKey = (key: string) => `novelty:research:cache:${key}`;
const runIndexKey = "novelty:research:runs";

function historyTtlSeconds(): number {
  const parsed = Number.parseInt(process.env.RESEARCH_HISTORY_TTL_SECONDS ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(31_536_000, Math.max(86_400, parsed)) : 31_536_000;
}

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
      return normalizeStoredResult(entry.result);
    }
  }

  const durable = getDurableRedis();
  if (durable) {
    try {
      const stored = await durable.get<ResearchResult>(durableCacheKey(exactKey));
      if (stored) {
        const normalized = normalizeStoredResult(stored);
        if (!hasCurrentShape(normalized)) return null;
        memoryCache.set(exactKey, { result: normalized, expiresAt: now + ttlSeconds * 1000 });
        return structuredClone(normalized);
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
    const normalized = normalizeStoredResult(stored);
    if (age <= ttlSeconds * 1000 && hasCurrentShape(normalized)) {
      memoryCache.set(exactKey, { result: normalized, expiresAt: now + ttlSeconds * 1000 - age });
      return structuredClone(normalized);
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
        durable.set(runKey(result.id), result, { ex: historyTtlSeconds() }),
        durable.set(durableCacheKey(key), result, { ex: ttlSeconds }),
        durable.zadd(runIndexKey, { score: new Date(result.completedAt).getTime(), member: result.id }),
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
    if (entry.result.id === id && hasCurrentShape(normalizeStoredResult(entry.result))) return normalizeStoredResult(entry.result);
  }
  const durable = getDurableRedis();
  if (durable) {
    try {
      const stored = await durable.get<ResearchResult>(runKey(id));
      if (stored) {
        const normalized = normalizeStoredResult(stored);
        if (hasCurrentShape(normalized)) return normalized;
      }
    } catch (error) {
      console.error("Durable research run lookup failed", error instanceof Error ? error.message : "unknown error");
    }
  }
  const directory = runsDirectory();
  if (!directory) return null;
  try {
    const stored = JSON.parse(await readFile(path.join(directory, `${id}.json`), "utf8")) as ResearchResult;
    const normalized = normalizeStoredResult(stored);
    return hasCurrentShape(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export async function listResearchRuns(limit = 20): Promise<Array<Pick<ResearchResult, "id" | "query" | "mode" | "status" | "completedAt" | "provider" | "stopDecision" | "budgetUsage">>> {
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
  const ids: string[] = [];
  const durable = getDurableRedis();
  if (durable) {
    try {
      ids.push(...await durable.zrange<string[]>(runIndexKey, 0, bounded - 1, { rev: true }));
    } catch (error) {
      console.error("Durable research history lookup failed", error instanceof Error ? error.message : "unknown error");
    }
  }
  if (!ids.length) {
    const directory = runsDirectory();
    if (directory) {
      try {
        const names = await readdir(/* turbopackIgnore: true */ directory);
        ids.push(...names.filter((name) => /^research_[a-zA-Z0-9_]{8,80}\.json$/.test(name)).map((name) => name.slice(0, -5)).reverse().slice(0, bounded));
      } catch {
        // An absent local history directory is an empty history, not an error.
      }
    }
  }
  const records = (await Promise.all(ids.slice(0, bounded).map((id) => getResearchResultById(id)))).filter((item): item is ResearchResult => Boolean(item));
  return records.sort((a, b) => b.completedAt.localeCompare(a.completedAt)).map((item) => ({
    id: item.id, query: item.query, mode: item.mode, status: item.status, completedAt: item.completedAt,
    provider: item.provider, stopDecision: item.stopDecision, budgetUsage: item.budgetUsage,
  }));
}

export async function searchResearchRuns(query: string, limit = 20) {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const runs = await listResearchRuns(100);
  return runs.map((run) => ({ ...run, similarity: querySimilarity(normalized, run.query) }))
    .filter((run) => run.similarity >= .15 || run.query.toLowerCase().includes(normalized.toLowerCase()))
    .sort((a, b) => b.similarity - a.similarity || b.completedAt.localeCompare(a.completedAt))
    .slice(0, Math.max(1, Math.min(50, Math.trunc(limit))));
}

export function clearMemoryResearchCache(): void {
  memoryCache.clear();
}
