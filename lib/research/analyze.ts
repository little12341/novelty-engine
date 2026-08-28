import { createHash } from "node:crypto";
import type {
  ComplaintCluster,
  Competitor,
  Evidence,
  GapType,
  SupportedValue,
  UnderservedSegment,
} from "./types.ts";
import { normalizeOrganizationName, preferredEntityName } from "./entity-resolution.ts";

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 10)}`;
}

function supported<T>(value: T | null, evidenceIds: string[], confidence: number): SupportedValue<T> {
  return { value, evidenceIds: value === null ? [] : evidenceIds, confidence: value === null ? 0 : confidence };
}

const FEATURE_TERMS = ["scheduling", "invoicing", "automation", "mobile", "reporting", "payments", "integrations", "collaboration", "compliance", "certificate tracking", "insurance", "vendor management", "risk", "procurement", "analytics", "crm", "marketplace", "workflow"];
const PRODUCT_RELATIONSHIP = /\b(?:offers?|provides?|built for|designed for|serves?|software|saas|platform|product|service|application|app|tool|system|solution|automation|helps?|enables?)\b/i;
const DISCUSSION_TYPES = new Set(["reddit", "forum", "github", "review", "app_marketplace"]);
const EXPERIENCE_VERB = String.raw`(?:use|used|using|tried|run|manage|work|spent|pay|paid|switch|switched|went|return|struggl|miss|chase|worr|disappoint|frustrat|cop(?:y|ies|ied)|re[- ]?enter|export|maintain|track|email|reconcil|have|has)\w*`;
const DIRECT_EXPERIENCE = new RegExp(String.raw`\b(?:i|we|my|our)\b[^.?!]{0,120}\b${EXPERIENCE_VERB}`, "i");
const ATTRIBUTED_EXPERIENCE = new RegExp(String.raw`\b(?:customers?|contractors?|reviewers?|participants?|operators?|coordinators?|managers?|users?|teams?|workers?|companies)\s+(?:says?|report|reports|describe|describes)\b[^.?!]{0,120}\b${EXPERIENCE_VERB}`, "i");
const RESEARCH_PROMPT = /\b(?:trying to understand|would love to hear|asks? whether|few questions|looking for feedback|market-research prompt|survey)\b/i;

function hasDirectCustomerExperience(item: Evidence): boolean {
  const text = `${item.title}. ${item.summary}`;
  if (RESEARCH_PROMPT.test(text)) return false;
  return DIRECT_EXPERIENCE.test(text) || ATTRIBUTED_EXPERIENCE.test(text);
}

function extractFeatures(text: string): string[] {
  const lower = text.toLowerCase();
  return FEATURE_TERMS.filter((term) => lower.includes(term)).slice(0, 6);
}

function extractPricing(text: string): string | null {
  const match = text.match(/(?:\$|€|£)\s?\d+(?:[.,]\d+)?(?:\s*(?:\/|per)\s*(?:month|mo|year|yr|user))?/i);
  if (match) return match[0];
  const phrase = text.match(/\b(?:free plan|free trial|contact sales|custom pricing|starts? at [^.]{1,50})/i);
  return phrase?.[0] ?? null;
}

function extractTargetCustomer(text: string): string | null {
  const match = text.match(/\bfor\s+((?:(?:small|mid[- ]?market|independent|growing|solo|regulated|commercial|general|specialty)\s+){0,3}(?:contractors?|subcontractors?|construction (?:companies|teams|firms)|home service companies|creators?|finance teams?|field teams?|operations teams?|compliance teams?|risk teams?|engineering teams?|developers?|agencies|companies|businesses|operators|professionals|enterprises?|smbs?))\b/i);
  return match?.[1] ?? null;
}

function competitorGroupKey(item: Evidence): string {
  const name = preferredEntityName(item);
  const isProfile = item.pageIdentity.pageKind === "product_profile";
  return isProfile && name ? `brand:${normalizeOrganizationName(name)}` : `domain:${item.pageIdentity.canonicalDomain}`;
}

function explicitEntityMention(item: Evidence, aliases: string[], domainStem: string): boolean {
  const text = `${item.title} ${item.summary}`;
  return [...aliases, domainStem].some((value) => value.length >= 4
    && new RegExp(`(?:^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(text));
}

function parentCompany(text: string, brand: string): string | null {
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const byline = text.match(new RegExp(`\\b${escaped}\\b[^.]{0,50}?\\b(?:by|from|owned by|a (?:product|brand|subsidiary) of)\\s+([A-Z][A-Za-z0-9&.' -]{2,60})`, "i"));
  return byline?.[1]?.trim().replace(/[.,;:]$/, "") ?? null;
}

function observedDate(items: Evidence[], edge: "first" | "last"): string {
  const dates = items.map((item) => item.retrievedAt).filter((value) => !Number.isNaN(new Date(value).getTime())).sort();
  return (edge === "first" ? dates[0] : dates.at(-1)) ?? new Date(0).toISOString();
}

function snippets(items: Evidence[], pattern: RegExp, limit = 4): { values: string[]; ids: string[] } {
  const matched = items.filter((item) => pattern.test(`${item.title} ${item.summary}`)).slice(0, limit);
  return { values: matched.map((item) => item.summary), ids: matched.map((item) => item.id) };
}

export function extractCompetitors(evidence: Evidence[]): Competitor[] {
  const eligible = evidence.filter((item) => item.pageIdentity.entityEligible && item.relevanceAssessment.acceptedForMarket
    && !item.sourceAssessment.discoveryOnly);
  const grouped = new Map<string, Evidence[]>();
  for (const item of eligible) {
    const key = competitorGroupKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  const extracted = [...grouped.entries()].slice(0, 30).map(([, items]) => {
    const primary = items.find((item) => ["company_product", "company_pricing", "company_documentation"].includes(item.pageIdentity.pageKind)) ?? items[0];
    const host = new URL(primary.normalizedUrl).hostname.replace(/^(app|docs|help|support)\./, "");
    const allText = items.map((item) => `${item.title}. ${item.summary}`).join(" ");
    const ids = items.map((item) => item.id);
    const directIdentityEvidence = items.filter((item) => ["company_product", "company_pricing", "company_documentation"].includes(item.pageIdentity.pageKind)
      && item.sourceAssessment.provenance === "company_controlled" && item.pageIdentity.discussedEntity);
    const independentIdentityCount = new Set(items.filter((item) => item.pageIdentity.pageKind === "product_profile")
      .map((item) => item.sourceAssessment.independenceGroup)).size;
    if (directIdentityEvidence.length === 0 && independentIdentityCount < 2) return null;
    const relationshipEvidence = items.filter((item) => item.pageIdentity.claimedCompetitiveRole === "competitor_candidate"
      && item.relevanceAssessment.acceptedForMarket
      && (PRODUCT_RELATIONSHIP.test(`${item.title} ${item.summary}`)
        || item.sourceAssessment.provenance === "company_controlled" && ["company_product", "company_pricing", "company_documentation"].includes(item.pageIdentity.pageKind)));
    if (relationshipEvidence.length === 0) return null;
    const pricingEvidence = items.find((item) => item.sourceType === "pricing" && item.pageIdentity.pageKind === "company_pricing"
      && extractPricing(`${item.title} ${item.summary}`));
    const pricing = pricingEvidence ? extractPricing(`${pricingEvidence.title} ${pricingEvidence.summary}`) : null;
    const features = extractFeatures(allText);
    const positioning = primary.summary || null;
    const name = preferredEntityName(primary) ?? items.map(preferredEntityName).find((item): item is string => Boolean(item));
    if (!name) return null;
    const hostStem = host.split(".")[0];
    const aliases = [...new Set(items.flatMap((item) => item.pageIdentity.explicitEntityNames).filter(Boolean))];
    const weaknessEvidence = evidence.filter((item) => DISCUSSION_TYPES.has(item.sourceType)
      && item.relevanceAssessment.acceptedForMarket && !item.sourceAssessment.discoveryOnly
      && hasDirectCustomerExperience(item)
      && explicitEntityMention(item, aliases, hostStem));
    const target = extractTargetCustomer(allText);
    const mentions = evidence.filter((item) => item.relevanceAssessment.acceptedForMarket && explicitEntityMention(item, aliases, hostStem));
    const funding = snippets(mentions, /raised|funding|series [a-z]|venture|seed round/i, 2);
    const headcount = mentions.find((item) => /\b\d+[,+]? employees|headcount|team of \d+/i.test(`${item.title} ${item.summary}`));
    const hiring = snippets(mentions, /hiring|job opening|careers|recruit/i);
    const traffic = mentions.find((item) => /monthly visits|traffic|unique visitors|web visits/i.test(`${item.title} ${item.summary}`));
    const reviews = snippets(mentions, /review|rated|stars?|g2|capterra|trustpilot/i);
    const complaints = snippets(mentions.filter((item) => DISCUSSION_TYPES.has(item.sourceType)), /missing|too expensive|unreliable|poor|broken|cancel|switched|manual|complain/i);
    const partnerships = snippets(mentions, /partner|partnership|alliance|reseller/i);
    const integrations = snippets(mentions, /integrat|api|connector|webhook/i);
    const channels = snippets(mentions, /marketplace|agency|partner channel|direct sales|self.serve|app store/i);
    const launches = snippets(mentions, /launch|released|introduced|announced|new product/i);
    const strategic = mentions.find((item) => /strategy|roadmap|expanding|focus|positioning|mission/i.test(`${item.title} ${item.summary}`));
    const completeIds = [...new Set([
      ...ids,
      ...weaknessEvidence.map((item) => item.id),
      ...funding.ids, ...hiring.ids, ...reviews.ids, ...complaints.ids, ...partnerships.ids,
      ...integrations.ids, ...channels.ids, ...launches.ids,
      ...(headcount ? [headcount.id] : []), ...(traffic ? [traffic.id] : []), ...(strategic ? [strategic.id] : []),
    ])];
    const substituteLanguage = /\b(?:manual|spreadsheet|paper|shared inbox|consultant|broker|agency service|outsourced|in-house|do it yourself|diy)\b/i.test(allText)
      && !/\b(?:software|saas|platform|application|automation product)\b/i.test(allText);
    const substituteOnly = substituteLanguage || items.every((item) => item.searchAngleIds.some((id) => /adjacent|substitute/i.test(id))
      && !item.searchAngleIds.some((id) => /direct|competitor_primary|competitor_crosscheck|competitor_escalation/i.test(id)));
    const entityDomain = directIdentityEvidence[0]?.pageIdentity.canonicalDomain ?? null;
    const canonicalOrganizationId = entityDomain ? `org:${entityDomain}` : `brand:${normalizeOrganizationName(name)}`;
    const classification = substituteOnly ? "substitute" as const : "direct_competitor" as const;
    return {
      id: stableId("comp", canonicalOrganizationId), canonicalOrganizationId, canonicalDomain: entityDomain,
      name: supported(name, [primary.id], 0.72),
      website: entityDomain ? `https://${entityDomain}/` : primary.normalizedUrl,
      targetCustomer: supported(target, target ? ids : [], target ? 0.68 : 0),
      coreJobToBeDone: supported(positioning, [primary.id], 0.58),
      pricing: supported(pricing, pricingEvidence && pricing ? [pricingEvidence.id] : [], pricing ? 0.82 : 0),
      keyFeatures: supported(features.length ? features : null, features.length ? ids : [], features.length ? 0.65 : 0),
      positioning: supported(positioning, [primary.id], 0.65),
      likelyStrengths: supported(features.length ? features.slice(0, 3) : null, features.length ? ids : [], features.length ? 0.55 : 0),
      likelyWeaknesses: supported(weaknessEvidence.length ? weaknessEvidence.slice(0, 3).map((item) => item.summary) : null, weaknessEvidence.map((item) => item.id), weaknessEvidence.length ? 0.65 : 0),
      relationship: supported<"direct" | "substitute">(substituteOnly ? "substitute" : "direct", relationshipEvidence.map((item) => item.id), .64),
      classification,
      aliases,
      productBrand: name,
      parentCompany: parentCompany(allText, name),
      entityFingerprint: canonicalOrganizationId,
      firstObservedDate: observedDate(items, "first"),
      mostRecentObservedDate: observedDate(items, "last"),
      independentSourceCount: new Set(items.map((item) => item.sourceAssessment.independenceGroup)).size,
      supportingEvidenceCount: ids.length,
      counterEvidenceCount: weaknessEvidence.length,
      sourceFamilyCoverage: [...new Set(items.map((item) => item.sourceAssessment.sourceFamily))],
      competitorStatus: directIdentityEvidence.length || independentIdentityCount >= 2 ? "supported" : "uncertain",
      materialChangeSincePreviousRun: null,
      intelligence: {
        funding: supported(funding.values[0] ?? null, funding.ids, funding.ids.length ? .6 : 0),
        headcount: supported(headcount?.summary ?? null, headcount ? [headcount.id] : [], headcount ? .6 : 0),
        hiring: supported(hiring.values.length ? hiring.values : null, hiring.ids, hiring.ids.length ? .65 : 0),
        traffic: supported(traffic?.summary ?? null, traffic ? [traffic.id] : [], traffic ? .5 : 0),
        reviews: supported(reviews.values.length ? reviews.values : null, reviews.ids, reviews.ids.length ? .65 : 0),
        complaints: supported(complaints.values.length ? complaints.values : null, complaints.ids, complaints.ids.length ? .68 : 0),
        partnerships: supported(partnerships.values.length ? partnerships.values : null, partnerships.ids, partnerships.ids.length ? .6 : 0),
        integrations: supported(integrations.values.length ? integrations.values : null, integrations.ids, integrations.ids.length ? .7 : 0),
        channels: supported(channels.values.length ? channels.values : null, channels.ids, channels.ids.length ? .6 : 0),
        launches: supported(launches.values.length ? launches.values : null, launches.ids, launches.ids.length ? .6 : 0),
        strategicDirection: supported(strategic?.summary ?? null, strategic ? [strategic.id] : [], strategic ? .5 : 0),
      },
      evidenceIds: completeIds,
      sourcePageIds: ids,
    };
  }).filter((item) => item !== null) as Competitor[];
  const deduplicated: Competitor[] = [];
  for (const competitor of extracted) {
    const nameKey = normalizeOrganizationName(competitor.name.value ?? competitor.id);
    const existing = deduplicated.find((item) => item.canonicalDomain && competitor.canonicalDomain
      ? item.canonicalDomain === competitor.canonicalDomain
      : !item.canonicalDomain && !competitor.canonicalDomain && normalizeOrganizationName(item.name.value ?? item.id) === nameKey);
    if (!existing) { deduplicated.push(competitor); continue; }
    existing.evidenceIds = [...new Set([...existing.evidenceIds, ...competitor.evidenceIds])];
    existing.sourcePageIds = [...new Set([...existing.sourcePageIds, ...competitor.sourcePageIds])];
    existing.aliases = [...new Set([...existing.aliases, ...competitor.aliases])];
    existing.independentSourceCount = Math.max(existing.independentSourceCount, competitor.independentSourceCount);
    existing.supportingEvidenceCount = existing.sourcePageIds.length;
    existing.counterEvidenceCount = new Set([...existing.likelyWeaknesses.evidenceIds, ...competitor.likelyWeaknesses.evidenceIds]).size;
    existing.sourceFamilyCoverage = [...new Set([...existing.sourceFamilyCoverage, ...competitor.sourceFamilyCoverage])];
    existing.firstObservedDate = [existing.firstObservedDate, competitor.firstObservedDate].sort()[0];
    existing.mostRecentObservedDate = [existing.mostRecentObservedDate, competitor.mostRecentObservedDate].sort().at(-1)!;
    if (!existing.canonicalDomain && competitor.canonicalDomain) {
      existing.canonicalDomain = competitor.canonicalDomain;
      existing.canonicalOrganizationId = competitor.canonicalOrganizationId;
      existing.website = competitor.website;
    }
    for (const field of ["targetCustomer", "coreJobToBeDone", "pricing", "keyFeatures", "positioning", "likelyStrengths", "likelyWeaknesses", "relationship"] as const) {
      const incoming = competitor[field];
      if (incoming && existing[field] && existing[field]!.value === null && incoming.value !== null) Object.assign(existing[field]!, incoming);
      else if (incoming && existing[field]) existing[field]!.evidenceIds = [...new Set([...existing[field]!.evidenceIds, ...incoming.evidenceIds])];
    }
    for (const [field, incoming] of Object.entries(competitor.intelligence)) {
      const current = existing.intelligence[field as keyof Competitor["intelligence"]];
      if (current.value === null && incoming.value !== null) Object.assign(current, incoming);
      else current.evidenceIds = [...new Set([...current.evidenceIds, ...incoming.evidenceIds])];
    }
  }
  return deduplicated;
}

interface ComplaintRule {
  label: string;
  type: GapType;
  patterns: RegExp[];
  severity: ComplaintCluster["severity"];
}

const COMPLAINT_RULES: ComplaintRule[] = [
  { label: "High or opaque pricing", type: "pricing", patterns: [/too expensive|overpriced|price increase|pricing (?:is|was)|costs? too much|hidden fee|contact sales/i], severity: "high" },
  { label: "Missing or unreliable integrations", type: "integration", patterns: [/doesn.?t integrate|missing integration|integration (?:is )?(?:broken|limited)|no api|webhook|sync (?:fails|issues?)/i], severity: "high" },
  { label: "Workflow fragmentation", type: "product", patterns: [/multiple tools|switch between|fragmented|copy and paste|duplicate entry|re-enter|spreadsheet.*(?:and|plus)/i], severity: "high" },
  { label: "Manual workaround burden", type: "product", patterns: [/manual(?:ly)?|spreadsheet|paper|text messages?|workaround|hand[- ]?enter|by hand/i], severity: "medium" },
  { label: "Difficult setup or usability", type: "usability", patterns: [/hard to use|confusing|steep learning|difficult setup|too complex|clunky|poor mobile|unusable/i], severity: "medium" },
  { label: "Weak support or trust", type: "trust", patterns: [/poor support|no response|unreliable|data loss|security concern|privacy concern|don.?t trust/i], severity: "high" },
  { label: "Compliance or policy mismatch", type: "compliance", patterns: [/compliance|regulation|audit|hipaa|gdpr|licen[cs]|certification/i], severity: "high" },
  { label: "Unavailable for the needed customer or region", type: "distribution", patterns: [/not available|only enterprise|minimum seats|not in (?:my|our) country|region|small business|solo/i], severity: "medium" },
];

function findSegment(text: string): string | null {
  const segments: Array<[RegExp, string]> = [
    [/solo|freelancer|one-person/i, "solo operators"],
    [/small business|smb|mom.and.pop/i, "small businesses"],
    [/nontechnical|non-technical|not tech savvy/i, "nontechnical users"],
    [/mobile|phone|field worker|on.site/i, "mobile-first and field users"],
    [/regulated|compliance|audit|hipaa|gdpr/i, "regulated teams"],
    [/rural|remote area/i, "rural or geographically remote users"],
    [/low budget|affordable|cheap|free tier/i, "low-budget customers"],
    [/accessib|dexterity|disab/i, "users with accessibility constraints"],
  ];
  return segments.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function findWorkaround(text: string): string | null {
  const match = text.match(/\b(?:spreadsheet|excel|google sheets|paper|text messages?|email|copy and paste|manual(?:ly)?|phone calls?)\b/i);
  return match?.[0].toLowerCase() ?? null;
}

export function clusterComplaints(evidence: Evidence[]): ComplaintCluster[] {
  const buckets = new Map<string, { rule: ComplaintRule; evidence: Evidence[]; segments: string[]; workarounds: string[] }>();
  for (const item of evidence) {
    if (!DISCUSSION_TYPES.has(item.sourceType) || !item.relevanceAssessment.acceptedForMarket
      || item.sourceAssessment.discoveryOnly || !hasDirectCustomerExperience(item)) continue;
    const text = `${item.title}. ${item.summary}`;
    for (const rule of COMPLAINT_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
      const bucket = buckets.get(rule.label) ?? { rule, evidence: [], segments: [], workarounds: [] };
      if (!bucket.evidence.some((existing) => existing.id === item.id)) bucket.evidence.push(item);
      const segment = findSegment(text);
      const workaround = findWorkaround(text);
      if (segment) bucket.segments.push(segment);
      if (workaround) bucket.workarounds.push(workaround);
      buckets.set(rule.label, bucket);
    }
  }

  return [...buckets.values()].map(({ rule, evidence: items, segments, workarounds }) => {
    const independentGroups = new Set(items.map((item) => item.sourceAssessment.independenceGroup));
    const independentCount = independentGroups.size;
    const isIsolated = independentCount < 2;
    return {
      id: stableId("complaint", rule.label),
      label: rule.label,
      normalizedProblem: `${rule.label} is reported in retrieved user or developer discussions.`,
      evidenceCount: independentCount,
      severity: rule.severity,
      affectedSegment: segments[0] ?? null,
      representativeEvidenceIds: items.slice(0, 5).map((item) => item.id),
      representativeSourceUrls: items.slice(0, 5).map((item) => item.sourceUrl),
      gapType: isIsolated ? "isolated" : rule.type,
      isIsolated,
      currentWorkaround: workarounds[0] ?? null,
      requestedFeatures: items.filter((item) => /feature request|wish (?:it|they)|should add|needs? (?:an?|to)/i.test(`${item.title} ${item.summary}`)).slice(0, 5).map((item) => item.summary),
      willingnessToPaySignals: items.filter((item) => /would pay|pay for|budget|price|cost|hiring|consultant/i.test(`${item.title} ${item.summary}`)).slice(0, 5).map((item) => item.summary),
      churnReasons: items.filter((item) => /cancel|churn|switched|went back|abandon|stopped using/i.test(`${item.title} ${item.summary}`)).slice(0, 5).map((item) => item.summary),
      buyingObjections: items.filter((item) => /too expensive|not worth|procurement|security review|hard to use|too complex|trust/i.test(`${item.title} ${item.summary}`)).slice(0, 5).map((item) => item.summary),
      jobsToBeDone: items.filter((item) => /need to|trying to|so (?:we|i) can|job|workflow|reconcile|coordinate|schedule|invoice/i.test(`${item.title} ${item.summary}`)).slice(0, 5).map((item) => item.summary),
      firstObservedDate: observedDate(items, "first"),
      mostRecentObservedDate: observedDate(items, "last"),
      independentSourceCount: independentCount,
      supportingEvidenceCount: items.length,
      counterEvidenceCount: 0,
      sourceFamilyCoverage: [...new Set(items.map((item) => item.sourceAssessment.sourceFamily))],
      complaintCategory: isIsolated ? "isolated" : rule.type,
      affectedCustomerSegment: segments[0] ?? null,
      workaround: workarounds[0] ?? null,
      confidence: Math.min(.95, .32 + independentCount * .16 + items.length * .06),
      materialChangeSincePreviousRun: null,
    };
  }).sort((a, b) => b.evidenceCount - a.evidenceCount);
}

export function detectUnderservedSegments(evidence: Evidence[]): UnderservedSegment[] {
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
    if (item.sourceAssessment.sourceFamily !== "user_voice" || !item.relevanceAssessment.acceptedForMarket
      || item.sourceAssessment.discoveryOnly || !hasDirectCustomerExperience(item)) continue;
    const segment = findSegment(`${item.title}. ${item.summary}`);
    if (!segment) continue;
    const items = groups.get(segment) ?? [];
    items.push(item);
    groups.set(segment, items);
  }
  return [...groups.entries()].map(([segment, items]) => ({
    id: stableId("segment", segment),
    segment,
    rationale: `Retrieved sources mention constraints or poor fit affecting ${segment}.`,
    evidenceIds: items.slice(0, 6).map((item) => item.id),
    confidence: Math.min(0.9, 0.42 + items.length * 0.12),
  })).sort((a, b) => b.evidenceIds.length - a.evidenceIds.length);
}
