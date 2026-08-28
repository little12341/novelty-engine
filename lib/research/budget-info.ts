import { researchLimits } from "./pipeline.ts";
import type { ResearchDepth } from "./types.ts";
import { hostedSearchEnabled } from "./providers.ts";

const boundedInt = (value: string | undefined, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(maximum, parsed)) : fallback;
};

function depthBudget(depth: ResearchDepth, env: NodeJS.ProcessEnv) {
  const limits = researchLimits(env, depth);
  const normalMinimum = depth === "fast" ? 4 : 6;
  return {
    relativeCost: depth === "fast" ? "low" as const : depth === "standard" ? "medium" as const : "high" as const,
    expectedSearchCalls: { minimum: Math.min(normalMinimum, limits.maxProviderCalls), maximum: limits.maxProviderCalls },
    hardCaps: {
      searchQueries: limits.maxSearchQueries,
      retrievalCalls: limits.maxProviderCalls,
      counterevidenceCalls: limits.maxCounterevidenceSearches,
      expansionBranches: limits.maxExpansionBranches,
      resultsPerQuery: limits.resultsPerQuery,
      runDurationMs: limits.maxRunDurationMs,
    },
    note: depth === "fast"
      ? "Directional coverage with the smallest configured retrieval envelope."
      : depth === "standard"
        ? "Default balanced coverage, including bounded competitor cross-checks and counterevidence where capacity remains."
        : "Broadest configured retrieval, counterevidence, and adjacent-branch envelope; substantially more retrieval than fast mode.",
  };
}

export function getResearchBudgetInfo(env: NodeJS.ProcessEnv = process.env) {
  const depths = {
    fast: depthBudget("fast", env),
    standard: depthBudget("standard", env),
    deep: depthBudget("deep", env),
  };
  const comparisonCap = boundedInt(env.RESEARCH_COMPARISON_MAX_PROVIDER_CALLS, 30, 40);
  return {
    unit: "configured retrieval/search calls, not money",
    recommendedDefault: {
      mode: "supplied_sources" as const,
      hostedProviderCalls: 0,
      estimatedHostedProviderCredits: 0,
      tools: ["research_from_sources", "get_research_requirements", "add_sources_to_run"],
      note: "Claude or the user gathers public sources; Novelty runs the complete evidence pipeline without deployment-owned hosted-search usage. Hosting, Redis, and other infrastructure can still incur costs above free tiers.",
    },
    hostedSearch: {
      enabled: hostedSearchEnabled(env),
      mode: "hosted" as const,
      optInTools: ["research_market", "run_research_mode", "compare_ideas", "rerun_research", "fresh_expand"],
    },
    depths,
    comparison: {
      relativeCost: "high" as const,
      expectedSearchCalls: { minimum: Math.min(8, comparisonCap), maximum: comparisonCap },
      hardCap: comparisonCap,
      scope: "One shared cap across 2–5 independently researched ideas.",
    },
    falsification: {
      relativeCost: "low" as const,
      expectedSearchCalls: { minimum: 0, maximum: 4 },
      hardCap: 4,
      scope: "Stored supplied evidence uses zero hosted calls; the optional hosted path uses up to four focused counterevidence searches.",
    },
    rerun: {
      relativeCost: "same_as_selected_depth" as const,
      byDepth: depths,
      scope: "A fresh cache-bypassing run using the selected depth, followed by a stored snapshot comparison.",
    },
    storedReadTools: {
      relativeCost: "none" as const,
      retrievalCalls: 0,
      examples: ["list_research_runs", "search_research_runs", "find_market_gaps", "get_research_run", "compare_run_candidates"],
    },
    quotaVisibility: {
      remainingCapacityExposed: false,
      reason: "Per-run expectations are public-safe; shared operational quota state is intentionally not exposed.",
    },
    safety: {
      providerIdentityExposed: false,
      credentialsExposed: false,
      monetaryEstimateProvided: false,
    },
  };
}

export type ResearchBudgetInfo = ReturnType<typeof getResearchBudgetInfo>;
