import { traceableClaim } from "./quality.ts";
import type {
  CompanyProfile, ComplaintCluster, Competitor, Evidence, FinalOpportunity, TraceableClaim,
  UnderservedSegment, ValidationExperiment,
} from "./types.ts";

function claim(label: string, evidenceIds: string[], evidence: Evidence[], rationale: string): TraceableClaim {
  return traceableClaim(label, evidenceIds, evidence, rationale);
}

export function buildCompanyProfile(input: {
  query: string;
  evidence: Evidence[];
  competitors: Competitor[];
  complaints: ComplaintCluster[];
  segments: UnderservedSegment[];
  opportunities: FinalOpportunity[];
}): CompanyProfile {
  const controlled = input.evidence.filter((item) => item.sourceAssessment.provenance === "company_controlled");
  const thirdParty = input.evidence.filter((item) => item.sourceAssessment.provenance !== "company_controlled");
  const pricing = input.evidence.filter((item) => item.sourceType === "pricing" || /\bpricing|\bplans?|\$\d|per month|contact sales/i.test(`${item.title} ${item.summary}`));
  const complaintEvidence = input.evidence.filter((item) => ["user_voice", "technical"].includes(item.sourceAssessment.sourceFamily)
    && /complain|frustrat|manual|workaround|missing|fail|expensive|unreliable|difficult|slow/i.test(item.summary));
  const identityEvidence = controlled.slice(0, 2);
  const identityText = identityEvidence[0]?.title ?? `Public identity for ${input.query} was not established`;
  const productClaims = controlled.slice(0, 8).map((item) => claim(item.summary, [item.id], input.evidence, "Product or service description from a company-controlled public source; this is a company claim, not independent validation."));
  const targetClaims = input.competitors.filter((item) => item.targetCustomer.value).slice(0, 5).map((item) => claim(
    item.targetCustomer.value!, item.targetCustomer.evidenceIds, input.evidence, "Target-user description extracted from cited public material.",
  ));
  const companyComplaints = complaintEvidence.filter((item) => controlled.some((source) => new URL(source.normalizedUrl).hostname === new URL(item.normalizedUrl).hostname))
    .map((item) => claim(item.summary, [item.id], input.evidence, "Complaint-like public evidence associated with the company domain or support surface."));
  const categoryComplaints = input.complaints.slice(0, 8).map((item) => claim(
    item.normalizedProblem, item.representativeEvidenceIds, input.evidence, "Complaint cluster from public user-voice evidence; recurrence and independence remain visible in the evidence records.",
  ));
  const validationActions: ValidationExperiment[] = input.opportunities.slice(0, 3).map((item) => item.validationExperiment);
  const unknowns = [
    controlled.length === 0 && "Company-controlled public site evidence was not retrieved.",
    pricing.length === 0 && "Pricing or business model is UNKNOWN from retrieved evidence.",
    input.competitors.length === 0 && "Direct competitors are UNKNOWN; absence from retrieval is not proof of no competitors.",
    complaintEvidence.length === 0 && "Company and category complaint evidence is thin or unavailable.",
  ].filter((item): item is string => Boolean(item));
  return {
    identity: claim(identityText, identityEvidence.map((item) => item.id), input.evidence, identityEvidence.length ? "Identity inferred from company-controlled public pages." : "No qualifying identity evidence was retrieved."),
    productsServices: productClaims,
    targetUsers: targetClaims,
    apparentPositioning: claim(controlled[0]?.summary ?? "Apparent positioning is UNKNOWN.", controlled[0] ? [controlled[0].id] : [], input.evidence, "Apparent positioning is limited to the company's own public description unless third-party evidence corroborates it."),
    pricingBusinessModel: claim(pricing[0]?.summary ?? "Pricing or business model is UNKNOWN.", pricing.map((item) => item.id), input.evidence, "Only publicly retrieved pricing or packaging language is reported."),
    directCompetitorIds: input.competitors.map((item) => item.id),
    indirectSubstitutes: input.evidence.filter((item) => item.searchAngleIds.some((id) => /angle_02/.test(id))).slice(0, 6).map((item) => claim(item.summary, [item.id], input.evidence, "Potential indirect substitute from the adjacent-category search; classification is inferred.")),
    companyComplaints,
    categoryComplaints,
    competitorStrengthsWeaknesses: input.competitors.slice(0, 8).map((item) => claim(
      [item.name.value, ...(item.likelyStrengths.value ?? []), ...(item.likelyWeaknesses.value ?? [])].filter(Boolean).join(": ") || "Competitor strengths and weaknesses are UNKNOWN.",
      item.evidenceIds, input.evidence, "Strengths and weaknesses are bounded to cited public evidence and remain inferred where indirect.",
    )),
    underservedSegments: input.segments.map((item) => claim(item.rationale, item.evidenceIds, input.evidence, "Underserved-segment hypothesis derived from cited evidence.")),
    threats: input.opportunities.flatMap((item) => item.falsification.decisiveRisks).slice(0, 8).map((item) => claim(item.reason, item.evidenceIds, input.evidence, "Threat carried forward from adversarial falsification.")),
    differentiationOpportunities: input.opportunities.slice(0, 5).map((item) => claim(item.candidate.differentiator, item.candidate.evidenceIds, input.evidence, "Proposed differentiation backed by opportunity lineage; it is not a factual claim about market success.")),
    adjacentMarkets: input.evidence.filter((item) => item.searchAngleIds.some((id) => /angle_02/.test(id))).slice(0, 5).map((item) => claim(item.title, [item.id], input.evidence, "Adjacent market inferred from the substitute/category search.")),
    validationActions,
    factsFromCompanyControlledSources: controlled.map((item) => item.id),
    thirdPartyEvidenceIds: thirdParty.map((item) => item.id),
    unknowns,
  };
}
