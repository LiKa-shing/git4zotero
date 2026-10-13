export const AI_INSIGHT_SCHEMA_VERSION = 1;
export const AI_INSIGHT_ROOT = ".git4zotero/ai-insights/v1";
const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

export class AIInsightStore {
  constructor(platform, options = {}) {
    this.platform = platform;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.writeLocks = new Map();
  }

  async createKey(descriptor) {
    const stable = stableStringify(descriptor);
    return this.platform.hashString(stable);
  }

  async read(repoPath, cacheKey) {
    const path = this.resolve(repoPath, cacheKey);
    if (!(await this.platform.exists(path))) {
      return null;
    }
    try {
      const parsed = JSON.parse(await this.platform.readText(path));
      if (parsed?.schemaVersion !== AI_INSIGHT_SCHEMA_VERSION || !parsed.result) {
        return null;
      }
      parsed.lastAccessedAt = new Date().toISOString();
      const content = `${JSON.stringify(parsed, null, 2)}\n`;
      try {
        if (typeof this.platform.atomicWriteText === "function") {
          await this.platform.atomicWriteText(path, content);
        }
        else {
          await this.platform.writeText(path, content);
        }
      }
      catch {
        // A valid cached result remains usable when its access timestamp cannot
        // be refreshed (for example, while the profile is temporarily read-only).
      }
      return parsed;
    }
    catch {
      return null;
    }
  }

  async write(repoPath, cacheKey, record) {
    const key = normalizeCacheKey(cacheKey);
    return this.withWriteLock(repoPath, async () => {
      const value = {
        schemaVersion: AI_INSIGHT_SCHEMA_VERSION,
        createdAt: record.createdAt || new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        provider: String(record.provider ?? ""),
        endpointOrigin: String(record.endpointOrigin ?? ""),
        model: String(record.model ?? ""),
        promptVersion: Number(record.promptVersion) || 1,
        versionKey: String(record.versionKey ?? ""),
        diffHash: String(record.diffHash ?? ""),
        changeIDs: Array.isArray(record.changeIDs) ? record.changeIDs.map(String) : [],
        language: String(record.language ?? ""),
        usage: record.usage ?? {},
        result: record.result
      };
      const path = this.resolve(repoPath, key);
      const content = `${JSON.stringify(value, null, 2)}\n`;
      if (typeof this.platform.atomicWriteText === "function") {
        await this.platform.atomicWriteText(path, content);
      }
      else {
        await this.platform.writeText(path, content);
      }
      await this.prune(repoPath);
      return value;
    });
  }

  async clear(repoPath, options = {}) {
    const directory = this.directory(repoPath);
    if (!(await this.platform.exists(directory))) {
      return 0;
    }
    let removed = 0;
    for (const path of await this.platform.listDirectory(directory)) {
      if (await this.platform.isDirectory(path)) {
        continue;
      }
      if (options.versionKey) {
        try {
          const parsed = JSON.parse(await this.platform.readText(path));
          if (parsed?.versionKey !== options.versionKey) {
            continue;
          }
        }
        catch {
          // Damaged cache entries are safe to remove.
        }
      }
      await this.platform.removeFile(path);
      removed += 1;
    }
    return removed;
  }

  async prune(repoPath) {
    const directory = this.directory(repoPath);
    if (!(await this.platform.exists(directory))) {
      return;
    }
    const entries = [];
    for (const path of await this.platform.listDirectory(directory)) {
      try {
        if (await this.platform.isDirectory(path)) {
          continue;
        }
        const stat = await this.platform.stat(path);
        entries.push({
          path,
          size: Number(stat?.size) || 0,
          modified: Number(stat?.lastModified) || Number(stat?.lastModificationDate) || 0
        });
      }
      catch {
        // Ignore entries that disappear during inspection.
      }
    }
    entries.sort((left, right) => right.modified - left.modified);
    let bytes = 0;
    for (let index = 0; index < entries.length; index += 1) {
      bytes += entries[index].size;
      if (index >= this.maxEntries || bytes > this.maxBytes) {
        await this.platform.removeFile(entries[index].path);
      }
    }
  }

  directory(repoPath) {
    return this.platform.join(repoPath, ...AI_INSIGHT_ROOT.split("/"));
  }

  resolve(repoPath, cacheKey) {
    return this.platform.join(this.directory(repoPath), `${normalizeCacheKey(cacheKey)}.json`);
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

export function normalizeCacheKey(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{32,128}$/.test(key)) {
    throw new Error("Invalid AI insight cache key.");
  }
  return key;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
