# Novelty Engine

Novelty Engine is a free, open-source Claude Skill that helps Claude produce more differentiated ideas instead of converging immediately on familiar categories. It maps and excludes the obvious answer cluster, transfers mechanisms from distant domains, generates at least 15 mechanism-level candidates internally, attacks similarity, mutates the strongest survivors, and returns only a small set of useful finalists.

This repository contains both the installable skill and its one-page Next.js distribution site. V1 has no database, authentication, paid API, analytics dependency, or required environment variables.

## Install the Claude Skill

### From the website ZIP

1. Download `novelty-engine.zip` from the website.
2. Unzip it. The archive contains `novelty-engine/SKILL.md` at its root.
3. In Claude, open **Settings → Capabilities → Skills**, choose **Upload skill**, and upload the ZIP or extracted folder as supported by your Claude surface.

### Claude Code

Copy the skill into the personal skills directory:

```bash
mkdir -p ~/.claude/skills
cp -R skill/novelty-engine ~/.claude/skills/
```

For a project-scoped installation, copy it to `.claude/skills/novelty-engine/` inside that project. Claude can activate it automatically for relevant ideation tasks, and Claude Code also exposes installed skills as slash commands.

## Example prompts

- **Startup:** “Generate startup ideas that make coordinating care for an aging parent less exhausting for siblings in different cities.”
- **Physical invention:** “Invent practical ways for renters in old buildings to stay cool during heat waves without central air.”
- **Software:** “Propose software tools that reduce too many internal meetings without transcribing or summarizing them.”
- **Consumer product:** “Create product ideas that reduce edible food waste in a two-person household.”
- **Science:** “Suggest testable, resource-conscious concepts for detecting microplastic accumulation in urban soil.”
- **Feature:** “Design differentiated features for a language-learning product used during a daily commute.”
- **Business model:** “Develop unusual but feasible business models that make small-appliance repair financially attractive again.”

Specific constraints improve the result. Include the user, available resources, hard limits, and what success looks like when you know them.

## Run the website locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run dev` first rebuilds `public/novelty-engine.zip`, so the download always reflects the checked-in skill.

## Quality checks and production build

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`npm run build` packages the skill before running the production Next.js build. `npm test` verifies the ZIP structure and required methodology, checks internal anchor/download targets, and validates the evaluation suite.

## Evaluation harness

The API-free harness in `evals/` compares ordinary model output with output produced while Novelty Engine is active. It covers startup ideas, physical inventions, software tools, consumer products, scientific concepts, product features, and business models.

```bash
npm run eval                       # validate the cases
npm run eval:init                  # create evals/results/local.json
# Capture and blind both responses, then enter 1–5 scores.
npm run eval:score -- evals/results/local.json
```

The rubric measures mechanism diversity, distance from common concepts, specificity, feasibility, useful novelty, and differentiation quality. The JSON format is intentionally model-agnostic so a future runner can populate the same records from local models or APIs without changing the scoring system.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Leave the detected framework as **Next.js**, build command as `npm run build`, and output settings at their defaults.
4. Do not add environment variables; V1 does not use any.
5. Deploy. The pre-build packaging step creates the downloadable ZIP in `public/` before Next.js builds the site.

The same project can be deployed from the repository root with the Vercel CLI (`vercel` followed by `vercel --prod`). No `vercel.json` is required.

The `githubUrl` constant near the top of `app/page.tsx` points to this public repository and powers the website’s GitHub links.

## Improve the skill

The product logic lives in `skill/novelty-engine/SKILL.md`. Keep the YAML `name` and activation `description` intact unless invocation behavior needs to change. When modifying the method:

1. Add a representative failure case to `evals/cases.json` rather than optimizing for one phrasing.
2. Preserve mechanism-level diversity, calibrated novelty claims, and the instruction not to reveal private reasoning.
3. Run a blinded baseline/engine evaluation with the same model settings.
4. Run `npm run package:skill` and `npm test` so the published ZIP contains the revised skill.

## License

MIT — free and open source.
