import type { ResearchResult } from "./types.ts";

export type ResearchRequirementCategory =
  | "user_voice" | "spend_wtp" | "institutional_regulatory" | "direct_competitors"
  | "failed_attempts" | "pricing" | "switching_cost" | "technical_feasibility" | "unresolved_claim";

export interface ResearchRequirement {
  id: string;
  category: ResearchRequirementCategory;
  priority: "high" | "medium";
  objective: string;
  whyNeeded: string;
  candidateIds: string[];
  claimIds: string[];
  suggestedQueries: string[];
}

const compact = (value: string, maximum = 260) => value.replace(/\s+/g, " ").trim().slice(0, maximum);

function categoryForAssumption(dimension: ResearchResult["assumptionLedger"][number]["dimension"]): ResearchRequirementCategory {
  if (dimension === "customer_pain" || dimension === "pain_frequency" || dimension === "buyer_access") return "user_voice";
  if (dimension === "existing_spend" || dimension === "market_size") return "spend_wtp";
  if (dimension === "switching") return "switching_cost";
  if (dimension === "technology") return "technical_feasibility";
  if (dimension === "regulation") return "institutional_regulatory";
  return "direct_competitors";
}

function categoryForClaim(claimType: ResearchResult["claimLineage"][number]["claimType"]): ResearchRequirementCategory {
  if (["customer_pain", "pain_frequency", "customer_workaround", "underserved_status"].includes(claimType)) return "user_voice";
  if (["willingness_to_pay", "market_spend"].includes(claimType)) return "spend_wtp";
  if (["vendor_pricing"].includes(claimType)) return "pricing";
  if (["regulation"].includes(claimType)) return "institutional_regulatory";
  if (["automation_capability", "technical_feasibility"].includes(claimType)) return "technical_feasibility";
  if (["company_existence", "competitor_relationship", "competitor_weakness"].includes(claimType)) return "direct_competitors";
  return "unresolved_claim";
}

export function getResearchRequirements(run: ResearchResult) {
  const requirements = new Map<ResearchRequirementCategory, ResearchRequirement>();
  const add = (category: ResearchRequirementCategory, objective: string, whyNeeded: string, options: {
    priority?: "high" | "medium"; candidateId?: string | null; claimId?: string; query?: string;
  } = {}) => {
    const existing = requirements.get(category);
    const candidateIds = options.candidateId ? [options.candidateId] : [];
    const claimIds = options.claimId ? [options.claimId] : [];
    const suggestedQueries = options.query ? [compact(options.query)] : [];
    if (existing) {
      existing.priority = existing.priority === "high" || options.priority === "high" ? "high" : "medium";
      existing.candidateIds = [...new Set([...existing.candidateIds, ...candidateIds])];
      existing.claimIds = [...new Set([...existing.claimIds, ...claimIds])].slice(0, 12);
      existing.suggestedQueries = [...new Set([...existing.suggestedQueries, ...suggestedQueries])].slice(0, 4);
      return;
    }
    requirements.set(category, {
      id: `requirement_${category}`,
      category,
      priority: options.priority ?? "medium",
      objective,
      whyNeeded,
      candidateIds,
      claimIds,
      suggestedQueries: suggestedQueries.slice(0, 4),
    });
  };

  for (const family of run.coverage.missingCriticalSourceFamilies) {
    if (family === "competitor") add("direct_competitors", "Find direct products and substitutes serving the same buyer, job, and workflow.", "Competitor recall or entity coverage is incomplete.", { priority: "high", query: `${run.query} direct competitors alternatives pricing reviews` });
    if (family === "user_voice") add("user_voice", "Find first-person complaints, workarounds, switching stories, and repeated failure patterns.", "The evidence gate needs independent user-voice support rather than vendor claims.", { priority: "high", query: `${run.query} complaints workaround switched cancelled forum review` });
    if (family === "commercial") add("spend_wtp", "Find observable current spend, procurement, budget, or willingness-to-pay evidence.", "Commercial evidence is missing from the current snapshot.", { priority: "high", query: `${run.query} pricing budget procurement cost would pay` });
    if (/institutional/.test(family)) add("institutional_regulatory", "Find primary regulatory, standards, government, or research evidence.", "This regulated market lacks an eligible institutional source family.", { priority: "high", query: `${run.query} regulation standard guidance site:.gov` });
  }
  if (run.coverage.commercialEvidenceThin) add("pricing", "Find public pricing pages and buyer-side evidence of what is paid today.", "Commercial evidence is too thin to support pricing or spend claims.", { query: `${run.query} pricing plans per month procurement contract` });

  for (const gate of run.evidenceGates) {
    for (const [check, passed] of Object.entries(gate.checks)) {
      if (passed) continue;
      if (check === "pain" || check === "segment" || check === "buyerSpecificity") add("user_voice", "Find buyer-specific, repeated pain and workaround evidence.", `Candidate ${gate.candidateId} fails the ${check} evidence check.`, { priority: "high", candidateId: gate.candidateId, query: `${run.query} exact buyer complaint manual workaround frequency` });
      else if (check === "spend") add("spend_wtp", "Find current spend or explicit willingness-to-pay evidence from eligible buyer-side or market sources.", `Candidate ${gate.candidateId} fails the spend evidence check.`, { priority: "high", candidateId: gate.candidateId, query: `${run.query} current spend budget quote procurement willingness to pay` });
      else if (check === "competition" || check === "competitorRecall") add("direct_competitors", "Run independent buyer/job and outcome/workaround searches for direct competitors and substitutes.", `Candidate ${gate.candidateId} has incomplete competitor coverage.`, { priority: "high", candidateId: gate.candidateId, query: `${run.query} same buyer same job software service alternatives` });
      else if (check === "timing") add("institutional_regulatory", "Find dated evidence of a regulatory, technology, behavior, or distribution change.", `Candidate ${gate.candidateId} lacks a supported timing signal.`, { candidateId: gate.candidateId, query: `${run.query} 2025 2026 regulation launch adoption change` });
      else if (check === "sourceDiversity" || check === "citationCoverage") add("unresolved_claim", "Find independent sources that directly state the unsupported major claims.", `Candidate ${gate.candidateId} lacks source diversity or eligible citation coverage.`, { priority: "high", candidateId: gate.candidateId, query: `${run.query} independent report survey case study` });
      else if (check === "fatalFalsification") add("failed_attempts", "Find counterevidence, failed attempts, shutdowns, and unfavorable unit economics.", `Candidate ${gate.candidateId} has unresolved fatal falsification risk.`, { priority: "high", candidateId: gate.candidateId, query: `${run.query} failed startup shutdown economics adoption failure` });
    }
  }

  for (const assumption of run.assumptionLedger.filter((item) => ["UNTESTED", "WEAK", "CRITICAL"].includes(item.status))) {
    const category = categoryForAssumption(assumption.dimension);
    add(category, `Resolve assumption: ${compact(assumption.assumption, 220)}`, `${assumption.status} ${assumption.dimension.replaceAll("_", " ")} assumption remains unresolved.`, {
      priority: assumption.status === "CRITICAL" ? "high" : "medium", candidateId: assumption.candidateId,
      query: `${run.query} ${assumption.assumption}`,
    });
  }

  for (const claim of run.claimLineage.filter((item) => item.major && item.supportingEvidenceIds.length === 0).slice(0, 16)) {
    const category = categoryForClaim(claim.claimType);
    add(category, `Find eligible direct support for: ${compact(claim.claim, 220)}`, claim.rationale, {
      priority: "high", claimId: claim.id, query: `${run.query} ${claim.claim}`,
    });
  }

  for (const result of run.falsificationResults) for (const hypothesis of result.hypotheses.filter((item) => item.unknown)) {
    const category: ResearchRequirementCategory = hypothesis.dimension === "switching_cost" ? "switching_cost"
      : hypothesis.dimension === "technical_feasibility" ? "technical_feasibility"
        : hypothesis.dimension === "regulation" || hypothesis.dimension === "liability" ? "institutional_regulatory"
          : hypothesis.dimension === "competition" || hypothesis.dimension === "defensibility" ? "direct_competitors"
            : hypothesis.dimension === "economics" ? "spend_wtp" : "failed_attempts";
    add(category, `Search for counterevidence about ${hypothesis.dimension.replaceAll("_", " ")}: ${compact(hypothesis.statement, 180)}`, "This falsification dimension is explicitly UNKNOWN in the stored evidence.", {
      candidateId: result.candidateId, query: `${run.query} ${hypothesis.statement} failure risk counterexample`,
    });
  }

  const ordered = [...requirements.values()].sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high") || a.category.localeCompare(b.category));
  return {
    runId: run.id,
    retrievalMode: run.retrievalMode,
    evidenceGateStatus: run.stopDecision.status,
    sourceFamilyCoverage: run.coverage.sourceFamilyCoverage,
    missingSourceFamilies: run.coverage.missingCriticalSourceFamilies,
    requirements: ordered.slice(0, 10),
    complete: ordered.length === 0,
    instruction: ordered.length
      ? "Use Claude/web search to collect excerpts that directly address these objectives, then pass the resulting public sources to add_sources_to_run. Novelty did not search the web for this requirements report."
      : "The current stored evidence has no automatically detected retrieval deficits; continue with validation or the recorded next-best action.",
    providerCalls: 0,
  };
}
