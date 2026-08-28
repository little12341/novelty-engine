import { randomUUID } from "node:crypto";
import { getConfiguredProvider } from "./providers.ts";
import { runResearch } from "./pipeline.ts";
import type {
  ClaimStatus, ComparedIdea, IdeaComparisonDimension, IdeaComparisonResult, PipelineBudgetUsage,
  ResearchRequestOptions, SearchProvider,
} from "./types.ts";

const boundedInt = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(max, parsed)) : fallback;
};

export async function compareIdeas(ideas: string[], options: Pick<ResearchRequestOptions, "provider" | "persist" | "now" | "ownerScope"> = {}): Promise<IdeaComparisonResult> {
  const cleaned = ideas.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length < 2 || cleaned.length > 5) throw new RangeError("Idea comparison requires 2–5 ideas.");
  if (cleaned.some((item) => item.length < 8 || item.length > 500)) throw new RangeError("Each idea must be 8–500 characters.");
  const provider = options.provider ?? getConfiguredProvider();
  const hostedCost = (provider.retrievalMode ?? "hosted") === "hosted" && provider.usesHostedCredits !== false;
  const totalCap = boundedInt(process.env.RESEARCH_COMPARISON_MAX_PROVIDER_CALLS, 30, 40);
  let sharedCalls = 0;
  const budgetedProvider: SearchProvider = {
    id: `${provider.id}-comparison`, displayName: `${provider.displayName} (shared comparison budget)`,
    retrievalMode: provider.retrievalMode,
    usesHostedCredits: provider.usesHostedCredits,
    async search(query, searchOptions) {
      if (hostedCost && sharedCalls >= totalCap) throw new Error("Shared idea-comparison provider-call budget exhausted.");
      if (hostedCost) sharedCalls += 1;
      return provider.search(query, searchOptions);
    },
  };
  const runs = [];
  for (const idea of cleaned) {
    runs.push(await runResearch(`Validate this business idea and identify decisive risks: ${idea}`, {
      provider: budgetedProvider, persist: options.persist, bypassCache: true, now: options.now, mode: "validate_idea",
      ownerScope: options.ownerScope,
    }));
  }
  const compared: ComparedIdea[] = runs.map((run, index) => {
    const survivor = run.finalOpportunities[0];
    const gap = run.gaps[0];
    const factor = survivor?.score.decisionFactors;
    const falsification = survivor?.falsification;
    const dimension = (name: IdeaComparisonDimension["name"], assessment: string, status: ClaimStatus, evidenceIds: string[]): IdeaComparisonDimension => ({ name, assessment, status, evidenceIds: [...new Set(evidenceIds)] });
    const dimensions: IdeaComparisonDimension[] = [
      dimension("evidence_strength", factor?.evidenceStrength.rationale ?? run.stopDecision.reasons.join(" "), factor?.evidenceStrength.status ?? "UNKNOWN", factor?.evidenceStrength.evidenceIds ?? []),
      dimension("demand", factor?.demandSignal.rationale ?? "Demand remains UNKNOWN from the retrieved record.", factor?.demandSignal.status ?? "UNKNOWN", factor?.demandSignal.evidenceIds ?? []),
      dimension("residual_gap", falsification?.residualUnmetDemand.rationale ?? "No candidate reached a residual-gap assessment.", falsification ? (falsification.residualUnmetDemand.meaningfulResidualGap ? "INFERRED" : "UNKNOWN") : "UNKNOWN", falsification?.residualUnmetDemand.evidenceIds ?? []),
      dimension("differentiation", factor?.noveltyDifferentiation.rationale ?? "Differentiation remains UNKNOWN.", factor?.noveltyDifferentiation.status ?? "UNKNOWN", factor?.noveltyDifferentiation.evidenceIds ?? []),
      dimension("feasibility", factor?.feasibility.rationale ?? "Feasibility remains UNKNOWN.", factor?.feasibility.status ?? "UNKNOWN", factor?.feasibility.evidenceIds ?? []),
      dimension("economics", factor?.economics.rationale ?? "Economics remain UNKNOWN.", factor?.economics.status ?? "UNKNOWN", factor?.economics.evidenceIds ?? []),
      dimension("distribution", factor?.distribution.rationale ?? "Distribution remains UNKNOWN.", factor?.distribution.status ?? "UNKNOWN", factor?.distribution.evidenceIds ?? []),
      dimension("switching_cost", falsification?.hypotheses.find((item) => item.dimension === "switching_cost")?.rationale ?? "Switching cost remains UNKNOWN.", falsification?.hypotheses.find((item) => item.dimension === "switching_cost")?.claimStatus ?? "UNKNOWN", falsification?.hypotheses.find((item) => item.dimension === "switching_cost")?.counterEvidenceIds ?? []),
      dimension("trust", falsification?.hypotheses.find((item) => item.dimension === "trust")?.rationale ?? "Trust remains UNKNOWN.", falsification?.hypotheses.find((item) => item.dimension === "trust")?.claimStatus ?? "UNKNOWN", falsification?.hypotheses.find((item) => item.dimension === "trust")?.counterEvidenceIds ?? []),
      dimension("regulation_liability", factor?.regulatoryRisk.rationale ?? "Regulation and liability remain UNKNOWN.", factor?.regulatoryRisk.status ?? "UNKNOWN", factor?.regulatoryRisk.evidenceIds ?? []),
      dimension("defensibility", factor?.defensibility.rationale ?? "Defensibility remains UNKNOWN.", factor?.defensibility.status ?? "UNKNOWN", factor?.defensibility.evidenceIds ?? []),
      dimension("incumbent_response", falsification?.hypotheses.find((item) => item.dimension === "defensibility")?.rationale ?? "Incumbent response remains UNKNOWN.", falsification?.hypotheses.find((item) => item.dimension === "defensibility")?.claimStatus ?? "UNKNOWN", falsification?.hypotheses.find((item) => item.dimension === "defensibility")?.counterEvidenceIds ?? []),
      dimension("decisive_risks", falsification?.decisiveRisks.map((item) => `${item.dimension}: ${item.reason}`).join(" ") || "No decisive risk was established; unresolved unknowns remain visible.", falsification?.decisiveRisks.length ? "INFERRED" : "UNKNOWN", falsification?.decisiveRisks.flatMap((item) => item.evidenceIds) ?? []),
    ];
    const recommendation: ComparedIdea["recommendation"] = survivor && run.stopDecision.status === "proceed" ? "advance"
      : survivor || gap && run.stopDecision.status !== "insufficient_evidence" ? "validate_first"
        : run.stopDecision.status === "insufficient_evidence" ? "hold" : "reject";
    return { idea: cleaned[index], runId: run.id, dimensions, recommendation, rationale: survivor?.score.writtenReasoning ?? run.stopDecision.reasons.join(" ") };
  });
  const preferred = compared.filter((item) => item.recommendation === "advance");
  const recommendation = preferred.length === 1
    ? `Advance ${preferred[0].idea} to its recorded 24–72 hour validation test; it has the strongest qualitatively complete surviving case. This is not a mathematically precise ranking.`
    : preferred.length > 1
      ? `More than one idea cleared the same framework. Run their recorded validation tests in parallel or choose based on current constraints; the evidence does not justify fake precision between them.`
      : `None of the ideas earned an unqualified advance recommendation. Resolve the decisive UNKNOWNs and run the proposed validation tests before choosing.`;
  const budgetUsage: PipelineBudgetUsage = {
    providerCalls: sharedCalls,
    counterevidenceSearches: runs.reduce((sum, run) => sum + run.budgetUsage.counterevidenceSearches, 0),
    agentCalls: runs.reduce((sum, run) => sum + run.budgetUsage.agentCalls, 0),
    modelIterations: runs.reduce((sum, run) => sum + run.budgetUsage.modelIterations, 0),
    estimatedProviderCredits: sharedCalls,
    candidatesGenerated: runs.reduce((sum, run) => sum + run.budgetUsage.candidatesGenerated, 0),
    survivorIterations: runs.reduce((sum, run) => sum + run.budgetUsage.survivorIterations, 0),
    sourceCount: runs.reduce((sum, run) => sum + run.sources.length, 0),
    exhausted: hostedCost && sharedCalls >= totalCap || runs.some((run) => run.budgetUsage.exhausted),
    gracefulDegradation: runs.some((run) => run.stopDecision.status === "insufficient_evidence") ? "insufficient_evidence" : runs.some((run) => run.status === "partial") ? "partial_provider_failure" : "none",
  };
  return { schemaVersion: runs[0].schemaVersion, mode: "compare_ideas", id: `comparison_${randomUUID().replaceAll("-", "").slice(0, 16)}`, createdAt: (options.now?.() ?? new Date()).toISOString(), ideas: compared, recommendation, runIds: runs.map((run) => run.id), budgetUsage };
}
