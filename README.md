# Novelty Engine

Novelty Engine V2.1 is an evidence-driven opportunity-discovery pipeline plus a Claude Skill. It gathers and deduplicates public sources, models the market as an Opportunity Graph, detects structural holes and stitched workflows, challenges category assumptions, generates and mutates typed candidates, rejects fingerprint lookalikes, tries to falsify the survivors, ranks them with visible factor scores, and attaches a measurable validation experiment. Claude consumes that structured result instead of pretending a prompt performed research.

It never treats missing search results as proof of demand, and it never fills unsupported competitors, prices, complaints, or citations from model memory. Unknown stays unknown.

## Architecture

```text
user request -> research plan -> bounded source gathering -> competitor map
  -> complaint/workaround mining -> Opportunity Graph -> graph-hole detection
  -> weak signals -> failed-attempt mining -> assumption contradictions
  -> candidate generation -> constraint mutation -> novelty fingerprints
  -> falsification -> bounded survivor mutation -> factor ranking
  -> 24-72 hour validation experiments -> cited ResearchResult + cache record
```

The app uses Next.js App Router, TypeScript, native `fetch`, Node standard-library storage helpers, and no new runtime dependencies. The provider and storage boundaries are intentionally small so they can be replaced later.

Important locations:

- `app/api/research/route.ts` — `GET` configuration status and `POST` research endpoint.
- `app/research-debug/` — internal inspector for every V2 artifact, budget, lineage, score, outcome, and citation.
- `lib/research/` — typed schemas and one module per pipeline concern. See [`docs/architecture.md`](docs/architecture.md).
- `skill/novelty-engine/` — installable Claude Skill and backend helper.
- `lib/research/fixtures/` — representative test-only provider results; never a production fallback.
- `evals/` — three-mode evaluation cases and rubric.

## What the pipeline researches

Every request derives bounded angles for direct competitors, adjacent categories, customer complaints, manual workarounds, pricing complaints, underserved segments, workflow fragmentation, poor integrations, regulatory/technology changes, and substitutes. Targeted angles use legitimate indexed public pages and `site:` queries for sources such as Reddit, GitHub, review sites, startup directories, and forums. The system does not bypass robots, authentication, paywalls, or access controls and does not directly scrape protected pages.

Each normalized source records its URL, title, inferred source type, available date, factual search-result summary, the question it supports, confidence, retrieval time, and contributing search angles. Repeated normalized URLs merge and do not inflate counts.

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
| `RESEARCH_MAX_QUERIES` | No; default 10, hard cap 12 | Search calls per research run |
| `RESEARCH_RESULTS_PER_QUERY` | No; default 6, hard cap 10 | Provider results per angle |
| `RESEARCH_MAX_PROVIDER_CALLS` | No; default follows query cap, hard cap 12 | Total search-provider calls |
| `RESEARCH_MAX_CANDIDATES` | No; default 30, hard cap 48 | Initial plus survivor-mutation candidates |
| `RESEARCH_MAX_SURVIVOR_ITERATIONS` | No; default/hard cap 2 | Maximum mutation/retest rounds |
| `RESEARCH_MAX_MODEL_ITERATIONS` | No; default 0, hard cap 6 | Reserved model-provider budget; deterministic engine currently uses 0 |
| `RESEARCH_TIMEOUT_MS` | No; default 15000, hard cap 30000 | Per-provider-call timeout |
| `RESEARCH_RATE_LIMIT_PER_HOUR` | No; default 10, hard cap 100 | Per-IP API request budget per instance |
| `RESEARCH_CACHE_TTL_SECONDS` | No; default 86400, hard cap 604800 | Exact/high-similarity result cache TTL |
| `RESEARCH_RUNS_DIR` | No | Local directory for durable JSON run files |

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

`GET /api/research` reports provider readiness without exposing keys. `POST /api/research` accepts:

```json
{
  "query": "give me 5 business ideas in home services",
  "bypassCache": false
}
```

The versioned `ResearchResult` contains sources, competitor/complaint/gap records, the graph and holes, assumptions and contradictions, stitching patterns, weak signals, failed attempts, candidates and mutations, fingerprints and similarity explanations, falsification results, lineages, factor scores, validation experiments, final opportunities, explicit budget usage, warnings, and a reduced `ideationContext`. Factual fields carry evidence IDs; unsupported values remain `null` or absent.

## Claude Skill

### Install from the website ZIP

1. Download `novelty-engine.zip` from the website.
2. In Claude, open **Settings → Capabilities → Skills** and upload the ZIP or extracted `novelty-engine` folder as supported by the current Claude surface.

### Claude Code

```bash
mkdir -p ~/.claude/skills
cp -R skill/novelty-engine ~/.claude/skills/
```

Set the backend URL in the environment used by Claude Code:

```bash
export NOVELTY_RESEARCH_API_URL="https://your-project.vercel.app/api/research"
```

The Skill’s `scripts/research.mjs` helper posts the complete ideation request to the backend and returns structured JSON. It consumes ranked survivor records before writing the response. When the backend is unavailable, the Skill uses a bounded local process but must label market openings as hypothesis-led, not research-backed; fixtures are never a fallback.

Example prompts include “find AI tools for contractors,” “find underserved creator software markets,” and “give me 5 business ideas in home services.” Adding a concrete user, workflow, region, budget, or hard constraint improves both search precision and ideas.

## Validation and tests

```bash
npm run lint
npm run typecheck
npm test
npm run validate:skill
npm run build
```

Unit tests use checked-in search-result fixtures and make no live or paid API requests. They cover graph construction and holes, contradiction extraction, mutation lineage, workflow stitching, weak-signal uncertainty, failed blockers, fingerprints and similarity, falsification, survivor budgets, factor scoring, validation experiments, citation preservation, deduplication, unknown fields, and cost limits, plus the V1.1 evidence regression suite.

## Three-mode evaluation

The evaluation harness compares:

1. ordinary Claude ideation;
2. Novelty Engine with the backend unavailable;
3. Novelty Engine with the structured research payload.

It scores market-gap evidence, idea diversity, mechanism novelty, competitor similarity, source validity, falsification quality, lineage clarity, validation usefulness, requested-count fidelity, unsupported-claim rate, and core quality dimensions. See `evals/rubric.md` for the blinded protocol.

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
4. Optionally tune the bounded query, result, cache, and rate-limit variables.
5. Deploy, then check `GET /api/research` and run a request in `/research-debug`.

Vercel functions cannot rely on local files for durable cross-instance history. In Vercel mode this implementation uses a warm-instance memory cache and returns a warning about nondurable history. Before historical comparisons or durable production caching are required, replace `lib/research/store.ts` with Vercel KV/Redis, Postgres, Blob, or another approved store. The `ResearchResult` schema and provider-neutral cache interface are already reusable.

The in-memory rate limiter is conservative but instance-local. A multi-instance public launch should move rate-limit counters to the same shared store and add authentication or an upstream protection layer. No deploy or push is performed by repository scripts.

## Current scope

Fully functional without model calls: schemas, normalized/deduplicated evidence, Opportunity Graph construction, graph-hole detection, contradiction transforms, stitching scores, weak-signal normalization, failed-blocker comparison, deterministic candidate/mutation records, fingerprint similarity, falsification penalties, survivor limits, factor scoring, lineage, experiments, caching, API, inspector, packaging, and fixture tests.

Fixture-backed/heuristic: semantic extraction from search snippets, entity resolution, complaint grouping, assumption detection, failure-cause extraction, acceleration proxies, candidate language, similarity, falsification risk, and opportunity scores. These are inspectable heuristics, never proof. Live public-web evidence requires a Brave or Tavily key. Durable Vercel history, distributed rate limiting, authentication, full-page retrieval, and an optional swappable model provider remain integrations rather than mocked capabilities.

## License

MIT — free and open source.
