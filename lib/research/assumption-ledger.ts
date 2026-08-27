import { stableId } from "./utils.ts";
import { classifyClaim, independentEvidenceCount } from "./quality.ts";
import type {
  AssumptionLedgerEntry, CandidateGap, Evidence, FalsificationDimension, FalsificationResult,
  IdeaCandidate, WhyNotBuiltAnalysis,
} from "./types.ts";

const DEFINITIONS: Array<{
  dimension: AssumptionLedgerEntry["dimension"];
  statement: (candidate: IdeaCandidate) => string;
  falsification?: FalsificationDimension;
  kill: string;
  resolve: string;
}> = [
  { dimension: "customer_pain", statement: (c) => `${c.targetCustomer ?? "The target customer"} cares enough about this pain to act.`, falsification: "demand", kill: "Kill if fewer than 3 independent pain signals or interviews show the problem is not consequential.", resolve: "Interview 10 affected users with recent concrete cases and collect artifacts." },
  { dimension: "pain_frequency", statement: () => "The pain occurs frequently enough to support repeat usage or urgent purchase.", falsification: "user_behavior", kill: "Kill if the median buyer experiences the problem less than quarterly without high per-event value.", resolve: "Measure event frequency in 10 workflow diaries or system logs." },
  { dimension: "existing_spend", statement: () => "Customers already spend money, labor, or risk budget on the problem.", falsification: "economics", kill: "Kill if no budget owner can name current spend or avoided loss.", resolve: "Obtain two invoices, job budgets, procurement records, or paid-pilot commitments." },
  { dimension: "buyer_access", statement: (c) => `${c.payer ?? c.targetCustomer ?? "The buyer"} can be identified and reached through a viable channel.`, falsification: "distribution", kill: "Kill if 50 qualified attempts cannot produce 5 conversations through the proposed channel.", resolve: "Build a list of 50 named buyers and run one channel-specific outreach test." },
  { dimension: "incumbent_weakness", statement: () => "Incumbents cannot adequately close the residual gap with a small feature or bundle.", falsification: "competition", kill: "Kill if a same-user, same-job substitute already resolves the complaint without material switching pain.", resolve: "Complete a feature/workflow matrix for at least 3 close substitutes." },
  { dimension: "switching", statement: () => "The wedge creates enough value to overcome migration and workflow switching costs.", falsification: "switching_cost", kill: "Kill if a concierge migration cannot win one pilot without a full system replacement.", resolve: "Offer a reversible migration or overlay pilot to 5 qualified accounts." },
  { dimension: "technology", statement: (c) => `The core mechanism (${c.technology ?? c.mechanism}) works at the required reliability and cost.`, falsification: "technical_feasibility", kill: "Kill if a representative proof fails the stated reliability or cost threshold.", resolve: "Run the recorded technical proof on 10 representative cases." },
  { dimension: "regulation", statement: () => "Regulation and platform rules permit the proposed workflow.", falsification: "regulation", kill: "Kill or redesign if a binding rule blocks the data flow, license, or operating model.", resolve: "Get a cited regulatory determination or qualified counsel review of the exact workflow." },
  { dimension: "market_size", statement: () => "The reachable buyer pool is large enough for the intended business outcome.", kill: "Kill if a bottom-up count cannot support the minimum revenue target at realistic penetration and pricing.", resolve: "Build a bottom-up count from named buyer records, price, and reachable channel capacity." },
];

export function buildAssumptionLedger(candidate: IdeaCandidate, gap: CandidateGap | undefined, falsification: FalsificationResult, evidence: Evidence[]): AssumptionLedgerEntry[] {
  return DEFINITIONS.map((definition) => {
    const hypothesis = definition.falsification ? falsification.hypotheses.find((item) => item.dimension === definition.falsification) : undefined;
    const supportingEvidenceIds = [...new Set([
      ...(definition.dimension === "customer_pain" || definition.dimension === "pain_frequency" ? gap?.supportingEvidenceIds ?? [] : []),
      ...(hypothesis?.supportingEvidenceIds ?? []),
    ])];
    const contradictingEvidenceIds = [...new Set(hypothesis?.counterEvidenceIds ?? [])];
    const supported = independentEvidenceCount(supportingEvidenceIds, evidence);
    const contradicted = independentEvidenceCount(contradictingEvidenceIds, evidence);
    const criticalUnknown = supported === 0 && contradicted === 0 && ["existing_spend", "buyer_access", "technology", "market_size"].includes(definition.dimension);
    const status: AssumptionLedgerEntry["status"] = contradicted >= 2 && (hypothesis?.risk ?? 0) >= 8 ? "DISPROVEN"
      : supported >= 2 ? "SUPPORTED" : criticalUnknown ? "CRITICAL" : supported || contradicted ? "WEAK" : "UNTESTED";
    const all = [...supportingEvidenceIds, ...contradictingEvidenceIds];
    const claim = classifyClaim(all, evidence);
    const factState: AssumptionLedgerEntry["factState"] = status === "DISPROVEN" ? "CONTRADICTED"
      : claim === "VERIFIED" ? "KNOWN" : claim === "INFERRED" ? "INFERRED" : "UNKNOWN";
    return {
      id: stableId("assumption", `${candidate.id}:${definition.dimension}`), candidateId: candidate.id,
      assumption: definition.statement(candidate), dimension: definition.dimension, status, factState,
      supportingEvidenceIds, contradictingEvidenceIds,
      researchToResolve: status === "SUPPORTED" || status === "DISPROVEN" ? null : definition.resolve,
      killCriterion: definition.kill,
    };
  });
}

export function analyzeWhyNotBuilt(candidate: IdeaCandidate, gap: CandidateGap | undefined, evidence: Evidence[]): WhyNotBuiltAnalysis {
  const definitions: Array<[WhyNotBuiltAnalysis["explanations"][number]["factor"], RegExp, string]> = [
    ["technology", /new api|model|automation|open.source|hardware|price collapse|now possible/i, "Technology may only recently have made the mechanism viable."],
    ["regulation", /regulat|law|mandate|guidance|compliance|effective/i, "A regulatory change may create or reshape demand."],
    ["market_size", /growth|adoption|market size|increasing demand|expanding/i, "The reachable market may have recently changed."],
    ["distribution_economics", /marketplace|channel|distribution|acquisition cost|sales cycle/i, "Distribution economics may explain prior non-entry or current timing."],
    ["willingness_to_pay", /would not pay|too expensive|not worth|pricing|budget|procurement/i, "Historical willingness to pay may be the binding constraint."],
    ["prior_failure", /shut down|discontinued|failed startup|abandoned|low adoption/i, "A prior attempt may expose a persistent blocker."],
    ["incumbent_distribution", /incumbent|bundle|platform|channel control|exclusive/i, "Incumbents may control distribution or bundle the job."],
    ["switching_cost", /switching|migration|lock.in|integration cost|entrenched/i, "Switching friction may keep a real pain underserved."],
    ["fake_pain", /low frequency|rare|not a problem|would not use|no demand/i, "The apparent pain may not cause purchase or behavior change."],
    ["overlooked", /underserved|not available|only enterprise|small business|rural|accessibility/i, "The segment may be structurally overlooked rather than absent."],
  ];
  const relevant = evidence.filter((item) => candidate.evidenceIds.includes(item.id) || gap?.supportingEvidenceIds.includes(item.id));
  const explanations = definitions.map(([factor, pattern, rationale]) => {
    const ids = relevant.filter((item) => pattern.test(`${item.title} ${item.summary}`)).map((item) => item.id);
    const claim = classifyClaim(ids, evidence);
    return { factor, state: claim === "VERIFIED" ? "KNOWN" as const : claim === "INFERRED" ? "INFERRED" as const : "UNKNOWN" as const, rationale: ids.length ? rationale : `Retrieved evidence did not establish whether ${factor.replaceAll("_", " ")} explains the gap.`, evidenceIds: ids };
  });
  const recent = explanations.some((item) => ["technology", "regulation", "market_size", "distribution_economics"].includes(item.factor) && item.state !== "UNKNOWN");
  const trap = explanations.some((item) => ["willingness_to_pay", "prior_failure", "incumbent_distribution", "switching_cost", "fake_pain"].includes(item.factor) && item.state === "KNOWN");
  const overlooked = explanations.find((item) => item.factor === "overlooked")?.state !== "UNKNOWN";
  return {
    candidateId: candidate.id,
    verdict: trap ? "persistent_trap" : recent ? "recently_viable" : overlooked ? "possibly_overlooked" : "unknown",
    explanations,
    unresolvedQuestion: "Which single historical blocker prevented prior solutions, and what cited change makes that blocker materially different now?",
  };
}
