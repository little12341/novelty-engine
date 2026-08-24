import { readFile, stat } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

const zipPath = path.join(process.cwd(), "public", "novelty-engine.zip");
const archive = await readFile(zipPath);
const details = await stat(zipPath);
if (details.size < 200) throw new Error("Skill ZIP is unexpectedly small");

const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const endOffset = archive.lastIndexOf(endSignature);
if (endOffset < 0) throw new Error("ZIP end-of-central-directory record missing");
const count = archive.readUInt16LE(endOffset + 10);
const centralOffset = archive.readUInt32LE(endOffset + 16);

let cursor = centralOffset;
const names = [];
for (let index = 0; index < count; index += 1) {
  if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
  const compressedSize = archive.readUInt32LE(cursor + 20);
  const nameLength = archive.readUInt16LE(cursor + 28);
  const extraLength = archive.readUInt16LE(cursor + 30);
  const commentLength = archive.readUInt16LE(cursor + 32);
  const localOffset = archive.readUInt32LE(cursor + 42);
  const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
  names.push(name);

  if (name === "novelty-engine/SKILL.md") {
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const text = inflateRawSync(archive.subarray(dataStart, dataStart + compressedSize)).toString("utf8");
    if (!text.includes("name: novelty-engine") || !text.includes("at least 15 substantially different candidates")) {
      throw new Error("Packaged SKILL.md is missing required methodology");
    }
  }
  cursor += 46 + nameLength + extraLength + commentLength;
}

if (!names.includes("novelty-engine/SKILL.md")) throw new Error("ZIP does not contain novelty-engine/SKILL.md");
console.log(`Verified installable ZIP: ${details.size} bytes; entries: ${names.join(", ")}`);
