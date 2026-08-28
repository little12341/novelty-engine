# Novelty Engine

Novelty Engine 2.2 is an evidence-driven search-and-elimination platform plus a Claude Skill. Its recommended default is `Claude/web search → research_from_sources → normalize → challenge → falsify → validate → persist/export`: Claude gathers public evidence with the user's web capability, while Novelty performs the full evidence pipeline without a Tavily or Brave call. Optional hosted retrieval remains available for backward-compatible or explicitly requested deep research. The engine preserves the V2.1 public result schema while adding persisted candidate lifecycles and kill reasons, adjacent expansion, configurable evidence gates, independent Bull/Bear/Judge records, specialist task graphs, assumption ledgers, founder constraints, separate opportunity/novelty/evidence-confidence scores, one next-best action, richer exports, and an architecturally separate financial-signal backtester.

Production website: [https://www.novelty-engine.com](https://www.novelty-engine.com)

It never treats missing search results as proof of demand, and it never fills unsupported competitors, prices, complaints, or citations from model memory. Claims remain `VERIFIED`, `INFERRED`, or `UNKNOWN`; fact records also distinguish `KNOWN`, `INFERRED`, `UNKNOWN`, and `CONTRADICTED`. Normal research can end at `SURVIVED/VALIDATING`, but never `VALIDATED` unless both the strict evidence gate and external validation evidence pass. An `insufficient_evidence` stop produces no forced ideas.

Competitors validate that a job or market may exist; their existence is never an automatic rejection. Every candidate in a competitive landscape receives an explicit residual-unmet-demand assessment covering repeated unresolved complaints, workaround prevalence, switching behavior, underserved segments, price/performance gaps, trust failures, distribution gaps, and whether the proposed mechanism materially changes the outcome. Similarity can reduce differentiation and defensibility, but competition is decisive only when close substitutes already solve the same job for the same user with no meaningful residual gap.

## Architecture

```text
Claude browser / Claude Code -> Claude web search -> bounded public source objects
  -> Novelty Engine Skill -> research_from_sources at remote MCP (/api/mcp)
  -> user request + supplied evidence -> synonym/customer-language plan over one immutable snapshot
  -> source-verification role -> injection screening + trust metadata + deduplication
  -> market / competitor / complaint / gap / company roles over one evidence set
  -> source quality/independence/repetition assessment -> competitor + substitute map
  -> complaint/workaround mining -> Opportunity Graph -> graph-hole detection
  -> weak signals -> failed-attempt mining -> assumption contradictions
  -> evidence gate + stop decision -> candidate lifecycle -> novelty/collision fingerprints
  -> independent Bull/Bear/Judge + 11-dimension falsification -> evidence requirements / bounded mutation
  -> 29-factor scorecard + evidence confidence + decision intelligence + moat/counterfactual tests
  -> assumption ledger -> strict validation gate -> one next-best action + 24-72 hour validation plan
  -> quality checkpoints -> evidence snapshot lineage -> consistent final output + durable history

Optional advanced path: explicit research_market/run_research_mode -> centrally enabled Tavily or Brave adapter -> same pipeline
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

## Retrieval modes and optional provider setup

For local development, create `.env.local` in the project root. It is ignored by Git.

No search-provider key is required for the recommended supplied-source workflow. `research_from_sources`, `get_research_requirements`, `add_sources_to_run`, stored reads, comparisons, falsification over stored evidence, and exports remain useful with no Tavily/Brave credentials. To enable optional hosted retrieval, configure one server-side provider; keys are never exposed to users or client components.

| Variable | Required | Purpose |
| --- | --- | --- |
| `HOSTED_SEARCH_ENABLED` | No; default `true` for backward compatibility | Set `false` to block every Tavily/Brave adapter call centrally, even when keys exist |
| `BRAVE_SEARCH_API_KEY` | Only for optional hosted mode | Brave Search API subscription token |
| `TAVILY_API_KEY` | Only for optional hosted mode | Tavily Search API key |
| `SEARCH_PROVIDER` | No; default `auto` | `brave`, `tavily`, or `auto` (Brave first) |
| `RESEARCH_MAX_QUERIES` | No; standard default 28, hard cap 48 | Landscape, competitor recall/cross-check, evidence-gap, expansion, and falsification angles per run |
| `RESEARCH_RESULTS_PER_QUERY` | No; default 6, hard cap 10 | Provider results per angle |
| `RESEARCH_MAX_PROVIDER_CALLS` | No; default follows query cap, hard cap 48 | Total search-provider calls |
| `RESEARCH_MAX_COUNTEREVIDENCE_SEARCHES` | No; default 2, hard cap 4 | Candidate-focused competition/constraint searches inside a run |
| `RESEARCH_MAX_AGENT_CALLS` | No; default 0, hard cap 8 | Reserved model/agent-call budget; current deterministic role boundaries use 0 |
| `RESEARCH_MAX_PROVIDER_SPEND_CREDITS` | No; default follows provider cap, hard cap 48 | Abstract per-run provider-credit ceiling (one credit per search call) |
| `RESEARCH_MAX_CONCURRENCY` | No; default 3, hard cap 6 | Search concurrency inside one run |
| `RESEARCH_MAX_RETRIES_PER_SEARCH` | No; default 1, hard cap 2 | Retry count for retryable provider failures |
| `RESEARCH_COMPARISON_MAX_PROVIDER_CALLS` | No; default 30, hard cap 40 | Shared search-call ceiling across a 2–5 idea comparison |
| `RESEARCH_MAX_CANDIDATES` | No; default 30, hard cap 48 | Initial plus survivor-mutation candidates |
| `RESEARCH_MAX_SURVIVOR_ITERATIONS` | No; default/hard cap 1 | One tightly bounded mutation/retest round; one dimension per root |
| `RESEARCH_MAX_EXPANSION_BRANCHES` | No; standard default 5, hard cap 8 | Materially distinct adjacent branches attempted when the initial niche is weak |
| `RESEARCH_MIN_CREDIBLE_COMPETITORS` | No; default 5, hard cap 15 | Recall-escalation threshold for established categories; it triggers more search rather than fabricating competitors |
| `RESEARCH_COMPETITOR_QUERIES_PER_CANDIDATE` | No; default 2, hard cap 4 | Materially different formulations per structural buyer/job group in each primary and cross-check pass |
| `RESEARCH_MAX_MODEL_ITERATIONS` | No; default 0, hard cap 6 | Reserved model-provider budget; deterministic engine currently uses 0 |
| `RESEARCH_TIMEOUT_MS` | No; default 15000, hard cap 30000 | Per-provider-call timeout |
| `RESEARCH_MAX_RUN_DURATION_MS` | No; standard default 75000, hard cap 120000 | Hard wall-clock research budget |
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
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Required for authless public Vercel research | Durable runs/cache and distributed counters |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Alternative | Vercel/Upstash-compatible aliases for the durable store |
| `NOVELTY_RESEARCH_DEPTH` | No; default `standard` | Claude Code helper default: `fast`, `standard`, or `deep` |

For an authless public Vercel deployment using the zero-provider-cost default, set `HOSTED_SEARCH_ENABLED=false` and configure `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN` for durable runs, distributed abuse limits, and concurrency protection. No Tavily/Brave key is needed. Leave `MCP_ALLOW_INSTANCE_LOCAL_PUBLIC=false` and `NOVELTY_MCP_ACCESS_TOKEN` unset for Claude’s authless custom-connector flow.

If hosted mode is enabled, current Brave/Tavily quotas and pricing should be checked with the provider. Secrets belong only in `.env.local` or Vercel environment settings and must never use a `NEXT_PUBLIC_` prefix. Users never supply Novelty's provider keys. Supplied-source mode records `providerCalls: 0`, consumes no Tavily/Brave credits, and bypasses daily/monthly provider-spend counters while retaining request-size, per-client, concurrency, CPU/time, persistence, and MCP protections. This does not mean the deployment is literally cost-free: Vercel, Redis, bandwidth, or other infrastructure can cost money above their free tiers.

Without a configured key, supplied-source research still works. Hosted `research_market` and hosted API requests return `RESEARCH_NOT_CONFIGURED`; when `HOSTED_SEARCH_ENABLED=false`, every hosted entry point returns `HOSTED_SEARCH_DISABLED` and suggests `research_from_sources`. No path substitutes fixtures or unsourced generation.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open the public landing page at [http://localhost:3000](http://localhost:3000) and the internal inspector at [http://localhost:3000/research-debug](http://localhost:3000/research-debug).

Use the supplied-source path by default. Each record needs `url`, `title`, and an evidence-bearing `snippet`, `excerpt`, or `content`:

```bash
curl -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"query":"find AI tools for contractors","retrieval_mode":"supplied_sources","sources":[{"url":"https://example.org/field-report","title":"Field report","excerpt":"Contractors report re-entering job data between scheduling, invoicing, and customer systems."}]}'
```

PowerShell equivalent:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/research `
  -ContentType application/json `
  -Body '{"query":"find underserved creator software markets","retrieval_mode":"supplied_sources","sources":[{"url":"https://example.org/creator-survey","title":"Creator survey","excerpt":"Respondents describe recurring manual sponsorship reconciliation and delayed payment tracking."}]}'
```

Successful local runs are saved as an immutable run-ID file and a canonical-query cache file. MCP/HTTP-created runs also receive a lightweight hashed current-client index under `.research-runs/owners/`; the owner namespace never enters `ResearchResult` JSON. Exact queries persist across restarts; highly similar queries are reused within the same owner namespace when token-set similarity is at least 0.88. Add `"bypassCache": true` only when a fresh paid search is intentional. Historical unscoped V2.1/V2.2 run files remain readable by ID but are deliberately not exposed through a scoped public list.

## Research API

The production research endpoint is `https://www.novelty-engine.com/api/research`. Keep relative `/api/research` calls inside the deployed application so they remain same-origin.

`GET /api/research` reports the available retrieval modes without exposing keys. `POST /api/research` accepts the backward-compatible hosted request below, plus `retrieval_mode: supplied_sources` with 1–48 strict source objects containing `url`, `title`, and at least one of `snippet`, `excerpt`, or `content`.

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

Company research keeps the free-text path and also accepts authoritative structured identifiers. At least one query or identifier is required:

```json
{
  "mode": "research_company",
  "query": "Research Certificial and its competitors",
  "company_name": "Certificial",
  "domain": "certificial.com",
  "ticker": null,
  "country": "United States"
}
```

`domain` must be a bare public hostname. Schemes, paths, queries, credentials, ports, localhost, and IP addresses are rejected. Ambiguous structured names and conflicting query/name/domain combinations return `INVALID_COMPANY_IDENTITY`; structured identity remains authoritative over article, directory, listicle, or comparison-page titles.

The backward-compatible `ResearchResult` schema now carries `engineVersion: 2.2.0`, depth, search branches, lifecycle histories, evidence gates, assumption ledgers, independent adversarial reviews, task-graph/checkpoint records, one next-best action, novelty and evidence-confidence scores, counterfactual scale requirements, and moat stress tests in addition to every V2.1 field. `GET /api/research/openapi` describes the HTTP surface.

## Remote MCP

The production connector endpoint is:

```text
https://www.novelty-engine.com/api/mcp
```

It uses Vercel's `mcp-handler` 2.x implementation pattern with the official MCP TypeScript SDK v2: stateless Streamable HTTP, native MCP `2026-07-28`, and built-in stateless compatibility for 2025-era Streamable HTTP clients. Deprecated HTTP+SSE is not exposed. `GET /api/mcp/health` checks readiness without starting a paid research run.

Existing connectors configured with the apex-domain redirect or `https://novelty-engine.vercel.app/api/mcp` remain supported for backward compatibility. Use the redirect-free canonical `www.novelty-engine.com` endpoints for every new installation.

The deliberate, additive tool surface now contains **20 tools**. The first three are the recommended zero-provider-credit orchestration surface:

| Tool | Arguments | Result |
| --- | --- | --- |
| `research_from_sources` | `{ query, depth?, founder_constraints?, sources }` | Runs bounded Claude/user-supplied evidence through the full shared pipeline; persists a canonical run with `providerCalls: 0` |
| `get_research_requirements` | `{ run_id }` | Returns missing evidence families, unresolved claims/assumptions, and suggested Claude/web search objectives; no provider call |
| `add_sources_to_run` | `{ run_id, sources, founder_constraints? }` | Creates an immutable descendant run, merges/dedupes sources, and recomputes downstream analysis with zero hosted calls |
| `research_market` | `{ query, depth?, founder_constraints?, retrieval_mode?: "hosted" }` | Backward-compatible optional hosted full run; fails safely when hosted search is disabled |
| `find_market_gaps` | `{ run_id, limit?, cursor? }` | Only reads and ranks gaps already in a completed stored run; no fresh retrieval |
| `inspect_competitors` | `{ run_id, limit?, cursor?, fresh_expand?, candidate_id? }` | Reads stored competitors; only `fresh_expand=true` performs one bounded high-recall expansion |
| `falsify_opportunity` | `{ opportunity: string, run_id?: string, candidate_id?: string }` | Uses stored supplied evidence at zero provider cost; otherwise optional hosted counterevidence retrieval |
| `get_research_run` | `{ run_id, include_full? }` | Concise summary by default; `include_full=true` returns the stored internal `ResearchResult` |
| `run_research_mode` | `{ mode, query?, company_name?, domain?, ticker?, country?, depth?, founder_constraints?, retrieval_mode?: "hosted" }` | Optional hosted intent-scoped run; structured identifiers apply to `research_company` |
| `compare_ideas` | `{ ideas: string[2..5] }` | Starts fresh research for separate ideas under one shared provider-call budget |
| `export_research_run` | `{ run_id, format }` | Returns the canonical export/report representation; JSON export is not the internal `ResearchResult` |
| `compare_research_runs` | `{ baseline_run_id, comparison_run_id }` | Material snapshot deltas with trivial/syndicated changes suppressed |
| `rerun_research` | `{ run_id, depth?, retrieval_mode?: "auto"|"hosted" }` | Hosted rerun for hosted baselines; supplied baselines require `add_sources_to_run` unless hosted is explicitly requested |
| `source_check` | `{ run_id }` | Citation integrity, source quality/diversity, duplicates, contradictions, and unknowns |
| `next_best_action` | `{ run_id }` | Single highest-information validation or search action with success/kill criteria |
| `record_validation_outcome` | `{ run_id, candidate_id, experiment_type, success, observed_metrics, artifact_urls? }` | Persist an external validation result without bypassing research/evidence gates |
| `list_research_runs` | `{ limit?, cursor?, created_after?, created_before?, updated_after?, updated_before?, status?, stop_status?, mode?, depth? }` | Scoped recent-run summaries with opaque pagination; no run ID or fresh retrieval required |
| `search_research_runs` | `{ query, ...list filters }` | Ranked scoped keyword/canonical-token matches with transparent match metadata; not embedding/vector search |
| `get_research_budget_info` | `{}` | Public-safe configured retrieval ranges, hard caps, and relative cost for fast/standard/deep/comparison/falsification/rerun |
| `compare_run_candidates` | `{ run_id, candidate_ids: string[2..5], dimensions?, fresh_expand? }` | Side-by-side stored evidence comparison; zero provider calls by default, with killed/UNKNOWN status preserved |

`list_research_runs` returns `runs`, `page { limit, nextCursor, hasMore }`, and the automatic ownership boundary. Each run summary contains `run_id`, original query/topic, mode, depth, result status, stop status, creation/update timestamps, survivor/candidate/gap/rejected counts, and a concise result summary—never raw internal JSON. `search_research_runs` adds `match { score, exactPhrase, matchedFields }` and a plain-language `rankingMethod`. Filters and cursors are bounded and validated.

Public discovery is automatically partitioned by the same privacy-preserving hashed client-network identity used by protection controls. New caches and indexes are also owner-scoped, so one client cannot list/search another client's run. No caller-supplied `user_id` can select a different namespace. This is a practical pre-OAuth boundary, not an account system: clients sharing a NAT/public IP share the namespace, and changing networks may make prior runs undiscoverable until a real authenticated user namespace is added. Random run IDs remain readable by explicit ID for backward compatibility.

`get_research_budget_info` reports deterministic configured call ranges/caps rather than fake money. Deep is high relative cost and uses substantially more retrieval than fast; reruns inherit the selected depth; comparison has one shared cap; focused falsification has a four-call hard cap. It deliberately omits provider identity, API plans, credentials, monetary estimates, sensitive shared quota state, and remaining-capacity details.

`compare_run_candidates` accepts 2–5 unique canonical candidate IDs or gap IDs from one run. Without `fresh_expand`, it reads only stored evidence, score reasoning, falsification, assumption ledger, collision/competitor data, and claim lineage and returns `providerCalls: 0`. Rows cover buyer specificity, pain, spend/WTP, residual gap, competition/collision, differentiation, feasibility, distribution, switching friction, regulation/liability, evidence confidence, critical assumptions, strongest counterevidence, and next validation. Every cell carries `KNOWN`, `INFERRED`, `UNKNOWN`, or `CONTRADICTED`, evidence IDs, and citations. Killed candidates retain their exact reason and are never revived. Explicit fresh expansion updates only the comparison view and does not mutate stored scores or lifecycle decisions.

Tool errors are structured and distinguish `HOSTED_SEARCH_DISABLED`, `RESEARCH_NOT_CONFIGURED`, and `SUPPLIED_SOURCES_REQUIRED`. They never substitute fixtures or model-generated research. Supplied-source compute is bounded by strict source schemas, URL policy, per-source and aggregate text caps, request size, per-client rate limits, a concurrent-run semaphore, CPU/time limits, and persistence controls, but it does not consume Tavily/Brave daily/monthly budgets. Hosted calls retain every existing provider-call, retry, timeout, daily/monthly, and concurrency limit.

If Upstash Redis REST is configured, run retrieval, exact-query cache records, counters, global budgets, and concurrency protection are durable/distributed. Without it, local development uses files plus memory. On Vercel, authless cost-bearing MCP calls fail closed with `DURABLE_PROTECTION_REQUIRED`; an explicit `MCP_ALLOW_INSTANCE_LOCAL_PUBLIC=true` exists only for private previews. `/api/mcp/health` and `/research-debug` report the active mode.

Concise MCP summaries include an `ideationContextGuide`. The actual typed `ideationContext` remains on the stored `ResearchResult` and its user-safe fields are `finalOpportunities` (survivors), `graphHoles` (sparse structural links), `contradictions` (unresolved assumption inversions), `stitchingPatterns` (multi-tool/manual handoffs), `weakSignals` (early calibrated change signals), `resurrectionOpportunities` (failed approaches with possibly changed blockers), `competitors` (normalized entities with explicit nulls), `evidence` (traceable source records), `finalOutput`, and `budgetUsage`. This formalizes existing artifacts without changing schema version. Hidden chain-of-thought, raw model reasoning, private scratchwork, unselected candidate pools, sensitive quota state, and secrets are explicitly excluded.

## Claude Skill

### Install the Claude Skill

For Claude on the web or desktop, download [the current Skill package](https://www.novelty-engine.com/novelty-engine.zip), then:

1. Open **Customize → Skills**.
2. Choose **+ Create skill → Upload a skill**.
3. Upload the ZIP directly and enable Novelty Engine.

For Claude Code, extract the ZIP and run these commands from beside the extracted `novelty-engine` folder:

```bash
mkdir -p ~/.claude/skills
cp -R novelty-engine ~/.claude/skills/
```

On Windows with Claude Code, extract the archive so the resulting folder is `%USERPROFILE%\.claude\skills\novelty-engine` and confirm that `SKILL.md` is directly inside it. Repository contributors can instead run `cp -R skill/novelty-engine ~/.claude/skills/` from the repository root.

See [Claude's current custom Skill instructions](https://support.claude.com/en/articles/12512180-use-skills-in-claude) for plan-specific organization controls.

### Claude browser (preferred live-research path)

After deployment:

1. Upload and enable the Novelty Engine ZIP under **Customize → Skills** as described above.
2. On individual plans (Free/Pro/Max), open **Customize → Connectors**, click **+**, then choose **Add custom connector**. On Team/Enterprise, an Owner or Primary Owner first uses **Organization settings → Connectors → Add → Custom → Web**; members then connect it under **Customize → Connectors**.
3. Name it `Novelty Engine` and paste `https://www.novelty-engine.com/api/mcp`.
4. In a chat, use the **+** button at lower left, open **Connectors**, and enable Novelty Engine for the conversation. Then type a Novelty intent or ask for market-gap research normally.
5. Open `https://www.novelty-engine.com/api/mcp/health`, then make one small research request and confirm Claude returns a Novelty `research_…` run ID with citations. The internal `/research-debug` inspector intentionally returns 404 in production.

Claude's remote connector supports authless and OAuth servers. This project initially defaults to authless public access protected by distributed limits when Upstash is configured. Leave `NOVELTY_MCP_ACCESS_TOKEN` unset for that browser flow. The optional static bearer token is useful for programmable MCP clients, but Claude's custom-connector form does not provide a general custom-header field; add OAuth at the isolated auth wrapper before requiring authentication in Claude browser.

See [Anthropic's current custom connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) if labels differ on your Claude plan or organization.

### Claude Code

```bash
mkdir -p ~/.claude/skills
cp -R skill/novelty-engine ~/.claude/skills/
```

Set the backend URL in the environment used by Claude Code:

```bash
export NOVELTY_RESEARCH_API_URL="https://www.novelty-engine.com/api/research"
```

The Skill’s `scripts/research.mjs` helper posts the complete ideation request plus the JSON array at `NOVELTY_RESEARCH_SOURCES_FILE` to the backend and returns structured JSON. It refuses source-less requests by default; `NOVELTY_ALLOW_HOSTED_SEARCH=true` is an explicit opt-in to hosted retrieval. When the backend is unavailable, the Skill uses a bounded local process but must label market openings as hypothesis-led, not research-backed; fixtures are never a fallback.

The Skill's research order is Claude/web source gathering plus remote MCP first, the source-file-backed `NOVELTY_RESEARCH_API_URL` helper second, and clearly labeled non-researched local methodology last. Browser users therefore need neither a local environment variable nor PowerShell setup.

Novelty’s slash-like commands are plain-text **Skill intents**. They route through the Skill to the intended MCP tool, but they do not appear in Claude’s native prompt-bar slash autocomplete unless Claude itself provides that interface. Use `/commands` for the full catalog and `/help <command>` for one command’s usage and example.

Example prompts include “find AI tools for contractors,” “find underserved creator software markets,” and “give me 5 business ideas in home services.” Adding a concrete user, workflow, region, budget, or hard constraint improves both search precision and ideas.

## Validation and tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:mcp
npm run validate:skill
npm run build
npm run verify:production-security
```

Unit tests use checked-in search-result fixtures and make no live or paid API requests. They cover the prior graph, evidence, falsification, budget, citation, and failure-recovery contracts plus V2.2 lifecycle transitions, exact kill persistence, strict validation gating, Bull/Bear independence, score separation, assumption ledgers, founder rejection, adjacent expansion, Agent Shield URL policy, command routing, and financial-signal killing.

With a local server and provider key configured, exercise the same remote transport as a Claude client:

```bash
npm run test:mcp:client -- http://localhost:3000/api/mcp "Find 3 opportunities for small field service teams"
```

Run `npm run benchmark:retrieval` for the deterministic 20-market competitor-recall benchmark (recall, precision, major-player misses, source diversity, direct-vs-substitute accuracy, and collision calibration). For the full production-server regression (build manifests, browser health GET, protocol GET semantics, MCP initialization, exact 20-tool discovery, and a fixture-backed zero-provider `research_from_sources` call), run `npm run test:production`.

## Beta feedback and operational diagnostics

The homepage feedback form stores reports through the existing `/api/research/feedback` platform store. Supported public reports cover bad research runs, installation problems, incorrect competitors, source-quality problems, and MCP failures. Research-result reports require the `research_…` run ID; installation and MCP reports do not. Feedback is rate-limited, bounded to 1,000 characters, treated as user-provided context rather than public evidence, and should not contain secrets or private customer data.

Privacy-safe structured logs cover MCP failures, provider errors, research failures, rate-limit events, and deep/high-cost runs. Logs contain event categories, request/run IDs, provider IDs, counts, and timings—not prompts, source text, authorization headers, or credential values. Provider HTTP 429/quota failures remain visible as `RATE_LIMIT`/provider-rate-limit categories and include safe retry guidance; use the request ID and provider dashboard to diagnose exhaustion.

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
3. Set `HOSTED_SEARCH_ENABLED=false` for a provider-spend-proof deployment. Add `SEARCH_PROVIDER` and one server-side key only if optional hosted retrieval is desired; never use `NEXT_PUBLIC_` prefixes.
4. Add an Upstash Redis integration (required for authless public research on a multi-instance Vercel deployment) and expose its REST URL/token variables.
5. Tune per-client, concurrency, request-size, run-time, persistence, and—only when hosted mode is enabled—daily/monthly provider budgets.
6. Deploy, check `GET https://www.novelty-engine.com/api/mcp/health`, connect `https://www.novelty-engine.com/api/mcp` in Claude, and confirm Claude web search → `research_from_sources` returns a run ID, citations, `retrievalMode: supplied_sources`, and `providerCalls: 0`. Verify `/research-debug` returns 404.

Vercel functions cannot rely on local files for cross-instance history. This build uses Upstash Redis REST when configured and falls back to warm-instance memory on Vercel. Public production use should configure Redis; memory-only limits are suitable for local/single-instance evaluation, not a distributed free service. Automatic hashed client-network scoping protects run discovery today; OAuth/account-level identity remains intentionally outside the tool definitions so it can later replace that boundary without rewriting them. No deploy or push is performed by repository scripts.

## Current scope

Fully functional without model calls: schemas, normalized/deduplicated evidence, Opportunity Graph construction, graph-hole detection, contradiction transforms, stitching scores, weak-signal normalization, market archaeology, candidate lifecycle/kill memory, bounded adjacent expansion, fingerprint collision checks, independent adversarial records, evidence gates, founder-fit rejection, 29-factor scoring, novelty/evidence confidence, assumption ledgers, counterfactual/moat tests, next-action selection, validation plans, caching, HTTP/OpenAPI, remote MCP routing, exports, and the separate financial backtester.

Evidence-backed/heuristic: extraction from supplied or hosted search snippets/excerpts, entity resolution, complaint grouping, assumption detection, failure-cause extraction, acceleration proxies, candidate language, similarity, falsification risk, and scores. These are inspectable heuristics, never proof. Claude can gather live public-web evidence without Novelty owning a provider key; optional hosted retrieval requires Brave or Tavily. Distributed persistence/protection additionally requires Upstash-compatible Redis. Background schedulers, OAuth/team accounts, full-page archiving/dead-link revalidation, SEC/news/price ingestion, SDK publication, webhooks/billing, and a swappable model provider remain explicit integrations rather than fake functionality.

## License

MIT — free and open source.
