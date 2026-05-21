import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import {
  buildRuntimeScript,
  runtimeEntry,
  runtimeModuleOrder
} from "./runtime-builder.mjs";

const root = process.cwd();
const distDir = path.join(root, "dist");
const packageRootDir = path.join(distDir, ".package");
const manifestPath = path.join(root, "manifest.json");
const manifestText = await fs.readFile(manifestPath, "utf8");

if (manifestText.charCodeAt(0) === 0xfeff) {
  throw new Error("Source manifest.json must not start with a UTF-8 BOM.");
}

const manifest = JSON.parse(manifestText);
const packageName = `git4zotero-${manifest.version}.xpi`;
const packageStamp = Date.now();
const outputPath = path.join(distDir, packageName);
const zipPath = path.join(packageRootDir, `git4zotero-${manifest.version}-${packageStamp}.zip`);
const stagingDir = path.join(packageRootDir, `git4zotero-${manifest.version}-${packageStamp}`);
const packageRoots = [
  "manifest.json",
  "bootstrap.js",
  "prefs.js",
  "README.md",
  "locale",
  "chrome"
];
let crcTable = null;

assert.equal(manifest.manifest_version, 2);
assert.equal(manifest.version, "0.1.30");
assert.equal(manifest.author, "Li Ka-shing");
assert.equal(manifest.applications.zotero.id, "git4zotero@paper-version.local");
assert.equal(manifest.applications.zotero.update_url, "https://github.com/LiKa-shing/git4zotero/releases/latest/download/updates.json");
assert.match(manifest.applications.zotero.update_url, /^https:\/\//);
assert.equal(manifest.applications.zotero.strict_min_version, "8.0");
assert.equal(manifest.applications.zotero.strict_max_version, "9.0.*");
assert(!("browser_specific_settings" in manifest), "Zotero manifest should rely on applications.zotero metadata");

await fs.mkdir(stagingDir, { recursive: true });
await copyPackageRootsToStaging();
const runtimeText = await buildRuntimeScript(root);
new Function(runtimeText);
await writeRuntimeToStaging(runtimeText);
await writeZipFromDirectory(stagingDir, zipPath);
await fs.copyFile(zipPath, outputPath);

const xpiBytes = await fs.readFile(outputPath);
const entries = listZipEntries(xpiBytes);
const entryNames = entries.map((entry) => entry.name).sort();
const requiredEntries = [
  "manifest.json",
  "bootstrap.js",
  "prefs.js",
  "README.md",
  "chrome/content/preferences.xhtml",
  "chrome/content/preferences.mjs",
  "chrome/content/preferences.css",
  "locale/zh-CN/git4zotero.ftl",
  "chrome/content/icons/paper-version-16.png",
  "chrome/content/icons/paper-version-20.png",
  "chrome/content/icons/paper-version-48.png",
  "chrome/content/icons/paper-version-96.png",
  runtimeEntry,
  "chrome/content/src/main.mjs",
  "chrome/content/src/docx-reader.mjs",
  "chrome/content/src/vendor/zip-reader.mjs"
].concat(runtimeModuleOrder);

for (const entryName of entryNames) {
  if (entryName.includes("\\")) {
    throw new Error(`XPI entry must use POSIX separators, got: ${entryName}`);
  }
}

for (const required of requiredEntries) {
  if (!entryNames.includes(required)) {
    throw new Error(`XPI missing required entry: ${required}`);
  }
}

if (entryNames.filter((name) => name === "manifest.json").length !== 1) {
  throw new Error("XPI must contain exactly one manifest.json at the archive root.");
}

if (!entryNames.includes("bootstrap.js") || !entryNames.includes("prefs.js")) {
  throw new Error("XPI root must directly contain bootstrap.js and prefs.js.");
}

if (!entryNames.some((name) => name.startsWith("chrome/"))) {
  throw new Error("XPI root must directly contain chrome/.");
}

if (!entryNames.some((name) => name.startsWith("locale/"))) {
  throw new Error("XPI root must directly contain locale/.");
}

if (entryNames.some((name) => /^git4zotero(?:[-/])/.test(name))) {
  throw new Error("XPI root is wrapped in a project directory; manifest.json must be at the archive root.");
}

const packagedManifestText = readZipText(xpiBytes, "manifest.json");
if (packagedManifestText.charCodeAt(0) === 0xfeff) {
  throw new Error("Packaged manifest.json must not start with a UTF-8 BOM.");
}

const packagedManifest = JSON.parse(packagedManifestText);
assert.deepEqual(packagedManifest, manifest, "XPI manifest.json must match source manifest.json.");
assert.equal(packagedManifest.version, "0.1.30");
assert.equal(packagedManifest.author, "Li Ka-shing");
assert.equal(packagedManifest.applications.zotero.update_url, "https://github.com/LiKa-shing/git4zotero/releases/latest/download/updates.json");
assert.match(packagedManifest.applications.zotero.update_url, /^https:\/\//);
assert.equal(packagedManifest.applications.zotero.strict_min_version, "8.0");
assert.equal(packagedManifest.applications.zotero.strict_max_version, "9.0.*");
assert(!("browser_specific_settings" in packagedManifest));

for (const iconPath of Object.values(packagedManifest.icons)) {
  assertPngEntry(xpiBytes, iconPath);
}

new Function(readZipText(xpiBytes, runtimeEntry));

console.log(`Package complete: ${path.relative(root, outputPath)}`);
console.log(`Temporary ZIP: ${path.relative(root, zipPath)}`);
console.log(`Staging directory: ${path.relative(root, stagingDir)}`);
console.log(`Validated ${entryNames.length} archive entries.`);
console.log("XPI root structure, POSIX entry paths, manifest metadata, runtime script, source modules, and PNG icons are valid.");

async function copyPackageRootsToStaging() {
  for (const packageRoot of packageRoots) {
    const source = path.join(root, packageRoot);
    const target = path.join(stagingDir, packageRoot);
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, target, { recursive: true });
    }
    else {
      await fs.copyFile(source, target);
    }
  }
}

async function writeRuntimeToStaging(runtimeText) {
  const runtimePath = path.join(stagingDir, runtimeEntry);
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.writeFile(runtimePath, runtimeText, "utf8");
}

async function writeZipFromDirectory(sourceDir, destinationZipPath) {
  const files = await listFiles(sourceDir);
  if (!files.length) {
    throw new Error("Staging directory is empty.");
  }

  const localParts = [];
  const records = [];
  let offset = 0;

  for (const file of files) {
    const name = toPosix(path.relative(sourceDir, file));
    assertValidZipEntryName(name);

    const data = await fs.readFile(file);
    const compressed = deflateRawSync(data);
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);

    writeLocalHeader(localHeader, {
      crc,
      compressedSize: compressed.byteLength,
      nameLength: nameBytes.byteLength,
      uncompressedSize: data.byteLength
    });

    localParts.push(localHeader, nameBytes, compressed);
    records.push({
      compressedSize: compressed.byteLength,
      crc,
      localHeaderOffset: offset,
      name,
      nameBytes,
      uncompressedSize: data.byteLength
    });
    offset += localHeader.byteLength + nameBytes.byteLength + compressed.byteLength;
  }

  const centralOffset = offset;
  const centralParts = [];
  for (const record of records) {
    const centralHeader = Buffer.alloc(46);
    writeCentralHeader(centralHeader, record);
    centralParts.push(centralHeader, record.nameBytes);
    offset += centralHeader.byteLength + record.nameBytes.byteLength;
  }

  const centralSize = offset - centralOffset;
  const endHeader = Buffer.alloc(22);
  writeEndHeader(endHeader, {
    centralOffset,
    centralSize,
    count: records.length
  });

  await fs.writeFile(destinationZipPath, Buffer.concat([...localParts, ...centralParts, endHeader]));
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    }
    else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => toPosix(path.relative(dir, a)).localeCompare(toPosix(path.relative(dir, b))));
}

function writeLocalHeader(buffer, { crc, compressedSize, nameLength, uncompressedSize }) {
  assertZip32(compressedSize, "compressed size");
  assertZip32(uncompressedSize, "uncompressed size");
  assertZip16(nameLength, "file name length");

  buffer.writeUInt32LE(0x04034b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(0x0800, 6);
  buffer.writeUInt16LE(8, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt32LE(crc, 14);
  buffer.writeUInt32LE(compressedSize, 18);
  buffer.writeUInt32LE(uncompressedSize, 22);
  buffer.writeUInt16LE(nameLength, 26);
  buffer.writeUInt16LE(0, 28);
}

function writeCentralHeader(buffer, record) {
  assertZip32(record.compressedSize, "compressed size");
  assertZip32(record.uncompressedSize, "uncompressed size");
  assertZip32(record.localHeaderOffset, "local header offset");
  assertZip16(record.nameBytes.byteLength, "file name length");

  buffer.writeUInt32LE(0x02014b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(20, 6);
  buffer.writeUInt16LE(0x0800, 8);
  buffer.writeUInt16LE(8, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt16LE(0, 14);
  buffer.writeUInt32LE(record.crc, 16);
  buffer.writeUInt32LE(record.compressedSize, 20);
  buffer.writeUInt32LE(record.uncompressedSize, 24);
  buffer.writeUInt16LE(record.nameBytes.byteLength, 28);
  buffer.writeUInt16LE(0, 30);
  buffer.writeUInt16LE(0, 32);
  buffer.writeUInt16LE(0, 34);
  buffer.writeUInt16LE(0, 36);
  buffer.writeUInt32LE(0, 38);
  buffer.writeUInt32LE(record.localHeaderOffset, 42);
}

function writeEndHeader(buffer, { centralOffset, centralSize, count }) {
  assertZip16(count, "entry count");
  assertZip32(centralOffset, "central directory offset");
  assertZip32(centralSize, "central directory size");

  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt16LE(0, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeUInt16LE(count, 8);
  buffer.writeUInt16LE(count, 10);
  buffer.writeUInt32LE(centralSize, 12);
  buffer.writeUInt32LE(centralOffset, 16);
  buffer.writeUInt16LE(0, 20);
}

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
  let data;

  if (entry.method === 0) {
    data = compressed;
  }
  else if (entry.method === 8) {
    data = inflateRawSync(compressed);
  }
  else {
    throw new Error(`Unsupported XPI compression method ${entry.method} for ${entryName}.`);
  }

  assert.equal(data.byteLength, entry.uncompressedSize);
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function assertPngEntry(zipBytes, entryName) {
  const data = readZipBytes(zipBytes, entryName);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (data[index] !== signature[index]) {
      throw new Error(`Manifest icon is not a PNG file: ${entryName}`);
    }
  }
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

function crc32(buffer) {
  let crc = 0xffffffff;
  const table = getCrcTable();
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }

  crcTable = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

function assertValidZipEntryName(name) {
  if (!name || name.includes("\\") || path.isAbsolute(name) || name.split("/").includes("..")) {
    throw new Error(`Invalid XPI entry name: ${name}`);
  }
}

function assertZip16(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`ZIP ${label} exceeds 16-bit limit: ${value}`);
  }
}

function assertZip32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`ZIP ${label} exceeds 32-bit limit: ${value}`);
  }
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
