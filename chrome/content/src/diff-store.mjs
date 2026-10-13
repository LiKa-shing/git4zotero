export const DIFF_SCHEMA_VERSION = 1;
export const DIFF_PAGE_SIZE = 100;
const DIFF_ROOT = ".git4zotero/diffs";

export class DiffStore {
  constructor(platform) {
    this.platform = platform;
    this.writeLocks = new Map();
    this.readCache = new Map();
    this.generation = 0;
  }

  async writeVersionDiff(repoPath, commitHash, diff) {
    const safeHash = normalizeSegment(commitHash, "commit hash");
    return this.writeDiff(repoPath, `${DIFF_ROOT}/versions/${safeHash}/index.json`, diff, {
      scope: "version",
      baseCommitHash: diff?.baseCommitHash ?? null
    });
  }

  async writeCurrentDiff(repoPath, diff) {
    return this.writeDiff(repoPath, `${DIFF_ROOT}/check-current/index.json`, diff, {
      scope: "check-current",
      baseCommitHash: diff?.baseCommitHash ?? null
    });
  }

  async writeComparisonDiff(repoPath, comparisonKey, diff) {
    const safeKey = normalizeSegment(comparisonKey, "comparison key");
    return this.writeDiff(repoPath, `${DIFF_ROOT}/comparisons/${safeKey}/index.json`, diff, {
      scope: "comparison",
      baseCommitHash: diff?.baseCommitHash ?? null
    });
  }

  async writeDiff(repoPath, relativeIndexPath, diff, options = {}) {
    const normalizedPath = validateDiffPath(relativeIndexPath);
    return this.withWriteLock(`${repoPath}:${normalizedPath}`, async () => {
      const previousPagePaths = await this.readExistingPagePaths(repoPath, normalizedPath);
      const groups = normalizeGroups(diff);
      const indexDirectory = normalizedPath.slice(0, normalizedPath.lastIndexOf("/"));
      const generation = `${Date.now()}-${++this.generation}`;
      const indexGroups = [];

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const group = groups[groupIndex];
        const groupID = normalizeSegment(group.id || group.key || `group-${groupIndex + 1}`, "group id");
        const pages = [];
        for (let offset = 0, page = 1; offset < group.changes.length; offset += DIFF_PAGE_SIZE, page += 1) {
          const pageChanges = group.changes.slice(offset, offset + DIFF_PAGE_SIZE)
            .map((change) => ({ ...change, groupID }));
          const pagePath = `${indexDirectory}/pages/${generation}/${groupID}/page-${String(page).padStart(4, "0")}.json`;
          await this.writeJSON(repoPath, pagePath, {
            schemaVersion: DIFF_SCHEMA_VERSION,
            groupID,
            page,
            pageSize: DIFF_PAGE_SIZE,
            totalChanges: group.changes.length,
            changes: pageChanges
          });
          pages.push({ page, path: pagePath, count: pageChanges.length });
        }
        indexGroups.push({
          id: groupID,
          key: group.key || groupID,
          label: group.label || groupID,
          areaType: group.areaType || "body",
          sourceLabel: group.sourceLabel || "",
          headingPath: Array.isArray(group.headingPath) ? group.headingPath : [],
          tableIndex: group.tableIndex ?? null,
          addedParagraphs: group.addedParagraphs || 0,
          deletedParagraphs: group.deletedParagraphs || 0,
          modifiedParagraphs: group.modifiedParagraphs || 0,
          movedParagraphs: group.movedParagraphs || 0,
          totalChanges: group.changes.length,
          summary: group.summary || "",
          pages
        });
      }

      const totalChanges = indexGroups.reduce((total, group) => total + group.totalChanges, 0);
      const index = {
        schemaVersion: DIFF_SCHEMA_VERSION,
        scope: options.scope || "version",
        quality: diff?.quality === "approximate" ? "approximate" : "exact",
        baseCommitHash: options.baseCommitHash ?? null,
        totalChanges,
        groupCount: indexGroups.length,
        counts: normalizeCounts(diff?.counts, indexGroups),
        createdAt: new Date().toISOString(),
        generation,
        groups: indexGroups
      };
      // The index is written last so readers never observe pages as a complete result prematurely.
      await this.writeJSON(repoPath, normalizedPath, index);
      await this.removeSupersededPages(repoPath, previousPagePaths, new Set(
        indexGroups.flatMap((group) => group.pages.map((page) => page.path))
      ));
      return {
        schemaVersion: DIFF_SCHEMA_VERSION,
        scope: options.scope || "version",
        path: normalizedPath,
        status: "complete",
        quality: index.quality,
        baseCommitHash: index.baseCommitHash,
        totalChanges,
        groupCount: indexGroups.length
      };
    });
  }

  createSummaryOnlyRef({ scope = "version", path = "", quality = "exact", baseCommitHash = null, totalChanges = 0, groupCount = 0 } = {}) {
    return {
      schemaVersion: DIFF_SCHEMA_VERSION,
      scope,
      path: path ? validateDiffPath(path) : "",
      status: "summary-only",
      quality: quality === "approximate" ? "approximate" : "exact",
      baseCommitHash,
      totalChanges: Number.isFinite(totalChanges) ? totalChanges : 0,
      groupCount: Number.isFinite(groupCount) ? groupCount : 0
    };
  }

  async readIndex(repoPath, diffRefOrPath) {
    const relativePath = validateDiffPath(typeof diffRefOrPath === "string" ? diffRefOrPath : diffRefOrPath?.path);
    const parsed = await this.readJSON(repoPath, relativePath);
    if (parsed?.schemaVersion !== DIFF_SCHEMA_VERSION || !Array.isArray(parsed.groups)) {
      throw new Error("Unsupported or damaged git4zotero diff index.");
    }
    for (const group of parsed.groups) {
      if (!Array.isArray(group.pages)) {
        throw new Error("Damaged git4zotero diff group index.");
      }
      for (const page of group.pages) {
        validateDiffPath(page.path);
      }
    }
    return parsed;
  }

  async loadPage(repoPath, diffRefOrIndex, { groupID, page = 1 } = {}) {
    const index = diffRefOrIndex?.groups ? diffRefOrIndex : await this.readIndex(repoPath, diffRefOrIndex);
    const group = index.groups.find((candidate) => candidate.id === groupID)
      || (groupID ? null : index.groups[0]);
    if (!group) {
      return { group: null, page: 1, pageCount: 0, totalChanges: 0, changes: [] };
    }
    const pageNumber = Math.max(1, Number(page) || 1);
    const descriptor = group.pages.find((candidate) => candidate.page === pageNumber);
    if (!descriptor) {
      return { group, page: pageNumber, pageCount: group.pages.length, totalChanges: group.totalChanges, changes: [] };
    }
    const parsed = await this.readJSON(repoPath, validateDiffPath(descriptor.path));
    if (parsed?.schemaVersion !== DIFF_SCHEMA_VERSION || !Array.isArray(parsed.changes)) {
      throw new Error("Damaged git4zotero diff page.");
    }
    return {
      group,
      page: pageNumber,
      pageCount: group.pages.length,
      totalChanges: group.totalChanges,
      changes: parsed.changes
    };
  }

  async loadAll(repoPath, diffRefOrIndex) {
    const index = diffRefOrIndex?.groups ? diffRefOrIndex : await this.readIndex(repoPath, diffRefOrIndex);
    const changes = [];
    for (const group of index.groups) {
      for (const page of group.pages) {
        const loaded = await this.loadPage(repoPath, index, { groupID: group.id, page: page.page });
        changes.push(...loaded.changes);
      }
    }
    return { index, changes };
  }

  async loadByIDs(repoPath, diffRefOrIndex, changeIDs = []) {
    const wanted = new Set((changeIDs ?? []).map(String).filter(Boolean));
    if (!wanted.size) {
      return [];
    }
    const index = diffRefOrIndex?.groups ? diffRefOrIndex : await this.readIndex(repoPath, diffRefOrIndex);
    const found = new Map();
    for (const group of index.groups) {
      for (const page of group.pages) {
        const loaded = await this.loadPage(repoPath, index, { groupID: group.id, page: page.page });
        for (const change of loaded.changes) {
          if (wanted.has(change.id) && !found.has(change.id)) {
            found.set(change.id, change);
          }
        }
        if (found.size === wanted.size) {
          return changeIDs.map((id) => found.get(String(id))).filter(Boolean);
        }
      }
    }
    return changeIDs.map((id) => found.get(String(id))).filter(Boolean);
  }

  async inspect(repoPath, diffRefOrIndex) {
    const issues = [];
    let index;
    try {
      index = diffRefOrIndex?.groups ? diffRefOrIndex : await this.readIndex(repoPath, diffRefOrIndex);
    }
    catch (error) {
      return { ok: false, issues: [{ kind: "index", message: error?.message || String(error) }], checkedPages: 0 };
    }
    let checkedPages = 0;
    for (const group of index.groups) {
      for (const page of group.pages) {
        checkedPages += 1;
        try {
          const loaded = await this.loadPage(repoPath, index, { groupID: group.id, page: page.page });
          if (loaded.changes.length !== page.count) {
            issues.push({ kind: "page-count", path: page.path, expected: page.count, actual: loaded.changes.length });
          }
        }
        catch (error) {
          issues.push({ kind: "page", path: page.path, message: error?.message || String(error) });
        }
      }
    }
    return { ok: issues.length === 0, issues, checkedPages };
  }

  clearReadCache() {
    const count = this.readCache.size;
    this.readCache.clear();
    return count;
  }

  async search(repoPath, diffRefOrIndex, options = {}) {
    const index = diffRefOrIndex?.groups ? diffRefOrIndex : await this.readIndex(repoPath, diffRefOrIndex);
    const query = String(options.query ?? "").trim().toLocaleLowerCase();
    const types = new Set((options.types ?? []).filter(Boolean));
    const excludedNoise = new Set((options.excludeNoise ?? []).filter(Boolean));
    const groupID = options.groupID || "";
    const limit = Math.max(1, Math.min(DIFF_PAGE_SIZE, Number(options.limit) || DIFF_PAGE_SIZE));
    const start = Math.max(0, Number(options.cursor) || 0);
    const matches = [];
    const groups = groupID ? index.groups.filter((group) => group.id === groupID) : index.groups;
    for (const group of groups) {
      for (const page of group.pages) {
        const loaded = await this.loadPage(repoPath, index, { groupID: group.id, page: page.page });
        for (const change of loaded.changes) {
          if (types.size && !types.has(change.type)) {
            continue;
          }
          if (excludedNoise.has(change.noiseLevel)) {
            continue;
          }
          const haystack = `${change.id || ""}\n${change.oldText || ""}\n${change.newText || ""}\n${change.locationLabel || ""}`.toLocaleLowerCase();
          if (!query || haystack.includes(query)) {
            matches.push(change);
          }
        }
      }
    }
    return {
      total: matches.length,
      cursor: start,
      nextCursor: start + limit < matches.length ? start + limit : null,
      changes: matches.slice(start, start + limit)
    };
  }

  async readJSON(repoPath, relativePath) {
    const path = this.resolve(repoPath, relativePath);
    if (this.readCache.has(path)) {
      const cached = this.readCache.get(path);
      this.readCache.delete(path);
      this.readCache.set(path, cached);
      return cached;
    }
    if (!(await this.platform.exists(path))) {
      throw new Error(`git4zotero diff file is missing: ${relativePath}`);
    }
    try {
      const parsed = JSON.parse(await this.platform.readText(path));
      this.cacheRead(path, parsed);
      return parsed;
    }
    catch (error) {
      throw new Error(`Could not read git4zotero diff file ${relativePath}: ${error?.message || error}`);
    }
  }

  async writeJSON(repoPath, relativePath, value) {
    const path = this.resolve(repoPath, validateDiffPath(relativePath));
    const content = `${JSON.stringify(value, null, 2)}\n`;
    if (typeof this.platform.atomicWriteText === "function") {
      await this.platform.atomicWriteText(path, content);
    }
    else {
      await this.platform.writeText(path, content);
    }
    this.cacheRead(path, value);
  }

  cacheRead(path, value) {
    this.readCache.delete(path);
    this.readCache.set(path, value);
    while (this.readCache.size > 128) {
      this.readCache.delete(this.readCache.keys().next().value);
    }
  }

  async readExistingPagePaths(repoPath, relativeIndexPath) {
    try {
      const indexPath = this.resolve(repoPath, relativeIndexPath);
      if (!(await this.platform.exists(indexPath))) {
        return [];
      }
      const parsed = JSON.parse(await this.platform.readText(indexPath));
      return (parsed?.groups ?? [])
        .flatMap((group) => group?.pages ?? [])
        .map((page) => page?.path)
        .filter((path) => {
          try {
            validateDiffPath(path);
            return true;
          }
          catch {
            return false;
          }
        });
    }
    catch {
      return [];
    }
  }

  async removeSupersededPages(repoPath, previousPagePaths, currentPagePaths) {
    if (typeof this.platform.removeFile !== "function") {
      return;
    }
    for (const relativePath of previousPagePaths) {
      if (currentPagePaths.has(relativePath)) {
        continue;
      }
      try {
        const path = this.resolve(repoPath, relativePath);
        await this.platform.removeFile(path);
        this.readCache.delete(path);
      }
      catch {
        // Stale diff pages are harmless; health checks focus on the active index.
      }
    }
  }

  resolve(repoPath, relativePath) {
    return this.platform.join(repoPath, ...validateDiffPath(relativePath).split("/"));
  }

  async withWriteLock(key, operation) {
    const previous = this.writeLocks.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.writeLocks.set(key, current);
    try {
      return await current;
    }
    finally {
      if (this.writeLocks.get(key) === current) {
        this.writeLocks.delete(key);
      }
    }
  }
}

export function validateDiffPath(value) {
  const normalized = String(value ?? "").trim().replace(/\\/g, "/");
  if (!normalized
      || normalized.startsWith("/")
      || /^[a-zA-Z]:/.test(normalized)
      || normalized.split("/").some((part) => !part || part === "." || part === "..")
      || !(normalized === DIFF_ROOT || normalized.startsWith(`${DIFF_ROOT}/`))) {
    throw new Error("Invalid git4zotero diff path.");
  }
  return normalized;
}

function normalizeSegment(value, label) {
  const normalized = String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized.slice(0, 120);
}

function normalizeGroups(diff) {
  if (Array.isArray(diff?.groups) && diff.groups.length) {
    return diff.groups.map((group) => ({ ...group, changes: Array.isArray(group.changes) ? group.changes : [] }));
  }
  return [{
    id: "document",
    key: "document",
    label: "Document",
    areaType: "body",
    changes: Array.isArray(diff?.changes) ? diff.changes : []
  }];
}

function normalizeCounts(counts, groups) {
  if (counts && typeof counts === "object") {
    return {
      added: Number(counts.added) || 0,
      deleted: Number(counts.deleted) || 0,
      modified: Number(counts.modified) || 0,
      moved: Number(counts.moved) || 0
    };
  }
  const result = { added: 0, deleted: 0, modified: 0, moved: 0 };
  for (const group of groups) {
    result.added += group.addedParagraphs || 0;
    result.deleted += group.deletedParagraphs || 0;
    result.modified += group.modifiedParagraphs || 0;
    result.moved += group.movedParagraphs || 0;
  }
  return result;
}
