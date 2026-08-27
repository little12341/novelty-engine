import type { AssumptionLedgerEntry, CounterfactualResearch, IdeaCandidate, MoatStressTest, OpportunityScore } from "./types.ts";

export function buildCounterfactual(candidate: IdeaCandidate, assumptions: AssumptionLedgerEntry[]): CounterfactualResearch {
  const by = (dimension: AssumptionLedgerEntry["dimension"]) => assumptions.find((item) => item.dimension === dimension);
  const conditions: Array<{ dimension: AssumptionLedgerEntry["dimension"]; condition: string; test: string; kill: string }> = [
    { dimension: "market_size", condition: "A bottom-up reachable market and realistic annual contract value can support $100M annual revenue.", test: "Count named reachable buyers, triangulate ACV from current spend, and model realistic penetration.", kill: "Reachable buyers × realistic ACV × plausible penetration is below $100M." },
    { dimension: "existing_spend", condition: "Budget can move from current labor, risk, or substitutes into the product.", test: "Obtain 10 buyer budget disclosures and 3 paid commitments.", kill: "Buyers acknowledge pain but cannot identify a budget source or avoided loss." },
    { dimension: "buyer_access", condition: "Distribution scales without CAC consuming gross profit.", test: "Measure qualified acquisition and conversion in the named channel.", kill: "CAC payback remains above 18 months after a focused channel test." },
    { dimension: "switching", condition: "The wedge can land without a full rip-and-replace migration.", test: "Run 3 reversible overlay pilots.", kill: "Every pilot requires replacing the incumbent system or unsafe data migration." },
    { dimension: "technology", condition: "The mechanism works reliably at target gross margin.", test: "Benchmark representative cases including failure handling and human review cost.", kill: "Reliability or human-review cost prevents the target margin." },
  ];
  const requiredConditions = conditions.map((item) => {
    const assumption = by(item.dimension);
    return { condition: item.condition, factState: assumption?.factState ?? "UNKNOWN", test: item.test, killCriterion: item.kill, evidenceIds: assumption ? [...assumption.supportingEvidenceIds, ...assumption.contradictingEvidenceIds] : [] };
  });
  const contradicted = requiredConditions.filter((item) => item.factState === "CONTRADICTED").length;
  const unknown = requiredConditions.filter((item) => item.factState === "UNKNOWN").length;
  return {
    candidateId: candidate.id, targetOutcome: "$100M annual revenue business",
    requiredConditions,
    verdict: contradicted ? "CONTRADICTED" : unknown >= 3 ? "TOO_UNKNOWN" : "PLAUSIBLE_IF",
    rationale: contradicted ? "At least one necessary condition is contradicted by the retrieved record." : unknown >= 3 ? "Too many necessary scale conditions remain unknown for a credible scale claim." : "The outcome is only plausible if every listed condition passes its explicit test.",
  };
}

export function buildMoatStressTest(candidate: IdeaCandidate, score: OpportunityScore): MoatStressTest {
  const assets = `${candidate.differentiator} ${candidate.workflowPosition} ${candidate.distribution ?? ""} ${candidate.dataSource ?? ""} ${candidate.businessModel ?? ""}`;
  const remainingMoats = [
    /workflow|between existing|system of record|integration/i.test(assets) && "Workflow embedding and integrations",
    /channel|partner|community|local|marketplace/i.test(assets) && "Distribution relationships",
    /customer.control|owned|proprietary|outcome|verified/i.test(assets) && "Customer-controlled data, trust, or outcome history",
    /service|concierge|managed/i.test(assets) && "Operational execution and service delivery",
  ].filter((item): item is string => Boolean(item));
  const destroyedAdvantages = ["Generic generation, summarization, classification, and agent orchestration", /ai|llm|model|generate|agent/i.test(`${candidate.technology} ${candidate.mechanism}`) && "The proposed core AI capability"].filter((item): item is string => Boolean(item));
  const aiRisk = score.intelligence.aiCommoditization;
  const survivability = Math.max(0, Math.min(10, Math.round((remainingMoats.length * 2 + score.scorecard.defensibility.score + (10 - aiRisk)) / 3 * 10) / 10));
  return {
    candidateId: candidate.id, attackers: ["OpenAI", "Anthropic", "Google", "Microsoft", "Amazon", "incumbent", "open_source"],
    coreCapabilityBecomesFree: { remainingMoats, destroyedAdvantages, survivability, verdict: survivability >= 7 ? "RESILIENT" : survivability >= 4 ? "EXPOSED" : "COMMODITIZED" },
    rationale: remainingMoats.length ? "The stress test removes generic model capability and credits only workflow, distribution, data/trust, or operational advantages that could remain." : "No non-model moat was identified; a free bundled capability would erase most differentiation.",
  };
}
