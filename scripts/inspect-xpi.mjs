import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const root = process.cwd();
const xpiPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "dist", "git4zotero.xpi");

const xpiBytes = await fs.readFile(xpiPath);
const entries = listZipEntries(xpiBytes);
const entryNames = entries.map((entry) => entry.name).sort();
const backslashEntries = entryNames.filter((name) => name.includes("\\"));
if (backslashEntries.length) {
  throw new Error(`XPI entries must use POSIX separators. Found: ${backslashEntries.slice(0, 5).join(", ")}`);
}
const manifestText = readZipText(xpiBytes, "manifest.json");
const manifest = JSON.parse(manifestText.replace(/^\ufeff/, ""));
const rootEntries = [...new Set(entryNames.map((name) => name.split("/")[0]))].sort();
const runtimeEntry = "chrome/content/runtime/git4zotero-runtime.js";

console.log(`XPI: ${path.relative(root, xpiPath)}`);
console.log("Root entries:");
for (const entry of rootEntries) {
  console.log(`- ${entry}`);
}

console.log("\nManifest:");
console.log(`- name: ${manifest.name}`);
console.log(`- version: ${manifest.version}`);
console.log(`- applications.zotero.id: ${manifest.applications?.zotero?.id}`);
console.log(`- applications.zotero.update_url: ${manifest.applications?.zotero?.update_url}`);
console.log(`- strict_min_version: ${manifest.applications?.zotero?.strict_min_version}`);
console.log(`- strict_max_version: ${manifest.applications?.zotero?.strict_max_version}`);
console.log("- icons:");
for (const [size, iconPath] of Object.entries(manifest.icons ?? {})) {
  const status = entryNames.includes(iconPath) && hasPngSignature(xpiBytes, iconPath)
    ? "PNG ok"
    : "missing or not PNG";
  console.log(`  - ${size}: ${iconPath} (${status})`);
}
console.log(`- runtime: ${runtimeEntry} (${entryNames.includes(runtimeEntry) ? "present" : "missing"})`);
console.log(`- source modules: ${entryNames.filter((name) => name.startsWith("chrome/content/src/") && name.endsWith(".mjs")).length}`);
console.log("- entry paths: POSIX separators ok");

console.log("\nDiagnostics:");
console.log("- applications.zotero.update_url not provided means Zotero rejected the manifest before startup.");
console.log("- Invalid XPI / loadManifest usually points to archive structure or manifest metadata.");
console.log("- startup / loadSubScript / registerChrome usually points to bootstrap runtime loading.");
console.log("- Install dist/git4zotero.xpi, not older package files.");

function listZipEntries(zipBytes) {
  const bytes = zipBytes instanceof Uint8Array ? zipBytes : new Uint8Array(zipBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries = [];

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("XPI central directory is invalid.");
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = new TextDecoder("utf-8").decode(nameBytes);

    entries.push({
      compressedSize,
      localHeaderOffset,
      method,
      name,
      uncompressedSize
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipText(zipBytes, entryName) {
  return new TextDecoder("utf-8").decode(readZipBytes(zipBytes, entryName));
}

function readZipBytes(zipBytes, entryName) {
  const bytes = zipBytes instanceof Uint8Array ? zipBytes : new Uint8Array(zipBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entry = listZipEntries(bytes).find((candidate) => candidate.name === entryName);
  if (!entry) {
    throw new Error(`XPI missing entry: ${entryName}`);
  }

  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error(`XPI local header is invalid for ${entryName}.`);
  }

  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) {
    return compressed;
  }
  if (entry.method === 8) {
    return inflateRawSync(compressed);
  }
  throw new Error(`Unsupported XPI compression method ${entry.method} for ${entryName}.`);
}

function hasPngSignature(zipBytes, entryName) {
  const data = readZipBytes(zipBytes, entryName);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((byte, index) => data[index] === byte);
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("XPI end of central directory was not found.");
}
