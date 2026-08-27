import type { ProviderSearchResult, SearchProvider } from "./types.ts";
import fixtureResults from "./fixtures/v2-market.json" with { type: "json" };

export class ResearchConfigurationError extends Error {
  readonly requiredEnvironmentVariables: string[];
  constructor(message: string, requiredEnvironmentVariables: string[]) {
    super(message);
    this.name = "ResearchConfigurationError";
    this.requiredEnvironmentVariables = requiredEnvironmentVariables;
  }
}

function requireOk(response: Response, provider: string): void {
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(`${provider} search failed with HTTP ${response.status}${retryAfter ? ` (retry-after ${retryAfter})` : ""}`);
  }
}

async function readJson<T>(response: Response, provider: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/json/i.test(contentType)) throw new TypeError(`${provider} returned malformed non-JSON content (${contentType}).`);
  try {
    return await response.json() as T;
  } catch (error) {
    throw new TypeError(`${provider} returned malformed JSON: ${error instanceof Error ? error.message : "parse failure"}`);
  }
}

export class BraveSearchProvider implements SearchProvider {
  readonly id = "brave";
  readonly displayName = "Brave Search API";
  private readonly apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }

  async search(query: string, options: { limit: number; signal?: AbortSignal }): Promise<ProviderSearchResult[]> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(options.limit));
    url.searchParams.set("extra_snippets", "true");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey },
      signal: options.signal,
      redirect: "error",
    });
    requireOk(response, this.displayName);
    const payload = await readJson<{ web?: { results?: Array<{ url?: string; title?: string; description?: string; age?: string }> } }>(response, this.displayName);
    if (payload.web?.results !== undefined && !Array.isArray(payload.web.results)) throw new TypeError(`${this.displayName} returned a malformed results field.`);
    return (payload.web?.results ?? []).flatMap((item, index) => item.url && item.title ? [{
      url: item.url,
      title: item.title,
      snippet: item.description ?? "",
      publishedAt: item.age ?? null,
      rank: index + 1,
    }] : []);
  }
}

export class TavilySearchProvider implements SearchProvider {
  readonly id = "tavily";
  readonly displayName = "Tavily Search API";
  private readonly apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }

  async search(query: string, options: { limit: number; signal?: AbortSignal }): Promise<ProviderSearchResult[]> {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: this.apiKey, query, search_depth: "advanced", max_results: options.limit, include_answer: false, include_raw_content: false }),
      signal: options.signal,
      redirect: "error",
    });
    requireOk(response, this.displayName);
    const payload = await readJson<{ results?: Array<{ url?: string; title?: string; content?: string; published_date?: string; score?: number }> }>(response, this.displayName);
    if (payload.results !== undefined && !Array.isArray(payload.results)) throw new TypeError(`${this.displayName} returned a malformed results field.`);
    return (payload.results ?? []).flatMap((item, index) => item.url && item.title ? [{
      url: item.url,
      title: item.title,
      snippet: item.content ?? "",
      publishedAt: item.published_date ?? null,
      rank: index + 1,
    }] : []);
  }
}

class LocalFixtureSearchProvider implements SearchProvider {
  readonly id = "fixture";
  readonly displayName = "Local MCP integration fixture";

  async search(query: string, options: { limit: number }): Promise<ProviderSearchResult[]> {
    const offset = /pricing|competitor|alternative/i.test(query) ? 0
      : /complaint|workaround|fragment|integration|underserved/i.test(query) ? 5 : 10;
    const results = fixtureResults as ProviderSearchResult[];
    return Array.from({ length: Math.min(options.limit, results.length) }, (_, index) => results[(offset + index) % results.length]);
  }
}

export function getConfiguredProvider(env: NodeJS.ProcessEnv = process.env): SearchProvider {
  const requested = (env.SEARCH_PROVIDER ?? "auto").toLowerCase();
  if (requested === "fixture" && env.NOVELTY_MCP_TEST_FIXTURES === "true" && !env.VERCEL) return new LocalFixtureSearchProvider();
  if ((requested === "auto" || requested === "brave") && env.BRAVE_SEARCH_API_KEY) return new BraveSearchProvider(env.BRAVE_SEARCH_API_KEY);
  if ((requested === "auto" || requested === "tavily") && env.TAVILY_API_KEY) return new TavilySearchProvider(env.TAVILY_API_KEY);
  if (!['auto', 'brave', 'tavily'].includes(requested)) {
    throw new ResearchConfigurationError(`Unknown SEARCH_PROVIDER value: ${requested}`, ["SEARCH_PROVIDER"]);
  }
  const required = requested === "brave" ? ["BRAVE_SEARCH_API_KEY"] : requested === "tavily" ? ["TAVILY_API_KEY"] : ["BRAVE_SEARCH_API_KEY or TAVILY_API_KEY"];
  throw new ResearchConfigurationError("Live research is not configured. Add a supported server-side search API key; no synthetic evidence was generated.", required);
}

export function providerConfiguration(env: NodeJS.ProcessEnv = process.env): { configured: boolean; selected: string | null; supported: string[] } {
  try {
    const provider = getConfiguredProvider(env);
    return { configured: true, selected: provider.id, supported: ["brave", "tavily"] };
  } catch {
    return { configured: false, selected: null, supported: ["brave", "tavily"] };
  }
}
