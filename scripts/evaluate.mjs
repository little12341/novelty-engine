import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const casesPath = path.join(process.cwd(), "evals", "cases.json");
const { cases, version } = JSON.parse(await readFile(casesPath, "utf8"));
const metrics = ["diversity", "commonConceptDistance", "specificity", "feasibility", "usefulNovelty", "differentiation"];
const args = process.argv.slice(2);

if (args[0] === "--init") {
  const target = args[1];
  if (!target) throw new Error("Usage: node scripts/evaluate.mjs --init <output.json>");
  const template = {
    version,
    createdAt: new Date().toISOString(),
    notes: "Keep model, settings, tools, and prompts identical between conditions.",
    results: cases.flatMap(({ id }) => ["baseline", "engine"].map((condition) => ({
      caseId: id,
      condition,
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
  const expected = cases.length * 2;
  if (!Array.isArray(data.results) || data.results.length !== expected) throw new Error(`Expected ${expected} scored responses`);
  const means = {};
  for (const condition of ["baseline", "engine"]) {
    const rows = data.results.filter((row) => row.condition === condition);
    means[condition] = {};
    for (const metric of metrics) {
      const values = rows.map((row) => row.scores?.[metric]);
      if (values.some((value) => !Number.isFinite(value) || value < 1 || value > 5)) throw new Error(`${condition}.${metric} requires scores from 1 to 5`);
      means[condition][metric] = values.reduce((sum, value) => sum + value, 0) / values.length;
    }
  }
  console.log("Metric                    Baseline  Engine  Delta");
  for (const metric of metrics) {
    const baseline = means.baseline[metric];
    const engine = means.engine[metric];
    console.log(`${metric.padEnd(25)} ${baseline.toFixed(2).padStart(7)}  ${engine.toFixed(2).padStart(6)}  ${(engine - baseline).toFixed(2).padStart(5)}`);
  }
  const failures = data.results.filter((row) => row.calibrationFailure).length;
  console.log(`\nCalibration failures: ${failures}`);
  process.exit(0);
}

if (!Array.isArray(cases) || cases.length < 6) throw new Error("Evaluation suite needs representative cases");
for (const testCase of cases) {
  if (!testCase.id || !testCase.prompt || !Array.isArray(testCase.commonDirections)) throw new Error(`Invalid evaluation case: ${testCase.id ?? "unknown"}`);
}
console.log(`Validated evaluation suite v${version}: ${cases.length} cases across ${new Set(cases.map((item) => item.category)).size} categories.`);
console.log("Run `npm run eval:init` to create a scoring sheet; see evals/rubric.md for the blinded comparison protocol.");
