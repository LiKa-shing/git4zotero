import { formatText } from "./localization.mjs";
import { withRepositoryLock } from "./repository-lock.mjs";

// Core records are not caches: unreadable data must never become an empty store.
// A backup is a previous valid record, not proof that it matches the latest Git
// commit. Reads therefore report recovery information instead of rolling back.
export class ProtectedJSONFile {
  constructor(platform, { validate, createEmpty }) {
    this.platform = platform;
    this.validate = validate;
    this.createEmpty = createEmpty;
  }

  async read(path) {
    return this.withLock(path, async () => {
      const current = await this.readCurrent(path);
      return current ? current.value : this.createEmpty();
    });
  }

  async write(path, value) {
    return this.withLock(path, async () => {
      // Validate the serialized representation too (JSON can omit values).
      this.validate(value);
      const text = `${JSON.stringify(value, null, 2)}\n`;
      this.parse(text);
      if (typeof this.platform.atomicWriteText !== "function") {
        throw new Error(formatText("atomicWriteUnavailable"));
      }
      const current = await this.readCurrent(path);
      const backupPath = `${path}.bak`;
      const backupText = current ? current.text : text;

      // Never rotate an unreadable primary over the last valid backup. If the
      // first primary write fails, the backup also distinguishes an interrupted
      // initialization from a repository that has never had any records.
      await this.platform.atomicWriteText(backupPath, backupText);
      await this.verify(backupPath, backupText);
      await this.platform.atomicWriteText(path, text);
      await this.verify(path, text);
    });
  }

  async readCurrent(path) {
    try {
      if (await this.platform.exists(path)) {
        const text = await this.platform.readText(path);
        return { text, value: this.parse(text) };
      }
      if (!(await this.platform.exists(`${path}.bak`))) {
        return null;
      }
      throw new Error(formatText("protectedJSONPrimaryMissing"));
    }
    catch (cause) {
      throw await this.recoveryError(path, cause);
    }
  }

  parse(text) {
    const value = JSON.parse(text);
    this.validate(value);
    return value;
  }

  async verify(path, expected) {
    const actual = await this.platform.readText(path);
    if (actual !== expected) {
      throw new Error(formatText("atomicWriteVerificationFailed", { path }));
    }
    this.parse(actual);
  }

  async recoveryError(path, cause) {
    const backupPath = `${path}.bak`;
    let backupAvailable = false;
    try {
      if (await this.platform.exists(backupPath)) {
        this.parse(await this.platform.readText(backupPath));
        backupAvailable = true;
      }
    }
    catch {
      // Preserve both files even when the backup is also unreadable.
    }
    const reason = cause?.message || String(cause);
    const error = new Error(formatText(
      backupAvailable ? "protectedJSONBackupAvailable" : "protectedJSONUnreadable",
      { path, backupPath, reason }
    ));
    error.name = "ProtectedJSONError";
    error.code = "PROTECTED_JSON_UNREADABLE";
    error.path = path;
    error.backupPath = backupPath;
    error.backupAvailable = backupAvailable;
    error.cause = cause;
    return error;
  }

  withLock(path, operation) {
    // Distinct from the repository/index lock held by callers. Sharing the
    // host queue also serializes separate store instances and loading realms.
    return withRepositoryLock(`${path}.write-guard`, operation, this.platform.Zotero);
  }
}

export function validateProtectedJSONShape(value, listKey, maxSchema) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || !Array.isArray(value[listKey])) {
    throw new Error(formatText("protectedJSONInvalidStructure", { field: listKey }));
  }
  if (value.schemaVersion !== undefined
      && (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion > maxSchema)) {
    throw new Error(formatText("protectedJSONUnsupportedSchema", { version: value.schemaVersion }));
  }
}
