import type { Competitor, IdeaCandidate, NoveltyFingerprint, SimilarityResult } from "./types.ts";
import { unique } from "./utils.ts";

const STOP = new Set(["the", "and", "for", "with", "that", "from", "into", "this", "their", "they", "are", "software", "saas", "platform", "tool", "tools", "solution", "system", "product"]);
const CONCEPTS: Array<[string, RegExp]> = [
  ["contractor", /contractor|subcontractor|construction|trades?|home service|field service/i],
  ["small_business", /small business|smb|owner.operator|independent|two.person|small team/i],
  ["enterprise", /enterprise|large compan|mid.market/i],
  ["compliance", /compliance|regulat|audit|certif|certificate of insurance|\bcoi\b/i],
  ["insurance", /insurance|coverage|policy|carrier|insured/i],
  ["third_party_risk", /third.party|vendor|subcontractor|supplier|risk management/i],
  ["tracking", /track|monitor|status|renew|expir|collect|verify/i],
  ["workflow", /workflow|process|handoff|queue|approval|operation/i],
  ["integration", /integrat|connector|api|sync|system boundary|between existing/i],
  ["automation", /automat|rules?|exception.only|passive|ambient/i],
  ["evidence", /proof|record|document|receipt|audit trail|evidence/i],
  ["pricing_subscription", /subscription|per month|per user|seat|annual|contact sales/i],
  ["outcome_pricing", /outcome.based|per outcome|managed service|concierge/i],
  ["direct_sales", /direct|sales team|self.serve|website/i],
  ["partner_channel", /partner|broker|association|marketplace|channel/i],
  ["manual_substitute", /spreadsheet|email|paper|manual|consultant|broker|in.house/i],
  ["finance", /finance|accounting|close|reconcil|controller/i],
  ["engineering", /developer|engineering|devops|ci|test/i],
  ["healthcare", /health|clinical|medical|patient|trial site/i],
];

function stem(token: string): string {
  return token.replace(/(?:ization|ations|ation|ments|ment|ingly|edly|ing|ers|ies|ed|es|s)$/i, (suffix) => suffix === "ies" ? "y" : "");
}

function tokens(value: string | null | undefined): string[] {
  const raw = (value ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .map(stem).filter((token) => token.length > 2 && !STOP.has(token));
  const concepts = CONCEPTS.filter(([, pattern]) => pattern.test(value ?? "")).map(([concept]) => `concept:${concept}`);
  return unique([...raw, ...concepts]);
}

function jaccard(a: string[], b: string[]): number {
  const left = new Set(a); const right = new Set(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / (left.size + right.size - intersection);
}

function containment(a: string[], b: string[]): number {
  const left = new Set(a); const right = new Set(b);
  if (!left.size || !right.size) return 0;
  return [...left].filter((token) => right.has(token)).length / Math.min(left.size, right.size);
}

function structuredOverlap(left: string | null | undefined, right: string | null | undefined): number {
  const a = tokens(left); const b = tokens(right);
  if (!a.length || !b.length) return 0;
  const conceptA = a.filter((item) => item.startsWith("concept:"));
  const conceptB = b.filter((item) => item.startsWith("concept:"));
  const conceptScore = Math.max(jaccard(conceptA, conceptB), containment(conceptA, conceptB) * .9);
  return Math.min(1, Math.max(conceptScore, jaccard(a, b), containment(a, b) * .72));
}

export function fingerprintCandidate(candidate: IdeaCandidate): NoveltyFingerprint {
  const dimensions = {
    targetCustomer: candidate.definition?.companyProfile ?? candidate.targetCustomer,
    jobToBeDone: candidate.jobToBeDone,
    mechanism: candidate.mechanism,
    interface: candidate.interface,
    technology: candidate.technology,
    businessModel: candidate.businessModel,
    distribution: candidate.distribution,
    dataSource: candidate.dataSource,
    ownershipModel: candidate.ownershipModel,
    workflowPosition: candidate.workflowPosition,
    coreDifferentiator: candidate.differentiator,
    desiredOutcome: `${candidate.definition?.economicConsequence ?? ""} ${candidate.differentiator} ${candidate.summary}`,
    integrationsSystemBoundary: `${candidate.interface} ${candidate.dataSource ?? ""} ${candidate.workflowPosition}`,
    pricingBusinessModel: candidate.businessModel,
    distributionContext: candidate.distribution,
  };
  return { candidateId: candidate.id, dimensions, tokens: unique(Object.values(dimensions).flatMap((value) => tokens(value))) };
}

export function fingerprintCompetitor(competitor: Competitor): NoveltyFingerprint {
  const name = competitor.name.value ?? competitor.id;
  const job = competitor.coreJobToBeDone.value ?? competitor.positioning.value ?? "unknown";
  const features = competitor.keyFeatures.value?.join(" ") ?? "unknown";
  const integrations = competitor.intelligence.integrations.value?.join(" ") ?? "";
  const channels = competitor.intelligence.channels.value?.join(" ") ?? "";
  const dimensions = {
    targetCustomer: competitor.targetCustomer.value,
    jobToBeDone: job,
    mechanism: features,
    interface: "software workflow product",
    technology: integrations || null,
    businessModel: competitor.pricing.value,
    distribution: channels || null,
    dataSource: integrations || null,
    ownershipModel: competitor.pricing.value ? "subscription or purchase" : null,
    workflowPosition: competitor.positioning.value ?? job,
    coreDifferentiator: competitor.positioning.value ?? name,
    desiredOutcome: competitor.positioning.value ?? job,
    integrationsSystemBoundary: `${features} ${integrations}`,
    pricingBusinessModel: competitor.pricing.value,
    distributionContext: channels || competitor.positioning.value,
  };
  return { candidateId: competitor.id, dimensions, tokens: unique(Object.values(dimensions).flatMap((value) => tokens(value))) };
}

const DIMENSION_WEIGHTS = {
  targetCustomer: .22, jobToBeDone: .28, workflow: .12, desiredOutcome: .12,
  mechanism: .12, integrationsSystemBoundary: .06, pricingBusinessModel: .04, distributionContext: .04,
} as const;

export function compareFingerprints(left: NoveltyFingerprint, right: NoveltyFingerprint): SimilarityResult {
  const l = left.dimensions; const r = right.dimensions;
  const dimensionScores: Record<keyof typeof DIMENSION_WEIGHTS, number> = {
    targetCustomer: Math.max(structuredOverlap(l.targetCustomer, r.targetCustomer), structuredOverlap(l.targetCustomer, r.jobToBeDone) * .85),
    jobToBeDone: Math.max(structuredOverlap(l.jobToBeDone, r.jobToBeDone), structuredOverlap(l.jobToBeDone, r.coreDifferentiator) * .85),
    workflow: Math.max(structuredOverlap(l.workflowPosition, r.workflowPosition), structuredOverlap(l.interface, r.interface)),
    desiredOutcome: structuredOverlap(l.desiredOutcome ?? l.coreDifferentiator, r.desiredOutcome ?? r.coreDifferentiator),
    mechanism: Math.max(structuredOverlap(l.mechanism, r.mechanism), structuredOverlap(l.technology, r.technology)),
    integrationsSystemBoundary: structuredOverlap(l.integrationsSystemBoundary ?? `${l.interface} ${l.dataSource ?? ""}`, r.integrationsSystemBoundary ?? `${r.interface} ${r.dataSource ?? ""}`),
    pricingBusinessModel: structuredOverlap(l.pricingBusinessModel ?? l.businessModel, r.pricingBusinessModel ?? r.businessModel),
    distributionContext: structuredOverlap(l.distributionContext ?? l.distribution, r.distributionContext ?? r.distribution),
  };
  const matchingDimensions = Object.entries(dimensionScores).filter(([, value]) => value >= .42).map(([key]) => key);
  const nonMatchingDimensions = Object.keys(dimensionScores).filter((key) => !matchingDimensions.includes(key));
  const score = Math.round(Object.entries(DIMENSION_WEIGHTS).reduce((sum, [key, weight]) => sum + dimensionScores[key as keyof typeof dimensionScores] * weight, 0) * 100) / 100;
  return {
    leftId: left.candidateId, rightId: right.candidateId, score, matchingDimensions, nonMatchingDimensions,
    dimensionScores: Object.fromEntries(Object.entries(dimensionScores).map(([key, value]) => [key, Math.round(value * 100) / 100])),
    explanation: `Structured-overlap heuristic (buyer 22%, job 28%, workflow 12%, outcome 12%, mechanism 12%, system boundary 6%, pricing/model 4%, distribution 4%). Matched: ${matchingDimensions.join(", ") || "none"}. Did not match: ${nonMatchingDimensions.join(", ") || "none"}. Names and broad label wording receive no independent weight.`,
    heuristic: true,
  };
}

export function similarityMatrix(candidates: NoveltyFingerprint[], competitors: NoveltyFingerprint[]): SimilarityResult[] {
  const results: SimilarityResult[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    for (const competitor of competitors) results.push(compareFingerprints(candidates[index], competitor));
    for (let other = index + 1; other < candidates.length; other += 1) results.push(compareFingerprints(candidates[index], candidates[other]));
  }
  for (const candidate of candidates) {
    const comparisons = results.filter((item) => item.leftId === candidate.candidateId && competitors.some((competitor) => competitor.candidateId === item.rightId));
    const sameBuyerJob = comparisons.filter((item) => (item.dimensionScores?.targetCustomer ?? 0) >= .35 && (item.dimensionScores?.jobToBeDone ?? 0) >= .35);
    const closest = comparisons.sort((a, b) => b.score - a.score)[0];
    if (sameBuyerJob.length >= 6 && closest && closest.score < .45) {
      closest.score = .45;
      closest.explanation += " Calibration floor applied: six or more purpose-built competitors overlap on buyer and job, so the category cannot be represented as near-greenfield without supported mechanism/outcome evidence.";
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

export function rejectNearDuplicates(candidates: IdeaCandidate[], fingerprints: NoveltyFingerprint[], threshold = 0.72): IdeaCandidate[] {
  const accepted: IdeaCandidate[] = [];
  for (const candidate of candidates) {
    const fingerprint = fingerprints.find((item) => item.candidateId === candidate.id)!;
    if (accepted.some((item) => {
      const sameMechanism = candidate.mechanismFamily === item.mechanismFamily
        || structuredOverlap(`${candidate.mechanismFamily} ${candidate.mechanism}`, `${item.mechanismFamily} ${item.mechanism}`) >= .72;
      return sameMechanism || compareFingerprints(fingerprint, fingerprints.find((other) => other.candidateId === item.id)!).score >= threshold;
    })) continue;
    accepted.push(candidate);
  }
  return accepted;
}
