import type { EntityRelationship, Evidence, SourceType } from "./types.ts";

const GENERIC_HOST = /(?:^|\.)(?:g2|capterra|getapp|trustradius|trustpilot|sourceforge|linkedin|facebook|medium|forbes|techcrunch|reddit|github|producthunt|crunchbase)\./i;
const DIRECTORY_HOST = /(?:^|\.)(?:g2|capterra|getapp|trustradius|trustpilot|sourceforge|producthunt|crunchbase)\./i;
const PUBLISHER_HOST = /(?:^|\.)(?:linkedin|medium|forbes|techcrunch|reuters|bloomberg|wired)\./i;
const ARTICLE_PATH = /\/(?:blog|blogs|resources?|articles?|guides?|news|insights?|learn|stories|reports?|whitepapers?)(?:\/|$)/i;
const COMPARISON_LANGUAGE = /\b(?:best|top\s+\d*|alternatives?|competitors?|platforms? compared|software comparison|buyer.?s guide|ultimate guide)\b/i;
const GENERIC_TITLE = /\b(?:best|top|benefits? of|guide to|how to|what is|market report|industry report|software comparison|platforms? compared|category|directory|white ?paper|ebook)\b/i;
const ENTITY_SUFFIX = /\b(?:inc\.?|llc|ltd\.?|limited|corp(?:oration)?|company|technologies|technology|systems|software|solutions|platform)\b/gi;
const TOPIC_STOP = new Set(["about", "article", "benefit", "best", "business", "category", "company", "comparison", "customer", "guide", "market", "platform", "report", "software", "solution", "system", "tool", "vendor", "workflow"]);

export function canonicalDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length >= 3 && /^(?:co|com|org|net|gov|ac)$/.test(parts.at(-2) ?? "")) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

export function normalizeOrganizationName(value: string): string {
  return value.normalize("NFKC").replace(ENTITY_SUFFIX, " ").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displaySlug(value: string): string {
  const known: Record<string, string> = {
    getjones: "Jones", mycoitracking: "myCOI", smartcompliance: "SmartCompliance", simplecerts: "SimpleCerts",
  };
  const clean = value.toLowerCase().replace(/^www\./, "").replace(/\.[a-z.]+$/, "").replace(/^(?:get|use|try|app)(?=[a-z])/i, "");
  if (known[value.toLowerCase()]) return known[value.toLowerCase()];
  return clean.split(/[-_]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function productSlug(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((part) => /^(?:products?|software|apps?|reviews?)$/i.test(part));
  const candidate = marker >= 0 ? parts[marker + 1] : null;
  if (!candidate || /^(?:category|categories|compare|alternatives?|reviews?)$/i.test(candidate)) return null;
  return candidate.replace(/-(?:reviews?|pricing|alternatives?)$/i, "");
}

function titleSegments(title: string): string[] {
  return title.split(/\s+[|–—:]\s+|\s+-\s+/).map((part) => part.trim().replace(/\s+(?:reviews?|pricing|plans?|features?|documentation)$/i, "").trim())
    .filter((part) => part.length >= 2 && part.length <= 70 && !GENERIC_TITLE.test(part));
}

function explicitNames(url: URL, title: string): string[] {
  const domainStem = canonicalDomain(url.hostname).split(".")[0];
  const slug = productSlug(url);
  const candidates = [...titleSegments(title), ...(slug ? [displaySlug(slug)] : []), ...(GENERIC_HOST.test(url.hostname) ? [] : [displaySlug(domainStem)])];
  return [...new Map(candidates.map((name) => [normalizeOrganizationName(name), name])).values()].filter((name) => {
    const normalized = normalizeOrganizationName(name);
    const domainNormalized = normalizeOrganizationName(domainStem);
    const slugNormalized = normalizeOrganizationName(slug ?? "");
    return normalized.length >= 2 && (GENERIC_HOST.test(url.hostname) ? normalized === slugNormalized || slugNormalized.includes(normalized) || normalized.includes(slugNormalized)
      : domainNormalized.includes(normalized) || normalized.includes(domainNormalized));
  }).sort((left, right) => {
    const reference = normalizeOrganizationName(slug ?? domainStem);
    return Math.abs(normalizeOrganizationName(left).length - reference.length) - Math.abs(normalizeOrganizationName(right).length - reference.length);
  }).slice(0, 3);
}

export function inferPageIdentity(urlString: string, title: string, summary: string, sourceType: SourceType): Evidence["pageIdentity"] {
  const url = new URL(urlString);
  const host = url.hostname.toLowerCase();
  const isPdf = /\.pdf$/i.test(url.pathname) || /\bpdf\b|white ?paper|market report|research report/i.test(title);
  const social = /(?:^|\.)linkedin\.com$/i.test(host) || /\/posts?\//i.test(url.pathname);
  const comparison = COMPARISON_LANGUAGE.test(title) || ARTICLE_PATH.test(url.pathname) && COMPARISON_LANGUAGE.test(`${url.pathname} ${title}`);
  const directory = DIRECTORY_HOST.test(host) && (!productSlug(url) || /\/categories?|\/software\//i.test(url.pathname));
  const productProfile = DIRECTORY_HOST.test(host) && Boolean(productSlug(url)) && !/\/articles?|\/resources?|\/compare/i.test(url.pathname);
  const article = ARTICLE_PATH.test(url.pathname) || PUBLISHER_HOST.test(host);
  let pageKind: Evidence["pageIdentity"]["pageKind"] = sourceType === "regulator" ? "government"
    : sourceType === "research" || sourceType === "patent" ? "research"
      : isPdf ? "report_pdf" : social ? "social_article" : directory ? "directory"
        : sourceType === "marketplace" || sourceType === "app_marketplace" ? "marketplace"
          : comparison ? "comparison" : article ? "article" : productProfile ? "product_profile"
            : sourceType === "pricing" ? "company_pricing" : sourceType === "documentation" ? "company_documentation"
              : ["reddit", "forum", "review"].includes(sourceType) ? "user_discussion"
                : sourceType === "official_company" ? "company_product" : "other";
  if (sourceType === "review" && productProfile) pageKind = "product_profile";
  const relationship: EntityRelationship = directory ? "aggregator_directory"
    : sourceType === "marketplace" || sourceType === "app_marketplace" ? "marketplace"
      : comparison ? "publisher_listicle" : article || social ? "publisher_listicle"
        : "evidence_only";
  const names = explicitNames(url, title);
  const entityEligible = ["company_product", "company_pricing", "company_documentation", "product_profile"].includes(pageKind)
    && !comparison && names.length > 0;
  return {
    canonicalDomain: canonicalDomain(host), pageKind,
    relationship: entityEligible ? "direct_competitor" : relationship,
    organizationSignals: [canonicalDomain(host), ...names.map(normalizeOrganizationName)].filter(Boolean),
    explicitEntityNames: names, entityEligible,
    rationale: entityEligible
      ? "A canonical company/product domain or structured product-profile path agrees with an explicit organization/brand signal."
      : comparison ? "Comparison/listicle identity is retained as a source page and is not promoted to a company entity."
        : directory ? "Category/directory identity is retained as an aggregator source and is not promoted to a company entity."
          : `The ${pageKind.replaceAll("_", " ")} page does not independently establish a normalized company entity.`,
  };
}

function topicTerms(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .map((item) => item.replace(/(?:ations?|ments?|ingly|ing|ers?|ies|ed|es|s)$/i, ""))
    .filter((item) => item.length >= 4 && !TOPIC_STOP.has(item)))];
}

const ANCHORS: Array<[string, RegExp]> = [
  ["coi", /certificate(?:s)? of insurance|\bcoi\b|subcontractor insurance/i],
  ["construction", /general contractor|specialty trad|subcontractor|construction/i],
  ["field_service", /contractors?|field[- ](?:service|workers?|teams?)|home[- ]service|mobile trad|dispatch|technicians?|scheduling|job (?:data|records?)/i],
  ["cleaning", /commercial clean|local clean|cleaning (?:compan|team|crew|service)|cleaners?|janitorial|proof of service/i],
  ["restaurant_pos", /restaurant|point.of.sale|\bpos\b/i],
  ["aquaculture_ozone", /aquaculture|ozone|fish farm/i],
  ["clinical", /clinical[- ](?:trial|research)|research site|sponsor portal|site coordinators?|visit data/i],
  ["finance_close", /month.end|financial close|reconciliation/i],
  ["ci_testing", /flaky[- ]test|continuous integration|\bci\b/i],
  ["food_waste", /food[- ]waste|pantry|grocery|freezer|expiry|expiration/i],
];

export function assessMarketRelevance(query: string, title: string, summary: string): Evidence["relevanceAssessment"] {
  const expected = topicTerms(query);
  const actual = new Set(topicTerms(`${title} ${summary}`));
  const matchedTerms = expected.filter((item) => actual.has(item));
  const expectedAnchors = ANCHORS.filter(([, pattern]) => pattern.test(query)).map(([name]) => name);
  const actualAnchors = new Set(ANCHORS.filter(([, pattern]) => pattern.test(`${title} ${summary}`)).map(([name]) => name));
  const matchedAnchors = expectedAnchors.filter((item) => actualAnchors.has(item));
  const score = Math.min(1, matchedTerms.length / Math.max(3, Math.min(10, expected.length)) + matchedAnchors.length * .4);
  const acceptedForMarket = expectedAnchors.length ? matchedAnchors.length > 0 && (matchedTerms.length > 0 || score >= .4)
    : matchedTerms.length >= Math.min(2, Math.max(1, expected.length)) || score >= .2;
  return {
    acceptedForMarket, score: Math.round(score * 100) / 100,
    matchedTerms: [...new Set([...matchedAnchors, ...matchedTerms])].slice(0, 12),
    missingAnchors: expectedAnchors.filter((item) => !actualAnchors.has(item)),
    rationale: acceptedForMarket
      ? `Accepted for market analysis with matched buyer/job/workflow/topic terms: ${[...matchedAnchors, ...matchedTerms].join(", ") || "broad query match"}.`
      : `Retained as a source record but rejected for market claims; it lacks the required specific overlap${expectedAnchors.length ? ` (${expectedAnchors.join(", ")})` : ""}.`,
  };
}

export function preferredEntityName(evidence: Evidence): string | null {
  return evidence.pageIdentity.explicitEntityNames[0] ?? null;
}
