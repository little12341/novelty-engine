import { createHash } from "node:crypto";
import { inferSourceType, normalizeUrl } from "./normalize.ts";
import type { ProviderSearchResult, SearchProvider, SourceType, SuppliedResearchSource } from "./types.ts";
import { validateExternalResearchUrl } from "./url-policy.ts";

export const SUPPLIED_SOURCE_MAX_COUNT = 48;
export const SUPPLIED_SOURCE_MAX_TEXT_CHARS = 4_000;
export const SUPPLIED_SOURCE_MAX_TOTAL_TEXT_CHARS = 120_000;

type ValidatedSuppliedSource = ProviderSearchResult & { retrievedAt: string };

function compactText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

function normalizedHostname(value: string): string | null {
  const compact = value.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!compact || compact.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(compact)) return null;
  return compact;
}

function safeDate(value: unknown, now: Date, field: "publication_date" | "retrieved_at", warnings: string[]): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 64) throw new RangeError(`${field} must be a bounded ISO 8601 date or date-time.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new RangeError(`${field} must be a valid ISO 8601 date or date-time.`);
  if (parsed.getTime() > now.getTime() + 86_400_000) {
    warnings.push(`${field}_future_value_ignored`);
    return null;
  }
  return parsed.toISOString();
}

function sourceText(source: SuppliedResearchSource): string {
  const values = [source.snippet, source.excerpt, source.content]
    .map((value) => compactText(value, SUPPLIED_SOURCE_MAX_TEXT_CHARS))
    .filter((value, index, all) => value && all.indexOf(value) === index);
  return values.join(" ").trim();
}

export function validateSuppliedSources(
  sources: SuppliedResearchSource[],
  options: { now?: Date; maxCount?: number } = {},
): ValidatedSuppliedSource[] {
  const now = options.now ?? new Date();
  const maxCount = Math.max(1, Math.min(180, options.maxCount ?? SUPPLIED_SOURCE_MAX_COUNT));
  if (!Array.isArray(sources) || sources.length < 1) throw new RangeError("At least one supplied source is required.");
  if (sources.length > maxCount) throw new RangeError(`At most ${maxCount} supplied sources are allowed in this request.`);
  let totalText = 0;
  const byUrl = new Map<string, ValidatedSuppliedSource>();
  for (const [index, source] of sources.entries()) {
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new RangeError(`Source ${index + 1} must be an object.`);
    const urlDecision = validateExternalResearchUrl(source.url);
    if (!urlDecision.allowed || !urlDecision.normalizedUrl) throw new RangeError(`Source ${index + 1} URL is not allowed (${urlDecision.reason ?? "invalid_url"}).`);
    const normalizedUrl = normalizeUrl(urlDecision.normalizedUrl);
    if (!normalizedUrl) throw new RangeError(`Source ${index + 1} URL is not allowed.`);
    const title = compactText(source.title, 300);
    if (!title) throw new RangeError(`Source ${index + 1} must include a non-empty title.`);
    const snippet = sourceText(source);
    if (!snippet) throw new RangeError(`Source ${index + 1} must include a non-empty snippet, excerpt, or content field.`);
    totalText += title.length + snippet.length;
    if (totalText > SUPPLIED_SOURCE_MAX_TOTAL_TEXT_CHARS) throw new RangeError(`Supplied source text exceeds the ${SUPPLIED_SOURCE_MAX_TOTAL_TEXT_CHARS}-character request limit.`);

    const warnings: string[] = [];
    const publicationDate = safeDate(source.publicationDate, now, "publication_date", warnings);
    const suppliedRetrievedAt = safeDate(source.retrievedAt, now, "retrieved_at", warnings);
    const retrievedAt = suppliedRetrievedAt ?? now.toISOString();
    const actualDomain = new URL(normalizedUrl).hostname.toLowerCase().replace(/^www\./, "");
    const declaredDomain = source.domain ? normalizedHostname(source.domain) : null;
    if (source.domain && !declaredDomain) warnings.push("declared_domain_invalid_ignored");
    else if (declaredDomain && declaredDomain !== actualDomain) warnings.push("declared_domain_mismatch_ignored");
    const inferredType = inferSourceType(normalizedUrl);
    if (source.sourceType && source.sourceType !== inferredType) warnings.push("declared_source_type_mismatch_ignored");
    const declaredPublisher = source.publisher ? compactText(source.publisher, 160) : null;
    if (declaredPublisher) warnings.push("declared_publisher_unverified");
    const result: ValidatedSuppliedSource = {
      url: normalizedUrl,
      title,
      snippet,
      publishedAt: publicationDate,
      retrievedAt,
      suppliedContentScope: compactText(source.content, SUPPLIED_SOURCE_MAX_TEXT_CHARS) ? "content" : "excerpt",
      suppliedMetadata: {
        declaredSourceType: source.sourceType ?? null,
        declaredPublisher,
        declaredDomain: declaredDomain ?? null,
        metadataWarnings: warnings,
      },
    };
    const existing = byUrl.get(normalizedUrl);
    if (!existing) byUrl.set(normalizedUrl, result);
    else {
      existing.snippet = existing.snippet.length >= snippet.length ? existing.snippet : snippet;
      if (result.suppliedContentScope === "content") existing.suppliedContentScope = "content";
      existing.suppliedMetadata!.metadataWarnings = [...new Set([...(existing.suppliedMetadata!.metadataWarnings ?? []), "duplicate_url_collapsed_at_ingestion"])];
    }
  }
  return [...byUrl.values()];
}

export class SuppliedSourcesProvider implements SearchProvider {
  readonly id: string;
  readonly displayName = "Claude/user supplied public sources";
  readonly retrievalMode = "supplied_sources" as const;
  readonly usesHostedCredits = false;
  private readonly sources: ValidatedSuppliedSource[];

  constructor(sources: ValidatedSuppliedSource[]) {
    const fingerprint = createHash("sha256").update(sources.map((item) => item.url).sort().join("\n")).digest("hex").slice(0, 12);
    this.id = `supplied_sources_${fingerprint}`;
    this.sources = structuredClone(sources);
  }

  async search(_query: string, options: { limit: number; signal?: AbortSignal }): Promise<ProviderSearchResult[]> {
    if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Supplied-source research cancelled.", "AbortError");
    // This is an in-memory evidence handoff, not a web/provider call. Returning the complete bounded
    // snapshot lets the existing angle-based normalization and downstream V2.2 pipeline audit it.
    return structuredClone(this.sources);
  }
}

export function suppliedSourcesToProvider(
  sources: SuppliedResearchSource[],
  options: { now?: Date; maxCount?: number } = {},
): { provider: SuppliedSourcesProvider; sourceCount: number; normalized: ValidatedSuppliedSource[] } {
  const normalized = validateSuppliedSources(sources, options);
  return { provider: new SuppliedSourcesProvider(normalized), sourceCount: normalized.length, normalized };
}

export function evidenceAsSuppliedSource(source: {
  sourceUrl: string; title: string; summary: string; publicationDate: string | null; sourceType: SourceType; retrievedAt: string;
  discussionSample?: { fullPageAccess: "available" | "not_available" | "unknown" };
}): SuppliedResearchSource {
  return {
    url: source.sourceUrl, title: source.title,
    ...(source.discussionSample?.fullPageAccess === "available" ? { content: source.summary } : { snippet: source.summary }),
    publicationDate: source.publicationDate, sourceType: source.sourceType, retrievedAt: source.retrievedAt,
  };
}
