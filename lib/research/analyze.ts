import { createHash } from "node:crypto";
import type {
  ComplaintCluster,
  Competitor,
  Evidence,
  GapType,
  SupportedValue,
  UnderservedSegment,
} from "./types.ts";

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 10)}`;
}

function supported<T>(value: T | null, evidenceIds: string[], confidence: number): SupportedValue<T> {
  return { value, evidenceIds: value === null ? [] : evidenceIds, confidence: value === null ? 0 : confidence };
}

function productName(title: string, hostname: string): string {
  const parts = title.split(/\s+[|–—:]\s+|\s+-\s+/).map((part) => part.trim());
  const candidate = parts.find((part) => !/^(home|pricing|features?|plans?|documentation)$/i.test(part));
  if (candidate && candidate.length >= 2 && candidate.length <= 70) return candidate.replace(/\s+(?:reviews?|pricing|plans?|features?|documentation)$/i, "").trim();
  return hostname.split(".")[0].replace(/(^|[-_])\w/g, (match) => match.replace(/[-_]/, "").toUpperCase());
}

const FEATURE_TERMS = ["scheduling", "invoicing", "automation", "mobile", "reporting", "payments", "integrations", "collaboration", "compliance", "certificate tracking", "insurance", "vendor management", "risk", "procurement", "analytics", "crm", "marketplace", "workflow"];

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
  const url = new URL(item.normalizedUrl);
  const host = url.hostname.replace(/^(app|docs|help|support)\./, "");
  if (["review", "product_directory", "app_marketplace"].includes(item.sourceType)) {
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => /products?|software|apps?/i.test(part));
    const product = marker >= 0 ? parts[marker + 1] : parts[0];
    if (product) return `${host}/${product.toLowerCase()}`;
  }
  return host;
}

function snippets(items: Evidence[], pattern: RegExp, limit = 4): { values: string[]; ids: string[] } {
  const matched = items.filter((item) => pattern.test(`${item.title} ${item.summary}`)).slice(0, limit);
  return { values: matched.map((item) => item.summary), ids: matched.map((item) => item.id) };
}

export function extractCompetitors(evidence: Evidence[]): Competitor[] {
  const eligible = evidence.filter((item) => ["official_company", "pricing", "documentation", "review", "product_directory", "app_marketplace"].includes(item.sourceType));
  const grouped = new Map<string, Evidence[]>();
  for (const item of eligible) {
    const key = competitorGroupKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  const extracted = [...grouped.entries()].slice(0, 30).map(([groupKey, items]) => {
    const primary = items[0];
    const host = new URL(primary.normalizedUrl).hostname.replace(/^(app|docs|help|support)\./, "");
    const allText = items.map((item) => `${item.title}. ${item.summary}`).join(" ");
    const ids = items.map((item) => item.id);
    const pricingEvidence = items.find((item) => item.sourceType === "pricing" || extractPricing(`${item.title} ${item.summary}`));
    const pricing = pricingEvidence ? extractPricing(`${pricingEvidence.title} ${pricingEvidence.summary}`) : null;
    const features = extractFeatures(allText);
    const positioning = primary.summary || null;
    const name = productName(primary.title, host);
    const hostStem = host.split(".")[0];
    const weaknessEvidence = evidence.filter((item) => DISCUSSION_TYPES.has(item.sourceType) && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b|\\b${hostStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(`${item.title} ${item.summary}`));
    const target = extractTargetCustomer(allText);
    const mentions = evidence.filter((item) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b|\\b${hostStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(`${item.title} ${item.summary}`));
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
    const completeIds = [...new Set([...ids, ...weaknessEvidence.map((item) => item.id), ...mentions.map((item) => item.id)])];
    const substituteLanguage = /\b(?:manual|spreadsheet|paper|shared inbox|consultant|broker|agency service|outsourced|in-house|do it yourself|diy)\b/i.test(allText)
      && !/\b(?:software|saas|platform|application|automation product)\b/i.test(allText);
    const substituteOnly = substituteLanguage || items.every((item) => item.searchAngleIds.some((id) => /adjacent|substitute/i.test(id))
      && !item.searchAngleIds.some((id) => /direct|competitor_primary|competitor_crosscheck|competitor_escalation/i.test(id)));
    return {
      id: stableId("comp", groupKey),
      name: supported(name, [primary.id], 0.72),
      website: ["review", "product_directory", "app_marketplace"].includes(primary.sourceType) ? primary.normalizedUrl : new URL(primary.normalizedUrl).origin,
      targetCustomer: supported(target, target ? ids : [], target ? 0.68 : 0),
      coreJobToBeDone: supported(positioning, [primary.id], 0.58),
      pricing: supported(pricing, pricingEvidence && pricing ? [pricingEvidence.id] : [], pricing ? 0.82 : 0),
      keyFeatures: supported(features.length ? features : null, features.length ? ids : [], features.length ? 0.65 : 0),
      positioning: supported(positioning, [primary.id], 0.65),
      likelyStrengths: supported(features.length ? features.slice(0, 3) : null, features.length ? ids : [], features.length ? 0.55 : 0),
      likelyWeaknesses: supported(weaknessEvidence.length ? weaknessEvidence.slice(0, 3).map((item) => item.summary) : null, weaknessEvidence.map((item) => item.id), weaknessEvidence.length ? 0.65 : 0),
      relationship: supported<"direct" | "substitute">(substituteOnly ? "substitute" : "direct", ids, .64),
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
    };
  });
  const deduplicated = new Map<string, Competitor>();
  for (const competitor of extracted) {
    const key = (competitor.name.value ?? competitor.id).toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = deduplicated.get(key);
    if (!existing) { deduplicated.set(key, competitor); continue; }
    existing.evidenceIds = [...new Set([...existing.evidenceIds, ...competitor.evidenceIds])];
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
  return [...deduplicated.values()];
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

const DISCUSSION_TYPES = new Set(["reddit", "forum", "github", "review", "app_marketplace"]);

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
    if (!DISCUSSION_TYPES.has(item.sourceType)) continue;
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
    };
  }).sort((a, b) => b.evidenceCount - a.evidenceCount);
}

export function detectUnderservedSegments(evidence: Evidence[]): UnderservedSegment[] {
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
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
