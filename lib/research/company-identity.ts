import { normalizeOrganizationName } from "./entity-resolution.ts";
import type { ResearchCompanyIdentity } from "./types.ts";

export class CompanyIdentityError extends RangeError {
  readonly code = "INVALID_COMPANY_IDENTITY";

  constructor(message: string) {
    super(message);
    this.name = "CompanyIdentityError";
  }
}

const AMBIGUOUS_NAMES = new Set(["apple", "block", "mercury", "monday", "oracle", "ramp", "square", "toast"]);
const DOMAIN_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$/i;
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

export type CompanyResearchIdentifiers = {
  companyName?: string;
  domain?: string;
  ticker?: string;
  country?: string;
};

export function requestedCompanyIdentity(query: string): { name: string; normalizedName: string } | null {
  const cleaned = query.replace(/^\s*\/(?:research-company|company)\s+/i, "").trim();
  const match = cleaned.match(/^(?:research|analy[sz]e|investigate|profile|look into)\s+(?:the\s+company\s+)?(.+?)(?=\s+(?:as\s+a\s+company|and\s+(?:its|their)|company\b|competitors?\b|pricing\b|products?\b)|[,.;]|$)/i);
  let name = match?.[1]?.trim() ?? "";
  name = name.replace(/^(?:a|an|the)\s+/i, "").trim();
  if (!name || /\b(?:market|industry|software company|category|business idea)\b/i.test(name) || name.split(/\s+/).length > 4) return null;
  const normalizedName = normalizeOrganizationName(name);
  return normalizedName.length >= 2 ? { name, normalizedName } : null;
}

export function normalizeCompanyDomain(value: string): string {
  const input = value.trim().toLowerCase().replace(/\.$/, "");
  if (!input || /:\/\/|[/?#@:]|\s/.test(input)) {
    throw new CompanyIdentityError("Company domain must be a bare public hostname such as certificial.com, without a scheme, path, query, credentials, or port.");
  }
  let hostname: string;
  try {
    hostname = new URL(`https://${input}`).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    throw new CompanyIdentityError("Company domain is not a valid public hostname.");
  }
  if (!DOMAIN_PATTERN.test(hostname) || hostname === "localhost" || /^\d+(?:\.\d+){3}$/.test(hostname)) {
    throw new CompanyIdentityError("Company domain must be a valid public DNS hostname, not localhost or an IP address.");
  }
  return hostname;
}

function domainBrand(domain: string): string {
  const labels = domain.split(".");
  const registrableIndex = labels.length >= 3 && /^(?:co|com|org|net|gov|ac)$/.test(labels.at(-2) ?? "") ? labels.length - 3 : labels.length - 2;
  return normalizeOrganizationName(labels[Math.max(0, registrableIndex)] ?? "");
}

function identityConflict(name: string, domain: string): boolean {
  const normalizedName = normalizeOrganizationName(name);
  const brand = domainBrand(domain);
  const nameTokens = normalizedName.split(/\s+/).filter((item) => item.length > 1);
  return !brand || !nameTokens.some((token) => token === brand || token.includes(brand) || brand.includes(token));
}

export function normalizeCompanyIdentity(input: CompanyResearchIdentifiers, query?: string): ResearchCompanyIdentity | null {
  const companyName = input.companyName?.trim().replace(/\s+/g, " ") || null;
  const domain = input.domain ? normalizeCompanyDomain(input.domain) : null;
  const ticker = input.ticker?.trim().toUpperCase() || null;
  const country = input.country?.trim().replace(/\s+/g, " ") || null;
  if (!companyName && !domain && !ticker && !country) return null;
  if (companyName && (companyName.length < 2 || companyName.length > 120 || /https?:\/\/|[<>]/i.test(companyName))) {
    throw new CompanyIdentityError("company_name must be a plain company name between 2 and 120 characters.");
  }
  if (ticker && !TICKER_PATTERN.test(ticker)) throw new CompanyIdentityError("ticker must contain 1–10 uppercase letters, digits, dots, or hyphens.");
  if (country && (country.length < 2 || country.length > 80 || /[<>]/.test(country))) throw new CompanyIdentityError("country must be 2–80 plain-text characters.");
  if (companyName && domain && identityConflict(companyName, domain)) {
    throw new CompanyIdentityError(`company_name ${companyName} conflicts with domain ${domain}; provide a matching identity or use the authoritative domain alone.`);
  }
  const parsedQueryIdentity = query ? requestedCompanyIdentity(query) : null;
  if (parsedQueryIdentity && companyName && parsedQueryIdentity.normalizedName !== normalizeOrganizationName(companyName)) {
    throw new CompanyIdentityError(`The free-text query targets ${parsedQueryIdentity.name}, but company_name targets ${companyName}. Resolve the conflict explicitly.`);
  }
  if (parsedQueryIdentity && domain && identityConflict(parsedQueryIdentity.name, domain)) {
    throw new CompanyIdentityError(`The free-text query targets ${parsedQueryIdentity.name}, but domain targets ${domain}. Resolve the conflict explicitly.`);
  }
  const normalizedName = companyName ? normalizeOrganizationName(companyName) : domain ? domainBrand(domain) : parsedQueryIdentity?.normalizedName ?? "";
  if (companyName && !domain && !ticker && !country && AMBIGUOUS_NAMES.has(normalizedName)) {
    throw new CompanyIdentityError(`${companyName} is an ambiguous company name; add domain, ticker, or country to identify the intended company.`);
  }
  return {
    companyName,
    normalizedName,
    canonicalDomain: domain,
    ticker,
    country,
    authoritative: true,
  };
}

export function buildCompanyResearchQuery(query: string | undefined, identity: ResearchCompanyIdentity | null): string {
  const focus = query?.trim() ?? "";
  if (!identity) {
    if (focus.length < 8) throw new CompanyIdentityError("research_company requires query or at least one structured company identifier.");
    return focus;
  }
  const labels = [
    identity.companyName && `name=${identity.companyName}`,
    identity.canonicalDomain && `domain=${identity.canonicalDomain}`,
    identity.ticker && `ticker=${identity.ticker}`,
    identity.country && `country/jurisdiction=${identity.country}`,
  ].filter((item): item is string => Boolean(item));
  const prefix = `Research the specifically identified company (${labels.join(", ")}).`;
  const suffix = focus ? ` User focus: ${focus}` : " Research its products, positioning, pricing, competitors, complaints, and exposed gaps.";
  return `${prefix}${suffix}`.slice(0, 500).trim();
}

export function normalizeCompanyResearchRequest(input: CompanyResearchIdentifiers & { query?: string }): { query: string; identity: ResearchCompanyIdentity | null } {
  const identity = normalizeCompanyIdentity(input, input.query);
  return { query: buildCompanyResearchQuery(input.query, identity), identity };
}
