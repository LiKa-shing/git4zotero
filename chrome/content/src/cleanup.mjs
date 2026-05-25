import { buildRepoRelativePath } from "./attachments.mjs";
import { UI_TEXT } from "./constants.mjs";

const INDEX_SCHEMA_VERSION = 1;
const INDEX_FILE_NAME = "index.json";
const REPO_RELATIVE_PATTERN = /^library-[A-Za-z0-9._-]+\/item-[A-Za-z0-9._-]+$/;

export function createEmptyRepositoryIndex() {
  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    repositories: []
  };
}

export class RepositoryIndexStore {
  constructor(platform) {
    this.platform = platform;
  }

  getIndexPath() {
    return this.platform.join(this.platform.getPluginDataDirectory(), INDEX_FILE_NAME);
  }

  async read() {
    const indexPath = this.getIndexPath();
    if (!(await this.platform.exists(indexPath))) {
      return createEmptyRepositoryIndex();
    }

    try {
      const parsed = JSON.parse(await this.platform.readText(indexPath));
      return {
        ...createEmptyRepositoryIndex(),
        ...parsed,
        schemaVersion: parsed.schemaVersion ?? 1,
        repositories: Array.isArray(parsed.repositories)
          ? parsed.repositories.map((entry) => normalizeIndexEntry(entry)).filter(Boolean)
          : []
      };
    }
    catch (error) {
      this.platform.Zotero?.debug?.(`git4zotero: repository index read failed: ${error?.stack || error}`);
      return createEmptyRepositoryIndex();
    }
  }

  async write(index) {
    const normalized = {
      ...createEmptyRepositoryIndex(),
      ...index,
      schemaVersion: INDEX_SCHEMA_VERSION,
      repositories: dedupeRepositories(index.repositories ?? [])
    };
    await this.platform.writeText(this.getIndexPath(), `${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  }

  async upsertAttachment(attachment, { enabled, repoRelativePath = null } = {}) {
    const relativePath = repoRelativePath || buildRepoRelativePath(attachment.libraryID, attachment.itemKey);
    const index = await this.read();
    const withoutCurrent = index.repositories.filter((entry) => entry.repoRelativePath !== relativePath);
    await this.write({
      ...index,
      repositories: [
        normalizeIndexEntry({
          libraryID: attachment.libraryID,
          itemID: attachment.itemID,
          itemKey: attachment.itemKey,
          attachmentID: attachment.attachmentID,
          attachmentKey: attachment.attachmentKey,
          repoRelativePath: relativePath,
          enabled: enabled === true,
          lastSeenAt: new Date().toISOString()
        }),
        ...withoutCurrent
      ].filter(Boolean)
    });
  }

  async removeRepositoryEntries(repoRelativePaths) {
    const paths = new Set(repoRelativePaths);
    const index = await this.read();
    await this.write({
      ...index,
      repositories: index.repositories.filter((entry) => !paths.has(entry.repoRelativePath))
    });
  }
}

export class RepositoryCleanupService {
  constructor({ platform, metadataStore, indexStore }) {
    this.platform = platform;
    this.metadataStore = metadataStore;
    this.indexStore = indexStore;
  }

  async handleItemEvent(event, type, ids) {
    if (type !== "item") {
      return { cleaned: [], skipped: [], ignored: true };
    }
    if (event === "trash") {
      this.debug("item moved to trash; repository history retained");
      return { cleaned: [], skipped: [], ignored: true };
    }
    if (event !== "delete") {
      return { cleaned: [], skipped: [], ignored: true };
    }
    return this.cleanupDeletedItems(ids);
  }

  async cleanupDeletedItems(ids) {
    const deletedIDs = normalizeIDSet(ids);
    await this.ensureIndex();
    const index = await this.indexStore.read();
    const candidates = index.repositories.filter((entry) => entryMatchesDeletedIDs(entry, deletedIDs));
    return this.cleanupCandidates(candidates, deletedIDs, { removeMissing: true });
  }

  async scanOrphanRepositories() {
    await this.ensureIndex();
    const index = await this.indexStore.read();
    const orphans = [];
    const skipped = [];

    for (const entry of index.repositories) {
      if (!isSafeRepoRelativePath(entry.repoRelativePath)) {
        skipped.push({ entry, reason: UI_TEXT.unsafeRepoPath });
        continue;
      }

      if (this.itemExists(entry.itemID) || this.itemExists(entry.attachmentID)) {
        continue;
      }
      orphans.push(entry);
    }

    return {
      count: orphans.length,
      repositories: orphans,
      skipped
    };
  }

  async cleanupOrphanRepositories() {
    const scan = await this.scanOrphanRepositories();
    const idSet = new Set();
    for (const entry of scan.repositories) {
      addID(idSet, entry.itemID);
      addID(idSet, entry.attachmentID);
    }
    const result = await this.cleanupCandidates(scan.repositories, idSet, { removeMissing: true });
    return {
      ...result,
      scanned: scan.repositories.length,
      skipped: [...scan.skipped, ...result.skipped]
    };
  }

  async ensureIndex() {
    return this.rebuildIndexFromRepositories();
  }

  async rebuildIndexFromRepositories() {
    const pluginDataDir = this.platform.getPluginDataDirectory();
    if (!(await this.platform.exists(pluginDataDir))) {
      const empty = createEmptyRepositoryIndex();
      await this.indexStore.write(empty);
      return empty;
    }

    const repositories = [];
    for (const libraryPath of await this.safeListDirectory(pluginDataDir)) {
      const libraryName = getPathName(libraryPath);
      if (!libraryName.startsWith("library-")) {
        continue;
      }
      for (const itemPath of await this.safeListDirectory(libraryPath)) {
        const itemName = getPathName(itemPath);
        const repoRelativePath = `${libraryName}/${itemName}`;
        if (!isSafeRepoRelativePath(repoRelativePath)) {
          continue;
        }
        const metadata = await this.safeReadMetadata(itemPath);
        const entry = indexEntryFromMetadata(metadata, repoRelativePath);
        if (entry) {
          repositories.push(entry);
        }
      }
    }

    return this.indexStore.write({
      schemaVersion: INDEX_SCHEMA_VERSION,
      repositories
    });
  }

  async cleanupCandidates(candidates, expectedIDs, { removeMissing = false } = {}) {
    const cleaned = [];
    const skipped = [];
    const removeFromIndex = [];
    const seen = new Set();

    for (const entry of candidates) {
      const normalizedEntry = normalizeIndexEntry(entry);
      if (!normalizedEntry) {
        skipped.push({ entry, cleaned: false, reason: UI_TEXT.unsafeRepoPath });
        continue;
      }
      if (seen.has(normalizedEntry.repoRelativePath)) {
        continue;
      }
      seen.add(normalizedEntry.repoRelativePath);

      const result = await this.cleanupRepository(normalizedEntry, expectedIDs, { removeMissing });
      if (result.cleaned) {
        cleaned.push(result);
        removeFromIndex.push(normalizedEntry.repoRelativePath);
      }
      else if (result.missing) {
        removeFromIndex.push(normalizedEntry.repoRelativePath);
      }
      else {
        skipped.push(result);
      }
    }

    if (removeFromIndex.length) {
      await this.indexStore.removeRepositoryEntries(removeFromIndex);
    }

    return { cleaned, skipped };
  }

  async cleanupRepository(entry, expectedIDs, { removeMissing = false } = {}) {
    if (!isSafeRepoRelativePath(entry.repoRelativePath)) {
      return { entry, cleaned: false, reason: UI_TEXT.unsafeRepoPath };
    }

    const repoPath = this.platform.join(this.platform.getPluginDataDirectory(), entry.repoRelativePath);
    if (!(await this.platform.exists(repoPath))) {
      return { entry, path: repoPath, cleaned: false, missing: removeMissing, reason: UI_TEXT.repoAlreadyMissing };
    }

    const metadata = await this.safeReadMetadata(repoPath);
    if (!metadataMatchesDeletedIDs(metadata, expectedIDs)) {
      return { entry, path: repoPath, cleaned: false, reason: UI_TEXT.metadataMismatchCleanup };
    }

    await this.platform.removeDirectory(repoPath);
    this.debug(`cleaned repository for deleted item: ${entry.repoRelativePath}`);
    return { entry, path: repoPath, cleaned: true };
  }

  async safeListDirectory(path) {
    try {
      return await this.platform.listDirectory(path);
    }
    catch (error) {
      this.debug(`list directory failed: ${path}: ${error?.stack || error}`);
      return [];
    }
  }

  async safeReadMetadata(repoPath) {
    try {
      return await this.metadataStore.read(repoPath);
    }
    catch (error) {
      this.debug(`read metadata failed: ${repoPath}: ${error?.stack || error}`);
      return null;
    }
  }

  itemExists(itemID) {
    if (!Number.isFinite(Number(itemID))) {
      return false;
    }
    try {
      return !!this.platform.Zotero?.Items?.get?.(Number(itemID));
    }
    catch (_error) {
      return false;
    }
  }

  debug(message) {
    this.platform.Zotero?.debug?.(`git4zotero: ${message}`);
  }
}

export function isSafeRepoRelativePath(value) {
  return REPO_RELATIVE_PATTERN.test(String(value ?? ""));
}

function normalizeIndexEntry(entry) {
  if (!entry || !isSafeRepoRelativePath(entry.repoRelativePath)) {
    return null;
  }
  return {
    libraryID: normalizeNumber(entry.libraryID),
    itemID: normalizeNumber(entry.itemID),
    itemKey: String(entry.itemKey ?? ""),
    attachmentID: normalizeNumber(entry.attachmentID),
    attachmentKey: String(entry.attachmentKey ?? ""),
    repoRelativePath: String(entry.repoRelativePath),
    enabled: entry.enabled === true,
    lastSeenAt: String(entry.lastSeenAt ?? "")
  };
}

function dedupeRepositories(entries) {
  const byPath = new Map();
  for (const entry of entries) {
    const normalized = normalizeIndexEntry(entry);
    if (normalized) {
      byPath.set(normalized.repoRelativePath, normalized);
    }
  }
  return [...byPath.values()];
}

function indexEntryFromMetadata(metadata, repoRelativePath) {
  const source = metadata?.versions?.[0]?.zotero ?? {};
  const entry = {
    libraryID: metadata?.item?.libraryID ?? source.libraryID,
    itemID: metadata?.item?.itemID ?? source.itemID,
    itemKey: metadata?.item?.itemKey ?? source.itemKey,
    attachmentID: metadata?.attachment?.attachmentID ?? source.attachmentID,
    attachmentKey: metadata?.attachment?.attachmentKey ?? source.attachmentKey,
    repoRelativePath,
    enabled: metadata?.enabled === true,
    lastSeenAt: new Date().toISOString()
  };
  if (!entry.itemKey && !entry.attachmentKey && !Number.isFinite(Number(entry.itemID)) && !Number.isFinite(Number(entry.attachmentID))) {
    return null;
  }
  return normalizeIndexEntry(entry);
}

function metadataMatchesDeletedIDs(metadata, expectedIDs) {
  if (!metadata || !expectedIDs?.size) {
    return false;
  }
  const metadataIDs = new Set();
  addID(metadataIDs, metadata.item?.itemID);
  addID(metadataIDs, metadata.attachment?.attachmentID);
  for (const version of metadata.versions ?? []) {
    addID(metadataIDs, version.zotero?.itemID);
    addID(metadataIDs, version.zotero?.attachmentID);
  }
  return [...metadataIDs].some((id) => expectedIDs.has(id));
}

function entryMatchesDeletedIDs(entry, deletedIDs) {
  return deletedIDs.has(normalizeNumber(entry.itemID)) || deletedIDs.has(normalizeNumber(entry.attachmentID));
}

function normalizeIDSet(ids) {
  const set = new Set();
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    addID(set, id);
  }
  return set;
}

function addID(set, value) {
  const normalized = normalizeNumber(value);
  if (normalized !== null) {
    set.add(normalized);
  }
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getPathName(value) {
  return String(value ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";
}
