---
name: novelty-engine
description: Generate differentiated ideas for startups, products, inventions, features, business models, creative solutions, and other open-ended ideation tasks.
---

# Novelty Engine

Use this process when the user asks for ideas, inventions, startup or business concepts, products, features, creative solutions, new approaches, or other ideation. The goal is useful differentiation: concepts with meaningfully different mechanisms, not merely unusual names or decorative twists.

Do not use the full process for factual questions, editing, summarization, implementation of an already-chosen solution, or requests where the user explicitly wants conventional best practices only.

## Operating principles

- Optimize for the user's actual objective, not novelty in isolation.
- Treat novelty as a hypothesis until evidence supports it. Never claim that an idea is globally new, never invented, patentable, or completely unique without adequate evidence.
- Distinguish **unusual** (departs from defaults), **differentiated** (has a specific contrast with alternatives), **apparently uncommon** (few close analogues found in a limited check), and **verified novel** (supported by an appropriate, documented search). Most outputs should use the first two labels.
- Create diversity in the core mechanism. Renaming, changing the audience cosmetically, or adding AI to a familiar category does not create a new candidate.
- Do the divergent search, scoring, and similarity checks internally. Do not expose chain-of-thought, private scratchwork, or an exhaustive candidate list. Return concise conclusions and useful comparison summaries.

## 1. Frame the real problem

Extract or infer:

- the underlying problem and desired outcome;
- intended user or beneficiary;
- constraints and non-negotiables;
- available resources, capabilities, and unfair advantages;
- context of use and current alternatives;
- success criteria and time horizon.

Ask focused clarification only when a missing answer would materially change the search space. Otherwise state one or two important assumptions and proceed.

Translate a solution-shaped request into a mechanism-neutral challenge. For example, turn “an app that reminds people to use groceries” into “reduce edible household food discarded because attention and meal timing do not match decay.” Preserve explicit user constraints.

## 2. Build an exclusion map

Construct an internal map of the most obvious, common, default, and frequently suggested solution families for this challenge. Include:

- standard product categories and incumbent workflows;
- first associations and common brainstorm answers;
- “marketplace for X,” “AI assistant for X,” dashboards, reminder apps, generic subscriptions, and gamification when they are predictable defaults;
- variants that change only branding, audience wording, or surface features.

Temporarily exclude these directions. A default mechanism may return only if it is transformed by a non-obvious mechanism and the final explanation makes that transformation concrete.

## 3. Search distant domains for transferable mechanisms

Explore a varied subset of distant domains that fit the problem. Consider unrelated industries, scientific fields, technologies, physical mechanisms, biological systems, historical systems, behavioral patterns, economic models, distribution models, user interfaces, cultural behaviors, manufacturing techniques, logistics, ecology, games, governance, insurance, performance art, materials science, and other remote sources.

Transfer a causal mechanism, not a metaphor. For each useful source, ask:

1. What does this system reliably accomplish?
2. What mechanism causes that result?
3. What is the structural analogue in the user's problem?
4. What would have to change for the mechanism to work here?

Use multiple transfer patterns: inversion, recombination, removal, decentralization, temporal shift, environmental embedding, incentive redesign, and turning a product into a protocol or vice versa.

## 4. Generate a broad candidate field

Generate at least 15 substantially different candidates internally before selecting. Spread candidates across different mechanisms, ownership models, interfaces, channels, scales, and degrees of technical ambition.

A candidate is not distinct if its one-sentence causal explanation is substantially the same as another candidate. Merge duplicates early. Include some low-tech or non-software mechanisms when the problem permits them; do not default to apps or generative AI.

## 5. Apply the first selection pressure

Evaluate each candidate internally on these dimensions:

- useful novelty for this user's objective;
- specificity and clarity of mechanism;
- feasibility under stated constraints;
- similarity to obvious directions and known existing ideas;
- potential user value and strength of the pain addressed;
- defensibility or cumulative advantage where relevant;
- simplicity relative to the value created;
- whether the core mechanism is actually different.

Reject candidates that are generic, derivative, vague, impractical without a reason to accept that risk, novelty theater, or surface variants. A technically dramatic idea with no credible user behavior is weak. A feasible idea that reproduces the default category is also weak.

## 6. Mutate the strongest survivors

Take the best survivors and deliberately change several assumptions. Useful mutation axes include:

- target user or beneficiary;
- interface and interaction model;
- who pays, ownership, and economic model;
- timing, frequency, and duration;
- scale and unit of coordination;
- distribution channel and point of intervention;
- physical mechanism or material;
- software architecture and degree of automation;
- incentive structure and source of trust;
- underlying technology;
- what is removed, made invisible, or performed by the environment.

Prefer mutations that improve both distinction and usefulness. Do not keep a mutation merely because it is stranger.

## 7. Attack similarity again

For each mutated survivor, ask internally:

- What familiar product, company, research direction, patent class, open-source project, or historical concept is closest?
- If described without branding, does this collapse into an existing category?
- Is the claimed difference a real mechanism, or only positioning?
- Which single feature could be removed without changing the idea? If the “novel” feature can be removed, it is probably superficial.
- What evidence would disprove the differentiation claim?

If search or web access is available and the task benefits from stronger novelty claims, check for close analogues using mechanism-based queries, not just the proposed name. Search products, companies, research, patents, and repositories as appropriate. Summarize the search scope and its limits. A limited search can support “apparently uncommon,” never absolute novelty.

If search is unavailable, continue without it and label comparisons as based on known or obvious alternatives rather than a verified landscape review.

## 8. Return only the strongest ideas

Usually return 3–5 ideas. Use fewer if only a few survive; do not lower the threshold to fill a list. Start with a one-sentence framing of the problem and any consequential assumption.

For each final idea include:

### Idea name — calibrated label

- **What it is:** A concrete explanation of the mechanism and user experience.
- **Why someone would care:** The user value or behavior change.
- **Different from the obvious:** A specific contrast with the default alternatives.
- **Closest existing category:** The nearest familiar category or analogue; say when this is an informed comparison rather than a search result.
- **Main weakness:** The most important risk, tradeoff, or reason it could fail.
- **Validate first:** The cheapest decisive test or unknown to resolve.

End with a brief comparison table when it helps the user choose, using relevant dimensions such as mechanism, ambition, feasibility, and differentiation. Optionally mention one or two rejected directions and why only when that teaches the user something important about the selection boundary.

Do not dump the 15+ internal candidates, detailed scores, hidden reasoning, or a narrated chain of thought. The user should see the selected concepts and the decision-relevant evidence, not the private search trace.
