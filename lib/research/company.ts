import { auditClaim } from "./claim-support.ts";
import { normalizeOrganizationName } from "./entity-resolution.ts";
import type {
  CompanyProfile, ComplaintCluster, Competitor, Evidence, FinalOpportunity, ResearchClaimType, TraceableClaim,
  UnderservedSegment, ValidationExperiment,
} from "./types.ts";

export function requestedCompanyIdentity(query: string): { name: string; normalizedName: string } | null {
  const cleaned = query.replace(/^\s*\/(?:research-company|company)\s+/i, "").trim();
  const match = cleaned.match(/^(?:research|analy[sz]e|investigate|profile|look into)\s+(?:the\s+company\s+)?(.+?)(?=\s+(?:as\s+a\s+company|and\s+(?:its|their)|company\b|competitors?\b|pricing\b|products?\b)|[,.;]|$)/i);
  let name = match?.[1]?.trim() ?? "";
  name = name.replace(/^(?:a|an|the)\s+/i, "").trim();
  if (!name || /\b(?:market|industry|software company|category|business idea)\b/i.test(name) || name.split(/\s+/).length > 4) return null;
  const normalizedName = normalizeOrganizationName(name);
  return normalizedName.length >= 2 ? { name, normalizedName } : null;
}

function sourceMatchesIdentity(item: Evidence, normalizedName: string): boolean {
  const domainStem = normalizeOrganizationName(item.pageIdentity.canonicalDomain.split(".")[0]);
  return domainStem.includes(normalizedName) || normalizedName.includes(domainStem)
    || item.pageIdentity.explicitEntityNames.some((name) => {
      const normalized = normalizeOrganizationName(name);
      return normalized === normalizedName || normalized.includes(normalizedName) || normalizedName.includes(normalized);
    });
}

function auditedClaim(
  label: string,
  claimType: ResearchClaimType,
  evidenceIds: string[],
  evidence: Evidence[],
  context: string,
  rationale: string,
): TraceableClaim {
  const audit = auditClaim({ claim: label, claimType, evidenceIds, evidence, marketContext: context });
  return {
    id: audit.id, claim: label, status: audit.status, evidenceIds: audit.supportingEvidenceIds,
    rationale: `${rationale} ${audit.rationale}`, claimType, supportAudit: audit.evidenceDecisions,
  };
}

export function buildCompanyProfile(input: {
  query: string;
  evidence: Evidence[];
  competitors: Competitor[];
  complaints: ComplaintCluster[];
  segments: UnderservedSegment[];
  opportunities: FinalOpportunity[];
}): CompanyProfile {
  const requested = requestedCompanyIdentity(input.query);
  const targetEvidence = requested ? input.evidence.filter((item) => sourceMatchesIdentity(item, requested.normalizedName)) : input.evidence;
  const controlled = targetEvidence.filter((item) => item.sourceAssessment.provenance === "company_controlled"
    && item.pageIdentity.entityEligible && !item.sourceAssessment.discoveryOnly && item.relevanceAssessment.acceptedForMarket);
  const anchorDomain = controlled[0]?.pageIdentity.canonicalDomain ?? null;
  const targetName = requested?.name ?? controlled[0]?.pageIdentity.explicitEntityNames[0] ?? "Requested company";
  const normalizedTarget = requested?.normalizedName ?? normalizeOrganizationName(targetName);
  const context = `${input.query} ${targetName}`;
  const thirdParty = targetEvidence.filter((item) => item.sourceAssessment.provenance !== "company_controlled" && item.relevanceAssessment.acceptedForMarket);
  const pricing = controlled.filter((item) => item.sourceType === "pricing" || /\bpricing|\bplans?|\$\d|per month|contact sales/i.test(`${item.title} ${item.summary}`));
  const complaintEvidence = thirdParty.filter((item) => item.sourceAssessment.sourceFamily === "user_voice"
    && /complain|frustrat|manual|workaround|missing|fail|expensive|unreliable|difficult|slow/i.test(item.summary));
  const identityEvidence = controlled.slice(0, 3);
  const productClaims = controlled.slice(0, 8).map((item) => auditedClaim(
    item.summary, "vendor_feature", [item.id], input.evidence, context,
    "Product or service description is limited to a company-controlled public statement, not independent outcome validation.",
  ));
  const targetClaims = controlled.filter((item) => /\bfor\s+\w|serves?|built for|designed for/i.test(item.summary)).slice(0, 5).map((item) => auditedClaim(
    item.summary, "vendor_positioning", [item.id], input.evidence, context, "Target-user positioning is reported as the company's public positioning.",
  ));
  const companyComplaints = complaintEvidence.slice(0, 8).map((item) => auditedClaim(
    item.summary, "customer_pain", [item.id], input.evidence, context, "Complaint evidence must come from eligible user voice and explicitly match the requested company/market.",
  ));
  const categoryComplaints = input.complaints.slice(0, 8).map((item) => auditedClaim(
    item.normalizedProblem, "customer_pain", item.representativeEvidenceIds, input.evidence, context,
    "Category complaint cluster is bounded to eligible public user voice; recurrence and independence remain visible.",
  ));
  const directCompetitors = input.competitors.filter((item) => item.classification === "direct_competitor"
    && normalizeOrganizationName(item.name.value ?? "") !== normalizedTarget
    && (!anchorDomain || item.canonicalDomain !== anchorDomain));
  const substitutes = input.competitors.filter((item) => item.classification === "substitute");
  const validationActions: ValidationExperiment[] = input.opportunities.slice(0, 3).map((item) => item.validationExperiment);
  const identityLabel = `${targetName} is the requested company identity.`;
  const unknowns = [
    controlled.length === 0 && `Company-controlled public evidence matching ${targetName} was not retrieved; unrelated result identities were not substituted.`,
    pricing.length === 0 && "Pricing or business model is UNKNOWN from matching retrieved evidence.",
    directCompetitors.length === 0 && "Direct competitors are UNKNOWN; absence from retrieval is not proof of no competitors.",
    complaintEvidence.length === 0 && "Company-specific complaint evidence is thin or unavailable.",
  ].filter((item): item is string => Boolean(item));
  return {
    requestedIdentity: { name: targetName, normalizedName: normalizedTarget, canonicalDomain: anchorDomain },
    identity: auditedClaim(identityLabel, "company_existence", identityEvidence.map((item) => item.id), input.evidence, context,
      identityEvidence.length ? "The requested identity is anchored to matching canonical domain and brand signals." : "The requested identity is preserved but remains unsupported."),
    productsServices: productClaims,
    targetUsers: targetClaims,
    apparentPositioning: auditedClaim(controlled[0]?.summary ?? `Positioning for ${targetName} is UNKNOWN.`, "vendor_positioning", controlled[0] ? [controlled[0].id] : [], input.evidence, context,
      "Positioning is limited to a matching company-controlled description unless eligible third-party evidence corroborates it."),
    pricingBusinessModel: auditedClaim(pricing[0]?.summary ?? `Pricing for ${targetName} is UNKNOWN.`, "vendor_pricing", pricing.map((item) => item.id), input.evidence, context,
      "Only matching publicly retrieved pricing or packaging language is reported."),
    directCompetitorIds: directCompetitors.map((item) => item.id),
    indirectSubstitutes: substitutes.slice(0, 6).map((item) => auditedClaim(
      `${item.name.value ?? "Unknown entity"} is a substitute for part of the workflow.`, "competitor_relationship", item.relationship?.evidenceIds ?? item.evidenceIds,
      input.evidence, context, "Substitute classification comes from the normalized entity graph, not the source-page title.")),
    companyComplaints,
    categoryComplaints,
    competitorStrengthsWeaknesses: directCompetitors.slice(0, 8).map((item) => auditedClaim(
      [item.name.value, ...(item.likelyStrengths.value ?? []), ...(item.likelyWeaknesses.value ?? [])].filter(Boolean).join(": ") || "Competitor strengths and weaknesses are UNKNOWN.",
      "competitor_weakness", item.likelyWeaknesses.evidenceIds, input.evidence, context,
      "Weaknesses require eligible user voice or independent/technical evidence; vendor positioning alone is not treated as weakness proof.")),
    underservedSegments: input.segments.map((item) => auditedClaim(item.rationale, "underserved_status", item.evidenceIds, input.evidence, context,
      "Underserved status requires eligible user voice or independent market evidence.")),
    threats: input.opportunities.flatMap((item) => item.falsification.decisiveRisks).slice(0, 8).map((item) => auditedClaim(item.reason, "falsification_risk", item.evidenceIds, input.evidence, context,
      "Threat carried forward from adversarial falsification with role/relevance-compatible evidence only.")),
    differentiationOpportunities: input.opportunities.slice(0, 5).map((item) => auditedClaim(item.candidate.differentiator, "candidate_hypothesis", item.candidate.evidenceIds, input.evidence, context,
      "Proposed differentiation is a research hypothesis, not a factual claim about market success.")),
    adjacentMarkets: substitutes.slice(0, 5).map((item) => auditedClaim(
      `${item.name.value ?? "Unknown substitute"} represents an adjacent/substitute workflow.`, "competitor_relationship", item.relationship?.evidenceIds ?? item.evidenceIds,
      input.evidence, context, "Adjacent markets are derived from normalized substitute entities rather than article or report titles.")),
    validationActions,
    factsFromCompanyControlledSources: controlled.map((item) => item.id),
    thirdPartyEvidenceIds: thirdParty.map((item) => item.id),
    unknowns,
  };
}
