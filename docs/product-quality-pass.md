# Product-quality pass: executable flow and audit

## Request flow before this pass

1. `POST /api/research` or MCP `research_market` validated a 8–500 character query, applied public-cost protection, and called `runResearch`.
2. `runResearch` checked an exact/similar-query cache, derived ten static search angles, and ran them with concurrency three and per-call timeouts.
3. Results were normalized by URL and exact full-snippet hash. Most unknown websites defaulted to `official_company`; no explicit quality, recency, directness, independence, or repeated-claim record survived normalization.
4. Regex extractors produced competitors, complaint clusters, underserved segments, and gap scores. Complaint “independence” used `max(item count, host count)`, which made every retrieved item look independent.
5. The opportunity pipeline built the graph, graph holes, workflow stitching, weak signals, failed attempts, assumptions, and contradictions.
6. Candidate generation always produced at least 15 candidates. When no gap existed it used `gap_unknown`, creating unsupported hypotheses inside the serious pipeline.
7. Fingerprints removed some high-similarity candidates and competitors. Five generic mechanism templates repeated across candidates, and same-mechanism variations often survived.
8. Falsification assigned generic hypotheses across eleven dimensions, but eight dimensions commonly stayed unknown and missing evidence still allowed a high enough survival score. The main research run did not spend search calls on candidate-specific counterevidence.
9. Any non-survivor—not only a promising `mutate` outcome—could enter up to two mutation rounds. Mutations changed a constraint but did not record a terminal result.
10. Thirteen numeric factors ranked survivors. They had no written factor rationale matching the product decision dimensions.
11. The final record contained survivors and validation tests, while the concise MCP response omitted full lineage, rejected concepts, decisive risks, and a stop decision. The Claude Skill described a similar philosophy but also instructed replenishment toward the requested count.

## Material failure modes found

- Unsupported `gap_unknown` candidates could make evidence-free ideation look researched.
- “No competitor found” could improve whitespace/saturation heuristics without proving demand or adequate search.
- Exact duplicate-claim removal hid syndication/repetition instead of preserving the warning.
- Source-type defaults and host counting overstated source authority and independence.
- Static category-keyword queries missed customer wording, abandonment, substitutes, jobs, procurement, patents, and adjacent causal mechanisms.
- Main-run falsification was mostly a local rubric, not an active counterevidence search.
- Unknown critical economics/distribution/feasibility risks received too little selection pressure.
- Fully rejected roots could be repeatedly rescued and requested-count behavior encouraged filler.
- Numeric ranking was more visible than evidence status and written reasoning.
- Partial search failures produced a `partial` flag but no structured coverage assessment or explicit generation stop.
- The MCP and Skill presentation contracts differed enough that the same backend run could be rendered with materially different rigor.

## Request flow after this pass

1. The HTTP/MCP boundary validates, protects, and calls the same `runResearch` function. The Claude Code helper now rejects responses missing the V2.1 `coverage`, `stopDecision`, and `finalOutput` contract.
2. Cache lookup accepts only the current schema so old records cannot masquerade as V2.1 runs.
3. The engine derives bounded market-map queries using category language plus synonyms, first-person complaint phrases, workaround phrases, negative reviews, substitutes, failed attempts, research/regulation, open source, jobs, procurement, and adjacent mechanisms.
4. Provider results are schema-checked. Timeouts, rate limits, malformed payloads, upstream 5xx responses, and general failures receive explicit categories. Retryable failures get one retry inside the same hard call budget.
5. A provisional market pass extracts competitors, complaints, segments, and gaps, applies the evidence gate, and creates a deterministic candidate reserve. When budget remains, up to two adversarial queries cover every distinct surviving mechanism family and target close substitutes/demand failure plus economics/feasibility/trust/regulatory constraints. The final pipeline is then rerun with the counterevidence included.
6. Final normalization collapses duplicate URLs and high-overlap claims while retaining duplicate URLs and repetition risk. Each evidence record is weighted by source quality, directness, recency, and independent provenance group.
7. `assessCoverage` measures successful angles, source types, independent groups, duplicate claims, quality-weighted evidence, and competitor/user/technical/institutional/failed-attempt/commercial source-family coverage.
8. `decideStop` returns `proceed`, `partial_research`, or `insufficient_evidence`. No candidate can be generated unless at least one gap has repeated independent positive support and research coverage is not insufficient. Missing competitors remain a limitation.
9. The graph, stitching, signals, failures, assumptions, and contradictions remain deterministic and citation-bound.
10. Candidate generation uses only supported gaps. Each candidate records its mechanism family and a bounded cross-domain causal transfer with an explicit adaptation boundary that forbids surface copying.
11. Mechanism-family plus gap deduplication collapses renamed/cosmetic variants before competitor similarity checks.
12. Falsification evaluates eleven failure dimensions with evidence for, evidence against, claim status, written rationale, decisive-risk flag, and critical-unknown count. Candidate-focused search results are inputs, not proof.
13. Only evidence-backed `mutate` outcomes can change exactly one constraint once per root. The mutation records before/after, rationale, parent, and terminal result.
14. Final ranking retains granular factors and adds written assessments for evidence strength, demand signal, novelty/differentiation, feasibility, economics, distribution, defensibility, regulatory risk, and confidence.
15. Every survivor carries complete lineage and a concrete 24–72 hour test with target, action, success threshold, kill threshold, cost, time, decision, and ethics note.
16. HTTP full results, MCP summaries, and the Claude Skill share the same order: Research Landscape → Signals → Structural Gaps → Candidate Ideas → Rejected Ideas + Why → Survivors → Evidence Lineage → Decisive Risks → 24–72 Hour Validation Tests.

## Baseline comparison target

The deterministic pre-change field-service fixture returned 8 sources, 5 gaps, 15 candidates, no recorded rejections, and 4 survivors. Every survivor exposed 8 of 11 falsification dimensions as unknown, and three of the four final ideas reused the same `Event Bridge` mechanism family. This baseline is intentionally recorded here so post-change fixture output can be compared without claiming fixture data represents a real market.

## Deterministic post-change comparison

The same field-service fixture under V2.1 returns 8 normalized sources across 8 source types and 8 independence groups, with all 12 requested angles successful (10 landscape plus 2 active falsification) and an `adequate` coverage decision. It retains the same two plausible and three speculative gaps, but speculative gaps no longer seed candidates. The bounded reserve contains 15 candidates, collapses 8 repeated mechanism families, records 3 additional lower-ranked/cutoff candidates with reasons, and returns 4 distinct survivor mechanism families: exception management, portable trust record, outcome-based service, and interoperability protocol.

The falsification representation changes materially: the four survivors now expose 3 unknown dimensions rather than 8, only 1 is a critical unknown, and the output names the remaining decisive risks instead of treating silence as clearance. Lineage labels observed complaint/workaround/segment facts separately from inferred graph holes and contradictions. Every survivor includes nine decision-factor rationales and a 24–72 hour test. These numbers describe fixture behavior and contract coverage, not real-world market validation.

The final five-market end-to-end run returns three distinct survivor families in each adequately covered consumer, B2B, regulated, and software/tooling fixture, with twelve candidates recorded outside the survivor cutoff in each run. The separate smart-hydration case stops at `insufficient_evidence`, with zero candidates and zero survivors. The suite also contains a code path where adequately covered research can return no survivor if every candidate fails; that path emits an explicit no-filler warning.
