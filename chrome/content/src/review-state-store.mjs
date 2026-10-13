export const REVIEW_STATE_SCHEMA_VERSION = 1;
export const REVIEW_STATE_PATH = ".git4zotero/review-state/v1/state.json";
export const REVIEW_STATUSES = new Set(["unreviewed", "confirmed", "action-required"]);

export class ReviewStateStore {
  constructor(platform) {
    this.platform = platform;
    this.writeLocks = new Map();
  }

  async load(repoPath, scopeKey, changeIDs = []) {
    const state = await this.read(repoPath);
    const scope = state.scopes[normalizeKey(scopeKey)]?.changes ?? {};
    const result = {};
    for (const changeID of changeIDs) {
      const key = normalizeKey(changeID);
      result[key] = normalizeReviewState(scope[key]);
    }
    return result;
  }

  async update(repoPath, scopeKey, changeID, patch = {}) {
    const safeScope = normalizeKey(scopeKey);
    const safeChange = normalizeKey(changeID);
    return this.withWriteLock(repoPath, async () => {
      const state = await this.read(repoPath);
      const scope = state.scopes[safeScope] ?? { updatedAt: "", changes: {} };
      const previous = normalizeReviewState(scope.changes[safeChange]);
      const next = normalizeReviewState({ ...previous, ...patch, updatedAt: new Date().toISOString() });
      scope.changes[safeChange] = next;
      scope.updatedAt = next.updatedAt;
      state.scopes[safeScope] = scope;
      await this.write(repoPath, state);
      return next;
    });
  }

  async read(repoPath) {
    const path = this.resolve(repoPath);
    if (!(await this.platform.exists(path))) {
      return { schemaVersion: REVIEW_STATE_SCHEMA_VERSION, scopes: {} };
    }
    try {
      const parsed = JSON.parse(await this.platform.readText(path));
      if (parsed?.schemaVersion !== REVIEW_STATE_SCHEMA_VERSION || !parsed.scopes || typeof parsed.scopes !== "object") {
        throw new Error("Unsupported review state schema.");
      }
      return parsed;
    }
    catch (error) {
      throw new Error(`Could not read git4zotero review state: ${error?.message || error}`);
    }
  }

  async write(repoPath, state) {
    const path = this.resolve(repoPath);
    const content = `${JSON.stringify(state, null, 2)}\n`;
    if (typeof this.platform.atomicWriteText === "function") {
      await this.platform.atomicWriteText(path, content);
    }
    else {
      await this.platform.writeText(path, content);
    }
  }

  resolve(repoPath) {
    return this.platform.join(repoPath, ...REVIEW_STATE_PATH.split("/"));
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

function normalizeReviewState(value = {}) {
  return {
    status: REVIEW_STATUSES.has(value?.status) ? value.status : "unreviewed",
    note: String(value?.note ?? "").slice(0, 2000),
    bookmarked: value?.bookmarked === true,
    updatedAt: String(value?.updatedAt ?? "")
  };
}

function normalizeKey(value) {
  const key = String(value ?? "").trim();
  if (!key || key.length > 240 || /[\\/\0]/.test(key) || key === "." || key === "..") {
    throw new Error("Invalid git4zotero review state key.");
  }
  return key;
}
