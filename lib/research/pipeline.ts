import { randomUUID } from "node:crypto";
import { deriveSearchAngles, buildProviderQuery } from "./angles.ts";
import { clusterComplaints, detectUnderservedSegments, extractCompetitors } from "./analyze.ts";
import { detectGaps } from "./gaps.ts";
import { canonicalizeQuery, normalizeResults } from "./normalize.ts";
import { getConfiguredProvider } from "./providers.ts";
import { runOpportunityPipeline } from "./opportunity-pipeline.ts";
import { findCachedResearch, saveResearchResult } from "./store.ts";
import { RESEARCH_SCHEMA_VERSION, type IdeationContext, type ResearchLimits, type ResearchRequestOptions, type ResearchResult } from "./types.ts";

const absoluteMax = (raw: string | undefined, fallback: number, max: number) => {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(1, value)) : fallback;
};

export function researchLimits(env: NodeJS.ProcessEnv = process.env): ResearchLimits {
  const maxSearchQueries = absoluteMax(env.RESEARCH_MAX_QUERIES, 10, 12);
  const resultsPerQuery = absoluteMax(env.RESEARCH_RESULTS_PER_QUERY, 6, 10);
  const maxProviderCalls = absoluteMax(env.RESEARCH_MAX_PROVIDER_CALLS, maxSearchQueries, 12);
  return {
    maxQueryLength: 500, maxSearchQueries: Math.min(maxSearchQueries, maxProviderCalls), resultsPerQuery,
    maxSources: Math.min(80, maxSearchQueries * resultsPerQuery), maxCandidates: absoluteMax(env.RESEARCH_MAX_CANDIDATES, 30, 48),
    maxModelIterations: absoluteMax(env.RESEARCH_MAX_MODEL_ITERATIONS, 0, 6),
    maxSurvivorIterations: absoluteMax(env.RESEARCH_MAX_SURVIVOR_ITERATIONS, 2, 2),
    maxProviderCalls, timeoutMs: absoluteMax(env.RESEARCH_TIMEOUT_MS, 15_000, 30_000),
  };
}

function cacheTtlSeconds(): number {
  return absoluteMax(process.env.RESEARCH_CACHE_TTL_SECONDS, 86_400, 604_800);
}

async function searchWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<PromiseSettledResult<T>[]> {
  const output: PromiseSettledResult<T>[] = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      try {
        output[index] = { status: "fulfilled", value: await tasks[index]() };
      } catch (reason) {
        output[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return output;
}

function ideationContext(result: Omit<ResearchResult, "ideationContext">): IdeationContext {
  const topGaps = result.gaps.slice(0, 5).map(({ id, problemStatement, affectedSegment, currentWorkaround, existingSolutions, whySolutionsFail, supportingEvidenceIds, counterEvidenceIds, score, confidenceLabel }) => ({
    id, problemStatement, affectedSegment, currentWorkaround, existingSolutions, whySolutionsFail, supportingEvidenceIds, counterEvidenceIds, score, confidenceLabel,
  }));
  const selectedEvidenceIds = new Set(topGaps.flatMap((gap) => [...gap.supportingEvidenceIds, ...gap.counterEvidenceIds]));
  const competitors = result.competitors.slice(0, 8).map(({ id, name, website, pricing, keyFeatures, likelyWeaknesses, evidenceIds }) => ({ id, name, website, pricing, keyFeatures, likelyWeaknesses, evidenceIds }));
  competitors.flatMap((item) => item.evidenceIds).forEach((id) => selectedEvidenceIds.add(id));
  result.finalOpportunities.flatMap((item) => [
    ...item.candidate.evidenceIds,
    ...item.falsification.hypotheses.flatMap((hypothesis) => [...hypothesis.supportingEvidenceIds, ...hypothesis.counterEvidenceIds]),
  ]).forEach((id) => selectedEvidenceIds.add(id));
  return {
    instruction: "Use the ranked survivor records as the starting point. Cite evidence IDs using their sourceUrl. Treat unknown fields as unknown; never fill them from memory. Similarity and opportunity scores are transparent heuristics, not proof of novelty or demand. Do not revive rejected candidates without a new mutation and falsification pass.",
    topGaps,
    competitors,
    evidence: result.sources.filter((item) => selectedEvidenceIds.has(item.id)),
    graphHoles: result.graphHoles.slice(0, 8),
    contradictions: result.contradictions.slice(0, 8),
    stitchingPatterns: result.stitchingPatterns.slice(0, 6),
    weakSignals: result.weakSignals.slice(0, 6),
    resurrectionOpportunities: result.failedAttempts.filter((item) => item.resurrectionEligible).slice(0, 4),
    finalOpportunities: result.finalOpportunities,
    budgetUsage: result.budgetUsage,
  };
}

export async function runResearch(rawQuery: string, options: ResearchRequestOptions = {}): Promise<ResearchResult> {
  const limits = researchLimits();
  const query = rawQuery.trim();
  if (query.length < 8) throw new RangeError("Research query must be at least 8 characters.");
  if (query.length > limits.maxQueryLength) throw new RangeError(`Research query must be ${limits.maxQueryLength} characters or fewer.`);
  const canonicalQuery = canonicalizeQuery(query);
  const provider = options.provider ?? getConfiguredProvider();
  const ttl = cacheTtlSeconds();
  if (!options.bypassCache) {
    const cached = await findCachedResearch(canonicalQuery, provider.id, ttl);
    if (cached) {
      cached.cache = { hit: true, matchedRunId: cached.id };
      return cached;
    }
  }

  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const searchAngles = deriveSearchAngles(query, limits.maxSearchQueries);
  const settled = await searchWithConcurrency(searchAngles.map((angle) => async () => ({
    angle,
    results: await provider.search(buildProviderQuery(angle), { limit: limits.resultsPerQuery, signal: AbortSignal.timeout(limits.timeoutMs) }),
  })), 3);
  const successful = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  const failures = settled.flatMap((item, index) => item.status === "rejected" ? [`Search angle ${searchAngles[index].kind} failed: ${item.reason instanceof Error ? item.reason.message : "unknown provider error"}`] : []);
  if (successful.length === 0) throw new Error(`All ${searchAngles.length} search angles failed. ${failures[0] ?? "No evidence was retrieved."}`);

  const retrievedAt = now().toISOString();
  const sources = normalizeResults(successful, retrievedAt, limits.maxSources);
  if (sources.length === 0) throw new Error("The configured provider returned no usable public sources. No research result was fabricated.");
  const competitors = extractCompetitors(sources);
  const complaintClusters = clusterComplaints(sources);
  const underservedSegments = detectUnderservedSegments(sources);
  const gaps = detectGaps(sources, competitors, complaintClusters, underservedSegments);
  const opportunity = runOpportunityPipeline({ query, sources, competitors, complaints: complaintClusters, segments: underservedSegments, gaps, limits, now: now() });
  opportunity.budgetUsage.providerCalls = searchAngles.length;
  const warnings = [...failures];
  if (complaintClusters.length === 0) warnings.push("No supported complaint clusters were found; the result contains no inferred market gaps rather than manufacturing them.");
  if (gaps.every((gap) => gap.confidenceLabel === "speculative opportunity")) warnings.push("All detected openings remain speculative because retrieved support is weak or isolated.");
  const base = {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    id: `research_${now().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`,
    query,
    canonicalQuery,
    status: failures.length ? "partial" as const : "complete" as const,
    startedAt,
    completedAt: now().toISOString(),
    provider: { id: provider.id, displayName: provider.displayName },
    cache: { hit: false, matchedRunId: null },
    limits,
    searchAngles,
    sources,
    competitors,
    complaintClusters,
    underservedSegments,
    gaps,
    ...opportunity,
    warnings,
  };
  const result: ResearchResult = { ...base, ideationContext: ideationContext(base as Omit<ResearchResult, "ideationContext">) };
  if (options.persist !== false) {
    const stored = await saveResearchResult(result, ttl);
    if (!stored.durable) result.warnings.push("This Vercel-compatible build uses in-memory cache in serverless mode; configure external durable storage before relying on run history across instances.");
  }
  return result;
}
