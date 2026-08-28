import { createHash } from "node:crypto";
import type { Evidence, ProviderSearchResult, SearchAngle, SourceType } from "./types.ts";
import { sanitizeUntrustedResearchText } from "./governance.ts";
import { validateExternalResearchUrl } from "./url-policy.ts";
import { assessMarketRelevance, inferPageIdentity } from "./entity-resolution.ts";

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "source",
]);

export function canonicalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function querySimilarity(left: string, right: string): number {
  const a = new Set(canonicalizeQuery(left).split(" ").filter((token) => token.length > 2));
  const b = new Set(canonicalizeQuery(right).split(" ").filter((token) => token.length > 2));
  if (a.size === 0 || b.size === 0) return left === right ? 1 : 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
}

export function normalizeUrl(rawUrl: string): string | null {
  try {
    const decision = validateExternalResearchUrl(rawUrl);
    if (!decision.allowed || !decision.normalizedUrl) return null;
    const url = new URL(decision.normalizedUrl);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function inferSourceType(urlString: string): SourceType {
  const url = new URL(urlString);
  const host = url.hostname;
  const path = url.pathname.toLowerCase();
  if (host.includes("reddit.com")) return "reddit";
  if (host.includes("github.com")) return "github";
  if (/g2\.com|capterra\.|trustpilot\.|trustradius\.|getapp\./.test(host)) return "review";
  if (/producthunt\.|betalist\.|crunchbase\.|sourceforge\./.test(host)) return "product_directory";
  if (/apps\.apple\.com|play\.google\.com|marketplace\./.test(host)) return "app_marketplace";
  if (/patents\.google\.|patentscope\.|uspto\.|epo\.org/.test(host)) return "patent";
  if (/arxiv\.|pubmed\.|nih\.gov|nature\.|sciencedirect\.|springer\.|jstor\.|doi\.org|semanticscholar\./.test(host)) return "research";
  if (/\.gov$|\.gov\.|europa\.eu$/.test(host)) return "regulator";
  if (/jobs\.|careers\.|indeed\.|greenhouse\.|lever\.co|workdayjobs\./.test(host) || /\/jobs?|\/careers?/.test(path)) return "job_posting";
  if (/procurement|tenders?|solicitations?/.test(host) || /\/(?:rfp|procurement|tenders?|solicitations?)(?:\/|$)/.test(path)) return "marketplace";
  if (/amazon\.|etsy\.|ebay\.|alibaba\.|gumroad\./.test(host)) return "marketplace";
  if (/forum|community|discuss/.test(host) || /\/forum|\/community|\/discussions/.test(path)) return "forum";
  if (/pricing|plans|packages/.test(path)) return "pricing";
  if (/docs|documentation|help|support|developers/.test(host) || /\/docs|\/help|\/support/.test(path)) return "documentation";
  if (/techcrunch|forbes|reuters|bloomberg|wired|linkedin|medium\.|industry|journal|magazine/.test(host)) return "industry_publication";
  return "official_company";
}

const SOURCE_QUALITY: Record<SourceType, number> = {
  official_company: .76, pricing: .84, documentation: .84, reddit: .52, forum: .5,
  github: .68, product_directory: .48, app_marketplace: .6, review: .62,
  industry_publication: .68, regulator: .96, research: .9, patent: .78,
  job_posting: .7, marketplace: .56, other: .4,
};

function registrableHost(host: string): string {
  const parts = host.replace(/^www\./, "").split(".");
  return parts.slice(-2).join(".");
}

function competitorEntityScope(urlString: string, sourceType: SourceType): string {
  const url = new URL(urlString);
  if (["review", "product_directory", "app_marketplace"].includes(sourceType)) {
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => /products?|software|apps?/i.test(part));
    const product = marker >= 0 ? parts[marker + 1] : parts[0];
    return `${url.hostname}/${product ?? ""}`;
  }
  return registrableHost(url.hostname);
}

function independenceGroup(urlString: string, sourceType: SourceType): string {
  const url = new URL(urlString);
  const parts = url.pathname.split("/").filter(Boolean);
  if (sourceType === "reddit") return `${url.hostname}:${parts.slice(0, 4).join("/")}`;
  if (sourceType === "github") return `${url.hostname}:${parts.slice(0, 2).join("/")}`;
  if (["forum", "review", "app_marketplace", "marketplace"].includes(sourceType)) return `${url.hostname}:${parts.slice(0, 3).join("/")}`;
  return registrableHost(url.hostname);
}

function recencyScore(publicationDate: string | null, retrievedAt: string): number {
  if (!publicationDate) return .5;
  const ageDays = Math.max(0, (new Date(retrievedAt).getTime() - new Date(publicationDate).getTime()) / 86_400_000);
  return ageDays <= 365 ? 1 : ageDays <= 1_095 ? .75 : ageDays <= 2_555 ? .55 : .35;
}

function directnessScore(sourceType: SourceType): number {
  if (["regulator", "pricing", "documentation", "patent", "job_posting"].includes(sourceType)) return .92;
  if (["reddit", "forum", "review", "github", "app_marketplace", "marketplace"].includes(sourceType)) return .8;
  if (["official_company", "research"].includes(sourceType)) return .78;
  return .5;
}

function trustMetadata(sourceType: SourceType, angleKind: SearchAngle["kind"]): Pick<Evidence["sourceAssessment"], "sourceFamily" | "provenance" | "commercialBiasRisk" | "observationKind"> {
  const sourceFamily: Evidence["sourceAssessment"]["sourceFamily"] =
    ["reddit", "forum", "review", "app_marketplace"].includes(sourceType) ? "user_voice"
      : ["documentation", "github", "research", "patent"].includes(sourceType) ? "technical"
        : ["regulator", "industry_publication"].includes(sourceType) ? "institutional"
          : ["pricing", "job_posting", "marketplace"].includes(sourceType) ? "commercial"
            : angleKind === "failed_attempts" ? "failed_attempt"
              : ["official_company", "product_directory"].includes(sourceType) ? "competitor" : "general";
  const provenance: Evidence["sourceAssessment"]["provenance"] =
    sourceType === "regulator" ? "government"
      : sourceType === "research" ? "research"
        : ["reddit", "forum", "review", "github", "app_marketplace"].includes(sourceType) ? "user_generated"
          : ["official_company", "pricing", "documentation", "job_posting"].includes(sourceType) ? "company_controlled"
            : ["marketplace", "product_directory"].includes(sourceType) ? "marketplace" : "independent_secondary";
  const commercialBiasRisk: Evidence["sourceAssessment"]["commercialBiasRisk"] =
    provenance === "company_controlled" || provenance === "marketplace" ? "high"
      : sourceType === "industry_publication" ? "medium"
        : provenance === "government" || provenance === "research" ? "low" : "unknown";
  const observationKind: Evidence["sourceAssessment"]["observationKind"] =
    provenance === "company_controlled" ? "company_claim"
      : provenance === "user_generated" ? "opinion_experience"
        : ["regulator", "pricing", "job_posting", "patent"].includes(sourceType) ? "factual_market_observation" : "mixed";
  return { sourceFamily, provenance, commercialBiasRisk, observationKind };
}

function isVendorSeoListicle(urlString: string, title: string): boolean {
  const url = new URL(urlString);
  const text = `${url.pathname} ${title}`;
  return /\/(?:blog|resources?|articles?|guides?)\//i.test(url.pathname)
    && /\b(?:best|top|alternatives?|competitors?|software list|tools for)\b/i.test(text);
}

function claimTokens(value: string): Set<string> {
  return new Set(canonicalizeQuery(value).split(" ").filter((token) => token.length > 3));
}

function claimSimilarity(left: string, right: string): number {
  const a = claimTokens(left); const b = claimTokens(right);
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / Math.min(a.size, b.size);
}

function cleanText(value: string, maxLength = 2_000): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePublicationDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function evidenceId(url: string): string {
  return `ev_${createHash("sha256").update(url).digest("hex").slice(0, 12)}`;
}

export function normalizeResults(
  batches: Array<{ angle: SearchAngle; results: ProviderSearchResult[] }>,
  retrievedAt: string,
  maxSources: number,
): Evidence[] {
  const byUrl = new Map<string, Evidence>();
  const claimRepresentatives: Evidence[] = [];
  for (const { angle, results } of batches) {
    for (const result of results) {
      const normalizedUrl = normalizeUrl(result.url);
      if (!normalizedUrl) continue;
      const existing = byUrl.get(normalizedUrl);
      if (existing) {
        if (!existing.searchAngleIds.includes(angle.id)) existing.searchAngleIds.push(angle.id);
        if (result.url !== existing.sourceUrl && !existing.duplicateSourceUrls.includes(result.url)) existing.duplicateSourceUrls.push(result.url);
        existing.sourceAssessment.repetitionRisk = "likely";
        continue;
      }
      const screenedSummary = sanitizeUntrustedResearchText(cleanText(result.snippet));
      const screenedTitle = sanitizeUntrustedResearchText(cleanText(result.title, 200));
      const summary = screenedSummary.text;
      const title = screenedTitle.text;
      if (!summary || !title) continue;
      const sourceType = inferSourceType(normalizedUrl);
      const competitorLike = ["official_company", "pricing", "documentation", "review", "product_directory", "app_marketplace"].includes(sourceType);
      const claimKey = createHash("sha256").update(canonicalizeQuery(`${title} ${summary}`)).digest("hex");
      const existingClaim = claimRepresentatives.find((item) => item.claimFingerprint === claimKey
        || claimSimilarity(`${item.title} ${item.summary}`, `${title} ${summary}`) >= .88
          && (!competitorLike || !["official_company", "pricing", "documentation", "review", "product_directory", "app_marketplace"].includes(item.sourceType)
            || competitorEntityScope(item.normalizedUrl, item.sourceType) === competitorEntityScope(normalizedUrl, sourceType)));
      if (existingClaim) {
        if (!existingClaim.searchAngleIds.includes(angle.id)) existingClaim.searchAngleIds.push(angle.id);
        if (!existingClaim.duplicateSourceUrls.includes(result.url)) existingClaim.duplicateSourceUrls.push(result.url);
        const duplicateType = inferSourceType(normalizedUrl);
        if (!existingClaim.duplicateSourceTypes.includes(duplicateType)) existingClaim.duplicateSourceTypes.push(duplicateType);
        existingClaim.sourceAssessment.repetitionRisk = "likely";
        existingClaim.sourceAssessment.independence = Math.max(.25, existingClaim.sourceAssessment.independence - .1);
        existingClaim.sourceAssessment.overallWeight = Math.round((existingClaim.sourceAssessment.quality * .35
          + existingClaim.sourceAssessment.directness * .3 + existingClaim.sourceAssessment.recency * .2
          + existingClaim.sourceAssessment.independence * .15) * 100) / 100;
        continue;
      }
      const sourceRetrievedAt = normalizePublicationDate(result.retrievedAt) ? new Date(result.retrievedAt!).toISOString() : retrievedAt;
      const publicationDate = normalizePublicationDate(result.publishedAt);
      const recency = recencyScore(publicationDate, sourceRetrievedAt);
      const quality = SOURCE_QUALITY[sourceType];
      const directness = directnessScore(sourceType);
      const independence = .9;
      const overallWeight = Math.round((quality * .35 + directness * .3 + recency * .2 + independence * .15) * 100) / 100;
       const pageIdentity = inferPageIdentity(normalizedUrl, title, summary, sourceType);
       const relevanceAssessment = assessMarketRelevance(angle.query, title, `${normalizedUrl} ${summary}`);
       const trust = trustMetadata(sourceType, angle.kind);
       if (pageIdentity.relationship === "publisher_listicle" && trust.provenance !== "company_controlled") {
         trust.provenance = "independent_secondary";
         trust.sourceFamily = "general";
         trust.commercialBiasRisk = "medium";
         trust.observationKind = "mixed";
       }
       const discoveryOnly = isVendorSeoListicle(normalizedUrl, title)
         || ["publisher_listicle", "aggregator_directory", "marketplace"].includes(pageIdentity.relationship);
      const ignoredDirectiveCategories = [...new Set([
        ...screenedTitle.ignoredDirectiveCategories,
        ...screenedSummary.ignoredDirectiveCategories,
      ])];
      const normalized: Evidence = {
        id: evidenceId(normalizedUrl),
        sourceUrl: result.url,
        normalizedUrl,
        title,
        sourceType,
        publicationDate,
        retrievedAt: sourceRetrievedAt,
        summary,
        supports: angle.purpose,
        confidence: Math.round((overallWeight - (result.rank && result.rank > 5 ? .08 : 0)) * 100) / 100,
        searchAngleIds: [angle.id],
        claimFingerprint: claimKey,
        duplicateSourceUrls: [],
         duplicateSourceTypes: [],
         pageIdentity,
         relevanceAssessment,
        security: {
          treatedAsUntrustedData: true,
          promptInjectionDetected: ignoredDirectiveCategories.length > 0,
          ignoredDirectiveCategories,
        },
        suppliedMetadata: result.suppliedMetadata ? {
          declaredSourceType: result.suppliedMetadata.declaredSourceType ?? null,
          declaredPublisher: result.suppliedMetadata.declaredPublisher ?? null,
          declaredDomain: result.suppliedMetadata.declaredDomain ?? null,
          metadataWarnings: [...new Set(result.suppliedMetadata.metadataWarnings ?? [])],
        } : undefined,
        sourceAssessment: {
          quality, directness, recency, independence, overallWeight,
          independenceGroup: independenceGroup(normalizedUrl, sourceType),
          isPrimary: ["official_company", "pricing", "documentation", "regulator", "research", "patent", "job_posting"].includes(sourceType),
          repetitionRisk: "none",
          discoveryOnly,
          ...trust,
           rationale: discoveryOnly
             ? `${pageIdentity.rationale} It is retained for discovery/context and cannot independently establish pain, willingness to pay, unmet demand, underserved status, competitor weakness, outcomes, or regulatory interpretation.`
             : `Weighted by ${sourceType} quality, claim directness, publication recency, and publisher independence; search rank is not treated as truth. ${relevanceAssessment.rationale}`,
        },
      };
      byUrl.set(normalizedUrl, normalized);
      claimRepresentatives.push(normalized);
      if (byUrl.size >= maxSources) break;
    }
    if (byUrl.size >= maxSources) break;
  }
  return [...byUrl.values()];
}
