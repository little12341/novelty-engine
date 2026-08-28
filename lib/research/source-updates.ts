import { compareResearchRuns } from "./changes.ts";
import { runResearch } from "./pipeline.ts";
import { normalizeUrl } from "./normalize.ts";
import { evidenceAsSuppliedSource, suppliedSourcesToProvider, SUPPLIED_SOURCE_MAX_COUNT, validateSuppliedSources } from "./supplied-sources.ts";
import type { ResearchResult, ResearchUserContext, SuppliedResearchSource } from "./types.ts";

function companyIdentityFromRun(run: ResearchResult) {
  const requested = run.companyProfile?.requestedIdentity;
  return run.mode === "research_company" && requested?.authoritativeIdentifiers?.length ? {
    companyName: requested.authoritativeIdentifiers.includes("company_name") ? requested.name : null,
    normalizedName: requested.normalizedName,
    canonicalDomain: requested.canonicalDomain,
    ticker: requested.ticker ?? null,
    country: requested.country ?? null,
    authoritative: true as const,
  } : undefined;
}

export async function addSourcesToResearchRun(input: {
  baseline: ResearchResult;
  sources: SuppliedResearchSource[];
  founderConstraints?: ResearchUserContext;
  ownerScope?: string;
  signal?: AbortSignal;
  now?: () => Date;
}) {
  const now = input.now?.() ?? new Date();
  const additional = validateSuppliedSources(input.sources, { now, maxCount: SUPPLIED_SOURCE_MAX_COUNT });
  const existingUrls = new Set(input.baseline.sources.map((item) => item.normalizedUrl));
  const uniqueAdditional = additional.filter((item) => !existingUrls.has(normalizeUrl(item.url) ?? item.url));
  if (!uniqueAdditional.length) throw new RangeError("No new unique source URL remained after normalization and deduplication.");
  const additionalAsSources: SuppliedResearchSource[] = uniqueAdditional.map((item) => ({
    url: item.url,
    title: item.title,
    ...(item.suppliedContentScope === "content" ? { content: item.snippet } : { snippet: item.snippet }),
    publicationDate: item.publishedAt,
    retrievedAt: item.retrievedAt,
    sourceType: item.suppliedMetadata?.declaredSourceType ?? undefined,
    publisher: item.suppliedMetadata?.declaredPublisher ?? undefined,
    domain: item.suppliedMetadata?.declaredDomain ?? undefined,
  }));
  const combined = [...input.baseline.sources.map(evidenceAsSuppliedSource), ...additionalAsSources];
  if (combined.length > input.baseline.limits.maxSources) throw new RangeError(`Merged evidence would exceed this run's ${input.baseline.limits.maxSources}-source limit.`);
  const supplied = suppliedSourcesToProvider(combined, { now, maxCount: input.baseline.limits.maxSources });
  const run = await runResearch(input.baseline.query, {
    provider: supplied.provider,
    retrievalMode: "supplied_sources",
    suppliedSourceCount: supplied.sourceCount,
    mode: input.baseline.mode,
    depth: input.baseline.depth,
    bypassCache: true,
    userContext: input.founderConstraints,
    companyIdentity: companyIdentityFromRun(input.baseline),
    ownerScope: input.ownerScope,
    signal: input.signal,
    now: input.now ?? (() => now),
    parentEvidenceIds: input.baseline.sources.map((item) => item.id),
    runLineage: {
      rootRunId: input.baseline.runLineage?.rootRunId ?? input.baseline.id,
      parentRunId: input.baseline.id,
      version: (input.baseline.runLineage?.version ?? 1) + 1,
      reason: "sources_added",
    },
  });
  const materialChanges = compareResearchRuns(input.baseline, run, now);
  const previousMissing = new Set(input.baseline.coverage.missingCriticalSourceFamilies);
  const currentMissing = new Set(run.coverage.missingCriticalSourceFamilies);
  const resolvedFamilies = [...previousMissing].filter((item) => !currentMissing.has(item));
  const newlyMissingFamilies = [...currentMissing].filter((item) => !previousMissing.has(item));
  const priorPassedGates = input.baseline.evidenceGates.filter((item) => item.survivalGatePassed).length;
  const currentPassedGates = run.evidenceGates.filter((item) => item.survivalGatePassed).length;
  return {
    run,
    summary: {
      baselineRunId: input.baseline.id,
      resultingRunId: run.id,
      rootRunId: run.runLineage.rootRunId,
      version: run.runLineage.version,
      addedSourceCount: run.evidenceSnapshot.lineage?.addedEvidenceIds.length ?? uniqueAdditional.length,
      retainedSourceCount: run.evidenceSnapshot.lineage?.retainedEvidenceIds.length ?? input.baseline.sources.length,
      duplicateInputUrlsCollapsed: Math.max(0, input.sources.length - uniqueAdditional.length),
      coverage: { before: input.baseline.coverage.coverageStatus, after: run.coverage.coverageStatus },
      evidenceGate: { passedBefore: priorPassedGates, passedAfter: currentPassedGates },
      citationCoverage: { before: input.baseline.citationCoverage.coverageRatio, after: run.citationCoverage.coverageRatio },
      resolvedSourceFamilies: resolvedFamilies,
      newlyMissingSourceFamilies: newlyMissingFamilies,
      materialChangeCount: materialChanges.materialChanges.length,
      providerCalls: run.budgetUsage.providerCalls,
      historicalSnapshotMutated: false,
    },
    materialChanges,
  };
}
