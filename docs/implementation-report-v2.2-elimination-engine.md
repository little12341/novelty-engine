# Novelty Engine 2.2 implementation report

## Zero-provider default extension (2026-08-28)

The recommended public workflow is now `Claude/web search → research_from_sources → get_research_requirements → add_sources_to_run → stored tools`. Claude or the user supplies bounded public URLs, titles, and evidence-bearing excerpts; Novelty validates and sanitizes them, then routes them through the same V2.2 normalization, provenance, entity, claim-audit, evidence-gate, competitor/gap, falsification, Bull/Bear/Judge, lifecycle, scoring, persistence, and next-action pipeline used by hosted search.

Supplied-source runs persist `retrievalMode: supplied_sources`, retrieval provenance, source counts, and immutable parent/root/version evidence lineage. Provider calls and estimated provider credits are exactly zero. `add_sources_to_run` creates a descendant snapshot rather than mutating history and reports evidence-family, gate, citation, and material-change deltas.

Brave/Tavily remain optional backward-compatible hosted adapters. `HOSTED_SEARCH_ENABLED=false` blocks them centrally even when credentials exist; secondary paths do not silently cross that boundary. Stored reads and stored-evidence falsification remain available. Public compute retains request-size, URL, text, per-client, concurrency, duration, persistence, and distributed-infrastructure protection while bypassing provider-spend counters. This avoids Tavily/Brave cost, not possible Vercel, Redis, bandwidth, or compute charges above free tiers.

## Outcome

The repository was upgraded in place. The landing-page visual system, existing public V2.1 result schema, provider adapters, deterministic opportunity pipeline, stored-run format, MCP endpoint, Claude Skill packaging, and existing tool names were preserved. `schemaVersion` intentionally remains `2.1.0` for client compatibility; new runs add `engineVersion: 2.2.0`.

The canonical loop is now:

```text
search → discover candidates → gather evidence → challenge → falsify
→ expand adjacent search when weak → apply founder constraints
→ survive or persist an exact kill → validate thresholds
→ return one next-best action and report only survivors
```

Research survival is deliberately not external validation. Normal survivors finish `SURVIVED → VALIDATING`. `VALIDATED` is possible only through a separately persisted measured validation outcome after the strict research gate passes and an inspectable external artifact URL is supplied.

## Audit: what already existed

The starting repository already had substantial V2.1 infrastructure, which was reused:

- Next.js App Router website, unchanged landing-page design, internal `/research-debug` inspector, Vercel deployment assets, sitemap, robots, and analytics.
- A provider-neutral `SearchProvider` contract with Brave and Tavily adapters, fixed server-side provider endpoints, timeouts, retry categorization, concurrency, and a fixture provider restricted to local tests.
- Bounded landscape and active-falsification search, result normalization, URL/claim deduplication, source-type inference, stable evidence IDs, source-quality/directness/recency/independence scoring, and prompt-injection screening.
- Competitor extraction, complaint clustering, underserved segments, gap detection/scoring, Opportunity Graph and graph holes, contradiction transforms, workflow stitching, weak signals, market archaeology/failed attempts, candidate generation, bounded one-dimension mutations, novelty fingerprints, residual-demand analysis, 11-dimension falsification, lineage, opportunity scoring, and 24–72 hour validation experiments.
- `VERIFIED`/`INFERRED`/`UNKNOWN` calibration, immutable evidence snapshots, citation-reference validation, stop decisions, rejection records, quality checkpoints, and “do not force an idea” behavior.
- Local JSON and optional Upstash Redis persistence, exact/similar-query caching, run history, opt-in preference memory, feedback, watchlists, explicit change checks, JSON/Markdown/print exports, and company/idea-comparison modes.
- Direct research HTTP API and remote stateless MCP Streamable HTTP, strict Zod tool inputs, bearer-token option, request-size caps, per-client/global daily/monthly/concurrency protection, health/observability, and fail-closed public Vercel behavior without distributed protection.
- An installable Claude Skill with MCP/direct-helper/local fallback order and a nine-case blinded evaluation harness.

## Added in 2.2

### Candidate elimination and validation

- Persisted candidate lifecycle: `DISCOVERED → RESEARCHING → CHALLENGED → FALSIFICATION → SURVIVED → VALIDATING → VALIDATED`, or `KILLED`.
- Exact kill phase/reason and failure-feedback tokens for deduplication, founder mismatch, falsification, mutation, evidence-gate, and selection-cutoff failures.
- Configurable strict evidence thresholds for independent pain, spend, competitors, underserved segments, timing, source diversity, citation coverage, and fatal falsifications.
- Explicit `discovered`, `promising`, `survived`, `validated`, and `killed` classifications. No external validation is inferred from research.
- Immutable external validation outcomes with measured metrics, public artifact URL policy, and `VALIDATED`/`INVESTIGATE`/`KILLED` decisions.
- One next-best action selected by unresolved assumption impact and uncertainty, plus interview/outreach targets, milestones, success criteria, and kill criteria.

### Search expansion, memory, and constraints

- Fast/standard/deep depth controls with shared hard query/provider/time/spend caps and abort-signal cancellation.
- Budgeted adjacent segment/workflow/vertical/geography/business-model/upstream/downstream/sub-niche branches when the initial case is weak. Provisional kill reasons are carried as negative search memory.
- Founder constraints for team size, time to MVP, technical/industry/geography exclusions, risk tolerance, capital/budget, and allowed distribution channels. Mismatches are rejected before final ranking.
- Searchable stored-run history, incremental rerun plus material-change and opportunity-evolution comparison, user-scoped research notes, tags, folders, and decision logs.
- Filterable daily/weekly views over recent saved snapshots for emerging gaps, vulnerable incumbents, pain, regulation, AI capability, funding, and open-source signals. This is a feed view, not an undeclared background scheduler.

### Adversarial and specialist orchestration

- Typed resumable dependency graph for Scout, Competitor, Gap, Skeptic, Evidence, Pricing, Customer Pain, Market Sizing, Trend, Distribution, Regulatory, Technical Feasibility, Business Model, Bull, Bear, Judge, and Final Judge.
- Bull and Bear receive independently assembled positive and counterevidence subsets and record distinct input hashes. Judge compares claims, contradictions, unknown assumptions, and source quality and returns `SURVIVES`, `INVESTIGATE`, or `KILL`.
- Nine-item candidate Assumption Ledger with `UNTESTED`, `WEAK`, `SUPPORTED`, `DISPROVEN`, and `CRITICAL`; fact state is separately `KNOWN`, `INFERRED`, `UNKNOWN`, or `CONTRADICTED`. Every unresolved assumption includes research-to-resolve and a predeclared kill criterion.
- Per-candidate “Why hasn’t this been built successfully?” analysis across technology, regulation, market size, distribution economics, willingness to pay, prior failures, incumbent control, switching, fake pain, and overlooked segments.

### Scoring and strategic tests

- Existing Opportunity Score retained for compatibility.
- Separate Evidence Confidence score using evidence density, independent sources, source diversity, citation coverage, freshness, and contradictions.
- Separate Novelty Score for feature/mechanism, positioning/job, customer, workflow/interface, technology, and business-model overlap; missing competitors earn no novelty credit. Collision detection is explicit.
- A 29-dimension scorecard covering pain, spend, market, competition, distribution, feasibility, regulation, capital, MVP time, defensibility, switching, revenue/margins/retention, founder fit, evidence, timing, incumbent vulnerability, fragmentation, and AI commoditization risk.
- Defined Evidence Density, Consensus vs Contrarian, Opportunity Half-Life, Demand Authenticity, Pain-to-Spend Ratio, Market Fragmentation, Incumbent Vulnerability, Switching Friction, Timing, Regulatory Tailwind, Manual Labor Replacement, Distribution Viability, and AI Commoditization scores.
- Counterfactual `$100M` requirements with tests/kill criteria and a moat stress test that assumes model capability becomes cheap/free through OpenAI, Anthropic, Google, Microsoft, Amazon, an incumbent, or open source.

### Evidence, security, competitive/customer intelligence

- Agent Shield URL policy rejects local/private/link-local destinations, URL credentials, non-HTTP protocols, and nonstandard ports; provider redirects now fail closed.
- Secret-like material is redacted from untrusted snippets in addition to existing prompt-injection directive removal.
- Per-tool client rate buckets, strict direct-API founder-constraint validation, MCP cancellation propagation, and existing cost/concurrency controls remain enforced.
- Competitor intelligence adds cited funding, headcount, hiring, traffic, review, complaint, partnership, integration, channel, launch, and strategy fields; unavailable fields remain `null`.
- Complaint intelligence adds requested features, willingness-to-pay signals, churn reasons, buying objections, and jobs-to-be-done snippets.
- `/find-business` receives dedicated search angles for real businesses, poor reviews, outdated/manual workflows, missing software/integrations, compliance, hiring/procurement, funding/growth, and buying intent.

### MCP, Skill, exports, API, and benchmarks

- MCP contract version 2.2 retains all old names and adds pagination, depth, founder constraints, cancellation, `rerun_research`, `source_check`, `next_best_action`, and `record_validation_outcome`.
- Claude command routing covers `/research-market`, `/find-gaps`, `/inspect-competitors`, `/falsify`, `/validate-idea`, `/research-company`, `/find-business`, `/compare`, `/market-size`, `/pricing`, `/customer-pain`, `/trend-check`, `/source-check`, `/evidence`, `/summarize-run`, `/rerun`, and `/export` without duplicating research logic.
- Exports now include JSON, Markdown, print HTML, opportunity CSV, competitor-matrix CSV, validation plan, opportunity brief, investor-style memo, and bibliography.
- OpenAPI 3.1 discovery at `/api/research/openapi`; new notes, feed, and external-validation endpoints; research debugger exposes lifecycle, gates, adversaries, task graph, branches, and next action without redesigning the product UI.
- Evaluation suite version 5 contains a 100-task domain/objective matrix plus nine curated cases and tracks competitor recall, source/citation accuracy, hallucination control, novelty, falsification effectiveness, confidence calibration, latency, provider calls, and cost.

### Architecturally separate financial signals

`lib/financial-signals/` adds immutable timestamped, evidence-ID-backed hypotheses and a backtester for 1/5/30-day returns, benchmark excess return, hit rate, false-positive rate, drawdown, calibration error, and sample size. Signals must be persisted before evaluated outcomes. An adequate sample is automatically killed below a 52% hit rate or at nonpositive excess return. The module explicitly states that historical testing is not guaranteed prediction or investment advice.

## Backward compatibility and migrations

- No destructive database migration is required.
- `ResearchResult.schemaVersion` stays `2.1.0`; `engineVersion` identifies 2.2 behavior.
- Existing run/cache JSON remains readable. Missing new top-level fields are conservatively normalized; historical runs are never retroactively called validated.
- Redis/local-file namespaces for notes, validation outcomes, and financial signals are created on demand. Existing run, cache, memory, feedback, watchlist, change, and comparison keys are untouched.
- Existing MCP tool names and required arguments remain valid. New depth/founder/cursor fields are optional.

## New configuration

See `.env.example` for defaults and bounds:

- `RESEARCH_MAX_EXPANSION_BRANCHES`
- `RESEARCH_MAX_RUN_DURATION_MS`
- `EVIDENCE_GATE_MIN_PAIN_SIGNALS`
- `EVIDENCE_GATE_MIN_SPEND_SIGNALS`
- `EVIDENCE_GATE_MIN_COMPETITORS`
- `EVIDENCE_GATE_MIN_SEGMENTS`
- `EVIDENCE_GATE_MIN_TIMING_SIGNALS`
- `EVIDENCE_GATE_MIN_SOURCE_TYPES`
- `EVIDENCE_GATE_MIN_CITATION_COVERAGE`
- `EVIDENCE_GATE_MAX_FATAL_RISKS`
- `NOVELTY_RESEARCH_DEPTH` for the Claude Code helper

Existing provider, Redis, MCP access, cache, quota, spend, retry, concurrency, and timeout variables remain valid.

## Deployment actions

1. Configure Brave or Tavily and Upstash Redis REST in the deployment environment. Public cost-bearing Vercel requests continue to fail closed without distributed protection.
2. Decide whether the platform supports a 120-second maximum function duration before setting deep-mode wall time above the standard 55-second default. The research and MCP routes declare `maxDuration = 120`; provider calls remain individually capped at 30 seconds.
3. Deploy the existing Next.js project; no schema migration command is required.
4. Check `/api/mcp/health`, `/api/research/openapi`, a standard research run, paginated gaps/competitors, `source_check`, an export, and the research debugger.
5. If multi-user notes or validation records are exposed publicly, add real OAuth/scoped authorization at the existing wrapper boundary; a supplied user ID is namespacing, not authentication.

No commit, push, or deployment was performed.

## Intentionally deferred

The following were not represented with fake buttons or placeholder claims:

- Live full-page crawling, source archiving, redirect-follow auditing, and dead-link revalidation. Current providers return search-result evidence only; URLs are policy-checked but not silently fetched.
- A production background scheduler and notification delivery. Watchlist checks and feeds are functional explicit endpoints; cron/queue/alert infrastructure depends on the deployment owner.
- OAuth, scoped public API keys, team accounts, usage billing, webhooks, and published JS/Python SDK packages. The OpenAPI and auth-wrapper boundaries are ready for these without changing research logic.
- True embedding-based semantic memory. Saved-run search currently uses transparent canonical token similarity; it is not mislabeled as vector semantics.
- Live SEC/news/earnings/hiring/supply-chain/analyst/price ingestion for financial signals. The timestamp/persistence/backtest boundary is implemented and isolated; data licensing, ingestion, and scheduling are separate deployment work.
- Independent model-provider calls for every specialist. The task graph and Bull/Bear evidence isolation are real deterministic orchestration records; `maxAgentCalls`/`maxModelIterations` remain reserved rather than spending hidden tokens or pretending persona prompts are independent research.
- Automated verification of user-supplied external validation artifacts. Artifact URLs and metrics are stored and policy-checked; factual verification requires an authorized retrieval workflow.

## Verification performed

- `npm run typecheck`
- `npm run lint`
- `npm test` — 57 unit/integration tests passed; Skill package/helper and 109-case evaluation manifest validated
- `npm run build` — production build succeeded with all routes
- `npm run verify:routes`
- `npm run verify:package`
- `git diff --check`

## Files changed

### Product/API/UI

- `.env.example`
- `README.md`
- `package.json`
- `package-lock.json`
- `app/api/mcp/route.ts`
- `app/api/research/route.ts`
- `app/api/research/export/route.ts`
- `app/api/research/history/route.ts`
- `app/api/research/feed/route.ts`
- `app/api/research/notes/route.ts`
- `app/api/research/openapi/route.ts`
- `app/api/research/validation/route.ts`
- `app/research-debug/research-debugger.tsx`
- `public/novelty-engine.zip` (regenerated installable Skill)

### Research core

- `lib/research/types.ts`
- `lib/research/pipeline.ts`
- `lib/research/opportunity-pipeline.ts`
- `lib/research/scoring.ts`
- `lib/research/intelligence.ts`
- `lib/research/evidence-gate.ts`
- `lib/research/lifecycle.ts`
- `lib/research/assumption-ledger.ts`
- `lib/research/adversarial.ts`
- `lib/research/orchestration.ts`
- `lib/research/next-action.ts`
- `lib/research/strategy-tests.ts`
- `lib/research/expansion.ts`
- `lib/research/founder-fit.ts`
- `lib/research/url-policy.ts`
- `lib/research/validation-outcomes.ts`
- `lib/research/analyze.ts`
- `lib/research/angles.ts`
- `lib/research/changes.ts`
- `lib/research/exports.ts`
- `lib/research/governance.ts`
- `lib/research/intents.ts`
- `lib/research/memory.ts`
- `lib/research/normalize.ts`
- `lib/research/notes.ts`
- `lib/research/platform-store.ts`
- `lib/research/providers.ts`
- `lib/research/store.ts`
- `lib/research/v2.2.test.ts`

### MCP

- `lib/mcp/http.ts`
- `lib/mcp/observability.ts`
- `lib/mcp/schemas.ts`
- `lib/mcp/summaries.ts`
- `lib/mcp/tools.ts`

### Financial-signal boundary

- `lib/financial-signals/types.ts`
- `lib/financial-signals/backtest.ts`
- `lib/financial-signals/store.ts`

### Skill, evaluation, docs, and verification

- `skill/novelty-engine/SKILL.md`
- `skill/novelty-engine/scripts/research.mjs`
- `evals/cases.json`
- `evals/task-matrix.json`
- `evals/rubric.md`
- `scripts/evaluate.mjs`
- `scripts/verify-production-routes.mjs`
- `docs/architecture.md`
- `docs/implementation-report-v2.2-elimination-engine.md`
