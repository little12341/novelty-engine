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
  ["field_service", /contractors?|field[- ](?:service|workers?|teams?)|home[- ]service|mobile trad|dispatch|technicians?|job (?:data|records?)/i],
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

function claimCoverage(claim: string, evidence: Evidence) {
  const expected = terms(claim);
  const sourceTerms = new Set(terms(`${evidence.title} ${evidence.summary}`));
  const matched = expected.filter((item) => sourceTerms.has(item));
  const missing = expected.filter((item) => !sourceTerms.has(item));
  return {
    score: expected.length ? Math.round(matched.length / expected.length * 100) / 100 : 0,
    matched,
    missing,
  };
}

function entityMatchesClaim(claim: string, evidence: Evidence): boolean {
  const normalizedClaim = claim.toLowerCase();
  const entity = evidence.pageIdentity.discussedEntity;
  return Boolean(entity && (normalizedClaim.includes(entity.name.toLowerCase())
    || evidence.pageIdentity.explicitEntityNames.some((name) => normalizedClaim.includes(name.toLowerCase()))));
}

function claimSpecificGate(claimType: ResearchClaimType, claim: string, marketContext: string, evidence: Evidence, coverage: number): { passed: boolean; reason: string } {
  const text = `${evidence.title} ${evidence.summary}`;
  if (claimType === "company_existence") {
    const direct = evidence.pageIdentity.entityEligible && ["company_product", "company_pricing", "company_documentation"].includes(evidence.pageIdentity.pageKind)
      && evidence.sourceAssessment.provenance === "company_controlled";
    const independentProfile = evidence.pageIdentity.entityEligible && evidence.pageIdentity.pageKind === "product_profile";
    return { passed: entityMatchesClaim(claim, evidence) && (direct || independentProfile), reason: "Company identity requires an explicit matching entity on an official page or a structured product profile." };
  }
  if (["vendor_feature", "vendor_positioning", "vendor_integration", "vendor_pricing", "competitor_weakness"].includes(claimType)
    && !entityMatchesClaim(`${claim} ${marketContext}`, evidence) && coverage < .45) {
    return { passed: false, reason: "The source does not identify the company or product associated with the claim." };
  }
  if (claimType === "vendor_pricing") {
    const exactAmounts = claim.match(/(?:\$|€|£)\s?\d+(?:[.,]\d+)?/g) ?? [];
    const exact = exactAmounts.every((amount) => text.replace(/\s/g, "").includes(amount.replace(/\s/g, "")));
    const pricingPage = evidence.pageIdentity.pageKind === "company_pricing" && evidence.sourceAssessment.provenance === "company_controlled";
    const datedIndependent = evidence.publicationDate !== null && evidence.sourceAssessment.provenance === "independent_secondary";
    return { passed: (pricingPage || datedIndependent) && exact && /\b(?:price|pricing|plan|cost|free|contact sales|per month|per year)\b|[$€£]\s?\d/i.test(text), reason: "Pricing requires an official pricing page or a clearly dated independent public price that matches the claimed amount." };
  }
  if (claimType === "customer_pain" || claimType === "pain_frequency" || claimType === "customer_workaround" || claimType === "competitor_weakness") {
    return { passed: /\b(?:complain\w*|frustrat\w*|manual\w*|workaround|missing|fail\w*|broken|slow|difficult|hard to use|expensive|unreliable|cancel\w*|switch\w*|stopped using|stopped tracking|went back|paper|spreadsheet|problem|burden)\b/i.test(text), reason: "Pain and weakness claims require explicit complaint, failure, workaround, or switching language." };
  }
  if (claimType === "competitor_relationship") {
    const adequateResolution = /\b(?:adequately solves?|fully solves?|complete solution|same job for the same (?:user|customer)|meets? (?:all|the) (?:needs|requirements)|no meaningful (?:gap|complaint)|eliminates? (?:the )?(?:problem|workaround))\b/i.test(text);
    const namedProductRelationship = entityMatchesClaim(`${claim} ${marketContext}`, evidence)
      && /\b(?:offers?|provides?|built for|designed for|serves?|software|platform|product|service|solution|substitute|alternative)\b/i.test(text);
    return { passed: adequateResolution || namedProductRelationship, reason: "Competitive relationships require either a named product-to-market relationship or explicit same-user, same-job resolution evidence." };
  }
  if (claimType === "unmet_demand" || claimType === "market_gap") {
    return { passed: /\b(?:missing|doesn.?t integrate|does not integrate|no api|manual|workaround|re-enter|copy and paste|unreliable|too expensive|hard to use|not available|enterprise only|no better option|still use|went back|stopped using|burden|delays?)\b/i.test(text), reason: "Unmet-demand claims require an explicit unresolved failure, workaround, exclusion, switching event, or tolerated bad solution." };
  }
  if (claimType === "underserved_status") {
    return { passed: /\b(?:small|independent|regional|rural|remote|specialty|local|three-person|two-person|owner-operator|smb|not available|enterprise only|minimum seats?|underserved|overlooked)\b/i.test(text), reason: "Underserved-segment claims require an explicit affected segment or exclusion condition." };
  }
  if (claimType === "willingness_to_pay") {
    return { passed: /\b(?:would pay|paid|paying|budget|procurement|purchase order|contract value|hiring|consultant|invoice)\b|[$€£]\s?\d/i.test(text), reason: "Willingness-to-pay requires observable spending, procurement, hiring, or an explicit payment statement; engagement and a listed vendor price are insufficient." };
  }
  if (claimType === "market_spend") {
    return { passed: /\b(?:paid|paying|budget|procurement|purchase order|contract value|hiring|consultant|invoice|spend(?:ing)?)\b|[$€£]\s?\d/i.test(text), reason: "Spend claims require observable buyer-side spending, procurement, hiring, or a dated monetary amount." };
  }
  if (claimType === "market_timing") {
    return { passed: Boolean(evidence.publicationDate) && /\b(?:launch|released|effective|mandate|adoption|changed?|increase|decrease|new regulation|new api|202[0-9])\b/i.test(text), reason: "Trend and timing claims require dated change evidence, not search frequency or one undated article." };
  }
  if (claimType === "regulation") return { passed: evidence.sourceAssessment.provenance === "government", reason: "Regulatory claims require a primary government or regulator source." };
  return { passed: coverage >= .35, reason: "The excerpt must support enough of the claim's specific language rather than only its broad market context." };
}

function contradictsClaim(claimType: ResearchClaimType, claim: string, evidence: Evidence, coverage: number): boolean {
  if (coverage < .3) return false;
  const text = `${evidence.title} ${evidence.summary}`;
  if (["customer_pain", "pain_frequency", "customer_workaround"].includes(claimType)) return /\b(?:no recurring complaints?|not a problem|rarely occurs?|users? (?:do not|don't) report)\b/i.test(text);
  if (claimType === "company_existence") return /\b(?:shut down|closed|dissolved|no longer operates?|ceased operations?)\b/i.test(text);
  return /\b(?:does not|doesn't|no longer|never|discontinued|removed|contradicts?|declined|not available|unavailable)\b/i.test(text)
    && !/\b(?:complain|frustrat|missing|fail|broken|problem)\b/i.test(claim);
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
  const exact = claimCoverage(claim, evidence);
  const identityClaim = ["company_existence", "vendor_feature", "vendor_positioning", "vendor_integration", "vendor_pricing", "competitor_relationship"].includes(claimType);
  const excerptSufficient = identityClaim || terms(evidence.summary).length >= 3;
  const broadRelevant = excerptSufficient && (identityClaim
    ? semantic.relevant || evidence.pageIdentity.explicitEntityNames.some((name) => claim.toLowerCase().includes(name.toLowerCase()))
    : semantic.relevant);
  const specific = claimSpecificGate(claimType, claim, marketContext, evidence, exact.score);
  const relevant = broadRelevant && specific.passed;
  const contradicts = roleCompatible && broadRelevant && contradictsClaim(claimType, claim, evidence, exact.score);
  const partialSupport = roleCompatible && broadRelevant && !specific.passed && exact.score > 0;
  const accepted = roleCompatible && relevant && !contradicts;
  const reason = !roleCompatible
    ? `${supportRole} sources are not allowed to establish ${claimType.replaceAll("_", " ")}${evidence.sourceAssessment.discoveryOnly ? "; discovery-only/listicle evidence cannot independently prove this claim" : ""}.`
    : !excerptSufficient
      ? `Rejected by the evidence sufficiency gate; the supplied excerpt is too thin to establish ${claimType.replaceAll("_", " ")}.`
      : contradicts
        ? "The excerpt materially contradicts the associated claim."
      : !broadRelevant
      ? `Rejected by the market relevance gate; matched ${semantic.matchedTerms.join(", ") || "no specific buyer/job/workflow/topic terms"}${semantic.missingAnchors.length ? ` and missed ${semantic.missingAnchors.join(", ")}` : ""}.`
      : !specific.passed
        ? `Only partial or claim-inexact support was found. ${specific.reason}`
      : `Accepted as ${supportRole} support with explicit buyer/job/workflow/topic overlap (${semantic.matchedTerms.join(", ") || "identity signal"}).`;
  return {
    evidenceId: evidence.id, accepted, roleCompatible, relevant, partialSupport, contradicts, supportRole,
    relevanceScore: semantic.score, claimCoverage: exact.score,
    matchedTerms: [...new Set([...semantic.matchedTerms, ...exact.matched])], missingClaimTerms: exact.missing, reason,
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
      : { evidenceId, accepted: false, roleCompatible: false, relevant: false, partialSupport: false, contradicts: false, supportRole: "unknown", relevanceScore: 0, claimCoverage: 0, matchedTerms: [], missingClaimTerms: terms(input.claim), reason: "The cited evidence ID does not exist in the immutable evidence snapshot." };
  });
  const supportingEvidenceIds = evidenceDecisions.filter((item) => item.accepted).map((item) => item.evidenceId);
  const rejectedEvidenceIds = evidenceDecisions.filter((item) => !item.accepted).map((item) => item.evidenceId);
  const accepted = input.evidence.filter((item) => supportingEvidenceIds.includes(item.id));
  const independent = new Set(accepted.map((item) => item.sourceAssessment.independenceGroup)).size;
  const authoritative = accepted.some((item) => {
    const role = evidenceSupportRole(item);
    return role === "government_official" || role === "vendor_controlled" && ["company_existence", "vendor_feature", "vendor_positioning", "vendor_integration", "vendor_pricing", "automation_capability"].includes(input.claimType);
  });
  const contradicted = evidenceDecisions.some((item) => item.contradicts);
  const status: ClaimStatus = contradicted ? "CONTRADICTED" : supportingEvidenceIds.length === 0 ? "UNKNOWN" : independent >= 2 || authoritative ? "VERIFIED" : "INFERRED";
  return {
    id: stableId("claim", input.idSeed ?? `${input.claimType}:${input.claim}:${requestedEvidenceIds.join(":")}`),
    claim: input.claim, claimType: input.claimType, major: input.major !== false, status,
    requestedEvidenceIds, supportingEvidenceIds, rejectedEvidenceIds, evidenceDecisions,
    rationale: contradicted
      ? "At least one role-compatible, relevant evidence record materially contradicts the claim; the claim was not upgraded by repeated support."
      : supportingEvidenceIds.length
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
    const competitorContext = `${result.query} ${competitor.name.value}`;
    add(competitor.name.value ? `${competitor.name.value} exists as a market entity.` : null, "company_existence", competitor.name.evidenceIds, `${competitor.id}:existence`, true, competitorContext);
    add(competitor.classification === "direct_competitor" ? `${competitor.name.value} directly serves the researched buyer/job.` : `${competitor.name.value} is a substitute for the researched workflow.`, "competitor_relationship", competitor.relationship?.evidenceIds ?? [], `${competitor.id}:relationship`, true, competitorContext);
    add(competitor.positioning.value, "vendor_positioning", competitor.positioning.evidenceIds, `${competitor.id}:positioning`, false, competitorContext);
    add(competitor.pricing.value, "vendor_pricing", competitor.pricing.evidenceIds, `${competitor.id}:pricing`, false, competitorContext);
    add(competitor.keyFeatures.value?.join(", "), "vendor_feature", competitor.keyFeatures.evidenceIds, `${competitor.id}:features`, false, competitorContext);
    add(competitor.likelyWeaknesses.value?.join("; "), "competitor_weakness", competitor.likelyWeaknesses.evidenceIds, `${competitor.id}:weaknesses`, true, competitorContext);
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
  const supported = major.filter((item) => item.status !== "CONTRADICTED" && item.supportingEvidenceIds.length > 0);
  return {
    supportedMajorClaims: supported.length,
    totalMajorClaims: major.length,
    roleMismatchedMajorClaims: major.filter((item) => item.evidenceDecisions.some((decision) => !decision.roleCompatible)).length,
    relevanceRejectedMajorClaims: major.filter((item) => item.evidenceDecisions.some((decision) => decision.roleCompatible && !decision.relevant)).length,
    missingEvidenceIdClaims: major.filter((item) => item.evidenceDecisions.some((decision) => /does not exist/i.test(decision.reason))).length,
    partialSupportClaims: major.filter((item) => item.evidenceDecisions.some((decision) => decision.partialSupport)).length,
    contradictedClaims: major.filter((item) => item.status === "CONTRADICTED").length,
    coverageRatio: major.length ? Math.round(supported.length / major.length * 1000) / 1000 : 0,
  };
}
