import { readFile, readdir, stat } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

const zipPath = path.join(process.cwd(), "public", "novelty-engine.zip");
const archive = await readFile(zipPath);
const details = await stat(zipPath);
if (details.size < 200) throw new Error("Skill ZIP is unexpectedly small");

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const endOffset = archive.lastIndexOf(endSignature);
if (endOffset < 0) throw new Error("ZIP end-of-central-directory record missing");
const count = archive.readUInt16LE(endOffset + 10);
const centralOffset = archive.readUInt32LE(endOffset + 16);

let cursor = centralOffset;
const names = [];
const extracted = new Map();
for (let index = 0; index < count; index += 1) {
  if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
  const compressedSize = archive.readUInt32LE(cursor + 20);
  const uncompressedSize = archive.readUInt32LE(cursor + 24);
  const expectedCrc = archive.readUInt32LE(cursor + 16);
  const compression = archive.readUInt16LE(cursor + 10);
  const nameLength = archive.readUInt16LE(cursor + 28);
  const extraLength = archive.readUInt16LE(cursor + 30);
  const commentLength = archive.readUInt16LE(cursor + 32);
  const localOffset = archive.readUInt32LE(cursor + 42);
  const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
  if (!name.startsWith("novelty-engine/") || name.includes("..") || name.includes("\\") || name.startsWith("/")) throw new Error(`Unsafe ZIP entry path: ${name}`);
  if (/(?:^|\/)\.(?:env|git)(?:\.|\/|$)|(?:^|\/)(?:runs?|watchlists?|cache|node_modules)(?:\/|$)/i.test(name)) throw new Error(`Local, secret-bearing, or unnecessary ZIP entry: ${name}`);
  names.push(name);

  const localNameLength = archive.readUInt16LE(localOffset + 26);
  const localExtraLength = archive.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const compressed = archive.subarray(dataStart, dataStart + compressedSize);
  const data = compression === 8 ? inflateRawSync(compressed) : compression === 0 ? compressed : null;
  if (!data) throw new Error(`Unsupported ZIP compression method ${compression} for ${name}`);
  if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) throw new Error(`ZIP integrity check failed for ${name}`);
  extracted.set(name, data);
  if (/\.(?:md|mjs|js|json|txt|yaml|yml)$/i.test(name)) {
    const text = data.toString("utf8");
    if (/(?:sk-ant-|tvly-[A-Za-z0-9_-]{12,}|BSA[A-Za-z0-9_-]{20,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/.test(text)) throw new Error(`Possible secret material in packaged file: ${name}`);
  }

  if (name === "novelty-engine/SKILL.md") {
    const text = data.toString("utf8");
    const requiredMethodology = [
      "name: novelty-engine",
      "Map existing solution categories before ideating",
      "Search deliberately for unmet demand and structural gaps",
      "at least 15 substantially different candidates",
      "market-gap strength",
      "Replenish rejected candidates",
      "Research-first operating mode",
      "Remote MCP (preferred)",
      "research_from_sources",
      "get_research_requirements",
      "add_sources_to_run",
      "providerCalls: 0",
      "NOVELTY_RESEARCH_SOURCES_FILE",
      "NOVELTY_ALLOW_HOSTED_SEARCH",
      "research_market",
      "falsify_opportunity",
      "list_research_runs",
      "search_research_runs",
      "get_research_budget_info",
      "compare_run_candidates",
      "slash-like strings as Novelty intents",
      "Novelty:source_check",
      "/commands",
      "/help",
      "does not register these in Claude's native slash-command UI",
      "Unknown Novelty command",
      "NOVELTY_RESEARCH_API_URL",
      "https://novelty-engine.com/api/mcp",
      "https://novelty-engine.com/api/mcp/health",
      "https://novelty-engine.com/api/research",
      "**Exact market gap:**",
      "**evidence-backed market gap**",
      "ideationContext.finalOutput",
      "VERIFIED",
      "insufficient_evidence",
      "Rejected Ideas + Why",
      "Decisive Risks",
      "**Evidence lineage:**",
      "**Falsification survived:**",
      "24–72",
      "Do not expose chain-of-thought"
    ];
    if (requiredMethodology.some((phrase) => !text.includes(phrase))) {
      throw new Error("Packaged SKILL.md is missing required methodology");
    }
    for (const command of ["/research-market", "/find-gaps", "/inspect-competitors", "/falsify", "/validate-idea", "/research-company", "/find-business", "/compare", "/market-size", "/pricing", "/customer-pain", "/trend-check", "/source-check", "/evidence", "/summarize-run", "/rerun", "/export", "/commands", "/help"]) {
      if (!text.includes(`| \`${command}\` |`)) throw new Error(`Packaged SKILL.md command catalog is missing ${command}`);
    }
    if (text.includes("novelty-engine.vercel.app") || text.includes("https://www.novelty-engine.com")) throw new Error("Packaged SKILL.md contains a non-canonical production hostname");
  }
  if (name === "novelty-engine/references/mcp-interfaces.md") {
    const text = data.toString("utf8");
    for (const phrase of ["Supplied-source default and evidence loop", "research_from_sources", "get_research_requirements", "add_sources_to_run", "HOSTED_SEARCH_ENABLED", "Stored-run discovery", "Structured company research", "Budget visibility", "Candidate comparison inside one run", "User-safe `ideationContext`", "not vector or embedding search", "zero provider calls"]) {
      if (!text.includes(phrase)) throw new Error(`Packaged MCP reference is missing ${phrase}`);
    }
  }
  if (name === "novelty-engine/scripts/research.mjs") {
    const text = data.toString("utf8");
    if (!text.includes('"https://novelty-engine.com/api/research"')) throw new Error("Packaged helper does not default to the canonical research endpoint");
    if (!text.includes("NOVELTY_RESEARCH_SOURCES_FILE") || !text.includes("NOVELTY_ALLOW_HOSTED_SEARCH")) throw new Error("Packaged helper does not enforce supplied-source default and explicit hosted opt-in");
    if (text.includes("novelty-engine.vercel.app") || text.includes("https://www.novelty-engine.com")) throw new Error("Packaged helper contains a non-canonical production hostname");
  }
  cursor += 46 + nameLength + extraLength + commentLength;
}

if (!names.includes("novelty-engine/SKILL.md")) throw new Error("ZIP does not contain novelty-engine/SKILL.md");
if (!names.includes("novelty-engine/scripts/research.mjs")) throw new Error("ZIP does not contain the research backend helper");
if (!names.includes("novelty-engine/references/mcp-interfaces.md")) throw new Error("ZIP does not contain the MCP interface reference");
const skillRoot = path.join(process.cwd(), "skill", "novelty-engine");
const sourceFiles = await collect(skillRoot);
const expectedNames = sourceFiles.map((file) => `novelty-engine/${path.relative(skillRoot, file).replaceAll(path.sep, "/")}`);
if (names.slice().sort().join("\n") !== expectedNames.slice().sort().join("\n")) throw new Error("ZIP entries do not exactly match the current Skill source tree");
for (let index = 0; index < sourceFiles.length; index += 1) {
  const source = await readFile(sourceFiles[index]);
  const packaged = extracted.get(expectedNames[index]);
  if (!packaged?.equals(source)) throw new Error(`Packaged file is stale: ${expectedNames[index]}`);
}
console.log(`Verified installable ZIP: ${details.size} bytes; entries: ${names.join(", ")}`);
