import { buildRepoRelativePath } from "./attachments.mjs";
import { UI_TEXT } from "./constants.mjs";
import { withRepositoryLock } from "./repository-lock.mjs";
import { ProtectedJSONFile, validateProtectedJSONShape } from "./protected-json.mjs";
import { attachmentMatchesOwnership, inspectAttachmentOwnership } from "./attachment-binding.mjs";

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
    this.storage = new ProtectedJSONFile(platform, {
      validate: (value) => validateProtectedJSONShape(value, "repositories", INDEX_SCHEMA_VERSION),
      createEmpty: createEmptyRepositoryIndex
    });
  }

  getIndexPath() {
    return this.platform.join(this.platform.getPluginDataDirectory(), INDEX_FILE_NAME);
  }

  async read() {
    return withRepositoryLock(this.getIndexPath(), () => this.readUnlocked(), this.platform.Zotero);
  }

  async readUnlocked() {
    const parsed = await this.storage.read(this.getIndexPath());
    return {
      ...createEmptyRepositoryIndex(),
      ...parsed,
      schemaVersion: parsed.schemaVersion ?? 1,
      repositories: parsed.repositories.map((entry) => normalizeIndexEntry(entry)).filter(Boolean)
    };
  }

  async write(index) {
    return withRepositoryLock(this.getIndexPath(), () => this.writeUnlocked(index), this.platform.Zotero);
  }

  async writeUnlocked(index) {
    validateProtectedJSONShape(index, "repositories", INDEX_SCHEMA_VERSION);
    const normalized = {
      ...createEmptyRepositoryIndex(),
      ...index,
      schemaVersion: INDEX_SCHEMA_VERSION,
      repositories: dedupeRepositories(index.repositories ?? [])
    };
    await this.storage.write(this.getIndexPath(), normalized);
    return normalized;
  }

  async update(updater) {
    return withRepositoryLock(this.getIndexPath(), async () => {
      const index = await this.readUnlocked();
      return this.writeUnlocked(await updater(index));
    }, this.platform.Zotero);
  }

  async upsertAttachment(attachment, { enabled, repoRelativePath = null } = {}) {
    const relativePath = repoRelativePath || buildRepoRelativePath(attachment.libraryID, attachment.itemKey);
    return this.update((index) => ({
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
        ...index.repositories.filter((entry) => entry.repoRelativePath !== relativePath)
      ].filter(Boolean)
    }));
  }

  async removeRepositoryEntries(repoRelativePaths) {
    const paths = new Set(repoRelativePaths);
    return this.update((index) => ({
      ...index,
      repositories: index.repositories.filter((entry) => !paths.has(entry.repoRelativePath))
    }));
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

      const repoPath = this.platform.join(this.platform.getPluginDataDirectory(), entry.repoRelativePath);
      await withRepositoryLock(repoPath, async () => {
        const metadata = await this.safeReadMetadata(repoPath);
        const eligibility = await this.inspectCleanupEligibility(entry, metadata);
        if (eligibility.allowed) {
          orphans.push(entry);
        }
        else if (eligibility.state !== "present") {
          skipped.push({ entry, reason: eligibility.reason });
        }
      }, this.platform.Zotero);
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
    const result = await this.cleanupCandidates(scan.repositories, idSet, { removeMissing: true, orphan: true });
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
    const currentIndex = await this.indexStore.read();
    const candidates = new Set(currentIndex.repositories.map((entry) => entry.repoRelativePath));
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
        candidates.add(repoRelativePath);
      }
    }

    // Refresh one repository at a time, always taking the repository lock before
    // the index lock. A whole-index replacement could lose a concurrent upsert.
    for (const repoRelativePath of candidates) {
      const repoPath = this.platform.join(pluginDataDir, ...repoRelativePath.split("/"));
      await withRepositoryLock(repoPath, async () => {
        const repositoryExists = await this.platform.exists(repoPath);
        // A failed read is not evidence that an existing repository has no
        // history. Propagate the error before changing its index entry.
        const metadata = repositoryExists ? await this.metadataStore.read(repoPath) : null;
        const entry = indexEntryFromMetadata(metadata, repoRelativePath);
        if (repositoryExists && !entry) {
          this.debug(`index rebuild retained repository with unavailable metadata: ${repoRelativePath}`);
          return;
        }
        await this.indexStore.update((index) => ({
          ...index,
          repositories: [
            ...(entry ? [entry] : []),
            ...index.repositories.filter((candidate) => candidate.repoRelativePath !== repoRelativePath)
          ]
        }));
      }, this.platform.Zotero);
    }
    return this.indexStore.update((index) => index);
  }

  async cleanupCandidates(candidates, expectedIDs, { removeMissing = false, orphan = false } = {}) {
    const cleaned = [];
    const skipped = [];
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

      const result = await this.cleanupRepository(normalizedEntry, expectedIDs, { removeMissing, orphan });
      if (result.cleaned) {
        cleaned.push(result);
      }
      else if (!result.missing) {
        skipped.push(result);
      }
    }

    return { cleaned, skipped };
  }

  async cleanupRepository(entry, expectedIDs, { removeMissing = false, orphan = false } = {}) {
    if (!isSafeRepoRelativePath(entry.repoRelativePath)) {
      return { entry, cleaned: false, reason: UI_TEXT.unsafeRepoPath };
    }

    const repoPath = this.platform.join(this.platform.getPluginDataDirectory(), entry.repoRelativePath);
    return withRepositoryLock(repoPath, async () => {
      if (!(await this.platform.exists(repoPath))) {
        if (removeMissing) {
          await this.indexStore.removeRepositoryEntries([entry.repoRelativePath]);
        }
        return { entry, path: repoPath, cleaned: false, missing: removeMissing, reason: UI_TEXT.repoAlreadyMissing };
      }

      const metadata = await this.safeReadMetadata(repoPath);
      // Recheck both ownership and actual attachment absence while holding the
      // same repository lock used by writers. A deletion event or stale index
      // alone cannot authorize deleting the complete history directory.
      const eligibility = await this.inspectCleanupEligibility(entry, metadata, orphan ? null : expectedIDs);
      if (!eligibility.allowed) {
        return { entry, path: repoPath, cleaned: false, reason: eligibility.reason };
      }

      await this.platform.removeDirectory(repoPath);
      await this.indexStore.removeRepositoryEntries([entry.repoRelativePath]);
      this.debug(`cleaned repository for deleted item: ${entry.repoRelativePath}`);
      return { entry, path: repoPath, cleaned: true };
    }, this.platform.Zotero);
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

  async inspectCleanupEligibility(entry, metadata, expectedIDs = null) {
    const ownership = inspectAttachmentOwnership(metadata);
    if (ownership.status !== "single" || !ownership.complete) {
      return { allowed: false, reason: UI_TEXT.cleanupOwnershipUncertain };
    }
    const parent = metadata?.item ?? metadata?.versions?.[0]?.zotero ?? {};
    const parentID = normalizeNumber(parent.itemID);
    if (!attachmentMatchesOwnership(entry, ownership)
        || (parentID !== null && entry.itemID !== null && parentID !== normalizeNumber(entry.itemID))
        || (parent.itemKey && entry.itemKey && parent.itemKey !== entry.itemKey)) {
      return { allowed: false, reason: UI_TEXT.metadataMismatchCleanup };
    }
    if (expectedIDs !== null
        && !expectedIDs?.has(normalizeNumber(ownership.owner.attachmentID))
        && !expectedIDs?.has(parentID)) {
      return { allowed: false, reason: UI_TEXT.metadataMismatchCleanup };
    }
    const state = await this.lookupAttachmentState(ownership.owner);
    if (state === "present") {
      return { allowed: false, state, reason: UI_TEXT.cleanupAttachmentStillExists };
    }
    if (state !== "absent") {
      return { allowed: false, state, reason: UI_TEXT.cleanupAttachmentLookupFailed };
    }
    return { allowed: true, state };
  }

  async lookupAttachmentState(owner) {
    const items = this.platform.Zotero?.Items;
    const libraryID = normalizeNumber(owner?.libraryID);
    const attachmentID = normalizeNumber(owner?.attachmentID);
    const attachmentKey = String(owner?.attachmentKey ?? "");
    try {
      let item;
      if (attachmentKey && libraryID !== null && typeof items?.getByLibraryAndKeyAsync === "function") {
        item = await items.getByLibraryAndKeyAsync(libraryID, attachmentKey);
      }
      else if (attachmentKey && libraryID !== null && typeof items?.getByLibraryAndKey === "function") {
        item = await items.getByLibraryAndKey(libraryID, attachmentKey);
      }
      else if (attachmentID !== null && typeof items?.getAsync === "function") {
        item = await items.getAsync(attachmentID);
      }
      else if (attachmentID !== null && typeof items?.get === "function") {
        item = await items.get(attachmentID);
      }
      else {
        return "unknown";
      }
      // Undefined can mean an unavailable or incomplete lookup; only explicit
      // absence counts as evidence that this attachment has been deleted.
      if (item === null || item === false) {
        return "absent";
      }
      if (!item || typeof item !== "object"
          || (attachmentKey && item.key && item.key !== attachmentKey)
          || (libraryID !== null && item.libraryID != null && Number(item.libraryID) !== libraryID)) {
        return "unknown";
      }
      return "present";
    }
    catch (_error) {
      return "unknown";
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
  if ((typeof value !== "number" && typeof value !== "string")
      || (typeof value === "string" && !/^\d+$/.test(value.trim()))) {
    return null;
  }
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function getPathName(value) {
  return String(value ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";
}
