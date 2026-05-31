import { PLUGIN_NAME, UI_TEXT } from "./constants.mjs";
import { isSafeRepoRelativePath } from "./cleanup.mjs";
import { formatText } from "./localization.mjs";

const ARCHIVE_SCHEMA_VERSION = 1;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8");
const ARCHIVE_EOCD_SIGNATURE = 0x06054b50;
const ARCHIVE_CENTRAL_SIGNATURE = 0x02014b50;
const ARCHIVE_LOCAL_SIGNATURE = 0x04034b50;

export class RepositoryArchiveService {
  constructor({ platform, cleanupService = null, pluginVersion = "" }) {
    this.platform = platform;
    this.cleanupService = cleanupService;
    this.pluginVersion = pluginVersion;
  }

  async exportRepositoryArchive() {
    const dataDir = this.platform.getPluginDataDirectory();
    await this.cleanupService?.ensureIndex?.();
    const entries = await this.collectArchiveEntries(dataDir);
    entries.unshift({
      name: "export-manifest.json",
      bytes: encodeText(JSON.stringify({
        schemaVersion: ARCHIVE_SCHEMA_VERSION,
        plugin: PLUGIN_NAME,
        pluginVersion: this.pluginVersion || this.platform.getPluginVersion?.() || "",
        exportedAt: new Date().toISOString(),
        includesOriginalAttachments: false
      }, null, 2) + "\n")
    });

    const defaultFileName = `git4zotero-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    const path = await this.platform.saveBinaryFile({
      title: UI_TEXT.archiveExportTitle,
      defaultFileName,
      bytes: createStoredZip(entries)
    });
    return {
      path,
      fileName: defaultFileName,
      fileCount: entries.length,
      repositoryCount: countRepositories(entries.map((entry) => entry.name))
    };
  }

  async importRepositoryArchive() {
    const picked = await this.platform.openBinaryFile({ title: UI_TEXT.archiveImportTitle });
    if (!picked) {
      return null;
    }
    const dataDir = this.platform.getPluginDataDirectory();
    const entries = readStoredZip(picked.bytes);
    const repoGroups = groupRepositoryEntries(entries);
    if (!repoGroups.size) {
      throw new Error(UI_TEXT.archiveNoRepositories);
    }
    const imported = [];
    const skipped = [];
    const failed = [];

    for (const [repoRelativePath, repoEntries] of repoGroups) {
      const repoPath = this.platform.join(dataDir, ...repoRelativePath.split("/"));
      if (await this.safeExists(repoPath)) {
        skipped.push({ repoRelativePath, reason: UI_TEXT.archiveImportSkippedExisting });
        continue;
      }
      try {
        for (const entry of repoEntries) {
          const relativeParts = entry.name.split("/");
          const targetPath = this.platform.join(dataDir, ...relativeParts);
          await this.platform.writeBytes(targetPath, entry.bytes);
        }
        imported.push(repoRelativePath);
      }
      catch (error) {
        failed.push({ repoRelativePath, reason: error.message || String(error) });
      }
    }

    await this.cleanupService?.ensureIndex?.();
    return {
      path: picked.path,
      imported,
      skipped,
      failed
    };
  }

  async collectArchiveEntries(dataDir) {
    const entries = [];
    if (!(await this.safeExists(dataDir))) {
      return entries;
    }

    const indexPath = this.platform.join(dataDir, "index.json");
    if (await this.safeExists(indexPath)) {
      entries.push({ name: "index.json", bytes: await this.platform.readFileBytes(indexPath) });
    }

    for (const libraryPath of await this.safeList(dataDir)) {
      const libraryName = pathName(libraryPath);
      if (!libraryName.startsWith("library-")) {
        continue;
      }
      for (const itemPath of await this.safeList(libraryPath)) {
        const itemName = pathName(itemPath);
        const repoRelativePath = `${libraryName}/${itemName}`;
        if (!isSafeRepoRelativePath(repoRelativePath)) {
          continue;
        }
        await this.collectFiles(itemPath, repoRelativePath, entries);
      }
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  async collectFiles(path, relativePath, entries) {
    if (!(await this.platform.isDirectory(path))) {
      entries.push({ name: assertArchiveEntryName(relativePath), bytes: await this.platform.readFileBytes(path) });
      return;
    }
    for (const childPath of await this.safeList(path)) {
      await this.collectFiles(childPath, `${relativePath}/${pathName(childPath)}`, entries);
    }
  }

  async safeList(path) {
    try {
      return await this.platform.listDirectory(path);
    }
    catch (_error) {
      return [];
    }
  }

  async safeExists(path) {
    try {
      return !!(path && await this.platform.exists(path));
    }
    catch (_error) {
      return false;
    }
  }
}

function groupRepositoryEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const name = assertArchiveEntryName(entry.name);
    if (name === "index.json" || name === "export-manifest.json") {
      continue;
    }
    const [libraryName, itemName] = name.split("/");
    const repoRelativePath = `${libraryName}/${itemName}`;
    if (!isSafeRepoRelativePath(repoRelativePath)) {
      throw new Error(formatText("archiveInvalidEntry", { name }));
    }
    if (!groups.has(repoRelativePath)) {
      groups.set(repoRelativePath, []);
    }
    groups.get(repoRelativePath).push({ ...entry, name });
  }
  return groups;
}

function countRepositories(names) {
  const repos = new Set();
  for (const name of names) {
    const parts = name.split("/");
    if (parts.length >= 3 && isSafeRepoRelativePath(`${parts[0]}/${parts[1]}`)) {
      repos.add(`${parts[0]}/${parts[1]}`);
    }
  }
  return repos.size;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  const records = [];
  let offset = 0;

  for (const entry of entries) {
    const name = assertArchiveEntryName(entry.name);
    const nameBytes = encodeText(name);
    const data = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, ARCHIVE_LOCAL_SIGNATURE, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.byteLength, true);
    localView.setUint32(22, data.byteLength, true);
    localView.setUint16(26, nameBytes.byteLength, true);
    localParts.push(localHeader, nameBytes, data);
    records.push({ name, nameBytes, data, crc, localHeaderOffset: offset });
    offset += localHeader.byteLength + nameBytes.byteLength + data.byteLength;
  }

  const centralOffset = offset;
  for (const record of records) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    view.setUint32(0, ARCHIVE_CENTRAL_SIGNATURE, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint32(16, record.crc, true);
    view.setUint32(20, record.data.byteLength, true);
    view.setUint32(24, record.data.byteLength, true);
    view.setUint16(28, record.nameBytes.byteLength, true);
    view.setUint32(42, record.localHeaderOffset, true);
    centralParts.push(header, record.nameBytes);
    offset += header.byteLength + record.nameBytes.byteLength;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, ARCHIVE_EOCD_SIGNATURE, true);
  endView.setUint16(8, records.length, true);
  endView.setUint16(10, records.length, true);
  endView.setUint32(12, offset - centralOffset, true);
  endView.setUint32(16, centralOffset, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

function readStoredZip(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries = [];

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== ARCHIVE_CENTRAL_SIGNATURE) {
      throw new Error(UI_TEXT.archiveInvalidZip);
    }
    const method = view.getUint16(offset + 10, true);
    if (method !== 0) {
      throw new Error(formatText("unsupportedCompressionMethod", { method }));
    }
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = assertArchiveEntryName(decodeText(data.slice(offset + 46, offset + 46 + nameLength)));
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    entries.push({ name, bytes: data.slice(dataStart, dataStart + compressedSize) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function assertArchiveEntryName(name) {
  const normalized = String(name ?? "").replace(/\\/g, "/");
  if (!normalized
    || normalized.startsWith("/")
    || /^[A-Za-z]:\//.test(normalized)
    || normalized.split("/").includes("..")) {
    throw new Error(formatText("archiveInvalidEntry", { name: normalized || UI_TEXT.unknown }));
  }
  if (normalized === "index.json" || normalized === "export-manifest.json") {
    return normalized;
  }
  const parts = normalized.split("/");
  if (parts.length < 3 || !isSafeRepoRelativePath(`${parts[0]}/${parts[1]}`)) {
    throw new Error(formatText("archiveInvalidEntry", { name: normalized }));
  }
  return normalized;
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === ARCHIVE_EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new Error(UI_TEXT.archiveInvalidZip);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  const table = getCrcTable();
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let crcTable = null;
function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }
  crcTable = [];
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[i] = value >>> 0;
  }
  return crcTable;
}

function encodeText(value) {
  return TEXT_ENCODER.encode(String(value ?? ""));
}

function decodeText(value) {
  return TEXT_DECODER.decode(value);
}

function pathName(value) {
  return String(value ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";
}
