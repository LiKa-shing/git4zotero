import { UI_TEXT } from "./constants.mjs";

export const METADATA_SCHEMA_VERSION = 4;

export function normalizeVersionNote(note, fallback = UI_TEXT.defaultNote) {
  const normalized = String(note ?? "").trim();
  return normalized || fallback;
}

export function createEmptyMetadata(context = {}) {
  return {
    schemaVersion: METADATA_SCHEMA_VERSION,
    enabled: context.enabled ?? false,
    item: context.item ?? null,
    attachment: context.attachment ?? null,
    trackedFile: context.trackedFile ?? null,
    versions: [],
    lastRestored: null,
    lastCheck: null
  };
}

export function createVersionRecord(input) {
  return {
    id: input.id,
    commitHash: input.commitHash,
    shortHash: input.commitHash.slice(0, 8),
    createdAt: input.createdAt,
    kind: input.kind,
    note: normalizeVersionNote(input.note),
    fileName: input.fileName,
    fileHash: input.fileHash,
    fileSize: input.fileSize,
    contentHash: input.contentHash ?? null,
    contentSummary: input.contentSummary ?? null,
    contentSnapshot: input.contentSnapshot ?? null,
    changeSummary: input.changeSummary ?? null,
    trackedRelativePath: input.trackedRelativePath,
    zotero: {
      libraryID: input.libraryID,
      itemID: input.itemID,
      itemKey: input.itemKey,
      attachmentID: input.attachmentID,
      attachmentKey: input.attachmentKey
    },
    pluginVersion: input.pluginVersion
  };
}

export function sortNewestFirst(versions) {
  return [...versions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function migrateMetadata(rawMetadata = {}, context = {}) {
  const source = rawMetadata && typeof rawMetadata === "object" ? rawMetadata : {};
  const versions = Array.isArray(source.versions) ? source.versions : [];
  const enabled = typeof source.enabled === "boolean"
    ? source.enabled
    : versions.length > 0;
  return {
    ...createEmptyMetadata(context),
    ...source,
    schemaVersion: METADATA_SCHEMA_VERSION,
    enabled,
    item: normalizeObject(source.item, context.item ?? null),
    attachment: normalizeObject(source.attachment, context.attachment ?? null),
    trackedFile: normalizeObject(source.trackedFile, context.trackedFile ?? null),
    versions: sortNewestFirst(versions.map(normalizeVersionRecord)),
    lastRestored: source.lastRestored ?? null,
    lastCheck: source.lastCheck ?? null
  };
}

function normalizeObject(value, fallback = null) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return fallback;
}

function normalizeVersionRecord(version = {}) {
  const source = version && typeof version === "object" ? version : {};
  return {
    ...source,
    note: normalizeVersionNote(source.note),
    contentHash: source.contentHash ?? null,
    contentSummary: source.contentSummary ?? null,
    contentSnapshot: source.contentSnapshot ?? null,
    changeSummary: source.changeSummary ?? null,
    zotero: normalizeObject(source.zotero, {})
  };
}

export class MetadataStore {
  constructor(platform) {
    this.platform = platform;
  }

  getMetadataDirectory(repoPath) {
    return this.platform.join(repoPath, ".git4zotero");
  }

  getMetadataPath(repoPath) {
    return this.platform.join(this.getMetadataDirectory(repoPath), "versions.json");
  }

  async read(repoPath) {
    const metadataPath = this.getMetadataPath(repoPath);
    if (!(await this.platform.exists(metadataPath))) {
      return createEmptyMetadata();
    }

    const raw = await this.platform.readText(metadataPath);
    const parsed = JSON.parse(raw);
    return migrateMetadata(parsed);
  }

  async write(repoPath, metadata) {
    await this.platform.makeDirectory(this.getMetadataDirectory(repoPath));
    const normalized = migrateMetadata(metadata);
    await this.platform.writeText(
      this.getMetadataPath(repoPath),
      `${JSON.stringify(normalized, null, 2)}\n`
    );
  }
}
