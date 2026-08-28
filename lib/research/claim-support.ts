import type {
  CitationCoverageAudit, ClaimEvidenceDecision, ClaimLineageRecord, ClaimStatus, Evidence,
  ResearchClaimType, ResearchResult,
} from "./types.ts";
import { stableId } from "./utils.ts";

const STOP_WORDS = new Set([
  "about", "after", "against", "already", "among", "because", "before", "between", "business", "claim", "company",
  "customer", "customers", "existing", "from", "have", "into", "market", "more", "other", "product", "products",
  "report", "software", "source", "system", "systems", "that", "their", "these", "they", "this", "those", "through",
  "tool", "tools", "using", "vendor", "vendors", "with", "workflow", "workflows",
]);

const DOMAIN_CONCEPTS: Array<[string, RegExp]> = [
  ["coi_subcontractor", /certificate(?:s)? of insurance|\bcoi\b|subcontractor insurance|insurance certificate/i],
  ["contracting", /general contractor|specialty trad|subcontractor|construction compan|field service|home service/i],
  ["field_service", /contractors?|field[- ](?:service|workers?|teams?)|home[- ]service|mobile trad|dispatch|technicians?|scheduling|job (?:data|records?)/i],
  ["commercial_cleaning", /commercial clean|local clean|cleaning (?:compan|team|crew|service)|cleaners?|janitorial|proof of service/i],
  ["restaurant_pos", /restaurant|point.of.sale|\bpos\b|food service|hospitality/i],
  ["aquaculture_ozone", /aquaculture|ozone|fish farm|water treatment|oxidation/i],
  ["clinical_research", /clinical[- ](?:trial|research)|research site|sponsor portal|site coordinators?|visit data|patient|fda/i],
  ["finance_close", /month.end|financial close|reconciliation|controller|accounting/i],
  ["software_ci", /continuous integration|\bci\b|flaky[- ]test|test infrastructure|software engineering|developer|platform (?:team|owner)|build (?:team|owner)/i],
  ["food_waste", /food[- ]waste|pantry|grocery|freezer|expiry|expiration/i],
  ["insurance_risk", /insurance|risk transfer|coverage|policy|insured/i],
  ["regulation", /regulat|compliance|mandate|rule|audit/i],
];

const ALLOWED_ROLES: Record<ResearchClaimType, Set<ClaimEvidenceDecision["supportRole"]>> = {
  company_existence: new Set(["vendor_controlled", "independent_market", "marketplace"]),
  vendor_feature: new Set(["vendor_controlled", "independent_market", "technical", "marketplace"]),
  vendor_positioning: new Set(["vendor_controlled", "independent_market"]),
  vendor_integration: new Set(["vendor_controlled", "technical", "independent_market", "marketplace"]),
  vendor_pricing: new Set(["vendor_controlled", "independent_market", "marketplace"]),
  customer_pain: new Set(["user_voice", "independent_market"]),
  pain_frequency: new Set(["user_voice", "independent_market", "technical"]),
  customer_workaround: new Set(["user_voice", "independent_market"]),
  willingness_to_pay: new Set(["user_voice", "independent_market", "marketplace"]),
  unmet_demand: new Set(["user_voice", "independent_market"]),
  underserved_status: new Set(["user_voice", "independent_market"]),
  competitor_weakness: new Set(["user_voice", "independent_market", "technical"]),
  successful_outcome: new Set(["user_voice", "independent_market", "technical"]),
  regulation: new Set(["government_official"]),
  market_spend: new Set(["independent_market", "marketplace", "user_voice"]),
  market_timing: new Set(["government_official", "independent_market", "technical"]),
  automation_capability: new Set(["vendor_controlled", "technical", "independent_market"]),
  competitor_relationship: new Set(["vendor_controlled", "independent_market", "marketplace", "user_voice"]),
  market_gap: new Set(["user_voice", "independent_market", "technical"]),
  candidate_hypothesis: new Set(["user_voice", "independent_market", "technical", "government_official", "marketplace"]),
  falsification_risk: new Set(["user_voice", "independent_market", "technical", "government_official", "marketplace", "vendor_controlled"]),
};

function terms(value: string): string[] {
  return [...new Set(value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .map((item) => item.replace(/(?:ations?|ments?|ingly|edly|ing|ers?|ies|ed|es|s)$/i, ""))
    .filter((item) => item.length >= 4 && !STOP_WORDS.has(item)))];
}

function concepts(value: string): string[] {
  return DOMAIN_CONCEPTS.filter(([, pattern]) => pattern.test(value)).map(([name]) => name);
}

export function evidenceSupportRole(evidence: Evidence): ClaimEvidenceDecision["supportRole"] {
  if (evidence.sourceAssessment.provenance === "company_controlled") return "vendor_controlled";
  if (evidence.sourceAssessment.provenance === "government") return "government_official";
  if (evidence.sourceAssessment.provenance === "user_generated") return "user_voice";
  if (evidence.sourceAssessment.provenance === "marketplace") return "marketplace";
  if (evidence.sourceAssessment.sourceFamily === "technical" || evidence.sourceAssessment.provenance === "research") return "technical";
  if (evidence.sourceAssessment.provenance === "independent_secondary") return "independent_market";
  return "unknown";
}

function relevance(claim: string, marketContext: string, evidence: Evidence) {
  const context = `${claim} ${marketContext}`;
  const expectedTerms = terms(context);
  const sourceText = `${evidence.normalizedUrl} ${evidence.title} ${evidence.summary}`;
  const sourceTerms = new Set(terms(sourceText));
  const matchedTerms = expectedTerms.filter((item) => sourceTerms.has(item));
  const expectedConcepts = concepts(context).filter((item) => item !== "regulation");
  const sourceConcepts = new Set(concepts(sourceText));
  const conceptMatches = expectedConcepts.filter((item) => sourceConcepts.has(item));
  const score = Math.min(1, matchedTerms.length / Math.max(3, Math.min(12, expectedTerms.length)) + conceptMatches.length * .35);
  const relevant = expectedConcepts.length > 0
    ? conceptMatches.length > 0 && (matchedTerms.length >= 1 || score >= .35)
    : matchedTerms.length >= Math.min(2, Math.max(1, expectedTerms.length)) || score >= .18;
  return {
    relevant,
    score: Math.round(score * 100) / 100,
    matchedTerms: [...new Set([...conceptMatches, ...matchedTerms])].slice(0, 12),
    missingAnchors: expectedConcepts.filter((item) => !sourceConcepts.has(item)),
  };
}

export function assessEvidenceForClaim(
  claimType: ResearchClaimType,
  claim: string,
  evidence: Evidence,
  marketContext = "",
): ClaimEvidenceDecision {
  const supportRole = evidenceSupportRole(evidence);
  const roleCompatible = ALLOWED_ROLES[claimType].has(supportRole)
    && !(evidence.sourceAssessment.discoveryOnly && !["company_existence", "vendor_positioning"].includes(claimType));
  const semantic = relevance(claim, marketContext, evidence);
  const identityClaim = ["company_existence", "vendor_feature", "vendor_positioning", "vendor_integration", "vendor_pricing", "competitor_relationship"].includes(claimType);
  const relevant = identityClaim
    ? semantic.relevant || evidence.pageIdentity.explicitEntityNames.some((name) => claim.toLowerCase().includes(name.toLowerCase()))
    : semantic.relevant;
  const accepted = roleCompatible && relevant;
  const reason = !roleCompatible
    ? `${supportRole} sources are not allowed to establish ${claimType.replaceAll("_", " ")}${evidence.sourceAssessment.discoveryOnly ? "; discovery-only/listicle evidence cannot independently prove this claim" : ""}.`
    : !relevant
      ? `Rejected by the market relevance gate; matched ${semantic.matchedTerms.join(", ") || "no specific buyer/job/workflow/topic terms"}${semantic.missingAnchors.length ? ` and missed ${semantic.missingAnchors.join(", ")}` : ""}.`
      : `Accepted as ${supportRole} support with explicit buyer/job/workflow/topic overlap (${semantic.matchedTerms.join(", ") || "identity signal"}).`;
  return {
    evidenceId: evidence.id, accepted, roleCompatible, relevant, supportRole,
    relevanceScore: semantic.score, matchedTerms: semantic.matchedTerms, reason,
  };
}

export function auditClaim(input: {
  claim: string;
  claimType: ResearchClaimType;
  evidenceIds: string[];
  evidence: Evidence[];
  marketContext?: string;
  major?: boolean;
  idSeed?: string;
}): ClaimLineageRecord {
  const requestedEvidenceIds = [...new Set(input.evidenceIds)];
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const evidenceDecisions = requestedEvidenceIds.map((evidenceId): ClaimEvidenceDecision => {
    const record = evidenceById.get(evidenceId);
    return record ? assessEvidenceForClaim(input.claimType, input.claim, record, input.marketContext)
      : { evidenceId, accepted: false, roleCompatible: false, relevant: false, supportRole: "unknown", relevanceScore: 0, matchedTerms: [], reason: "The cited evidence ID does not exist in the immutable evidence snapshot." };
  });
  const supportingEvidenceIds = evidenceDecisions.filter((item) => item.accepted).map((item) => item.evidenceId);
  const rejectedEvidenceIds = evidenceDecisions.filter((item) => !item.accepted).map((item) => item.evidenceId);
  const accepted = input.evidence.filter((item) => supportingEvidenceIds.includes(item.id));
  const independent = new Set(accepted.map((item) => item.sourceAssessment.independenceGroup)).size;
  const authoritative = accepted.some((item) => {
    const role = evidenceSupportRole(item);
    return role === "government_official" || role === "vendor_controlled" && ["company_existence", "vendor_feature", "vendor_positioning", "vendor_integration", "vendor_pricing", "automation_capability"].includes(input.claimType);
  });
  const status: ClaimStatus = supportingEvidenceIds.length === 0 ? "UNKNOWN" : independent >= 2 || authoritative ? "VERIFIED" : "INFERRED";
  return {
    id: stableId("claim", input.idSeed ?? `${input.claimType}:${input.claim}:${requestedEvidenceIds.join(":")}`),
    claim: input.claim, claimType: input.claimType, major: input.major !== false, status,
    requestedEvidenceIds, supportingEvidenceIds, rejectedEvidenceIds, evidenceDecisions,
    rationale: supportingEvidenceIds.length
      ? `${supportingEvidenceIds.length}/${requestedEvidenceIds.length} cited evidence record(s) passed both support-role and relevance gates.`
      : requestedEvidenceIds.length ? "Citations existed, but none were eligible to prove this claim." : "No evidence was attached to this claim.",
  };
}

export function filterEvidenceIdsForClaim(claimType: ResearchClaimType, claim: string, evidenceIds: string[], evidence: Evidence[], marketContext = ""): string[] {
  return auditClaim({ claimType, claim, evidenceIds, evidence, marketContext }).supportingEvidenceIds;
}

function falsificationClaimType(dimension: string): ResearchClaimType {
  if (dimension === "demand" || dimension === "user_behavior") return "pain_frequency";
  if (dimension === "economics" || dimension === "distribution") return "market_spend";
  if (dimension === "regulation" || dimension === "liability") return "regulation";
  if (dimension === "competition") return "unmet_demand";
  if (dimension === "technical_feasibility") return "automation_capability";
  if (dimension === "defensibility") return "competitor_weakness";
  return "falsification_risk";
}

export function buildResearchClaimLineage(result: Pick<ResearchResult,
  "query" | "sources" | "competitors" | "gaps" | "candidates" | "falsificationResults" | "weakSignals" | "companyProfile"
>): ClaimLineageRecord[] {
  const rows: ClaimLineageRecord[] = [];
  const add = (claim: string | null | undefined, claimType: ResearchClaimType, evidenceIds: string[], idSeed: string, major = true, context = result.query) => {
    if (!claim) return;
    rows.push(auditClaim({ claim, claimType, evidenceIds, evidence: result.sources, marketContext: context, major, idSeed }));
  };
  for (const competitor of result.competitors) {
    add(competitor.name.value ? `${competitor.name.value} exists as a market entity.` : null, "company_existence", competitor.name.evidenceIds, `${competitor.id}:existence`);
    add(competitor.classification === "direct_competitor" ? `${competitor.name.value} directly serves the researched buyer/job.` : `${competitor.name.value} is a substitute for the researched workflow.`, "competitor_relationship", competitor.relationship?.evidenceIds ?? [], `${competitor.id}:relationship`);
    add(competitor.positioning.value, "vendor_positioning", competitor.positioning.evidenceIds, `${competitor.id}:positioning`, false);
    add(competitor.pricing.value, "vendor_pricing", competitor.pricing.evidenceIds, `${competitor.id}:pricing`, false);
    add(competitor.keyFeatures.value?.join(", "), "vendor_feature", competitor.keyFeatures.evidenceIds, `${competitor.id}:features`, false);
    add(competitor.likelyWeaknesses.value?.join("; "), "competitor_weakness", competitor.likelyWeaknesses.evidenceIds, `${competitor.id}:weaknesses`);
  }
  for (const gap of result.gaps) {
    add(gap.problemStatement, "customer_pain", gap.supportingEvidenceIds, `${gap.id}:problem`);
    add(gap.currentWorkaround, "customer_workaround", gap.supportingEvidenceIds, `${gap.id}:workaround`);
    add(gap.willingnessToPaySignal, "willingness_to_pay", gap.supportingEvidenceIds, `${gap.id}:wtp`);
    add(gap.affectedSegment ? `${gap.affectedSegment} is underserved in this workflow.` : null, "underserved_status", gap.supportingEvidenceIds, `${gap.id}:segment`);
    add(gap.whySolutionsFail, "competitor_weakness", gap.supportingEvidenceIds, `${gap.id}:incumbent-failure`);
  }
  for (const candidate of result.candidates) {
    add(candidate.definition?.specificProblem, "customer_pain", candidate.definition?.evidenceIds ?? candidate.evidenceIds, `${candidate.id}:problem`);
    add(candidate.definition?.currentWorkaround, "customer_workaround", candidate.definition?.evidenceIds ?? candidate.evidenceIds, `${candidate.id}:workaround`);
    add(candidate.definition?.economicConsequence, "market_spend", candidate.definition?.evidenceIds ?? candidate.evidenceIds, `${candidate.id}:economics`);
    add(candidate.definition?.whyExistingSolutionsFail, "competitor_weakness", candidate.definition?.evidenceIds ?? candidate.evidenceIds, `${candidate.id}:failure`);
    add(candidate.definition?.proposedMechanism ?? candidate.mechanism, "candidate_hypothesis", candidate.evidenceIds, `${candidate.id}:mechanism`, false);
  }
  for (const resultItem of result.falsificationResults) for (const hypothesis of resultItem.hypotheses) {
    add(hypothesis.statement, falsificationClaimType(hypothesis.dimension), [...hypothesis.supportingEvidenceIds, ...hypothesis.counterEvidenceIds], `${resultItem.candidateId}:falsification:${hypothesis.dimension}`);
  }
  for (const signal of result.weakSignals) add(signal.description, "market_timing", signal.evidenceIds, `${signal.id}:timing`);
  if (result.companyProfile) {
    const profile = result.companyProfile;
    add(profile.identity.claim, "company_existence", profile.identity.evidenceIds, `${profile.identity.id}:company-profile`);
    for (const item of profile.productsServices) add(item.claim, "vendor_feature", item.evidenceIds, `${item.id}:product`, false);
    add(profile.pricingBusinessModel.claim, "vendor_pricing", profile.pricingBusinessModel.evidenceIds, `${profile.pricingBusinessModel.id}:pricing`, false);
    for (const item of profile.companyComplaints) add(item.claim, "customer_pain", item.evidenceIds, `${item.id}:complaint`);
    for (const item of profile.underservedSegments) add(item.claim, "underserved_status", item.evidenceIds, `${item.id}:underserved`);
    for (const item of profile.adjacentMarkets) add(item.claim, "competitor_relationship", item.evidenceIds, `${item.id}:adjacent`, false);
  }
  const dedup = new Map<string, ClaimLineageRecord>();
  for (const row of rows) dedup.set(row.id, row);
  return [...dedup.values()];
}

export function citationCoverageAudit(claims: ClaimLineageRecord[]): CitationCoverageAudit {
  const major = claims.filter((item) => item.major);
  const supported = major.filter((item) => item.supportingEvidenceIds.length > 0);
  return {
    supportedMajorClaims: supported.length,
    totalMajorClaims: major.length,
    roleMismatchedMajorClaims: major.filter((item) => item.evidenceDecisions.some((decision) => !decision.roleCompatible)).length,
    relevanceRejectedMajorClaims: major.filter((item) => item.evidenceDecisions.some((decision) => decision.roleCompatible && !decision.relevant)).length,
    coverageRatio: major.length ? Math.round(supported.length / major.length * 1000) / 1000 : 0,
  };
}
