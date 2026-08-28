import { createHash } from "node:crypto";
import type { IdeaCandidate, SearchAngle, SearchAngleKind } from "./types.ts";

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

const BUSINESS_ANGLES: Array<{ kind: SearchAngleKind; suffix: string; purpose: string; domains: string[] }> = [
  { kind: "direct_competitors", suffix: "business directory companies locations contact website services", purpose: "Real operating businesses and observable public identity", domains: [] },
  { kind: "customer_complaints", suffix: 'reviews "poor service" OR "never responded" OR "outdated" OR "hard to book"', purpose: "Poor reviews and repeated customer-facing failures", domains: ["google.com", "yelp.com", "trustpilot.com"] },
  { kind: "workflow_fragmentation", suffix: '"spreadsheet" OR "paper forms" OR "manual entry" OR "call us" OR "fax"', purpose: "Observable outdated systems and repetitive manual workflows", domains: [] },
  { kind: "poor_integrations", suffix: '"no online booking" OR "no portal" OR "no API" OR "does not integrate"', purpose: "Missing software, booking, portals, and integrations", domains: [] },
  { kind: "pricing_complaints", suffix: "pricing estimate quote procurement budget software spend", purpose: "Spend, buying intent, and price friction", domains: [] },
  { kind: "research_regulation", suffix: "compliance violation consent order new regulation audit deadline license", purpose: "Compliance burdens and regulation-created demand", domains: [] },
  { kind: "jobs_procurement", suffix: 'hiring coordinator administrator "data entry" operations manager procurement RFP', purpose: "Hiring and procurement signals that reveal paid manual work", domains: ["linkedin.com", "indeed.com", "greenhouse.io"] },
  { kind: "change_signals", suffix: "recent funding expansion new locations rapid growth acquisition hiring 2026", purpose: "Funding, growth, and organizational change that creates buying capacity", domains: [] },
  { kind: "underserved_segments", suffix: "local small business owner operator rural region accessibility language underserved", purpose: "Reachable local and underserved business segments", domains: [] },
  { kind: "customer_language", suffix: '"looking for software" OR "recommend a tool" OR "need help automating" OR "switching from"', purpose: "Observable buying intent in the customer’s language", domains: ["reddit.com", "facebook.com"] },
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

export function deriveBusinessSearchAngles(query: string, limit = 10): SearchAngle[] {
  return BUSINESS_ANGLES.slice(0, Math.max(1, Math.min(limit, BUSINESS_ANGLES.length))).map((angle, index) => ({
    id: `business_${String(index + 1).padStart(2, "0")}_${createHash("sha1").update(`${query}:${angle.kind}:${angle.purpose}`).digest("hex").slice(0, 6)}`,
    kind: angle.kind, query: `${query}${customerLanguageExpansion(query)} ${angle.suffix}`,
    purpose: angle.purpose, targetedDomains: angle.domains,
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
      suffix: `unit economics support cost technical limitation trust privacy liability regulation adoption failure failed company shutdown prior attempt AI commoditization incumbent bundle open source capability becomes free ${focus}`,
      purpose: "Active counterevidence: economics, feasibility, behavior, trust, liability, regulation, failed companies/prior attempts, AI commoditization, and defensibility constraints",
    },
  ];
  return angles.slice(0, Math.max(0, limit)).map((angle, index) => ({
    id: `falsify_${index + 1}_${createHash("sha1").update(`${query}:${focus}:${angle.kind}`).digest("hex").slice(0, 7)}`,
    kind: angle.kind, query: `${query} ${angle.suffix}`, purpose: angle.purpose, targetedDomains: [],
  }));
}

export function deriveEvidenceGapAngles(query: string, candidates: IdeaCandidate[], blockers: string[], regulated: boolean, limit = 3): SearchAngle[] {
  const focus = candidates.slice(0, 3).map((candidate) => `${candidate.definition?.companyProfile ?? candidate.targetCustomer ?? "buyer"}; ${candidate.definition?.specificProblem ?? candidate.jobToBeDone}`).join(" | ").slice(0, 650);
  const requested = new Set(blockers);
  const angles: Array<{ kind: SearchAngleKind; query: string; purpose: string; domains: string[] }> = [];
  if (requested.has("pain") || requested.has("sourceDiversity")) angles.push({
    kind: "evidence_gap_pain",
    query: `${query} ${focus} user review complaint workaround "we use" "switched" "would pay"`,
    purpose: "Evidence-gate feedback: retrieve first-hand pain, workaround, churn, and user-language evidence missing from candidate gates.",
    domains: ["reddit.com", "g2.com", "capterra.com", "trustradius.com"],
  });
  if (requested.has("spend") || requested.has("timing")) angles.push({
    kind: "evidence_gap_spend",
    query: `${query} ${focus} pricing procurement RFP budget manual labor cost current tool spend hiring coordinator case study`,
    purpose: "Evidence-gate feedback: retrieve pricing, procurement, budget, labor-cost, current-tool-spend, hiring, and customer-case evidence.",
    domains: [],
  });
  if (regulated || requested.has("sourceDiversity")) angles.push({
    kind: "evidence_gap_institutional",
    query: `${query} ${focus} regulator government trade association industry body standard guidance compliance official`,
    purpose: "Evidence-gate feedback: retrieve regulator, government, trade-association, and industry-body evidence.",
    domains: [".gov", "nist.gov", "iso.org"],
  });
  return angles.slice(0, Math.max(0, limit)).map((angle, index) => ({
    id: `gate_${angle.kind}_${index + 1}_${createHash("sha1").update(`${query}:${focus}:${angle.kind}`).digest("hex").slice(0, 7)}`,
    kind: angle.kind, query: angle.query.slice(0, 1_000), purpose: angle.purpose, targetedDomains: angle.domains,
  }));
}

export function buildProviderQuery(angle: SearchAngle): string {
  if (angle.targetedDomains.length === 0) return angle.query;
  return `${angle.query} (${angle.targetedDomains.map((domain) => `site:${domain}`).join(" OR ")})`;
}
