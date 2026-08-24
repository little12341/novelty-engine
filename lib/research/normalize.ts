import { createHash } from "node:crypto";
import type { Evidence, ProviderSearchResult, SearchAngle, SourceType } from "./types.ts";

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
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.protocol = "https:";
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
  if (/producthunt\.|betalist\.|crunchbase\./.test(host)) return "product_directory";
  if (/apps\.apple\.com|play\.google\.com|marketplace\./.test(host)) return "app_marketplace";
  if (/\.gov$|\.gov\.|europa\.eu$/.test(host)) return "regulator";
  if (/forum|community|discuss/.test(host) || /\/forum|\/community|\/discussions/.test(path)) return "forum";
  if (/pricing|plans|packages/.test(path)) return "pricing";
  if (/docs|documentation|help|support|developers/.test(host) || /\/docs|\/help|\/support/.test(path)) return "documentation";
  if (/techcrunch|forbes|reuters|bloomberg|wired|industry|journal|magazine/.test(host)) return "industry_publication";
  return "official_company";
}

function cleanText(value: string, maxLength = 420): string {
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
  const byClaim = new Map<string, Evidence>();
  for (const { angle, results } of batches) {
    for (const result of results) {
      const normalizedUrl = normalizeUrl(result.url);
      if (!normalizedUrl) continue;
      const existing = byUrl.get(normalizedUrl);
      if (existing) {
        if (!existing.searchAngleIds.includes(angle.id)) existing.searchAngleIds.push(angle.id);
        continue;
      }
      const summary = cleanText(result.snippet);
      const title = cleanText(result.title, 200);
      if (!summary || !title) continue;
      const claimKey = createHash("sha256").update(canonicalizeQuery(`${title} ${summary}`)).digest("hex");
      const existingClaim = byClaim.get(claimKey);
      if (existingClaim) {
        if (!existingClaim.searchAngleIds.includes(angle.id)) existingClaim.searchAngleIds.push(angle.id);
        continue;
      }
      const normalized: Evidence = {
        id: evidenceId(normalizedUrl),
        sourceUrl: result.url,
        normalizedUrl,
        title,
        sourceType: inferSourceType(normalizedUrl),
        publicationDate: normalizePublicationDate(result.publishedAt),
        retrievedAt,
        summary,
        supports: angle.purpose,
        confidence: result.rank && result.rank > 5 ? 0.55 : 0.7,
        searchAngleIds: [angle.id],
      };
      byUrl.set(normalizedUrl, normalized);
      byClaim.set(claimKey, normalized);
      if (byUrl.size >= maxSources) break;
    }
    if (byUrl.size >= maxSources) break;
  }
  return [...byUrl.values()];
}
