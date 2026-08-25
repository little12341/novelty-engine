import { createHash } from "node:crypto";
import type { SearchAngle, SearchAngleKind } from "./types.ts";

const ANGLES: Array<{ kind: SearchAngleKind; suffix: string; purpose: string; domains: string[] }> = [
  { kind: "direct_competitors", suffix: "products services companies pricing features customers", purpose: "Direct competitors, positioning, capabilities, and public pricing", domains: [] },
  { kind: "adjacent_categories", suffix: "alternatives substitutes comparison marketplace open source", purpose: "Adjacent categories, indirect substitutes, and do-nothing alternatives", domains: [] },
  { kind: "customer_complaints", suffix: '"hate" OR "frustrating" OR "doesn\'t work" OR "wish it" negative reviews complaints', purpose: "First-hand customer complaints, customer language, and recurring pain", domains: ["reddit.com", "g2.com", "capterra.com"] },
  { kind: "manual_workarounds", suffix: '"workaround" OR "spreadsheet" OR "by hand" OR "copy paste" OR "we built our own"', purpose: "Manual workarounds, shadow workflows, and customer-authored substitutes", domains: ["reddit.com", "github.com"] },
  { kind: "pricing_complaints", suffix: '"too expensive" OR "not worth" OR "cancelled" pricing procurement budget', purpose: "Pricing, packaging, procurement, and willingness-to-pay objections", domains: ["reddit.com", "g2.com", "capterra.com"] },
  { kind: "underserved_segments", suffix: 'underserved "not for us" "only enterprise" accessibility region language edge case', purpose: "Customer groups excluded by incumbent product and distribution assumptions", domains: [] },
  { kind: "poor_integrations", suffix: '"missing integration" OR "feature request" OR "no API" issues abandoned repository', purpose: "Integration failures, GitHub issues, feature requests, and open-source substitutes", domains: ["github.com"] },
  { kind: "research_regulation", suffix: "research study regulation policy standard patent 2025 2026", purpose: "Research, patents, regulations, standards, and structural constraints", domains: [] },
  { kind: "failed_attempts", suffix: 'startup failed shutdown discontinued abandoned "low adoption" why', purpose: "Failed products and prior attempts, including the blocker that prevented adoption", domains: [] },
  { kind: "jobs_procurement", suffix: 'jobs hiring consultant procurement RFP manual coordinator specialist', purpose: "Job postings, procurement, paid labor, and organizational workarounds that reveal budget", domains: [] },
];

const SYNONYMS: Array<[RegExp, string]> = [
  [/\bsmall business(?:es)?\b/i, "SMB OR independent OR owner-operator"],
  [/\bsoftware\b/i, "tool OR platform OR system OR workflow"],
  [/\bcaregiv(?:er|ing)\b/i, "family care OR care coordination OR aging parent"],
  [/\bcontractor(?:s)?\b/i, "field service OR trades OR technician OR owner-operator"],
  [/\bdeveloper(?:s)?\b/i, "engineer OR maintainer OR DevOps OR platform team"],
  [/\bconsumer(?:s)?\b/i, "buyer OR household OR customer OR user"],
];

function customerLanguageExpansion(query: string): string {
  const matches = SYNONYMS.filter(([pattern]) => pattern.test(query)).map(([, expansion]) => expansion);
  return matches.length ? ` (${matches.slice(0, 2).join(") (")})` : "";
}

export function deriveSearchAngles(query: string, limit = 10): SearchAngle[] {
  return ANGLES.slice(0, Math.max(1, Math.min(limit, ANGLES.length))).map((angle, index) => ({
    id: `angle_${String(index + 1).padStart(2, "0")}_${createHash("sha1").update(`${query}:${angle.kind}`).digest("hex").slice(0, 6)}`,
    kind: angle.kind,
    query: `${query}${customerLanguageExpansion(query)} ${angle.suffix}`,
    purpose: angle.purpose,
    targetedDomains: angle.domains,
  }));
}

export function deriveFalsificationAngles(query: string, candidateSummaries: string[], limit = 2): SearchAngle[] {
  const focus = candidateSummaries.join("; ").replace(/\s+/g, " ").slice(0, 700);
  const angles: Array<{ kind: SearchAngleKind; suffix: string; purpose: string }> = [
    {
      kind: "active_falsification_competition",
      suffix: `closest competitor same user same job adequately solved unresolved complaints workaround switched cancelled underserved too expensive unreliable trust unavailable ${focus}`,
      purpose: "Active competition test: adequate same-job substitutes versus residual complaints, workarounds, switching, underserved segments, price/performance, trust, and distribution gaps",
    },
    {
      kind: "active_falsification_constraints",
      suffix: `unit economics support cost technical limitation trust privacy liability regulation adoption failure ${focus}`,
      purpose: "Active counterevidence: economics, feasibility, behavior, trust, liability, regulation, and defensibility constraints",
    },
  ];
  return angles.slice(0, Math.max(0, limit)).map((angle, index) => ({
    id: `falsify_${index + 1}_${createHash("sha1").update(`${query}:${focus}:${angle.kind}`).digest("hex").slice(0, 7)}`,
    kind: angle.kind, query: `${query} ${angle.suffix}`, purpose: angle.purpose, targetedDomains: [],
  }));
}

export function buildProviderQuery(angle: SearchAngle): string {
  if (angle.targetedDomains.length === 0) return angle.query;
  return `${angle.query} (${angle.targetedDomains.map((domain) => `site:${domain}`).join(" OR ")})`;
}
