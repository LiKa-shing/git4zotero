import { PREFS, UI_TEXT } from "./constants.mjs";
import { buildTrackedFileName } from "./attachments.mjs";
import { ContentAnalyzer } from "./content-diff.mjs";
import { createVersionRecord, normalizeVersionNote, sortNewestFirst } from "./metadata.mjs";

export class VersionService {
  constructor({
    platform,
    attachmentFinder,
    gitBackend,
    metadataStore,
    pluginVersion,
    contentAnalyzer = null
  }) {
    this.platform = platform;
    this.attachmentFinder = attachmentFinder;
    this.gitBackend = gitBackend;
    this.metadataStore = metadataStore;
    this.pluginVersion = pluginVersion;
    this.contentAnalyzer = contentAnalyzer ?? new ContentAnalyzer({ platform });
  }

  async getPanelState(item) {
    const attachment = await this.attachmentFinder.findManageableAttachment(item);

    if (!attachment) {
      return { git: null, attachment: null, enabled: false, versions: [], lastCheck: null, workingTree: null };
    }

    const repoPath = this.platform.getRepoPath(attachment.libraryID, attachment.itemKey);
    const metadata = await this.metadataStore.read(repoPath);
    const enabled = this.isEnabled(metadata);

    if (!enabled) {
      return {
        git: null,
        attachment,
        repoPath,
        enabled: false,
        versions: [],
        lastCheck: metadata.lastCheck ?? null,
        workingTree: null
      };
    }

    const git = await this.gitBackend.checkAvailability();
    if (!git.available) {
      return {
        git,
        attachment,
        repoPath,
        enabled: true,
        versions: this.mergeHistoryWithMetadata([], metadata, attachment),
        lastCheck: metadata.lastCheck ?? null,
        workingTree: null
      };
    }

    const versions = await this.loadVersionHistory(repoPath, metadata, attachment);
    const workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    return {
      git,
      attachment,
      repoPath,
      enabled: true,
      versions,
      lastCheck: metadata.lastCheck ?? null,
      workingTree
    };
  }

  async getVersionHistory(item) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    await this.requireGitAvailable();
    return this.loadVersionHistory(repoPath, metadata, attachment);
  }

  async getRestoreCandidates(item) {
    return this.getVersionHistory(item);
  }

  async loadVersionHistory(repoPath, metadata, attachment) {
    const history = await this.gitBackend.listHistory(repoPath);
    return this.mergeHistoryWithMetadata(history, metadata, attachment);
  }

  async checkCurrentChange(item) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    const git = await this.requireGitAvailable();
    const previousVersion = this.getLatestVersion(metadata);
    const analysis = await this.contentAnalyzer.analyze(attachment.filePath, previousVersion);
    const trackedFile = await this.writeWorkingTreeSnapshot(attachment, repoPath);
    const workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    const lastCheck = this.createLastCheck({
      attachment,
      analysis,
      checkedAt: new Date().toISOString(),
      previousVersion,
      workingTree
    });

    await this.metadataStore.write(repoPath, {
      ...metadata,
      enabled: true,
      item: this.createItemMetadata(attachment),
      attachment: this.createAttachmentMetadata(attachment),
      trackedFile,
      lastCheck
    });

    return {
      attachment,
      repoPath,
      git,
      workingTree,
      lastCheck,
      previousVersion,
      ...analysis
    };
  }

  async createVersion(item, note, options = {}) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    const previousVersion = this.getLatestVersion(metadata);
    const analysis = await this.contentAnalyzer.analyze(attachment.filePath, previousVersion);

    if (!analysis.shouldCreateVersion && (options.kind ?? "manual") === "manual") {
      throw new Error(UI_TEXT.noChangesToSave);
    }

    const createdAt = new Date().toISOString();
    const normalizedNote = normalizeVersionNote(
      note,
      this.platform.getPref(PREFS.defaultVersionNote, UI_TEXT.defaultNote)
    );
    if (!(await this.platform.exists(attachment.filePath))) {
      throw new Error(`论文文件不存在：${attachment.filePath}`);
    }

    await this.requireGitAvailable();
    const trackedFile = await this.writeWorkingTreeSnapshot(attachment, repoPath);
    const { trackedRelativePath } = trackedFile;

    const commit = await this.gitBackend.commitSnapshot(repoPath, {
      note: normalizedNote,
      sourceFileName: attachment.fileName,
      trackedRelativePath,
      kind: options.kind ?? "manual",
      createdAt,
      changeSummary: analysis.changeSummary
    });

    const record = createVersionRecord({
      id: `${createdAt}-${commit.hash.slice(0, 8)}`,
      commitHash: commit.hash,
      createdAt,
      kind: options.kind ?? "manual",
      note: normalizedNote,
      fileName: attachment.fileName,
      fileHash: analysis.fileHash,
      fileSize: analysis.fileSize,
      contentHash: analysis.contentHash,
      contentSummary: analysis.contentSummary,
      contentSnapshot: toStoredSnapshot(analysis.contentSnapshot),
      changeSummary: analysis.changeSummary,
      trackedRelativePath,
      libraryID: attachment.libraryID,
      itemID: attachment.itemID,
      itemKey: attachment.itemKey,
      attachmentID: attachment.attachmentID,
      attachmentKey: attachment.attachmentKey,
      pluginVersion: this.pluginVersion
    });

    const workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    const lastCheck = this.createLastCheck({
      attachment,
      analysis,
      checkedAt: createdAt,
      previousVersion,
      workingTree
    });

    await this.metadataStore.write(repoPath, {
      ...metadata,
      enabled: true,
      item: this.createItemMetadata(attachment),
      attachment: this.createAttachmentMetadata(attachment),
      trackedFile,
      lastCheck,
      versions: [record, ...(metadata.versions ?? [])]
    });

    return record;
  }

  async restoreVersion(item, versionRecord) {
    const { attachment, repoPath } = await this.requireEnabledAttachment(item);
    const trackedRelativePath = this.normalizeTrackedRelativePath(versionRecord.trackedRelativePath);
    if (!trackedRelativePath) {
      throw new Error("历史版本缺少可恢复文件路径，无法恢复。");
    }
    const targetVersion = {
      ...versionRecord,
      shortHash: versionRecord.shortHash ?? String(versionRecord.commitHash ?? "").slice(0, 8),
      trackedRelativePath
    };
    const safetyEnabled = this.platform.getPref(PREFS.autoSafetyVersion, true);
    let safetyVersion = null;

    if (safetyEnabled) {
      safetyVersion = await this.createVersion(
        item,
        `${UI_TEXT.safetyNotePrefix}：${targetVersion.shortHash}`,
        { kind: "safety" }
      );
    }

    try {
      await this.gitBackend.checkoutTrackedFile(
        repoPath,
        targetVersion.commitHash,
        targetVersion.trackedRelativePath
      );
    }
    catch (error) {
      throw new Error(`无法恢复所选版本：${error.message || String(error)}`);
    }

    const sourcePath = this.pathFromRelative(repoPath, targetVersion.trackedRelativePath);
    await this.platform.copyFile(sourcePath, attachment.filePath);

    const metadata = await this.metadataStore.read(repoPath);
    const workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    await this.metadataStore.write(repoPath, {
      ...metadata,
      enabled: true,
      lastCheck: metadata.lastCheck
        ? { ...metadata.lastCheck, workingTree }
        : metadata.lastCheck,
      lastRestored: {
        commitHash: targetVersion.commitHash,
        restoredAt: new Date().toISOString(),
        attachmentPath: attachment.filePath
      }
    });

    return {
      attachment,
      restoredVersion: targetVersion,
      safetyVersion,
      workingTree
    };
  }

  async setVersionManagementEnabled(item, enabled) {
    const attachment = await this.requireAttachment(item);
    const repoPath = this.platform.getRepoPath(attachment.libraryID, attachment.itemKey);
    const metadata = await this.metadataStore.read(repoPath);
    await this.metadataStore.write(repoPath, {
      ...metadata,
      enabled,
      item: this.createItemMetadata(attachment),
      attachment: this.createAttachmentMetadata(attachment)
    });
    return { attachment, repoPath, enabled };
  }

  async enableVersionManagement(item) {
    return this.setVersionManagementEnabled(item, true);
  }

  async disableVersionManagement(item) {
    return this.setVersionManagementEnabled(item, false);
  }

  async requireAttachment(item) {
    const attachment = await this.attachmentFinder.findManageableAttachment(item);
    if (!attachment) {
      throw new Error(UI_TEXT.noDocument);
    }
    return attachment;
  }

  async requireEnabledAttachment(item) {
    const attachment = await this.requireAttachment(item);
    const repoPath = this.platform.getRepoPath(attachment.libraryID, attachment.itemKey);
    const metadata = await this.metadataStore.read(repoPath);
    if (!this.isEnabled(metadata)) {
      throw new Error(UI_TEXT.itemNotEnabledError);
    }
    return { attachment, repoPath, metadata };
  }

  isEnabled(metadata) {
    return metadata.enabled === true;
  }

  getLatestVersion(metadata) {
    return metadata.versions?.[0] ?? null;
  }

  async requireGitAvailable() {
    const git = await this.gitBackend.checkAvailability();
    if (!git.available) {
      throw new Error(`${UI_TEXT.gitUnavailable}：${git.error || git.detail || UI_TEXT.gitUnavailableDetail}`);
    }
    return git;
  }

  async writeWorkingTreeSnapshot(attachment, repoPath) {
    if (!(await this.platform.exists(attachment.filePath))) {
      throw new Error(`论文文件不存在：${attachment.filePath}`);
    }

    const trackedFileName = buildTrackedFileName(attachment.filePath);
    const trackedRelativePath = `tracked/${trackedFileName}`;
    const trackedPath = this.platform.join(repoPath, "tracked", trackedFileName);
    await this.gitBackend.ensureRepo(repoPath);
    await this.platform.copyFile(attachment.filePath, trackedPath);
    return { trackedRelativePath, trackedFileName };
  }

  createItemMetadata(attachment) {
    return {
      libraryID: attachment.libraryID,
      itemID: attachment.itemID,
      itemKey: attachment.itemKey
    };
  }

  createAttachmentMetadata(attachment) {
    return {
      attachmentID: attachment.attachmentID,
      attachmentKey: attachment.attachmentKey,
      fileName: attachment.fileName
    };
  }

  createLastCheck({ attachment, analysis, checkedAt, previousVersion, workingTree }) {
    return {
      checkedAt,
      fileName: attachment.fileName,
      fileHash: analysis.fileHash,
      fileSize: analysis.fileSize,
      contentHash: analysis.contentHash,
      contentSummary: analysis.contentSummary,
      changeSummary: analysis.changeSummary,
      previousVersionID: previousVersion?.id ?? null,
      previousCommitHash: previousVersion?.commitHash ?? null,
      workingTree
    };
  }

  pathFromRelative(basePath, relativePath) {
    return this.platform.join(basePath, ...relativePath.split("/"));
  }

  mergeHistoryWithMetadata(history, metadata, attachment) {
    const metadataVersionList = metadata.versions ?? [];
    const metadataVersions = new Map();
    for (const version of metadataVersionList) {
      if (version.commitHash) {
        metadataVersions.set(version.commitHash, version);
      }
    }

    const versions = [];
    const seenCommitHashes = new Set();
    for (const commit of history ?? []) {
      const knownVersion = metadataVersions.get(commit.hash);
      const version = knownVersion
        ? this.normalizeVersionCandidate(knownVersion, { metadata, attachment, commit, source: "metadata" })
        : this.versionFromCommit(commit, metadata, attachment);
      versions.push(version);
      if (version.commitHash) {
        seenCommitHashes.add(version.commitHash);
      }
    }

    for (const version of metadataVersionList) {
      if (version.commitHash && seenCommitHashes.has(version.commitHash)) {
        continue;
      }
      versions.push(this.normalizeVersionCandidate(version, { metadata, attachment, source: "metadata" }));
    }

    return sortNewestFirst(versions);
  }

  versionFromCommit(commit, metadata, attachment) {
    return this.normalizeVersionCandidate({}, {
      metadata,
      attachment,
      commit,
      source: "git"
    });
  }

  normalizeVersionCandidate(version, { metadata, attachment, commit = null, source }) {
    const commitHash = version.commitHash ?? commit?.hash ?? version.id ?? "";
    const trackedRelativePath = this.normalizeTrackedRelativePath(version.trackedRelativePath)
      || this.normalizeTrackedRelativePath(commit?.trackedRelativePath)
      || this.fallbackTrackedRelativePath(metadata, attachment);
    const fileName = version.fileName
      ?? commit?.sourceFileName
      ?? metadata.attachment?.fileName
      ?? attachment.fileName;

    return {
      ...version,
      id: version.id ?? commitHash,
      commitHash,
      shortHash: version.shortHash ?? commit?.shortHash ?? String(commitHash).slice(0, 8),
      createdAt: version.createdAt ?? commit?.createdAt ?? "",
      kind: this.normalizeKind(version.kind ?? commit?.kind),
      note: normalizeVersionNote(version.note ?? this.noteFromCommit(commit), UI_TEXT.defaultNote),
      fileName,
      fileHash: version.fileHash ?? "",
      fileSize: Number.isFinite(version.fileSize) ? version.fileSize : Number.NaN,
      contentHash: version.contentHash ?? null,
      contentSummary: version.contentSummary ?? null,
      contentSnapshot: version.contentSnapshot ?? null,
      changeSummary: this.normalizeChangeSummary(version.changeSummary ?? commit?.changeSummary),
      trackedRelativePath,
      zotero: version.zotero ?? {
        libraryID: attachment.libraryID,
        itemID: attachment.itemID,
        itemKey: attachment.itemKey,
        attachmentID: attachment.attachmentID,
        attachmentKey: attachment.attachmentKey
      },
      pluginVersion: version.pluginVersion ?? "unknown",
      source,
      author: version.author ?? commit?.author ?? ""
    };
  }

  noteFromCommit(commit) {
    return String(commit?.subject ?? "").replace(/^git4zotero:\s*/, "").trim();
  }

  normalizeChangeSummary(changeSummary) {
    if (!changeSummary) {
      return null;
    }
    if (typeof changeSummary === "string") {
      return { summary: changeSummary };
    }
    if (typeof changeSummary === "object") {
      return changeSummary;
    }
    return { summary: String(changeSummary) };
  }

  normalizeKind(kind) {
    return kind === "safety" ? "safety" : "manual";
  }

  fallbackTrackedRelativePath(metadata, attachment) {
    return this.normalizeTrackedRelativePath(metadata.trackedFile?.trackedRelativePath)
      || `tracked/${buildTrackedFileName(attachment.filePath)}`;
  }

  normalizeTrackedRelativePath(value) {
    let normalized = String(value ?? "").trim().replace(/\\/g, "/");
    while (normalized.startsWith("./")) {
      normalized = normalized.slice(2);
    }
    if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
      return "";
    }
    return normalized;
  }
}

function toStoredSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }
  return {
    paragraphs: snapshot.paragraphs,
    paragraphDetails: snapshot.paragraphDetails ?? null,
    paragraphCount: snapshot.paragraphCount,
    wordCount: snapshot.wordCount,
    sections: snapshot.sections
  };
}
