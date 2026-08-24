import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const casesPath = path.join(process.cwd(), "evals", "cases.json");
const { cases, version, conditions, researchProtocol } = JSON.parse(await readFile(casesPath, "utf8"));
const metrics = [
  "specificity",
  "evidenceQuality",
  "marketGapStrength",
  "ideaDiversity",
  "mechanismNovelty",
  "competitorSimilarity",
  "sourceValidity",
  "falsificationQuality",
  "lineageClarity",
  "validationUsefulness",
  "requestedCountFidelity",
  "unsupportedClaimRate",
  "feasibility",
  "differentiation"
];
const args = process.argv.slice(2);

if (args[0] === "--init") {
  const target = args[1];
  if (!target) throw new Error("Usage: node scripts/evaluate.mjs --init <output.json>");
  const template = {
    version,
    createdAt: new Date().toISOString(),
    notes: "Keep model, settings, and prompts identical. Only the skill and structured research context vary by condition.",
    researchProtocol,
    results: cases.flatMap(({ id }) => conditions.map((condition) => ({
      caseId: id,
      condition,
      researchRunId: condition === "novelty_engine_evidence_v2" ? null : undefined,
      scores: Object.fromEntries(metrics.map((metric) => [metric, null])),
      calibrationFailure: false,
      rationale: ""
    })))
  };
  await mkdir(path.dirname(path.resolve(target)), { recursive: true });
  await writeFile(target, `${JSON.stringify(template, null, 2)}\n`);
  console.log(`Created blinded scoring sheet at ${target}`);
  process.exit(0);
}

if (args[0] === "--score") {
  const target = args[1];
  if (!target) throw new Error("Usage: npm run eval:score -- <results.json>");
  const data = JSON.parse(await readFile(path.resolve(target), "utf8"));
  const expected = cases.length * conditions.length;
  if (!Array.isArray(data.results) || data.results.length !== expected) throw new Error(`Expected ${expected} scored responses`);
  const means = {};
  for (const condition of conditions) {
    const rows = data.results.filter((row) => row.condition === condition);
    means[condition] = {};
    for (const metric of metrics) {
      const values = rows.map((row) => row.scores?.[metric]);
      if (values.some((value) => !Number.isFinite(value) || value < 1 || value > 5)) throw new Error(`${condition}.${metric} requires scores from 1 to 5`);
      means[condition][metric] = values.reduce((sum, value) => sum + value, 0) / values.length;
    }
  }
  console.log(`Metric                    ${conditions.map((item) => item.slice(0, 12).padStart(12)).join("  ")}`);
  for (const metric of metrics) {
    console.log(`${metric.padEnd(25)} ${conditions.map((condition) => means[condition][metric].toFixed(2).padStart(12)).join("  ")}`);
  }
  const failures = data.results.filter((row) => row.calibrationFailure).length;
  console.log(`\nCalibration failures: ${failures}`);
  process.exit(0);
}

if (!Array.isArray(cases) || cases.length < 6) throw new Error("Evaluation suite needs representative cases");
if (!Array.isArray(conditions) || conditions.join(",") !== "ordinary_model_ideation,novelty_engine_local_only,novelty_engine_evidence_v2") throw new Error("Evaluation suite must define ordinary model, local-only, and evidence-driven V2 modes");
for (const testCase of cases) {
  if (!testCase.id || !testCase.prompt || !Array.isArray(testCase.commonDirections)) throw new Error(`Invalid evaluation case: ${testCase.id ?? "unknown"}`);
}
if (!cases.some((item) => item.category === "market-gap discovery")) throw new Error("Evaluation suite needs a dedicated market-gap case");
if (!cases.some((item) => /preserve the requested count|Generate \d|Propose \d|Develop \d/i.test(item.prompt))) throw new Error("Evaluation suite needs requested-count coverage");
for (const required of ["marketGapStrength", "ideaDiversity", "mechanismNovelty", "competitorSimilarity", "sourceValidity", "falsificationQuality", "lineageClarity", "validationUsefulness", "requestedCountFidelity", "unsupportedClaimRate"]) {
  if (!metrics.includes(required)) throw new Error(`Evaluation metrics missing ${required}`);
}
console.log(`Validated evaluation suite v${version}: ${cases.length} cases across ${new Set(cases.map((item) => item.category)).size} categories.`);
console.log("Run `npm run eval:init` to create a scoring sheet; see evals/rubric.md for the blinded comparison protocol.");
