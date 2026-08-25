# Novelty Engine V2.1 architecture

## Design contract

V2 separates public evidence, deterministic inference, candidate invention, adversarial review, and presentation. A factual statement about a company, price, complaint, regulation, trend, or historical failure must resolve through `evidenceIds` to a normalized `Evidence` record. Missing evidence stays unknown. Candidate proposals may be creative, but they cannot silently become market facts.

The backend is modular and provider-neutral. Search uses the `SearchProvider` interface; Brave and Tavily are current adapters. The deterministic invention layer uses no model calls, so fixture runs are repeatable and free. `maxModelIterations` reserves an explicit budget for a future `ModelProvider` without making one a hidden dependency.

The remote MCP layer is an adapter in front of this backend, not a replacement for it:

```text
Claude browser / Claude Code
  → Novelty Engine Skill
  → /api/mcp (stateless MCP Streamable HTTP)
  → deliberate tool router
  → existing runResearch / opportunity / falsification modules
  → Brave or Tavily
  → structured evidence, gaps, competitors, and survivors
```

`mcp-handler` 2.x and the official MCP TypeScript SDK v2 provide Web-standard Next.js route handling. The endpoint serves MCP 2026-07-28 natively and 2025-era stateless Streamable HTTP through the package's compatibility path. No proprietary request envelope or deprecated HTTP+SSE route is used.

## Pipeline

```text
request
  ├─ validate query / compute budgets
  ├─ cache lookup
  ├─ derive 10 bounded landscape angles with synonyms and customer/workaround language
  ├─ SearchProvider.search (timeout + concurrency + categorized failures + bounded retry)
  ├─ provisional landscape/gap pass
  ├─ derive up to 2 candidate-focused competition/constraint falsification angles
  ├─ normalize URLs, dates, source types, summaries; collapse URLs and repeated claims
  ├─ weight sources by quality, directness, recency, and independent provenance group
  ├─ assess source-family coverage and apply proceed / partial / insufficient stop decision
  ├─ extract competitors, complaint clusters, segments, candidate gaps
  └─ opportunity pipeline
       ├─ build OpportunityGraph and find graph holes
       ├─ detect stitched workflows
       ├─ normalize weak signals (acceleration is marked approximate)
       ├─ mine failed attempts and compare historical blockers
       ├─ extract market assumptions and generate contradictions
       ├─ generate only from gaps that clear positive-evidence and independence gates
       ├─ fingerprint candidates and competitors; reject lookalikes
       ├─ falsify each candidate across 11 risk dimensions
       ├─ mutate/retest only promising `mutate` outcomes, one constraint and once per root
       ├─ build concise evidence lineage
       ├─ rank survivors with legacy granular factors plus 9 written decision assessments
       ├─ create a measurable 24–72 hour validation experiment
       └─ return at most the requested count; record cutoff/rejected ideas and never pad
```

`pipeline.ts` owns request/search/cache orchestration, the active counterevidence search, research coverage, and the stop decision. `opportunity-pipeline.ts` composes the deterministic post-research stages. Individual engines do not perform network calls, persistence, or UI work.

## MCP boundary

`app/api/mcp/route.ts` mounts one endpoint and registers five tools through `lib/mcp/tools.ts`:

- `research_market({ query })` invokes the complete existing pipeline and returns the consistent `Research Landscape → Signals → Structural Gaps → Candidate Ideas → Rejected Ideas + Why → Survivors → Evidence Lineage → Decisive Risks → 24–72 Hour Validation Tests` summary plus run ID.
- `find_market_gaps({ run_id, limit? })` selects ranked gaps and resolves support/counterevidence to source URLs.
- `inspect_competitors({ run_id, limit? })` returns the evidence-carrying competitor map and a list of unsupported fields.
- `falsify_opportunity({ opportunity, run_id?, candidate_id? })` makes at most four focused counterevidence searches, then reuses the existing falsification engine.
- `get_research_run({ run_id, include_full? })` returns a concise summary or the preserved full record when explicitly requested.

All input schemas are strict Zod objects with bounded strings and list limits. MCP tool results include both text content and `structuredContent`; the default summaries bound sources and survivors rather than dumping every internal stage. Provider/configuration failures return tool errors with `fabricatedEvidence: false`. Transport-level request, rate, budget, and concurrency denials use HTTP `4xx`/`429` plus JSON-RPC errors and `Retry-After` where applicable.

The HTTP wrapper is separate from tool registration. It currently supports authless rate-limited access or an optional constant-time bearer-token check. OAuth or per-user authorization can replace that wrapper without changing tool schemas or research functions.

Authless cost-bearing MCP calls fail closed on Vercel when no distributed store is configured. A named instance-local override exists for private preview testing, but production does not silently present warm-instance counters as safe public protection.

## Schemas and provenance

`types.ts` is the public server-side contract. Major records are:

- `Evidence` and `SupportedValue<T>` for source-backed facts and explicit unknowns.
- `OpportunityGraphNode`, `OpportunityGraphEdge`, and `GraphHole` for the serializable market model.
- `MarketAssumption` and `ContradictionHypothesis` for evidenced category defaults and transforms.
- `WorkflowStitchingPattern`, `WeakSignal`, and `FailedAttempt` for missing-product, early-change, and resurrection analysis.
- `IdeaCandidate` and `MutationRecord` for traceable concepts and exact constraint changes.
- `NoveltyFingerprint` and `SimilarityResult` for explainable heuristic comparisons.
- `FalsificationResult` for separate arguments for/against, unknowns, risk penalties, and outcomes.
- `IdeaLineage`, `OpportunityScore`, `ValidationExperiment`, and `FinalOpportunity` for user-facing survivor records.
- `PipelineBudgetUsage` for cost/iteration accounting.

Source IDs are stable hashes of normalized URLs. Normalized duplicate URLs merge their search-angle IDs. Exact and high-overlap claim copies at different URLs collapse into one evidence record whose `duplicateSourceUrls` and repetition risk remain visible. Each evidence record includes a source assessment for quality, directness, recency, independence, primary-source status, and overall weight. Community posts use post/repository-level independence groups while publisher material uses publisher-level groups. Engines union evidence IDs rather than copying source claims into new unsupported text. Fixture assertions verify that every referenced ID exists in the source set.

## Opportunity Graph

Supported node types include competitors, products, customer segments, complaints, workarounds, jobs-to-be-done, technologies, regulations, pricing models, distribution channels, failed attempts, behaviors, and gaps. A run contains only types supported or inferred by its retrieved evidence; the schema does not manufacture placeholder nodes.

Supported relationships include `serves`, `complains-about`, `depends-on`, `replaces`, `integrates-with`, `blocked-by`, `priced-for`, `workaround-for`, `enabled-by`, `failed-because`, `similar-to`, and `underserved-by`. The current deterministic constructor emits the relationships it can support from snippet-level extraction. Graph-hole analysis looks for complaint-heavy/solution-light segments, repeated complaint/workaround pairs, unconnected enabling technologies, and regulatory shifts. Missing combinations are hypotheses, never absence-based proof of demand.

## Invention and survivor loops

Candidate generation combines gaps, graph holes, contradictions, stitching patterns, weak signals, and changed historical blockers. Each record stores source IDs for every upstream family. Constraint mutations change one core dimension and record `before`, `after`, effect, parent, result, and iteration.

Fingerprints compare target customer, job, mechanism, interface, technology, business model, distribution, data source, ownership, workflow position, and differentiator. Similarity is a declared heuristic: 55% token Jaccard overlap plus 45% matching-dimension share. It is useful for duplicate rejection, not a patent or uniqueness search.

Falsification tests demand, competition/incumbent response, economics, distribution, technical feasibility, regulation, behavior, trust, liability, switching cost, and defensibility. The main run spends available search budget on explicit competitor/demand and structural-constraint counterqueries after a provisional gap pass. Each dimension records evidence for and against, a `VERIFIED`/`INFERRED`/`UNKNOWN` status, written rationale, and whether it is decisive. Missing evidence never clears risk. Only a candidate with an evidence-backed core and `mutate` outcome can receive one tightly bounded one-dimension mutation; a failed mutation is terminal.

## Scoring and confidence

The Opportunity Score retains 13 granular factors for compatibility and adds nine decision assessments: evidence strength, demand signal, novelty/differentiation, feasibility, economics, distribution, defensibility, regulatory risk, and confidence. Every assessment contains a numeric heuristic, claim status, written rationale, and evidence IDs. Regulatory risk is explicitly a risk scale where higher is worse. Named penalties cover missing evidence, near-duplicates, and failed falsification. No aggregate or factor score is a probability or replacement for written reasoning. Confidence is `evidence-backed`, `plausible`, or `speculative` based on provenance and upstream gap support.

## Cost, timeout, cache, and storage controls

Hard caps are enforced in `researchLimits()` even if environment values are larger:

- 12 search angles/provider calls, normally 10 landscape plus up to 2 active falsification angles (failed retry attempts consume the same cap);
- 10 results per query and 80 normalized sources;
- 48 total candidates;
- 1 survivor-mutation round, with at most one changed constraint per root;
- 30-second provider-call timeout;
- bounded request length, API body size, concurrency, and per-IP request rate.

MCP adds a 16 KiB protocol-body cap, a configurable per-IP/client hourly call limit, global daily/monthly research-call budgets, maximum concurrent research runs, and a four-query hard cap for focused falsification. The direct `/api/research` route shares the same global budgets and semaphore, so it cannot bypass public cost controls.

Exact cache keys hash provider plus canonical query. Similar warm-process queries can reuse results at a token-set threshold of 0.88. Local runs persist immutable and cache JSON files. When Upstash Redis REST credentials are present, exact cache entries, full run-ID records, request counters, global budgets, and the concurrency semaphore are distributed and TTL-bound. Without Redis, local files preserve runs locally while counters remain memory-only; Vercel falls back to warm-instance memory and reports that limitation through health/debug output.

## Live and fixture-backed capabilities

Live source gathering requires `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY`. No credentials means a clear HTTP 503; fixtures are never selected in production. Once sources exist, all downstream stages execute locally.

Fixture-backed tests establish deterministic behavior and schema/provenance invariants, not real market truth. Regressions cover a crowded consumer category, B2B workflow, regulated market, software/tooling market, insufficient-evidence case, partial provider failures, malformed payloads, and total timeouts. Snippet-level entity extraction, assumptions, failure causes, signals, candidate language, similarities, falsification risk, and scores remain heuristic. Weak-signal acceleration is `null` when dates are insufficient and otherwise explicitly marked as an approximation.

## User surfaces

`/api/research` returns the full versioned record. `/api/mcp` exposes concise protocol-native tools, while `/api/mcp/health` reports tools, provider readiness, storage/protection mode, and sanitized recent calls. `/research-debug` exposes MCP status plus graph counts and raw JSON for every stage. The public page explains local and Claude-browser installation paths and labels its concrete walkthrough as fixture-backed. The Claude Skill prefers remote MCP, then the direct `NOVELTY_RESEARCH_API_URL` helper, and finally clearly labeled non-researched local ideation.
