# Novelty Engine 2.2 search-and-elimination architecture

## Design contract

V2 separates public evidence, deterministic inference, candidate invention, adversarial review, and presentation. A factual statement about a company, price, complaint, regulation, trend, or historical failure must resolve through `evidenceIds` to a normalized `Evidence` record. Missing evidence stays unknown. Candidate proposals may be creative, but they cannot silently become market facts.

Engine 2.2 is a backward-compatible extension of the V2.1 result schema. `schemaVersion` remains `2.1.0` so installed clients keep working; new runs declare `engineVersion: 2.2.0` and add lifecycle, evidence-gate, adversarial, task-graph, scorecard, founder-fit, expansion, and next-action records. Historical V2.1 records are conservatively normalized on read and are never retroactively labeled validated.

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
  ├─ derive 6 fast or 8 standard/deep landscape angles with synonyms and customer/workaround language
  ├─ SearchProvider.search (timeout + concurrency + categorized failures + bounded retry)
  ├─ provisional landscape/gap pass and specialist task graph
  ├─ if weak: branch into adjacent segments/workflows with prior kill reasons as negative memory
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
       ├─ fingerprint candidates and competitors; penalize lookalikes and test whether the residual gap is actually solved
       ├─ independently assemble Bull positive evidence and Bear counterevidence; Judge contradictions
       ├─ falsify each candidate across 11 risk dimensions
       ├─ mutate/retest only promising `mutate` outcomes, one constraint and once per root
       ├─ build concise evidence lineage
       ├─ persist DISCOVERED → RESEARCHING → CHALLENGED → FALSIFICATION → SURVIVED/VALIDATING or KILLED
       ├─ apply strict configurable validation evidence thresholds; external validation is separately required
       ├─ rank survivors with legacy factors, a 29-factor scorecard, Novelty Score, and Evidence Confidence
       ├─ create an assumption ledger, why-not-built analysis, counterfactual, and moat stress test
       ├─ create a measurable validation plan and one highest-information next action
       └─ return at most the requested count; record cutoff/rejected ideas and never pad
```

`pipeline.ts` owns request/search/cache orchestration, the active counterevidence search, research coverage, and the stop decision. `opportunity-pipeline.ts` composes the deterministic post-research stages. Individual engines do not perform network calls, persistence, or UI work.

## Specialist orchestration and independent adversaries

Every run records a resumable dependency graph for Scout, Competitor, Gap, Skeptic, Evidence, Pricing, Customer Pain, Market Sizing, Trend, Distribution, Regulatory, Technical Feasibility, Business Model, Bull, Bear, Judge, and Final Judge. These are typed stage boundaries over shared record IDs, not claims that persona labels create independent truth. Fast mode skips nonessential specialists; standard/deep modes record the full graph. Cancellation propagates through the HTTP/MCP request signal into provider calls.

Bull and Bear are the exception to the shared-input rule: Bull receives the positive/residual-demand subset, Bear receives counterevidence, decisive risks, and kill criteria, and each records a distinct input hash. Judge sees their outputs, source quality, contradictions, and unresolved assumptions. A research survivor can still receive `INVESTIGATE`; only fatal cited conditions produce `KILL`, and no Judge outcome alone creates external validation.

## Intent and legacy role orchestration

`/find-business`, `/research-market`, `/research-company`, `/find-competitors`, `/find-gaps`, `/falsify`, and `/validate-idea` map to the same `runResearch` path; `/compare-ideas` invokes 2–5 bounded runs behind one shared comparison cap. The role records are deterministic orchestration boundaries, not independent free-form agents: Source Verification normalizes once, then Market Mapping, Competitor Analysis, Complaint/Workaround Mining, Structural Gap Detection, Company Analysis, Adversarial Falsification, and Opportunity Synthesis exchange record IDs over the shared evidence set. Only Adversarial Falsification may request bounded extra search. No role receives repository, deployment, user-data mutation, secret, or arbitrary tool permissions.

Every run records enforced checkpoints for source validation/deduplication, competitor/substitute coverage, residual-gap assessment, candidate mechanism deduplication, falsification, citation validation, and final persistence. A survivor cannot pass the final gate without resolvable evidence lineage and a `survived` falsification outcome.

## MCP boundary

`app/api/mcp/route.ts` mounts one endpoint and registers the deliberate tool catalog through `lib/mcp/tools.ts`:

- `research_market({ query })` invokes the complete existing pipeline and returns the consistent `Research Landscape → Signals → Structural Gaps → Candidate Ideas → Rejected Ideas + Why → Survivors → Evidence Lineage → Decisive Risks → 24–72 Hour Validation Tests` summary plus run ID.
- `find_market_gaps({ run_id, limit? })` selects ranked gaps and resolves support/counterevidence to source URLs.
- `inspect_competitors({ run_id, limit? })` returns the evidence-carrying competitor map and a list of unsupported fields.
- `falsify_opportunity({ opportunity, run_id?, candidate_id? })` makes at most four focused counterevidence searches, then reuses the existing falsification engine.
- `get_research_run({ run_id, include_full? })` returns a concise summary or the preserved full record when explicitly requested.
- `run_research_mode({ mode, query })` exposes the supported intent modes without duplicating the pipeline.
- `compare_ideas({ ideas })` compares 2–5 ideas qualitatively under a shared call budget.
- `export_research_run({ run_id, format })` emits JSON, Markdown, print-ready data, CSV/matrices, validation plans, briefs, memos, or bibliographies.
- `compare_research_runs({ baseline_run_id, comparison_run_id })` reports material snapshot deltas.
- `rerun_research({ run_id, depth? })` bypasses the cache and returns both a fresh run and material evolution.
- `source_check({ run_id })` audits citation coverage, duplicates, source quality, contradictions, and unsupported claims.
- `next_best_action({ run_id })` returns the single ranked validation/search step.

Gap and competitor tools paginate with stable numeric offsets. Cost-bearing tool cancellation uses the MCP request abort signal. Tool contract `2.2.0` retains every V2.1 tool name and input field. The stateless transport continues to rely on persisted run IDs rather than inventing server-local session state.

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

The trust layer also records source family, provenance/control, commercial-bias risk, whether content is a factual observation, company claim, mixed record, or user experience, and prompt-injection screening results. Retrieved text is always untrusted data. Instruction overrides, secret requests, tool instructions, system-style directives, and repository/data mutations are removed before analysis while ordinary complaint facts remain. Provider keys and internal prompts never enter provider queries or evidence output.

Every completed run embeds an immutable `EvidenceSnapshot` containing normalized claims, retrieval timestamps, source assessments, claim statuses, syndication warnings, and missing-family warnings. Later comparisons use the two stored snapshots rather than reinterpreting an old run against today's web.

## Opportunity Graph

Supported node types include competitors, products, customer segments, complaints, workarounds, jobs-to-be-done, technologies, regulations, pricing models, distribution channels, failed attempts, behaviors, and gaps. A run contains only types supported or inferred by its retrieved evidence; the schema does not manufacture placeholder nodes.

Supported relationships include `serves`, `complains-about`, `depends-on`, `replaces`, `integrates-with`, `blocked-by`, `priced-for`, `workaround-for`, `enabled-by`, `failed-because`, `similar-to`, and `underserved-by`. The current deterministic constructor emits the relationships it can support from snippet-level extraction. Graph-hole analysis looks for complaint-heavy/solution-light segments, repeated complaint/workaround pairs, unconnected enabling technologies, and regulatory shifts. Missing combinations are hypotheses, never absence-based proof of demand.

## Invention and survivor loops

Candidate generation combines gaps, graph holes, contradictions, stitching patterns, weak signals, and changed historical blockers. Each record stores source IDs for every upstream family. Constraint mutations change one core dimension and record `before`, `after`, effect, parent, result, and iteration.

Fingerprints compare target customer, job, mechanism, interface, technology, business model, distribution, data source, ownership, workflow position, and differentiator. Similarity is a declared heuristic: 55% token Jaccard overlap plus 45% matching-dimension share. It is useful for duplicate rejection, not a patent or uniqueness search.

Falsification tests demand, competition/incumbent response, economics, distribution, technical feasibility, regulation, behavior, trust, liability, switching cost, and defensibility. The main run spends available search budget on explicit competitor/demand and structural-constraint counterqueries after a provisional gap pass. Each candidate with competitors also receives a structured residual-unmet-demand assessment across repeated unresolved complaints, workaround prevalence, switching behavior, underserved segments, price/performance gaps, trust failures, distribution gaps, and mechanism-level outcome change. Competitor existence validates a possible job rather than vetoing it: similarity lowers differentiation and defensibility when appropriate, while competition becomes decisive only when close substitutes adequately solve the same job for the same user and no meaningful residual gap remains. Each dimension records evidence for and against, a `VERIFIED`/`INFERRED`/`UNKNOWN` status, written rationale, and whether it is decisive. Missing evidence never clears risk. Only a candidate with an evidence-backed core and `mutate` outcome can receive one tightly bounded one-dimension mutation; a failed mutation is terminal.

## Scoring and confidence

The Opportunity Score retains 13 granular factors for compatibility and adds nine decision assessments: evidence strength, demand signal, novelty/differentiation, feasibility, economics, distribution, defensibility, regulatory risk, and confidence. Every assessment contains a numeric heuristic, claim status, written rationale, and evidence IDs. Regulatory risk is explicitly a risk scale where higher is worse. Named penalties cover missing evidence, near-duplicates, and failed falsification. No aggregate or factor score is a probability or replacement for written reasoning. Confidence is `evidence-backed`, `plausible`, or `speculative` based on provenance and upstream gap support.

Engine 2.2 adds three separate families rather than hiding them in that aggregate:

- `EvidenceConfidenceScore` uses independent provenance, diversity, citation coverage, freshness, quality, and contradiction penalties.
- `NoveltyScore` compares feature/mechanism, positioning/job, customer, workflow/interface, technology, and business-model overlap; missing competitors receive zero novelty credit.
- `StructuredOpportunityScorecard` exposes 29 requested decision dimensions. Risk dimensions explicitly say when higher is worse. `DecisionIntelligenceScores` adds Evidence Density, Consensus vs Contrarian, Opportunity Half-Life, Demand Authenticity, Pain-to-Spend Ratio, Fragmentation, Incumbent Vulnerability, Switching Friction, Timing, Regulatory Tailwind, Manual Labor Replacement, Distribution Viability, and AI Commoditization with definitions.

## Validation gate and lifecycle

Falsification survival is not validation. The configurable strict gate defaults to 3 independent pain signals, 2 independent spend signals, 3 analyzed competitors where applicable, 1 underserved segment, 1 timing signal, 3 source types, 85% citation coverage, and no unresolved fatal falsification. A candidate may be `survived` while those validation blockers remain. It becomes `validated` only when the strict gate passes **and** an external experiment result is recorded; current research runs do not fabricate that event.

Every candidate, including deduplicated, founder-mismatched, mutation-failed, and cutoff candidates, receives an immutable lifecycle with the exact kill phase/reason. Provisional kill reasons are sanitized as data and fed into adjacent branch queries so the next search avoids repeating failed mechanisms.

## Cost, timeout, cache, and storage controls

Hard caps are enforced in `researchLimits()` even if environment values are larger:

- 12 search angles/provider calls, normally 6–8 landscape, up to 2–4 adjacent branches/counterevidence angles within the same shared cap (failed retry attempts consume the provider-call cap);
- 10 results per query and 80 normalized sources;
- 48 total candidates;
- 1 survivor-mutation round, with at most one changed constraint per root;
- 30-second provider-call timeout;
- bounded request length, API body size, concurrency, and per-IP request rate.

MCP adds a 16 KiB protocol-body cap, a configurable per-IP/client hourly call limit, global daily/monthly research-call budgets, maximum concurrent research runs, and a four-query hard cap for focused falsification. The direct `/api/research` route shares the same global budgets and semaphore, so it cannot bypass public cost controls.

Exact cache keys hash provider plus canonical query. Similar warm-process queries can reuse results at a token-set threshold of 0.88. Local runs persist immutable and cache JSON files. When Upstash Redis REST credentials are present, exact cache entries, full run-ID records, request counters, global budgets, and the concurrency semaphore are distributed and TTL-bound. Without Redis, local files preserve runs locally while counters remain memory-only; Vercel falls back to warm-instance memory and reports that limitation through health/debug output.

Run history uses a separate long retention from the short query cache. Opt-in memory, feedback, watch configurations, and change reports extend the same local-file/Upstash boundary under typed namespaces; no new database vendor is required. User identifiers are one-way hashed. Memory accepts only bounded research preferences/constraints and never overrides a current-run field. Feedback is stored as `USER_PROVIDED_CONTEXT_NOT_PUBLIC_EVIDENCE`. Watchlists are persisted configurations plus explicit re-check operations—there is no background loop.

Every export preserves the survivor/validation distinction and evidence lineage. Print HTML escapes retrieved strings; CSV fields are quoted; bibliography and source-audit output retains provenance and duplicate warnings.

## Live and fixture-backed capabilities

Live source gathering requires `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY`. No credentials means a clear HTTP 503; fixtures are never selected in production. Once sources exist, all downstream stages execute locally.

Fixture-backed tests establish deterministic behavior and schema/provenance invariants, not real market truth. Regressions cover a crowded consumer category, B2B workflow, regulated market, software/tooling market, insufficient-evidence case, partial provider failures, malformed payloads, and total timeouts. Snippet-level entity extraction, assumptions, failure causes, signals, candidate language, similarities, falsification risk, and scores remain heuristic. Weak-signal acceleration is `null` when dates are insufficient and otherwise explicitly marked as an approximation.

## User surfaces

`GET /api/research/openapi` documents the HTTP surface. Export formats are JSON, Markdown, print HTML, opportunity CSV, competitor-matrix CSV, validation plan, opportunity brief, investor-style memo, and source bibliography. `GET /api/research/history?query=...` searches saved run summaries using the same transparent canonical token similarity used for warm-cache deduplication.

## Optional financial-signal boundary

`lib/financial-signals/` is deliberately separate from market-gap research. A signal must contain public evidence IDs and `observedAt ≤ persistedAt < expiresAt` before price outcomes are evaluated. The backtester measures 1/5/30-day returns, excess return versus a supplied benchmark, hit rate, false-positive rate, drawdown, calibration error, and sample size. Insufficient samples remain insufficient; strategies with adequate samples but hit rate below 52% or nonpositive excess return are killed. There is no price prediction claim, live SEC/news/price ingestion, or investment advice. Production ingestion and scheduling remain deployment integrations.

`/api/research` returns the full versioned record. `/api/mcp` exposes concise protocol-native tools, while `/api/mcp/health` reports tools, provider readiness, storage/protection mode, and sanitized recent calls. `/research-debug` exposes MCP status plus graph counts and raw JSON for every stage. The public page explains local and Claude-browser installation paths and labels its concrete walkthrough as fixture-backed. The Claude Skill prefers remote MCP, then the direct `NOVELTY_RESEARCH_API_URL` helper, and finally clearly labeled non-researched local ideation.
