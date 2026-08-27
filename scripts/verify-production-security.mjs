#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sensitiveName = /(?:API_KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION|PRIVATE_KEY)$/i;
const obviousPlaceholder = /^(?:your(?:[_\s-]|$)|replace(?:[_\s-]?me)?$|change(?:[_\s-]?me)?$|placeholder$|example$|<[^>]+>$|x{6,}$)/i;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]];
  }));
}

const candidates = { ...process.env };
for (const name of [".env.local", ".env.production"]) {
  try { Object.assign(candidates, parseEnv(await readFile(path.join(root, name), "utf8"))); } catch {}
}
const secrets = Object.entries(candidates).filter(([name, value]) => sensitiveName.test(name)
  && typeof value === "string" && value.trim().length >= 8 && !obviousPlaceholder.test(value.trim()));

async function filesBelow(directory) {
  try { await access(directory); } catch { return []; }
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const clientRoots = [path.join(root, "public"), path.join(root, ".next", "static"), path.join(root, ".next", "server", "app")];
const files = (await Promise.all(clientRoots.map(filesBelow))).flat();
const publicMaps = files.filter((file) => file.endsWith(".map") && (file.includes(`${path.sep}public${path.sep}`) || file.includes(`${path.sep}.next${path.sep}static${path.sep}`)));
if (publicMaps.length) throw new Error(`Public source maps are enabled: ${publicMaps.map((file) => path.relative(root, file)).join(", ")}`);

const textFiles = files.filter((file) => /\.(?:js|mjs|cjs|json|html|txt|xml|css|svg|map)$/i.test(file));
for (const file of textFiles) {
  const contents = await readFile(file, "utf8");
  for (const [name, value] of secrets) {
    if (contents.includes(value)) throw new Error(`Sensitive value from ${name} appears in public output ${path.relative(root, file)}`);
  }
}

const nextConfig = await readFile(path.join(root, "next.config.ts"), "utf8");
if (!nextConfig.includes("productionBrowserSourceMaps: false")) throw new Error("next.config.ts must explicitly disable production browser source maps");
console.log(`Verified production public output: ${textFiles.length} text assets, ${secrets.length} configured sensitive values checked, no public source maps.`);
