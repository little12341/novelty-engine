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
  if (candidate && candidate.length >= 2 && candidate.length <= 70) return candidate;
  return hostname.split(".")[0].replace(/(^|[-_])\w/g, (match) => match.replace(/[-_]/, "").toUpperCase());
}

const FEATURE_TERMS = ["scheduling", "invoicing", "automation", "mobile", "reporting", "payments", "integrations", "collaboration", "compliance", "analytics", "crm", "marketplace", "workflow"];

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
  const match = text.match(/\bfor\s+((?:small |independent |growing |solo |regulated )?(?:contractors?|creators?|teams?|companies|businesses|operators|professionals|developers|agencies|home service companies))\b/i);
  return match?.[1] ?? null;
}

export function extractCompetitors(evidence: Evidence[]): Competitor[] {
  const eligible = evidence.filter((item) => ["official_company", "pricing", "documentation", "product_directory", "app_marketplace"].includes(item.sourceType));
  const grouped = new Map<string, Evidence[]>();
  for (const item of eligible) {
    const host = new URL(item.normalizedUrl).hostname.replace(/^(app|docs|help|support)\./, "");
    const group = grouped.get(host) ?? [];
    group.push(item);
    grouped.set(host, group);
  }

  return [...grouped.entries()].slice(0, 15).map(([host, items]) => {
    const primary = items[0];
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
    const completeIds = [...new Set([...ids, ...weaknessEvidence.map((item) => item.id)])];
    return {
      id: stableId("comp", host),
      name: supported(name, [primary.id], 0.72),
      website: new URL(primary.normalizedUrl).origin,
      targetCustomer: supported(target, target ? ids : [], target ? 0.68 : 0),
      coreJobToBeDone: supported(positioning, [primary.id], 0.58),
      pricing: supported(pricing, pricingEvidence && pricing ? [pricingEvidence.id] : [], pricing ? 0.82 : 0),
      keyFeatures: supported(features.length ? features : null, features.length ? ids : [], features.length ? 0.65 : 0),
      positioning: supported(positioning, [primary.id], 0.65),
      likelyStrengths: supported(features.length ? features.slice(0, 3) : null, features.length ? ids : [], features.length ? 0.55 : 0),
      likelyWeaknesses: supported(weaknessEvidence.length ? weaknessEvidence.slice(0, 3).map((item) => item.summary) : null, weaknessEvidence.map((item) => item.id), weaknessEvidence.length ? 0.65 : 0),
      evidenceIds: completeIds,
    };
  });
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
