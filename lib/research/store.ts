import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResearchResult } from "./types.ts";
import { RESEARCH_ENGINE_VERSION, RESEARCH_SCHEMA_VERSION } from "./types.ts";
import { querySimilarity } from "./normalize.ts";
import { getDurableRedis } from "./durable.ts";
import { operationalLog, safeErrorCategory } from "../http-safety.ts";
import { assessMarketRelevance, inferPageIdentity, normalizeOrganizationName } from "./entity-resolution.ts";
import { buildResearchClaimLineage, citationCoverageAudit } from "./claim-support.ts";
import { buildCandidateIdMapping } from "./candidate-ids.ts";

interface CacheEntry { result: ResearchResult; expiresAt: number; ownerScope?: string }

const globalState = globalThis as typeof globalThis & { __noveltyResearchCache?: Map<string, CacheEntry> };
const memoryCache = globalState.__noveltyResearchCache ??= new Map<string, CacheEntry>();

function normalizeStoredResult(raw: ResearchResult): ResearchResult {
  const result = structuredClone(raw);
  result.engineVersion ??= RESEARCH_ENGINE_VERSION;
  result.depth ??= "standard";
  result.mode ??= "research_market";
  result.retrievalMode ??= result.provider?.id?.startsWith("supplied_sources") ? "supplied_sources" : "hosted";
  result.retrieval ??= {
    mode: result.retrievalMode,
    provenance: result.retrievalMode === "supplied_sources" ? "claude_or_user_supplied" : "novelty_hosted_search",
    suppliedSourceCount: result.retrievalMode === "supplied_sources" ? result.sources?.length ?? 0 : 0,
    hostedProviderCalls: result.retrievalMode === "supplied_sources" ? 0 : result.budgetUsage?.providerCalls ?? 0,
    estimatedHostedProviderCredits: result.retrievalMode === "supplied_sources" ? 0 : result.budgetUsage?.estimatedProviderCredits ?? result.budgetUsage?.providerCalls ?? 0,
  };
  result.runLineage ??= { rootRunId: result.id, parentRunId: null, version: 1, reason: "fresh_run" };
  result.sources = (result.sources ?? []).map((source) => {
    const fallbackQuery = result.query ?? source.supports ?? "research market";
    return {
    ...source,
    pageIdentity: source.pageIdentity ?? inferPageIdentity(source.normalizedUrl, source.title, source.summary, source.sourceType),
    relevanceAssessment: source.relevanceAssessment ?? assessMarketRelevance(fallbackQuery, source.title, source.summary),
    security: source.security ?? { treatedAsUntrustedData: true, promptInjectionDetected: false, ignoredDirectiveCategories: [] },
    sourceAssessment: {
      ...source.sourceAssessment,
      sourceFamily: source.sourceAssessment.sourceFamily ?? "general",
      provenance: source.sourceAssessment.provenance ?? (source.sourceAssessment.isPrimary ? "company_controlled" : "independent_secondary"),
      commercialBiasRisk: source.sourceAssessment.commercialBiasRisk ?? "unknown",
      observationKind: source.sourceAssessment.observationKind ?? "mixed",
      discoveryOnly: source.sourceAssessment.discoveryOnly ?? false,
    },
  }; });
  result.competitors = (result.competitors ?? []).map((competitor) => {
    const relationship = competitor.relationship?.value === "substitute" ? "substitute" as const : "direct_competitor" as const;
    const domain = competitor.canonicalDomain ?? (() => { try { return new URL(competitor.website).hostname.replace(/^www\./, ""); } catch { return null; } })();
    return {
      ...competitor,
      canonicalDomain: domain,
      canonicalOrganizationId: competitor.canonicalOrganizationId ?? (domain ? `org:${domain}` : `brand:${normalizeOrganizationName(competitor.name.value ?? competitor.id)}`),
      classification: competitor.classification ?? relationship,
      sourcePageIds: competitor.sourcePageIds ?? competitor.evidenceIds,
    };
  });
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
    expansionStopReason: result.budgetUsage.expansionStopReason ?? "not_needed",
  };
  if (result.budgetUsage.exhausted) result.budgetUsage.expansionStopReason = "budget_exhausted";
  else if (result.budgetUsage.expansionStopReason === "budget_exhausted") result.budgetUsage.expansionStopReason = "no_useful_branch_remaining";
  result.limits.minCredibleCompetitors ??= 5;
  result.limits.competitorQueriesPerCandidate ??= 2;
  result.competitorRecall ??= {
    minimumCredibleCompetitors: result.limits.minCredibleCompetitors,
    primaryQueries: 0, crossCheckQueries: 0, escalationQueries: 0, candidates: [],
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
  result.evidenceSnapshot.lineage ??= {
    runId: result.id, rootRunId: result.runLineage.rootRunId, parentRunId: result.runLineage.parentRunId,
    version: result.runLineage.version, retainedEvidenceIds: [], addedEvidenceIds: result.sources.map((source) => source.id),
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
  result.falsificationResults = (result.falsificationResults ?? []).map((item) => ({
    ...item,
    searchCoverage: item.searchCoverage ?? {
      failedCompaniesPriorAttempts: { status: "UNKNOWN", searched: false, evidenceIds: [], rationale: "Historical V2.2 record predates explicit failed-attempt search coverage." },
      aiCommoditization: { status: "UNKNOWN", searched: false, evidenceIds: [], rationale: "Historical V2.2 record predates explicit AI-commoditization search coverage." },
    },
  }));
  result.candidateIdMapping ??= buildCandidateIdMapping(result.candidates ?? [], result.candidates ?? []);
  result.claimLineage ??= buildResearchClaimLineage({
    query: result.query, sources: result.sources, competitors: result.competitors, gaps: result.gaps,
    candidates: result.candidates, falsificationResults: result.falsificationResults,
    weakSignals: result.weakSignals, companyProfile: result.companyProfile,
  });
  result.citationCoverage ??= citationCoverageAudit(result.claimLineage);
  result.evidenceSnapshot.claimLineage ??= structuredClone(result.claimLineage);
  result.evidenceSnapshot.citationCoverage ??= structuredClone(result.citationCoverage);
  return result;
}

function hasCurrentShape(result: ResearchResult): boolean {
  return result.schemaVersion === RESEARCH_SCHEMA_VERSION
    && result.engineVersion === RESEARCH_ENGINE_VERSION
    && Array.isArray(result.finalOpportunities) && Array.isArray(result.opportunityGraph?.nodes)
    && Array.isArray(result.falsificationResults) && Boolean(result.coverage) && Boolean(result.stopDecision) && Boolean(result.output)
    && Array.isArray(result.roleOutputs) && Array.isArray(result.checkpoints) && Boolean(result.evidenceSnapshot);
}

function cacheKey(canonicalQuery: string, providerId: string, ownerScope?: string): string {
  return createHash("sha256").update(`${ownerScope ? `${ownerScope}:` : ""}${providerId}:${canonicalQuery}`).digest("hex");
}

const runKey = (id: string) => `novelty:research:run:${id}`;
const durableCacheKey = (key: string) => `novelty:research:cache:${key}`;
const runIndexKey = "novelty:research:runs";
const scopedRunIndexKey = (ownerScope: string) => `${runIndexKey}:owner:${ownerScope}`;
const validOwnerScope = (value: string | undefined): value is string => Boolean(value && /^usr_[a-f0-9]{20}$/.test(value));

function historyTtlSeconds(): number {
  const parsed = Number.parseInt(process.env.RESEARCH_HISTORY_TTL_SECONDS ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(31_536_000, Math.max(86_400, parsed)) : 31_536_000;
}

function runsDirectory(): string | null {
  if (process.env.RESEARCH_RUNS_DIR) return path.resolve(process.env.RESEARCH_RUNS_DIR);
  if (process.env.VERCEL) return null;
  return path.join(process.cwd(), ".research-runs");
}

function scopedRunsDirectory(ownerScope: string): string | null {
  const root = runsDirectory();
  return root && validOwnerScope(ownerScope) ? path.join(root, "owners", ownerScope) : null;
}

export async function findCachedResearch(canonicalQuery: string, providerId: string, ttlSeconds: number, ownerScope?: string): Promise<ResearchResult | null> {
  const now = Date.now();
  const exactKey = cacheKey(canonicalQuery, providerId, ownerScope);
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
      continue;
    }
    if (entry.ownerScope === ownerScope && hasCurrentShape(entry.result) && (key === exactKey || (entry.result.provider.id === providerId && querySimilarity(canonicalQuery, entry.result.canonicalQuery) >= 0.88))) {
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
        memoryCache.set(exactKey, { result: normalized, expiresAt: now + ttlSeconds * 1000, ownerScope });
        return structuredClone(normalized);
      }
    } catch (error) {
      operationalLog("error", "durable_cache_lookup_failed", { category: safeErrorCategory(error) });
    }
  }

  const directory = runsDirectory();
  if (!directory) return null;
  try {
    const stored = JSON.parse(await readFile(path.join(directory, `cache-${exactKey}.json`), "utf8")) as ResearchResult;
    const age = now - new Date(stored.completedAt).getTime();
    const normalized = normalizeStoredResult(stored);
    if (age <= ttlSeconds * 1000 && hasCurrentShape(normalized)) {
      memoryCache.set(exactKey, { result: normalized, expiresAt: now + ttlSeconds * 1000 - age, ownerScope });
      return structuredClone(normalized);
    }
  } catch {
    // A cache miss or malformed local file must never become fabricated evidence.
  }
  return null;
}

export async function saveResearchResult(result: ResearchResult, ttlSeconds: number, ownerScope?: string): Promise<{ durable: boolean }> {
  if (ownerScope && !validOwnerScope(ownerScope)) throw new RangeError("Invalid research owner scope.");
  const key = cacheKey(result.canonicalQuery, result.provider.id, ownerScope);
  memoryCache.set(key, { result: structuredClone(result), expiresAt: Date.now() + ttlSeconds * 1000, ownerScope });
  const durable = getDurableRedis();
  if (durable) {
    try {
      const writes = [
        durable.set(runKey(result.id), result, { ex: historyTtlSeconds() }),
        durable.set(durableCacheKey(key), result, { ex: ttlSeconds }),
        durable.zadd(runIndexKey, { score: new Date(result.completedAt).getTime(), member: result.id }),
      ];
      if (validOwnerScope(ownerScope)) writes.push(durable.zadd(scopedRunIndexKey(ownerScope), { score: new Date(result.completedAt).getTime(), member: result.id }));
      await Promise.all(writes);
      return { durable: true };
    } catch (error) {
      operationalLog("error", "durable_research_save_failed", { category: safeErrorCategory(error) });
    }
  }
  const directory = runsDirectory();
  if (!directory) return { durable: false };
  await mkdir(directory, { recursive: true });
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  const writes: Array<Promise<unknown>> = [
    writeFile(path.join(directory, `${result.id}.json`), serialized, { flag: "wx" }),
    writeFile(path.join(directory, `cache-${key}.json`), serialized),
  ];
  if (validOwnerScope(ownerScope)) {
    const ownerDirectory = scopedRunsDirectory(ownerScope)!;
    await mkdir(ownerDirectory, { recursive: true });
    writes.push(writeFile(path.join(ownerDirectory, `${result.id}.ref`), `${result.id}\n`, { flag: "wx" }));
  }
  await Promise.all(writes);
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
      operationalLog("error", "durable_run_lookup_failed", { category: safeErrorCategory(error) });
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

export type ResearchRunListSummary = Pick<ResearchResult, "id" | "query" | "mode" | "depth" | "status" | "startedAt" | "completedAt" | "provider" | "stopDecision" | "budgetUsage"> & {
  retrievalMode?: ResearchResult["retrievalMode"];
  survivorCount: number;
  candidateCount: number;
  gapCount: number;
  rejectedCount: number;
};

export type ResearchRunDiscoveryFilters = {
  limit?: number;
  cursor?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  status?: ResearchResult["status"];
  stopStatus?: ResearchResult["stopDecision"]["status"];
  mode?: ResearchResult["mode"];
  depth?: ResearchResult["depth"];
  ownerScope?: string;
};

export type ResearchRunDiscoveryPage<T = ResearchRunListSummary> = {
  runs: T[];
  page: { limit: number; nextCursor: string | null; hasMore: boolean };
  ownership: { scoped: boolean; boundary: "current_client_namespace" | "unscoped_internal" };
};

async function indexedRunIds(maximum: number, ownerScope?: string): Promise<string[]> {
  if (ownerScope && !validOwnerScope(ownerScope)) throw new RangeError("Invalid research owner scope.");
  const bounded = Math.max(1, Math.min(1_000, Math.trunc(maximum)));
  const index = validOwnerScope(ownerScope) ? scopedRunIndexKey(ownerScope) : runIndexKey;
  const ids: string[] = [];
  const durable = getDurableRedis();
  if (durable) {
    try {
      ids.push(...await durable.zrange<string[]>(index, 0, bounded - 1, { rev: true }));
    } catch (error) {
      operationalLog("error", "durable_history_lookup_failed", { category: safeErrorCategory(error) });
    }
  }
  if (!ids.length) {
    const directory = validOwnerScope(ownerScope) ? scopedRunsDirectory(ownerScope) : runsDirectory();
    if (directory) {
      try {
        const suffix = validOwnerScope(ownerScope) ? ".ref" : ".json";
        const pattern = validOwnerScope(ownerScope) ? /^research_[a-zA-Z0-9_]{8,80}\.ref$/ : /^research_[a-zA-Z0-9_]{8,80}\.json$/;
        const names = await readdir(/* turbopackIgnore: true */ directory);
        ids.push(...names.filter((name) => pattern.test(name)).sort().reverse().slice(0, bounded).map((name) => name.slice(0, -suffix.length)));
      } catch {
        // An absent local history namespace is an empty history, not an error.
      }
    }
  }
  return [...new Set(ids)].slice(0, bounded);
}

function runSummary(item: ResearchResult): ResearchRunListSummary {
  return {
    id: item.id, query: item.query, mode: item.mode, depth: item.depth, status: item.status,
    startedAt: item.startedAt, completedAt: item.completedAt, provider: item.provider, retrievalMode: item.retrievalMode,
    stopDecision: item.stopDecision, budgetUsage: item.budgetUsage,
    survivorCount: item.finalOpportunities.length, candidateCount: item.candidates.length,
    gapCount: item.gaps.length, rejectedCount: item.rejectedIdeas.length,
  };
}

function filterFingerprint(filters: ResearchRunDiscoveryFilters, searchQuery = ""): string {
  const stable = JSON.stringify({
    searchQuery: canonicalizeForCursor(searchQuery), createdAfter: filters.createdAfter ?? null, createdBefore: filters.createdBefore ?? null,
    updatedAfter: filters.updatedAfter ?? null, updatedBefore: filters.updatedBefore ?? null, status: filters.status ?? null,
    stopStatus: filters.stopStatus ?? null, mode: filters.mode ?? null, depth: filters.depth ?? null,
  });
  return createHash("sha256").update(stable).digest("hex").slice(0, 12);
}

const canonicalizeForCursor = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

function decodeCursor(cursor: string | undefined, fingerprint: string): number {
  if (!cursor) return 0;
  if (!/^rrc_[a-zA-Z0-9_-]{8,300}$/.test(cursor)) throw new RangeError("Malformed research-run cursor.");
  try {
    const decoded = JSON.parse(Buffer.from(cursor.slice(4), "base64url").toString("utf8")) as { v?: unknown; offset?: unknown; filter?: unknown };
    if (decoded.v !== 1 || !Number.isInteger(decoded.offset) || Number(decoded.offset) < 0 || Number(decoded.offset) > 10_000 || decoded.filter !== fingerprint) {
      throw new Error("invalid cursor payload");
    }
    return Number(decoded.offset);
  } catch {
    throw new RangeError("Malformed research-run cursor or cursor does not match the active filters.");
  }
}

function encodeCursor(offset: number, fingerprint: string): string {
  return `rrc_${Buffer.from(JSON.stringify({ v: 1, offset, filter: fingerprint })).toString("base64url")}`;
}

function dateMillis(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new RangeError("Research-run date filters must be valid ISO 8601 date-times.");
  return parsed;
}

async function filteredRuns(filters: ResearchRunDiscoveryFilters): Promise<ResearchResult[]> {
  const createdAfter = dateMillis(filters.createdAfter);
  const createdBefore = dateMillis(filters.createdBefore);
  const updatedAfter = dateMillis(filters.updatedAfter);
  const updatedBefore = dateMillis(filters.updatedBefore);
  if (createdAfter !== null && createdBefore !== null && createdAfter > createdBefore) throw new RangeError("created_after must not be later than created_before.");
  if (updatedAfter !== null && updatedBefore !== null && updatedAfter > updatedBefore) throw new RangeError("updated_after must not be later than updated_before.");
  const ids = await indexedRunIds(1_000, filters.ownerScope);
  const records = (await Promise.all(ids.map((id) => getResearchResultById(id)))).filter((item): item is ResearchResult => Boolean(item));
  return records.filter((item) => {
    const created = new Date(item.startedAt).getTime();
    const updated = new Date(item.completedAt).getTime();
    return (createdAfter === null || created >= createdAfter) && (createdBefore === null || created <= createdBefore)
      && (updatedAfter === null || updated >= updatedAfter) && (updatedBefore === null || updated <= updatedBefore)
      && (!filters.status || item.status === filters.status) && (!filters.stopStatus || item.stopDecision.status === filters.stopStatus)
      && (!filters.mode || item.mode === filters.mode) && (!filters.depth || item.depth === filters.depth);
  }).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function discoverResearchRuns(filters: ResearchRunDiscoveryFilters = {}): Promise<ResearchRunDiscoveryPage> {
  const limit = Math.max(1, Math.min(50, Math.trunc(filters.limit ?? 20)));
  const fingerprint = filterFingerprint(filters);
  const offset = decodeCursor(filters.cursor, fingerprint);
  const filtered = await filteredRuns(filters);
  const selected = filtered.slice(offset, offset + limit).map(runSummary);
  const hasMore = offset + selected.length < filtered.length;
  return {
    runs: selected,
    page: { limit, nextCursor: hasMore ? encodeCursor(offset + selected.length, fingerprint) : null, hasMore },
    ownership: { scoped: validOwnerScope(filters.ownerScope), boundary: validOwnerScope(filters.ownerScope) ? "current_client_namespace" : "unscoped_internal" },
  };
}

export async function listResearchRuns(limit = 20, ownerScope?: string): Promise<ResearchRunListSummary[]> {
  const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
  const ids = await indexedRunIds(bounded, ownerScope);
  const records = (await Promise.all(ids.slice(0, bounded).map((id) => getResearchResultById(id)))).filter((item): item is ResearchResult => Boolean(item));
  return records.sort((a, b) => b.completedAt.localeCompare(a.completedAt)).map(runSummary);
}

export type RankedResearchRunSummary = ResearchRunListSummary & {
  match: { score: number; exactPhrase: boolean; matchedFields: string[] };
};

export async function searchResearchRunPage(query: string, filters: ResearchRunDiscoveryFilters = {}): Promise<ResearchRunDiscoveryPage<RankedResearchRunSummary> & { rankingMethod: string }> {
  const normalized = query.trim();
  if (normalized.length < 2 || normalized.length > 200) throw new RangeError("Research-run search query must be 2–200 characters.");
  const limit = Math.max(1, Math.min(50, Math.trunc(filters.limit ?? 20)));
  const fingerprint = filterFingerprint(filters, normalized);
  const offset = decodeCursor(filters.cursor, fingerprint);
  const runs = await filteredRuns(filters);
  const ranked = runs.map((run): RankedResearchRunSummary | null => {
    const identity = run.companyProfile?.requestedIdentity;
    const fields = {
      query: run.query,
      company_name: identity?.name ?? "",
      company_domain: identity?.canonicalDomain ?? "",
      ticker: identity?.ticker ?? "",
      mode: run.mode,
    };
    const exactFields = Object.entries(fields).filter(([, value]) => value.toLowerCase().includes(normalized.toLowerCase())).map(([name]) => name);
    const similarities = Object.entries(fields).map(([name, value]) => ({ name, score: value ? querySimilarity(normalized, value) : 0 }));
    const best = similarities.sort((a, b) => b.score - a.score)[0];
    const score = exactFields.length ? Math.max(.9, best?.score ?? 0) : best?.score ?? 0;
    if (score <= 0) return null;
    return { ...runSummary(run), match: { score: Math.round(score * 1_000) / 1_000, exactPhrase: exactFields.length > 0, matchedFields: exactFields.length ? exactFields : best ? [best.name] : [] } };
  }).filter((item): item is RankedResearchRunSummary => Boolean(item))
    .sort((a, b) => b.match.score - a.match.score || b.completedAt.localeCompare(a.completedAt));
  const selected = ranked.slice(offset, offset + limit);
  const hasMore = offset + selected.length < ranked.length;
  return {
    runs: selected,
    page: { limit, nextCursor: hasMore ? encodeCursor(offset + selected.length, fingerprint) : null, hasMore },
    ownership: { scoped: validOwnerScope(filters.ownerScope), boundary: validOwnerScope(filters.ownerScope) ? "current_client_namespace" : "unscoped_internal" },
    rankingMethod: "Transparent canonical-token Jaccard similarity with an exact-substring boost; no embeddings or vector index.",
  };
}

export async function searchResearchRuns(query: string, limit = 20, ownerScope?: string): Promise<RankedResearchRunSummary[]> {
  return (await searchResearchRunPage(query, { limit, ownerScope })).runs;
}

export function clearMemoryResearchCache(): void {
  memoryCache.clear();
}
