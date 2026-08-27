# Novelty Engine

Novelty Engine 2.2 is an evidence-driven search-and-elimination platform plus a Claude Skill. Its core loop is `search → discover → gather evidence → challenge → falsify → expand → validate → report survivors`. It preserves the V2.1 public result schema while adding persisted candidate lifecycles and kill reasons, adjacent-search expansion, configurable evidence gates, independent Bull/Bear/Judge records, specialist task graphs, assumption ledgers, founder constraints, separate opportunity/novelty/evidence-confidence scores, one next-best action, richer exports, and an architecturally separate financial-signal backtester. Claude consumes the same structured contract exposed by MCP instead of pretending a prompt performed research.

Production website: [https://novelty-engine.com](https://novelty-engine.com)

It never treats missing search results as proof of demand, and it never fills unsupported competitors, prices, complaints, or citations from model memory. Claims remain `VERIFIED`, `INFERRED`, or `UNKNOWN`; fact records also distinguish `KNOWN`, `INFERRED`, `UNKNOWN`, and `CONTRADICTED`. Normal research can end at `SURVIVED/VALIDATING`, but never `VALIDATED` unless both the strict evidence gate and external validation evidence pass. An `insufficient_evidence` stop produces no forced ideas.

Competitors validate that a job or market may exist; their existence is never an automatic rejection. Every candidate in a competitive landscape receives an explicit residual-unmet-demand assessment covering repeated unresolved complaints, workaround prevalence, switching behavior, underserved segments, price/performance gaps, trust failures, distribution gaps, and whether the proposed mechanism materially changes the outcome. Similarity can reduce differentiation and defensibility, but competition is decisive only when close substitutes already solve the same job for the same user with no meaningful residual gap.

## Architecture

```text
Claude browser / Claude Code -> Novelty Engine Skill -> remote MCP (/api/mcp)
  -> intent (/find-business, /research-market, /research-company, ...)
  -> user request -> synonym/customer-language plan -> bounded shared source gathering
  -> source-verification role -> injection screening + trust metadata + deduplication
  -> market / competitor / complaint / gap / company roles over one evidence set
  -> source quality/independence/repetition assessment -> competitor + substitute map
  -> complaint/workaround mining -> Opportunity Graph -> graph-hole detection
  -> weak signals -> failed-attempt mining -> assumption contradictions
  -> evidence gate + stop decision -> candidate lifecycle -> novelty/collision fingerprints
  -> independent Bull/Bear/Judge + 11-dimension falsification -> adjacent search / bounded mutation
  -> 29-factor scorecard + evidence confidence + decision intelligence + moat/counterfactual tests
  -> assumption ledger -> strict validation gate -> one next-best action + 24-72 hour validation plan
  -> quality checkpoints -> evidence snapshot -> consistent final output + durable history
```

The app uses Next.js App Router, TypeScript, native `fetch`, the official MCP TypeScript SDK with Vercel's Web-standard handler, Zod schemas, Node storage helpers, and an optional Upstash Redis adapter. The provider, storage, protection, and authorization boundaries remain intentionally small.

Important locations:

- `app/api/research/route.ts` — `GET` configuration status and `POST` research endpoint.
- `app/api/mcp/route.ts` — stateless MCP Streamable HTTP endpoint for Claude and other remote clients.
- `app/api/mcp/health/route.ts` — secret-free MCP health, tool, storage, and protection status.
- `app/api/research/openapi/route.ts` — OpenAPI 3.1 discovery document for the stable HTTP boundary.
- `app/research-debug/` — internal inspector for every V2 artifact, budget, lineage, score, outcome, and citation.
- `lib/research/` — typed schemas and one module per pipeline concern. See [`docs/architecture.md`](docs/architecture.md).
- `lib/financial-signals/` — separate timestamped hypothesis persistence and 1/5/30-day benchmark-relative backtesting.
- `skill/novelty-engine/` — installable Claude Skill and backend helper.
- `lib/research/fixtures/` — representative test-only provider results; never a production fallback.
- `evals/` — three-mode evaluation cases and rubric.

## What the pipeline researches

Every request derives bounded angles for direct competitors, substitutes, first-person complaints and negative reviews, manual workarounds, customer terminology, pricing/procurement objections, underserved segments, GitHub/open-source gaps, research/regulation/patents, failed products, job postings, and paid labor. A provisional pass then spends remaining budget on candidate-focused competitor/demand and economics/feasibility/trust/regulatory counterqueries. The system does not bypass robots, authentication, paywalls, or access controls and does not directly scrape protected pages.

Each normalized source records its URL, title, inferred source type, date, search-result summary, retrieval time, contributing angles, claim fingerprint, repeated-copy URLs, and a transparent quality/directness/recency/independence assessment. Repeated URLs and high-overlap claims merge and cannot inflate recurrence, while the repetition warning remains visible.

Competitor fields use an evidence-carrying value shape: `{ value, evidenceIds, confidence }`. Public pricing is extracted only when a retrieved result states a price or pricing phrase. Target customers, weaknesses, and other unsupported fields remain `null` with no evidence IDs.

Complaint mining clusters repeated language into product, pricing, usability, distribution, integration, trust, or compliance gaps. It records evidence count, severity, affected segment, workaround, links, and whether the complaint is isolated. Gap scoring exposes ten 0–10 heuristic factors and named penalties for absence-only reasoning, weak evidence, one-off complaints, and crowded incumbent markets without a wedge. Scores prioritize review; they are not probabilities or market forecasts.

## Search provider setup

For local development, create `.env.local` in the project root. It is ignored by Git.

Configure one provider. Both are server-side only and are never referenced by client components:

| Variable | Required | Purpose |
| --- | --- | --- |
| `BRAVE_SEARCH_API_KEY` | One of the two keys | Brave Search API subscription token |
| `TAVILY_API_KEY` | One of the two keys | Tavily Search API key |
| `SEARCH_PROVIDER` | No; default `auto` | `brave`, `tavily`, or `auto` (Brave first) |
| `RESEARCH_MAX_QUERIES` | No; default/hard cap 12 | Landscape plus active-falsification search angles per run |
| `RESEARCH_RESULTS_PER_QUERY` | No; default 6, hard cap 10 | Provider results per angle |
| `RESEARCH_MAX_PROVIDER_CALLS` | No; default follows query cap, hard cap 12 | Total search-provider calls |
| `RESEARCH_MAX_COUNTEREVIDENCE_SEARCHES` | No; default 2, hard cap 4 | Candidate-focused competition/constraint searches inside a run |
| `RESEARCH_MAX_AGENT_CALLS` | No; default 0, hard cap 8 | Reserved model/agent-call budget; current deterministic role boundaries use 0 |
| `RESEARCH_MAX_PROVIDER_SPEND_CREDITS` | No; default follows provider cap, hard cap 12 | Abstract per-run provider-credit ceiling (one credit per search call) |
| `RESEARCH_MAX_CONCURRENCY` | No; default 3, hard cap 6 | Search concurrency inside one run |
| `RESEARCH_MAX_RETRIES_PER_SEARCH` | No; default 1, hard cap 2 | Retry count for retryable provider failures |
| `RESEARCH_COMPARISON_MAX_PROVIDER_CALLS` | No; default 30, hard cap 40 | Shared search-call ceiling across a 2–5 idea comparison |
| `RESEARCH_MAX_CANDIDATES` | No; default 30, hard cap 48 | Initial plus survivor-mutation candidates |
| `RESEARCH_MAX_SURVIVOR_ITERATIONS` | No; default/hard cap 1 | One tightly bounded mutation/retest round; one dimension per root |
| `RESEARCH_MAX_EXPANSION_BRANCHES` | No; standard default 2, hard cap 4 | Adjacent segment/workflow branches when the initial niche is weak |
| `RESEARCH_MAX_MODEL_ITERATIONS` | No; default 0, hard cap 6 | Reserved model-provider budget; deterministic engine currently uses 0 |
| `RESEARCH_TIMEOUT_MS` | No; default 15000, hard cap 30000 | Per-provider-call timeout |
| `RESEARCH_MAX_RUN_DURATION_MS` | No; standard default 55000, hard cap 120000 | Hard wall-clock research budget |
| `EVIDENCE_GATE_MIN_*` | No; see `.env.example` | Strict validation thresholds for pain, spend, competitors, segments, timing, source diversity, citation coverage, and fatal risks |
| `RESEARCH_RATE_LIMIT_PER_HOUR` | No | Legacy alias used when `MCP_RATE_LIMIT_PER_HOUR` is unset |
| `RESEARCH_CACHE_TTL_SECONDS` | No; default 86400, hard cap 604800 | Exact/high-similarity result cache TTL |
| `RESEARCH_HISTORY_TTL_SECONDS` | No; default/hard cap 31536000 | Durable Redis run/snapshot history retention; local files persist until removed |
| `RESEARCH_RUNS_DIR` | No | Local directory for durable JSON run files |
| `RESEARCH_PER_USER_DAILY_LIMIT` | No; default 10 | Cost-bearing research calls per hashed client identity per day |
| `RESEARCH_PER_USER_MONTHLY_LIMIT` | No; default 100 | Cost-bearing research calls per hashed client identity per month |
| `MCP_RATE_LIMIT_PER_HOUR` | No; default 20, hard cap 200 | Per-IP/client MCP tool-call limit; falls back to `RESEARCH_RATE_LIMIT_PER_HOUR` |
| `MCP_GLOBAL_DAILY_RESEARCH_LIMIT` | No; default 50 | Shared daily research/falsification request budget |
| `MCP_GLOBAL_MONTHLY_RESEARCH_LIMIT` | No; default 500 | Shared monthly research/falsification request budget |
| `MCP_MAX_CONCURRENT_RESEARCH` | No; default 2, hard cap 20 | Concurrent cost-bearing research calls |
| `MCP_CONCURRENCY_LEASE_SECONDS` | No; default 90 | Crash-safe distributed concurrency lease |
| `MCP_FALSIFICATION_MAX_QUERIES` | No; default/hard cap 4 | Focused searches made by `falsify_opportunity` |
| `MCP_ALLOW_INSTANCE_LOCAL_PUBLIC` | No; default false on Vercel | Explicit preview-only override for nondistributed public research |
| `NOVELTY_MCP_ACCESS_TOKEN` | No | Optional bearer token for non-browser clients; public Claude connector mode leaves this unset |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Recommended on Vercel | Durable runs/cache and distributed counters |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Alternative | Vercel/Upstash-compatible aliases for the durable store |
| `NOVELTY_RESEARCH_DEPTH` | No; default `standard` | Claude Code helper default: `fast`, `standard`, or `deep` |

Brave and Tavily both offer entry-level plans suitable for development, but current quotas and pricing should be checked with the provider. Secrets belong only in `.env.local` or Vercel environment settings. `.env*` and `.research-runs/` are ignored by Git; `.env.example` is the deliberately committed key template.

Without a configured key, `POST /api/research` returns HTTP 503 with `RESEARCH_NOT_CONFIGURED`. It does not substitute mock data or ask a model to invent results.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open the public landing page at [http://localhost:3000](http://localhost:3000) and the internal inspector at [http://localhost:3000/research-debug](http://localhost:3000/research-debug).

Run a request with curl:

```bash
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"query":"find AI tools for contractors"}'
```

PowerShell equivalent:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/research `
  -ContentType application/json `
  -Body '{"query":"find underserved creator software markets"}'
```

Successful local runs are saved twice under `.research-runs/`: an immutable run-ID file and a canonical-query cache file. Exact queries persist across restarts; highly similar queries are reused within a warm process when token-set similarity is at least 0.88. Add `"bypassCache": true` only when a fresh paid search is intentional.

## Research API

The production research endpoint is `https://novelty-engine.com/api/research`. Keep relative `/api/research` calls inside the deployed application so they remain same-origin.

`GET /api/research` reports provider readiness without exposing keys. `POST /api/research` accepts:

```json
{
  "query": "give me 5 business ideas in home services",
  "mode": "find_business",
  "depth": "standard",
  "userContext": { "teamSize": 2, "timeToMvpWeeks": 6, "riskTolerance": "low" },
  "bypassCache": false
}
```

The same endpoint accepts the documented research command prefixes. For comparison, send `{ "mode": "compare_ideas", "ideas": ["...", "..."] }`. Current-run `userContext` overrides any explicitly selected opt-in memory profile. Supporting endpoints cover searchable history, exports, notes/tags/folders/decision logs, measured validation outcomes, filtered saved-run feeds, memory, feedback, watchlists, and explicit watchlist checks; inspect `GET /api/research/openapi` for the current contract.

The backward-compatible `ResearchResult` schema now carries `engineVersion: 2.2.0`, depth, search branches, lifecycle histories, evidence gates, assumption ledgers, independent adversarial reviews, task-graph/checkpoint records, one next-best action, novelty and evidence-confidence scores, counterfactual scale requirements, and moat stress tests in addition to every V2.1 field. `GET /api/research/openapi` describes the HTTP surface.

## Remote MCP

The production connector endpoint is:

```text
https://novelty-engine.com/api/mcp
```

It uses Vercel's `mcp-handler` 2.x implementation pattern with the official MCP TypeScript SDK v2: stateless Streamable HTTP, native MCP `2026-07-28`, and built-in stateless compatibility for 2025-era Streamable HTTP clients. Deprecated HTTP+SSE is not exposed. `GET /api/mcp/health` checks readiness without starting a paid research run.

Existing connectors configured with `https://novelty-engine.vercel.app/api/mcp` remain supported for backward compatibility. Use the canonical `novelty-engine.com` endpoints for every new installation.

The deliberate tool surface is:

| Tool | Arguments | Result |
| --- | --- | --- |
| `research_market` | `{ query, depth?, founder_constraints? }` | Complete compatible output schema, gates, lifecycle, citations, warnings, budgets, and run ID; may return no ideas |
| `find_market_gaps` | `{ run_id, limit?, cursor? }` | Paginated ranked gaps with supporting/counter citations and explicit unknowns |
| `inspect_competitors` | `{ run_id, limit?, cursor? }` | Paginated evidence-carrying competitor intelligence; unsupported fields stay `null` |
| `falsify_opportunity` | `{ opportunity: string, run_id?: string, candidate_id?: string }` | Up to four fresh counterevidence searches plus the falsification result |
| `get_research_run` | `{ run_id: string, include_full?: boolean }` | Concise summary by default; complete internal JSON only when explicitly requested |
| `run_research_mode` | `{ mode, query, depth?, founder_constraints? }` | Shared pipeline for business, market, company, competitor, gap, falsification, and validation intents |
| `compare_ideas` | `{ ideas: string[2..5] }` | Qualitative cross-idea comparison under one shared provider-call budget |
| `export_research_run` | `{ run_id, format }` | JSON, Markdown, print, CSV, competitor matrix, validation plan, brief, memo, or bibliography |
| `compare_research_runs` | `{ baseline_run_id, comparison_run_id }` | Material snapshot deltas with trivial/syndicated changes suppressed |
| `rerun_research` | `{ run_id, depth? }` | Fresh incremental rerun plus material-change and opportunity-evolution comparison |
| `source_check` | `{ run_id }` | Citation integrity, source quality/diversity, duplicates, contradictions, and unknowns |
| `next_best_action` | `{ run_id }` | Single highest-information validation or search action with success/kill criteria |

Tool errors are structured and say when the provider is not configured or unavailable. They never substitute fixtures or model-generated research. Cost-bearing calls are bounded by request length, source/result limits, provider timeouts, search-call caps, per-client rate limits, daily/monthly global budgets, and a concurrent-run semaphore. Budget denial returns HTTP `429` with `Retry-After` and a machine-readable reason.

If Upstash Redis REST is configured, run retrieval, exact-query cache records, counters, global budgets, and concurrency protection are durable/distributed. Without it, local development uses files plus memory. On Vercel, authless cost-bearing MCP calls fail closed with `DURABLE_PROTECTION_REQUIRED`; an explicit `MCP_ALLOW_INSTANCE_LOCAL_PUBLIC=true` exists only for private previews. `/api/mcp/health` and `/research-debug` report the active mode.

## Claude Skill

### Install as a local Claude Skill

From beside the repository folder, run:

```bash
mkdir -p ~/.claude/skills
cp -R novelty-engine ~/.claude/skills/
```

See [Claude's current custom Skill instructions](https://support.claude.com/en/articles/12512180-use-skills-in-claude) for plan-specific organization controls.

### Claude browser (preferred live-research path)

After deployment:

1. Install the Novelty Engine Skill with the local setup commands above.
2. In Claude, open **Settings → Connectors**. On Team/Enterprise, an Owner or Primary Owner first uses the **Organization connectors** view.
3. Choose **Add custom connector**, name it `Novelty Engine`, and paste `https://novelty-engine.com/api/mcp`.
4. In a chat, open **Search and tools**, enable the Novelty Engine connector/tools, then invoke `/novelty-engine` or ask for market-gap/invention research normally.
5. Test the connection with `GET https://novelty-engine.com/api/mcp/health`, then confirm a live call in `https://novelty-engine.com/research-debug`.

Claude's remote connector supports authless and OAuth servers. This project initially defaults to authless public access protected by distributed limits when Upstash is configured. Leave `NOVELTY_MCP_ACCESS_TOKEN` unset for that browser flow. The optional static bearer token is useful for programmable MCP clients, but Claude's custom-connector form does not provide a general custom-header field; add OAuth at the isolated auth wrapper before requiring authentication in Claude browser.

See [Anthropic's current custom connector instructions](https://support.anthropic.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp) if labels differ on your Claude plan or organization.

### Claude Code

```bash
mkdir -p ~/.claude/skills
cp -R skill/novelty-engine ~/.claude/skills/
```

Set the backend URL in the environment used by Claude Code:

```bash
export NOVELTY_RESEARCH_API_URL="https://novelty-engine.com/api/research"
```

The Skill’s `scripts/research.mjs` helper posts the complete ideation request to the backend and returns structured JSON. It consumes ranked survivor records before writing the response. When the backend is unavailable, the Skill uses a bounded local process but must label market openings as hypothesis-led, not research-backed; fixtures are never a fallback.

The Skill's research order is remote MCP first, the `NOVELTY_RESEARCH_API_URL` helper second, and clearly labeled non-researched local methodology last. Browser users therefore need neither a local environment variable nor PowerShell setup.

Example prompts include “find AI tools for contractors,” “find underserved creator software markets,” and “give me 5 business ideas in home services.” Adding a concrete user, workflow, region, budget, or hard constraint improves both search precision and ideas.

## Validation and tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:mcp
npm run validate:skill
npm run build
```

Unit tests use checked-in search-result fixtures and make no live or paid API requests. They cover the prior graph, evidence, falsification, budget, citation, and failure-recovery contracts plus V2.2 lifecycle transitions, exact kill persistence, strict validation gating, Bull/Bear independence, score separation, assumption ledgers, founder rejection, adjacent expansion, Agent Shield URL policy, command routing, and financial-signal killing.

With a local server and provider key configured, exercise the same remote transport as a Claude client:

```bash
npm run test:mcp:client -- http://localhost:3000/api/mcp "Find 3 opportunities for small field service teams"
```

For the full production-server regression (build manifests, browser health GET, protocol GET semantics, MCP initialization, exact tool discovery, and a fixture-backed `research_market` call), run `npm run test:production`.

## Three-mode evaluation

The evaluation harness compares:

1. ordinary Claude ideation;
2. Novelty Engine with the backend unavailable;
3. Novelty Engine with the structured research payload.

It includes 100 matrix-generated representative tasks plus curated edge cases and tracks competitor recall, source/citation accuracy, hallucination control, opportunity novelty, falsification effectiveness, confidence calibration, latency, provider calls, and cost alongside the original quality dimensions. See `evals/rubric.md` for the blinded protocol.

```bash
npm run eval
npm run eval:init
# Capture and blind all three conditions, enter 1–5 scores, then:
npm run eval:score -- evals/results/local.json
```

## Deploy to Vercel

1. Import the repository as a Next.js project.
2. Keep the default build command (`npm run build`) and output settings.
3. Add `SEARCH_PROVIDER` and one provider API key in **Project Settings → Environment Variables**. Do not use `NEXT_PUBLIC_` prefixes.
4. Add an Upstash Redis integration (required for authless public research on a multi-instance Vercel deployment) and expose its REST URL/token variables.
5. Tune the MCP per-client, daily, monthly, concurrency, search, and cache budgets for the provider plan.
6. Deploy, check `GET https://novelty-engine.com/api/mcp/health`, connect `https://novelty-engine.com/api/mcp` in Claude, and run a request from Claude plus `https://novelty-engine.com/research-debug`.

Vercel functions cannot rely on local files for cross-instance history. This build uses Upstash Redis REST when configured and falls back to warm-instance memory on Vercel. Public production use should configure Redis; memory-only limits are suitable for local/single-instance evaluation, not a distributed free service. OAuth/per-user authorization remains intentionally outside the tool definitions so it can be added without rewriting them. No deploy or push is performed by repository scripts.

## Current scope

Fully functional without model calls: schemas, normalized/deduplicated evidence, Opportunity Graph construction, graph-hole detection, contradiction transforms, stitching scores, weak-signal normalization, market archaeology, candidate lifecycle/kill memory, bounded adjacent expansion, fingerprint collision checks, independent adversarial records, evidence gates, founder-fit rejection, 29-factor scoring, novelty/evidence confidence, assumption ledgers, counterfactual/moat tests, next-action selection, validation plans, caching, HTTP/OpenAPI, remote MCP routing, exports, and the separate financial backtester.

Fixture-backed/heuristic: extraction from search snippets, entity resolution, complaint grouping, assumption detection, failure-cause extraction, acceleration proxies, candidate language, similarity, falsification risk, and scores. These are inspectable heuristics, never proof. Live public-web evidence requires Brave or Tavily. Distributed persistence/protection additionally requires Upstash-compatible Redis. Background schedulers, OAuth/team accounts, full-page archiving/dead-link revalidation, SEC/news/price ingestion, SDK publication, webhooks/billing, and a swappable model provider remain explicit integrations rather than fake functionality.

## License

MIT — free and open source.
