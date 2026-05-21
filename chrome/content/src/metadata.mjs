export const METADATA_SCHEMA_VERSION = 3;

export function normalizeVersionNote(note, fallback = "论文版本") {
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
    return {
      ...createEmptyMetadata(),
      ...parsed,
      enabled: typeof parsed.enabled === "boolean"
        ? parsed.enabled
        : (parsed.versions?.length ?? 0) > 0,
      schemaVersion: parsed.schemaVersion ?? 1,
      versions: sortNewestFirst(parsed.versions ?? [])
    };
  }

  async write(repoPath, metadata) {
    await this.platform.makeDirectory(this.getMetadataDirectory(repoPath));
    const normalized = {
      ...createEmptyMetadata(),
      ...metadata,
      schemaVersion: METADATA_SCHEMA_VERSION,
      versions: sortNewestFirst(metadata.versions ?? [])
    };
    await this.platform.writeText(
      this.getMetadataPath(repoPath),
      `${JSON.stringify(normalized, null, 2)}\n`
    );
  }
}
