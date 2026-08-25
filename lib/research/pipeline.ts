import { randomUUID } from "node:crypto";
import { deriveSearchAngles, deriveFalsificationAngles, buildProviderQuery } from "./angles.ts";
import { clusterComplaints, detectUnderservedSegments, extractCompetitors } from "./analyze.ts";
import { detectGaps } from "./gaps.ts";
import { canonicalizeQuery, normalizeResults } from "./normalize.ts";
import { getConfiguredProvider } from "./providers.ts";
import { runOpportunityPipeline } from "./opportunity-pipeline.ts";
import { assessCoverage, decideStop, isRegulatedQuery } from "./quality.ts";
import { buildFinalOutput } from "./final-output.ts";
import { findCachedResearch, saveResearchResult } from "./store.ts";
import { RESEARCH_SCHEMA_VERSION, type IdeationContext, type ResearchLimits, type ResearchRequestOptions, type ResearchResult } from "./types.ts";

const absoluteMax = (raw: string | undefined, fallback: number, max: number) => {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(1, value)) : fallback;
};

export function researchLimits(env: NodeJS.ProcessEnv = process.env): ResearchLimits {
  const maxSearchQueries = absoluteMax(env.RESEARCH_MAX_QUERIES, 12, 12);
  const resultsPerQuery = absoluteMax(env.RESEARCH_RESULTS_PER_QUERY, 6, 10);
  const maxProviderCalls = absoluteMax(env.RESEARCH_MAX_PROVIDER_CALLS, maxSearchQueries, 12);
  return {
    maxQueryLength: 500, maxSearchQueries: Math.min(maxSearchQueries, maxProviderCalls), resultsPerQuery,
    maxSources: Math.min(80, maxSearchQueries * resultsPerQuery), maxCandidates: absoluteMax(env.RESEARCH_MAX_CANDIDATES, 30, 48),
    maxModelIterations: absoluteMax(env.RESEARCH_MAX_MODEL_ITERATIONS, 0, 6),
    maxSurvivorIterations: absoluteMax(env.RESEARCH_MAX_SURVIVOR_ITERATIONS, 1, 1),
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
    instruction: "Use finalOutput and ranked survivors as the starting point. Preserve VERIFIED, INFERRED, and UNKNOWN claim labels. Cite evidence IDs using sourceUrl. A missing competitor is a search result, not a validated opportunity. Scores are heuristics and must stay paired with written reasoning. Never revive rejected candidates without new evidence and a bounded mutation/falsification pass.",
    topGaps,
    competitors,
    evidence: result.sources.filter((item) => selectedEvidenceIds.has(item.id)),
    graphHoles: result.graphHoles.slice(0, 8),
    contradictions: result.contradictions.slice(0, 8),
    stitchingPatterns: result.stitchingPatterns.slice(0, 6),
    weakSignals: result.weakSignals.slice(0, 6),
    resurrectionOpportunities: result.failedAttempts.filter((item) => item.resurrectionEligible).slice(0, 4),
    finalOpportunities: result.finalOpportunities,
    finalOutput: result.output,
    budgetUsage: result.budgetUsage,
  };
}

function providerFailure(error: unknown): { category: string; message: string; retryable: boolean } {
  const message = error instanceof Error ? error.message : "unknown provider error";
  const category = /abort|time(?:d)?\s*out/i.test(message) ? "TIMEOUT" : /429|rate/i.test(message) ? "RATE_LIMIT"
    : /json|malformed|schema|array/i.test(message) ? "MALFORMED_RESPONSE" : /HTTP 5\d\d/i.test(message) ? "UPSTREAM_5XX" : "PROVIDER_ERROR";
  return { category, message, retryable: ["TIMEOUT", "RATE_LIMIT", "UPSTREAM_5XX"].includes(category) };
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
  let providerCalls = 0;
  const failures: string[] = [];
  const executeAngles = async (angles: ReturnType<typeof deriveSearchAngles>) => {
    const settled = await searchWithConcurrency(angles.map((angle) => async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (providerCalls >= limits.maxProviderCalls) throw new Error("Provider-call budget exhausted before this angle could complete.");
        providerCalls += 1;
        try {
          const results = await provider.search(buildProviderQuery(angle), { limit: limits.resultsPerQuery, signal: AbortSignal.timeout(limits.timeoutMs) });
          if (!Array.isArray(results)) throw new TypeError("Search provider returned a malformed response instead of a result array.");
          return { angle, results: results.filter((item) => item && typeof item.url === "string" && typeof item.title === "string" && typeof item.snippet === "string") };
        } catch (error) {
          lastError = error;
          if (!providerFailure(error).retryable || attempt === 2) throw error;
        }
      }
      throw lastError;
    }), 3);
    settled.forEach((item, index) => {
      if (item.status === "rejected") {
        const detail = providerFailure(item.reason);
        failures.push(`Search angle ${angles[index].kind} failed [${detail.category}]: ${detail.message}`);
      }
    });
    return settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  };

  const landscapeAngles = deriveSearchAngles(query, Math.min(10, limits.maxSearchQueries));
  const landscapeResults = await executeAngles(landscapeAngles);
  const provisionalSources = normalizeResults(landscapeResults, now().toISOString(), limits.maxSources);
  const provisionalCompetitors = extractCompetitors(provisionalSources);
  const provisionalComplaints = clusterComplaints(provisionalSources);
  const provisionalSegments = detectUnderservedSegments(provisionalSources);
  const provisionalGaps = detectGaps(provisionalSources, provisionalCompetitors, provisionalComplaints, provisionalSegments);
  const provisionalCoverage = assessCoverage({
    angles: landscapeAngles, successfulAngleIds: landscapeResults.map((item) => item.angle.id), evidence: provisionalSources,
    regulatedMarket: isRegulatedQuery(query),
  });
  const provisionalStop = decideStop({ coverage: provisionalCoverage, gaps: provisionalGaps, competitors: provisionalCompetitors });
  const provisionalOpportunity = runOpportunityPipeline({
    query, sources: provisionalSources, competitors: provisionalCompetitors, complaints: provisionalComplaints,
    segments: provisionalSegments, gaps: provisionalGaps, limits, now: now(), allowGeneration: provisionalStop.canGenerateCandidates,
  });
  const seenMechanisms = new Set<string>();
  const candidateFocus = provisionalOpportunity.candidates.filter((candidate) => candidate.iteration === 0 && !seenMechanisms.has(candidate.mechanismFamily) && seenMechanisms.add(candidate.mechanismFamily)).map((candidate) =>
    `${candidate.mechanismFamily} for ${candidate.targetCustomer ?? "unknown"}: ${candidate.differentiator}`,
  );
  const remainingAngles = Math.min(2, limits.maxSearchQueries - landscapeAngles.length, limits.maxProviderCalls - providerCalls);
  const falsificationAngles = candidateFocus.length && remainingAngles > 0
    ? deriveFalsificationAngles(query, candidateFocus, remainingAngles)
    : [];
  const falsificationResults = falsificationAngles.length ? await executeAngles(falsificationAngles) : [];
  const searchAngles = [...landscapeAngles, ...falsificationAngles];
  const successful = [...landscapeResults, ...falsificationResults];

  const retrievedAt = now().toISOString();
  const sources = normalizeResults(successful, retrievedAt, limits.maxSources);
  const competitors = extractCompetitors(sources);
  const complaintClusters = clusterComplaints(sources);
  const underservedSegments = detectUnderservedSegments(sources);
  const gaps = detectGaps(sources, competitors, complaintClusters, underservedSegments);
  const successfulAngleIds = successful.map((item) => item.angle.id);
  const coverage = assessCoverage({ angles: searchAngles, successfulAngleIds, evidence: sources, regulatedMarket: isRegulatedQuery(query) });
  const stopDecision = decideStop({ coverage, gaps, competitors });
  const opportunity = runOpportunityPipeline({ query, sources, competitors, complaints: complaintClusters, segments: underservedSegments, gaps, limits, now: now(), allowGeneration: stopDecision.canGenerateCandidates });
  opportunity.budgetUsage.providerCalls = providerCalls;
  opportunity.budgetUsage.exhausted ||= providerCalls >= limits.maxProviderCalls;
  const warnings = [...failures];
  if (complaintClusters.length === 0) warnings.push("No supported complaint clusters were found; the result contains no inferred market gaps rather than manufacturing them.");
  if (gaps.length > 0 && gaps.every((gap) => gap.confidenceLabel === "speculative opportunity")) warnings.push("All detected openings remain speculative because retrieved support is weak or isolated.");
  if (sources.length === 0) warnings.push("No usable public sources were retrieved. The run is returned as insufficient evidence; no candidate was generated.");
  if (!falsificationAngles.length && provisionalGaps.length > 0) warnings.push("The provider-call budget left no room for active candidate counterevidence searches; falsification dimensions without evidence remain UNKNOWN.");
  if (stopDecision.canGenerateCandidates && opportunity.finalOpportunities.length === 0) warnings.push("No candidate survived the bounded competitor, falsification, and mutation gates; the response intentionally contains no mediocre filler ideas.");
  if (stopDecision.status !== "proceed") warnings.push(...stopDecision.reasons);
  const output = buildFinalOutput({
    evidence: sources, competitors, gaps, signals: opportunity.weakSignals, candidates: opportunity.candidates,
    rejectedIdeas: opportunity.rejectedIdeas, survivors: opportunity.finalOpportunities, lineages: opportunity.lineages,
    validationExperiments: opportunity.validationExperiments, coverage, stopDecision,
  });
  const base = {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    id: `research_${now().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`,
    query,
    canonicalQuery,
    status: failures.length || stopDecision.status !== "proceed" ? "partial" as const : "complete" as const,
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
    coverage,
    stopDecision,
    output,
    warnings,
  };
  const result: ResearchResult = { ...base, ideationContext: ideationContext(base as Omit<ResearchResult, "ideationContext">) };
  if (options.persist !== false) {
    const stored = await saveResearchResult(result, ttl);
    if (!stored.durable) result.warnings.push("This Vercel-compatible build uses in-memory cache in serverless mode; configure external durable storage before relying on run history across instances.");
  }
  return result;
}
