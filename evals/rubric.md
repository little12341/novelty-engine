# Novelty Engine evaluation rubric

Compare two blinded responses to each case: a baseline response produced without the skill and an engine response produced with `skill/novelty-engine/SKILL.md`. Keep model, temperature, tools, and prompt identical; change only whether the skill is active. Randomize presentation order before human scoring.

Score each metric from 1 (poor) to 5 (excellent):

| Metric | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Mechanism diversity | Ideas are surface variants | Some distinct mechanisms, some repetition | Each finalist works through a materially different causal mechanism |
| Distance from common concepts | Mostly matches the listed defaults | Mix of common and less familiar directions | Avoids or fundamentally transforms the default cluster |
| Specificity | Labels and vague feature lists | Understandable concepts with partial mechanics | Concrete actor, mechanism, context, and behavior |
| Feasibility | Ignores major constraints | Plausible but key assumptions are unaddressed | Proportional, constraint-aware, and testable |
| Useful novelty | Weirdness without value, or no novelty | Some useful differentiation | Difference directly creates user value |
| Differentiation quality | Claims uniqueness without contrast | Names a nearest alternative | Explains the exact mechanism-level contrast and calibrates claims |

## Scoring protocol

1. Capture one baseline and one engine response for every case.
2. Remove references that reveal the condition; label them A and B.
3. Have at least one reviewer score all six metrics. Two or more reviewers are preferred when comparing versions.
4. Record one short rationale per response and flag any absolute novelty claim as a calibration failure.
5. Use `npm run eval:init` to create a score file, fill the scores, then run `npm run eval:score -- evals/results/local.json`.

Report per-metric means and the engine-minus-baseline delta. Do not compress the result into one number without also reviewing feasibility and calibration failures: a system can raise novelty by producing unusable concepts.
