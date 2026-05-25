import { PREFS, UI_TEXT } from "./constants.mjs";
import { buildTrackedFileName, sanitizeForPath } from "./attachments.mjs";
import { ContentAnalyzer } from "./content-diff.mjs";
import { formatText } from "./localization.mjs";
import {
  createVersionRecord,
  METADATA_SCHEMA_VERSION,
  normalizeVersionNote,
  sortNewestFirst
} from "./metadata.mjs";

export class VersionService {
  constructor({
    platform,
    attachmentFinder,
    gitBackend,
    metadataStore,
    indexStore = null,
    pluginVersion,
    contentAnalyzer = null
  }) {
    this.platform = platform;
    this.attachmentFinder = attachmentFinder;
    this.gitBackend = gitBackend;
    this.metadataStore = metadataStore;
    this.indexStore = indexStore;
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
        workingTree: null,
        health: await this.buildRepositoryHealth({
          attachment,
          repoPath,
          metadata,
          git,
          versions: this.mergeHistoryWithMetadata([], metadata, attachment),
          workingTree: null
        })
      };
    }

    const versions = await this.loadVersionHistory(repoPath, metadata, attachment);
    const workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    const health = await this.buildRepositoryHealth({
      attachment,
      repoPath,
      metadata,
      git,
      versions,
      workingTree
    });
    return {
      git,
      attachment,
      repoPath,
      enabled: true,
      versions,
      lastCheck: metadata.lastCheck ?? null,
      workingTree,
      health
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

  async exportVersionSummary(item, options = {}) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    const scope = options.scope === "last-check" ? "last-check" : "history";
    const format = options.format === "text" ? "text" : "markdown";
    const extension = format === "markdown" ? ".md" : ".txt";
    let versions = [];
    let lastCheck = metadata.lastCheck ?? null;

    if (scope === "history") {
      await this.requireGitAvailable();
      versions = await this.loadVersionHistory(repoPath, metadata, attachment);
    }
    else if (!lastCheck) {
      throw new Error(UI_TEXT.exportNoLastCheck);
    }

    const content = format === "markdown"
      ? renderMarkdownExport({ scope, attachment, versions, lastCheck })
      : renderTextExport({ scope, attachment, versions, lastCheck });
    const defaultFileName = buildExportFileName(attachment, scope, extension);
    const path = await this.platform.saveTextFile({
      title: UI_TEXT.menuExportSummary,
      defaultFileName,
      content
    });
    if (!path) {
      return null;
    }
    return { path, scope, format, fileName: defaultFileName };
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
    await this.recordRepositoryIndex(attachment, true);

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
      throw new Error(formatText("fileDoesNotExist", { path: attachment.filePath }));
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
    await this.recordRepositoryIndex(attachment, true);

    return record;
  }

  async restoreVersion(item, versionRecord) {
    const { attachment, repoPath } = await this.requireEnabledAttachment(item);
    const trackedRelativePath = this.normalizeTrackedRelativePath(versionRecord.trackedRelativePath);
    if (!trackedRelativePath) {
      throw new Error(UI_TEXT.missingRestorePath);
    }
    const targetVersion = {
      ...versionRecord,
      shortHash: versionRecord.shortHash ?? String(versionRecord.commitHash ?? "").slice(0, 8),
      trackedRelativePath
    };
    await this.validateAttachmentBeforeRestore(attachment);
    await this.requireGitAvailable();
    const safetyEnabled = this.platform.getPref(PREFS.autoSafetyVersion, true);
    let safetyVersion = null;

    if (safetyEnabled) {
      safetyVersion = await this.createVersion(
        item,
        `${UI_TEXT.safetyNotePrefix}${UI_TEXT.colon}${targetVersion.shortHash}`,
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
      throw new Error(formatText("restoreCannotRestore", { reason: error.message || String(error) }));
    }

    const sourcePath = this.pathFromRelative(repoPath, targetVersion.trackedRelativePath);
    const restoreResult = await this.restoreFileWithRollback({
      attachment,
      repoPath,
      sourcePath,
      targetVersion
    });

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
        attachmentPath: attachment.filePath,
        restoredFileHash: restoreResult.restoredFileHash,
        backupPath: restoreResult.backupPath
      }
    });
    await this.recordRepositoryIndex(attachment, true);

    return {
      attachment,
      restoredVersion: targetVersion,
      safetyVersion,
      workingTree,
      backupPath: restoreResult.backupPath,
      restoredFileHash: restoreResult.restoredFileHash
    };
  }

  async checkRepositoryHealth(item) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    const git = await this.gitBackend.checkAvailability();
    let versions = this.mergeHistoryWithMetadata([], metadata, attachment);
    let workingTree = null;
    if (git.available) {
      versions = await this.loadVersionHistory(repoPath, metadata, attachment);
      workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    }
    return this.buildRepositoryHealth({ attachment, repoPath, metadata, git, versions, workingTree });
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
    await this.recordRepositoryIndex(attachment, enabled);
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
      throw new Error(`${UI_TEXT.gitUnavailable}${UI_TEXT.colon}${git.error || git.detail || UI_TEXT.gitUnavailableDetail}`);
    }
    return git;
  }

  async writeWorkingTreeSnapshot(attachment, repoPath) {
    if (!(await this.platform.exists(attachment.filePath))) {
      throw new Error(formatText("fileDoesNotExist", { path: attachment.filePath }));
    }

    const trackedFileName = buildTrackedFileName(attachment.filePath);
    const trackedRelativePath = `tracked/${trackedFileName}`;
    const trackedPath = this.platform.join(repoPath, "tracked", trackedFileName);
    await this.gitBackend.ensureRepo(repoPath);
    await this.platform.copyFile(attachment.filePath, trackedPath);
    return { trackedRelativePath, trackedFileName };
  }

  async validateAttachmentBeforeRestore(attachment) {
    if (!(await this.safeExists(attachment.filePath))) {
      throw new Error(UI_TEXT.restorePreflightMissing);
    }

    try {
      await this.platform.hashFile(attachment.filePath);
      await this.platform.stat(attachment.filePath);
    }
    catch (error) {
      throw new Error(`${UI_TEXT.restorePreflightUnreadable} ${error.message || String(error)}`);
    }

    const probePath = `${attachment.filePath}.git4zotero-write-test-${Date.now()}.tmp`;
    try {
      await this.platform.writeText(probePath, "git4zotero restore preflight");
    }
    catch (error) {
      throw new Error(`${UI_TEXT.restorePreflightUnwritable} ${error.message || String(error)}`);
    }
    finally {
      await this.removeFileQuietly(probePath);
    }
  }

  async restoreFileWithRollback({ attachment, repoPath, sourcePath, targetVersion }) {
    if (!(await this.safeExists(sourcePath))) {
      throw new Error(formatText("restoreSourceMissing", { path: sourcePath }));
    }

    const sourceHash = await this.platform.hashFile(sourcePath);
    const stamp = `${Date.now()}-${sanitizeForPath(targetVersion.shortHash || "version")}`;
    const safeFileName = sanitizeForPath(attachment.fileName);
    const restoreDir = this.joinPath(repoPath, ".git4zotero", "restore-backups");
    const backupPath = this.joinPath(restoreDir, `${stamp}-current-${safeFileName}`);
    const stagedPath = this.joinPath(restoreDir, `${stamp}-restore-${safeFileName}`);

    await this.platform.copyFile(attachment.filePath, backupPath);
    await this.platform.copyFile(sourcePath, stagedPath);

    try {
      const stagedHash = await this.platform.hashFile(stagedPath);
      if (stagedHash !== sourceHash) {
        throw new Error(UI_TEXT.restoreStagingHashMismatch);
      }
      await this.platform.copyFile(stagedPath, attachment.filePath);
      const restoredHash = await this.platform.hashFile(attachment.filePath);
      if (restoredHash !== sourceHash) {
        await this.rollbackRestoredFile(backupPath, attachment.filePath);
        throw new Error(UI_TEXT.restoreHashMismatch);
      }
      return {
        backupPath,
        restoredFileHash: restoredHash
      };
    }
    catch (error) {
      await this.rollbackRestoredFile(backupPath, attachment.filePath);
      throw new Error(formatText("restoreFailedWithBackupPath", {
        message: UI_TEXT.restoreFailedWithBackup,
        path: backupPath,
        reason: error.message || String(error)
      }));
    }
    finally {
      await this.removeFileQuietly(stagedPath);
    }
  }

  async rollbackRestoredFile(backupPath, targetPath) {
    try {
      if (await this.safeExists(backupPath)) {
        await this.platform.copyFile(backupPath, targetPath);
      }
    }
    catch (error) {
      this.platform.Zotero?.debug?.(`git4zotero: restore rollback failed: ${error?.stack || error}`);
    }
  }

  async removeFileQuietly(path) {
    try {
      if (typeof this.platform.removeFile === "function") {
        await this.platform.removeFile(path);
      }
    }
    catch (error) {
      this.platform.Zotero?.debug?.(`git4zotero: temporary file cleanup failed: ${error?.stack || error}`);
    }
  }

  async recordRepositoryIndex(attachment, enabled) {
    if (!this.indexStore?.upsertAttachment) {
      return;
    }
    try {
      await this.indexStore.upsertAttachment(attachment, { enabled });
    }
    catch (error) {
      this.platform.Zotero?.debug?.(`git4zotero: repository index update failed: ${error?.stack || error}`);
    }
  }

  async buildRepositoryHealth({ attachment, repoPath, metadata, git, versions, workingTree }) {
    const checks = [];
    const add = (id, label, status, detail = "") => {
      checks.push({ id, label, status, detail });
    };

    add(
      "attachment",
      UI_TEXT.currentAttachment,
      await this.safeExists(attachment.filePath) ? "ok" : "error",
      await this.safeExists(attachment.filePath) ? attachment.fileName : UI_TEXT.currentFileMissing
    );

    const metadataVersions = Array.isArray(metadata.versions) ? metadata.versions : [];
    add(
      "metadata",
      UI_TEXT.metadataFile,
      Array.isArray(metadata.versions) ? "ok" : "error",
      Array.isArray(metadata.versions)
        ? formatText("metadataRecordCount", { schema: metadata.schemaVersion ?? UI_TEXT.unknown, count: metadataVersions.length })
        : UI_TEXT.metadataVersionsInvalid
    );

    if ((metadata.schemaVersion ?? 1) !== METADATA_SCHEMA_VERSION) {
      add(
        "metadata-schema",
        UI_TEXT.metadataVersions,
        "warning",
        formatText("metadataWillUpgrade", { current: metadata.schemaVersion ?? UI_TEXT.unknown, next: METADATA_SCHEMA_VERSION })
      );
    }

    add(
      "git",
      "Git",
      git?.available ? "ok" : "error",
      git?.detail || git?.error || UI_TEXT.gitUnavailableDetail
    );

    const gitDirExists = await this.safeExists(this.joinPath(repoPath, ".git"));
    add(
      "git-repo",
      UI_TEXT.gitRepository,
      gitDirExists ? "ok" : (metadataVersions.length ? "error" : "warning"),
      gitDirExists ? UI_TEXT.repositoryInitialized : UI_TEXT.repositoryGitDirMissing
    );

    const invalidTrackedVersions = metadataVersions.filter((version) => {
      return version.trackedRelativePath && !this.normalizeTrackedRelativePath(version.trackedRelativePath);
    });
    if (invalidTrackedVersions.length) {
      add(
        "tracked-paths",
        UI_TEXT.historyFilePath,
        "error",
        formatText("invalidTrackedVersions", { count: invalidTrackedVersions.length })
      );
    }

    const trackedRelativePath = this.normalizeTrackedRelativePath(metadata.trackedFile?.trackedRelativePath)
      || this.fallbackTrackedRelativePath(metadata, attachment);
    const trackedPath = this.pathFromRelative(repoPath, trackedRelativePath);
    const trackedExists = await this.safeExists(trackedPath);
    add(
      "tracked-file",
      UI_TEXT.currentTrackedFile,
      trackedExists || !metadataVersions.length ? "ok" : "warning",
      trackedExists ? trackedRelativePath : UI_TEXT.trackedFileMissing
    );

    if (workingTree) {
      add(
        "working-tree",
        UI_TEXT.workingTree,
        workingTree.clean ? "ok" : "warning",
        workingTree.summary || UI_TEXT.workingTreeClean
      );
    }

    if ((versions?.length ?? 0) < metadataVersions.length) {
      add(
        "history",
        UI_TEXT.versionHistoryHealth,
        "warning",
        formatText("versionHistoryHealthDetail", { visibleCount: versions?.length ?? 0, metadataCount: metadataVersions.length })
      );
    }

    const errorCount = checks.filter((check) => check.status === "error").length;
    const warningCount = checks.filter((check) => check.status === "warning").length;
    return {
      ok: errorCount === 0,
      errorCount,
      warningCount,
      checks,
      summary: errorCount
        ? UI_TEXT.repositoryHealthError
        : (warningCount ? UI_TEXT.repositoryHealthWarning : UI_TEXT.repositoryHealthOk)
    };
  }

  async safeExists(path) {
    try {
      return !!(path && await this.platform.exists(path));
    }
    catch (_error) {
      return false;
    }
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
    return this.joinPath(basePath, ...relativePath.split("/"));
  }

  joinPath(basePath, ...parts) {
    if (typeof this.platform.join === "function") {
      return this.platform.join(basePath, ...parts);
    }
    return [basePath, ...parts].join("/");
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

function buildExportFileName(attachment, scope, extension) {
  const key = sanitizeForPath(attachment.itemKey || attachment.attachmentKey || "item") || "item";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const kind = scope === "last-check" ? "diff" : "history";
  return `git4zotero-${kind}-${key}-${timestamp}${extension}`;
}

function renderMarkdownExport({ scope, attachment, versions, lastCheck }) {
  const lines = [
    `# git4zotero ${scope === "last-check" ? UI_TEXT.exportTitleLastCheck : UI_TEXT.exportTitleHistory}`,
    "",
    `- ${UI_TEXT.exportFieldFile}${UI_TEXT.colon}${attachment.fileName}`,
    `- ${UI_TEXT.exportFieldItem}${UI_TEXT.colon}${attachment.itemKey || UI_TEXT.unknown}`,
    `- ${UI_TEXT.exportFieldExportedAt}${UI_TEXT.colon}${new Date().toISOString()}`,
    ""
  ];
  if (scope === "last-check") {
    lines.push(...renderMarkdownCheck(lastCheck));
  }
  else if (!versions.length) {
    lines.push(UI_TEXT.exportNoVersions);
  }
  else {
    for (const version of versions) {
      lines.push(...renderMarkdownVersion(version), "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderMarkdownCheck(lastCheck) {
  return [
    `## ${UI_TEXT.exportRecentCheck}`,
    "",
    `- ${UI_TEXT.exportFieldTime}${UI_TEXT.colon}${lastCheck.checkedAt || UI_TEXT.unknown}`,
    `- ${UI_TEXT.exportFieldFile}${UI_TEXT.colon}${lastCheck.fileName || UI_TEXT.unknown}`,
    `- ${UI_TEXT.exportFieldSize}${UI_TEXT.colon}${formatByteSize(lastCheck.fileSize)}`,
    `- ${UI_TEXT.exportFieldSummary}${UI_TEXT.colon}${lastCheck.changeSummary?.summary || UI_TEXT.actionCompleted}`,
    "",
    ...renderMarkdownChangeSummary(lastCheck.changeSummary)
  ];
}

function renderMarkdownVersion(version) {
  return [
    `## ${version.note || UI_TEXT.defaultNote}`,
    "",
    `- ${UI_TEXT.exportFieldTime}${UI_TEXT.colon}${version.createdAt || UI_TEXT.unknown}`,
    `- Hash${UI_TEXT.colon}${version.commitHash || version.id || UI_TEXT.unknown}`,
    `- ${UI_TEXT.exportFieldFile}${UI_TEXT.colon}${version.fileName || UI_TEXT.unknown}`,
    `- ${UI_TEXT.exportFieldSize}${UI_TEXT.colon}${formatByteSize(version.fileSize)}`,
    `- ${UI_TEXT.exportFieldType}${UI_TEXT.colon}${formatVersionKind(version)}`,
    `- ${UI_TEXT.safetyBackupLabel}${UI_TEXT.colon}${version.kind === "safety" ? UI_TEXT.yes : UI_TEXT.no}`,
    `- ${UI_TEXT.exportFieldSummary}${UI_TEXT.colon}${version.changeSummary?.summary || UI_TEXT.actionCompleted}`,
    "",
    ...renderMarkdownChangeSummary(version.changeSummary)
  ];
}

function renderMarkdownChangeSummary(changeSummary) {
  if (!changeSummary) {
    return [];
  }
  if (changeSummary.changeGroups?.length) {
    const lines = [`### ${UI_TEXT.exportLocationSummary}`, ""];
    for (const group of changeSummary.changeGroups) {
      lines.push(`- ${group.summary || group.label}`);
    }
    lines.push("");
    for (const group of changeSummary.changeGroups) {
      lines.push(`### ${group.label}`, "");
      for (const change of group.changes ?? []) {
        lines.push(`- ${formatParagraphChange(change)}`);
      }
      lines.push("");
    }
    return lines;
  }
  const changes = changeSummary.paragraphChanges ?? changeSummary.displayChanges ?? [];
  if (!changes.length) {
    return [];
  }
  return [
    `### ${UI_TEXT.concreteChanges}`,
    "",
    ...changes.map((change) => `- ${formatParagraphChange(change)}`)
  ];
}

function renderTextExport({ scope, attachment, versions, lastCheck }) {
  const lines = [
    `git4zotero ${scope === "last-check" ? UI_TEXT.exportTitleLastCheck : UI_TEXT.exportTitleHistory}`,
    "",
    `${UI_TEXT.exportFieldFile}${UI_TEXT.colon}${attachment.fileName}`,
    `${UI_TEXT.exportFieldItem}${UI_TEXT.colon}${attachment.itemKey || UI_TEXT.unknown}`,
    `${UI_TEXT.exportFieldExportedAt}${UI_TEXT.colon}${new Date().toISOString()}`,
    ""
  ];
  if (scope === "last-check") {
    lines.push(...renderTextCheck(lastCheck));
  }
  else if (!versions.length) {
    lines.push(UI_TEXT.exportNoVersions);
  }
  else {
    for (const version of versions) {
      lines.push(...renderTextVersion(version), "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderTextCheck(lastCheck) {
  return [
    UI_TEXT.exportRecentCheck,
    `${UI_TEXT.exportFieldTime}${UI_TEXT.colon}${lastCheck.checkedAt || UI_TEXT.unknown}`,
    `${UI_TEXT.exportFieldFile}${UI_TEXT.colon}${lastCheck.fileName || UI_TEXT.unknown}`,
    `${UI_TEXT.exportFieldSize}${UI_TEXT.colon}${formatByteSize(lastCheck.fileSize)}`,
    `${UI_TEXT.exportFieldSummary}${UI_TEXT.colon}${lastCheck.changeSummary?.summary || UI_TEXT.actionCompleted}`,
    "",
    ...renderTextChangeSummary(lastCheck.changeSummary)
  ];
}

function renderTextVersion(version) {
  return [
    version.note || UI_TEXT.defaultNote,
    `${UI_TEXT.exportFieldTime}${UI_TEXT.colon}${version.createdAt || UI_TEXT.unknown}`,
    `Hash${UI_TEXT.colon}${version.commitHash || version.id || UI_TEXT.unknown}`,
    `${UI_TEXT.exportFieldFile}${UI_TEXT.colon}${version.fileName || UI_TEXT.unknown}`,
    `${UI_TEXT.exportFieldSize}${UI_TEXT.colon}${formatByteSize(version.fileSize)}`,
    `${UI_TEXT.exportFieldType}${UI_TEXT.colon}${formatVersionKind(version)}`,
    `${UI_TEXT.safetyBackupLabel}${UI_TEXT.colon}${version.kind === "safety" ? UI_TEXT.yes : UI_TEXT.no}`,
    `${UI_TEXT.exportFieldSummary}${UI_TEXT.colon}${version.changeSummary?.summary || UI_TEXT.actionCompleted}`,
    "",
    ...renderTextChangeSummary(version.changeSummary)
  ];
}

function renderTextChangeSummary(changeSummary) {
  if (!changeSummary) {
    return [];
  }
  if (changeSummary.changeGroups?.length) {
    const lines = [UI_TEXT.exportLocationSummary];
    for (const group of changeSummary.changeGroups) {
      lines.push(`- ${group.summary || group.label}`);
    }
    for (const group of changeSummary.changeGroups) {
      lines.push("", group.label);
      for (const change of group.changes ?? []) {
        lines.push(`- ${formatParagraphChange(change)}`);
      }
    }
    return lines;
  }
  const changes = changeSummary.paragraphChanges ?? changeSummary.displayChanges ?? [];
  return changes.length
    ? [UI_TEXT.concreteChanges, ...changes.map((change) => `- ${formatParagraphChange(change)}`)]
    : [];
}

function formatParagraphChange(change) {
  const location = change.locationLabel ? `${change.locationLabel}${UI_TEXT.colon}` : "";
  if (change.type === "added") {
    return `${location}${UI_TEXT.changeAdded}${UI_TEXT.colon}${change.newText || ""}`;
  }
  if (change.type === "deleted") {
    return `${location}${UI_TEXT.changeDeleted}${UI_TEXT.colon}${change.oldText || ""}`;
  }
  if (change.type === "modified") {
    return `${location}${UI_TEXT.changeKindModified}${UI_TEXT.colon}${change.oldText || ""} -> ${change.newText || ""}`;
  }
  return `${location}${change.newText || change.oldText || UI_TEXT.actionCompleted}`;
}

function formatVersionKind(version) {
  if (version.kind === "safety") {
    return UI_TEXT.versionKindSafetyFull;
  }
  if (version.source === "git") {
    return UI_TEXT.versionKindGit;
  }
  return UI_TEXT.versionKindManualFull;
}

function formatByteSize(size) {
  if (!Number.isFinite(size)) {
    return UI_TEXT.exportUnknownSize;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
