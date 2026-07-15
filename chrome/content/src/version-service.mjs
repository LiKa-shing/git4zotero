import { PREFS, UI_TEXT } from "./constants.mjs";
import { buildTrackedFileName, sanitizeForPath } from "./attachments.mjs";
import { ContentAnalyzer, summarizeDocxChange } from "./content-diff.mjs";
import { DiffStore } from "./diff-store.mjs";
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
    contentAnalyzer = null,
    diffStore = null
  }) {
    this.platform = platform;
    this.attachmentFinder = attachmentFinder;
    this.gitBackend = gitBackend;
    this.metadataStore = metadataStore;
    this.indexStore = indexStore;
    this.pluginVersion = pluginVersion;
    this.contentAnalyzer = contentAnalyzer ?? new ContentAnalyzer({ platform });
    this.diffStore = diffStore ?? new DiffStore(platform);
  }

  async getPanelState(item) {
    const attachment = await this.attachmentFinder.findManageableAttachment(item);

    if (!attachment) {
      return { git: null, attachment: null, enabled: false, versions: [], lastCheck: null, workingTree: null };
    }

    const repoPath = this.platform.getRepoPath(attachment.libraryID, attachment.itemKey);
    const metadata = await this.metadataStore.read(repoPath);
    const enabled = this.isEnabled(metadata);
    const panelLastCheck = metadata.lastCheck ? {
      ...metadata.lastCheck,
      id: `check-${metadata.lastCheck.checkedAt || "current"}`,
      createdAt: metadata.lastCheck.checkedAt,
      note: UI_TEXT.lastCheck,
      repoPath
    } : null;

    if (!enabled) {
      return {
        git: null,
        attachment,
        repoPath,
        enabled: false,
        versions: [],
        lastCheck: panelLastCheck,
        workingTree: null
      };
    }

    const git = await this.gitBackend.checkAvailability();
    if (!git.available) {
      const offlineVersions = this.mergeHistoryWithMetadata([], metadata, attachment)
        .map((version) => ({ ...version, repoPath }));
      return {
        git,
        attachment,
        repoPath,
        enabled: true,
        versions: offlineVersions,
        lastCheck: panelLastCheck,
        workingTree: null,
        health: await this.buildRepositoryHealth({
          attachment,
          repoPath,
          metadata,
          git,
          versions: offlineVersions,
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
      lastCheck: panelLastCheck,
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
      content,
      initialDirectory: options.initialDirectory || ""
    });
    if (!path) {
      return null;
    }
    return { path, scope, format, fileName: defaultFileName };
  }

  formatSingleVersionSummaryMarkdown(version) {
    return renderMarkdownSingleVersion(version);
  }

  async exportSingleVersionSummary(version, options = {}) {
    const content = await this.buildCompleteVersionMarkdownForVersion(version, options.filters);
    const defaultFileName = buildSingleVersionExportFileName(version, ".md");
    const path = await this.platform.saveTextFile({
      title: UI_TEXT.versionDetailExport,
      defaultFileName,
      content,
      initialDirectory: options.initialDirectory || ""
    });
    if (!path) {
      return null;
    }
    return { path, format: "markdown", fileName: defaultFileName };
  }

  async getVersionDiffIndex(item, version, options = {}) {
    const context = await this.resolveDiffContext(item, version);
    let target = context.version;
    if (target?.diffRef?.status === "complete") {
      try {
        return await this.diffStore.readIndex(context.repoPath, target.diffRef);
      }
      catch (error) {
        this.platform.Zotero?.debug?.(`git4zotero: saved diff index unavailable: ${error?.stack || error}`);
        if (options.rebuild === false) {
          throw error;
        }
      }
    }
    if (options.rebuild === false) {
      return createLegacyDiffIndex(target);
    }
    const rebuilt = await this.rebuildVersionDiff(context.repoPath, context.metadata, target);
    target = rebuilt.version;
    return rebuilt.index;
  }

  async loadVersionDiffPage(item, version, options = {}) {
    const context = await this.resolveDiffContext(item, version);
    const index = await this.getVersionDiffIndex({ repoPath: context.repoPath, metadata: context.metadata }, context.version, { rebuild: options.rebuild !== false });
    if (index.legacy) {
      const group = index.groups.find((candidate) => candidate.id === options.groupID) || index.groups[0] || null;
      return { group, page: 1, pageCount: group ? 1 : 0, totalChanges: group?.totalChanges ?? 0, changes: group?.changes ?? [] };
    }
    return this.diffStore.loadPage(context.repoPath, index, options);
  }

  async searchVersionDiff(item, version, options = {}) {
    const context = await this.resolveDiffContext(item, version);
    const index = await this.getVersionDiffIndex({ repoPath: context.repoPath, metadata: context.metadata }, context.version, { rebuild: options.rebuild !== false });
    if (index.legacy) {
      return searchLegacyDiff(index, options);
    }
    return this.diffStore.search(context.repoPath, index, options);
  }

  async buildCompleteVersionMarkdown(item, version, filters = {}) {
    const context = await this.resolveDiffContext(item, version);
    let changes = [];
    try {
      const index = await this.getVersionDiffIndex({ repoPath: context.repoPath, metadata: context.metadata }, context.version, { rebuild: filters.rebuild !== false });
      if (index.legacy) {
        changes = index.groups.flatMap((group) => group.changes ?? []);
      }
      else {
        changes = (await this.diffStore.loadAll(context.repoPath, index)).changes;
      }
    }
    catch (error) {
      this.platform.Zotero?.debug?.(`git4zotero: complete markdown fell back to summary: ${error?.stack || error}`);
    }
    const typeSet = new Set((filters.types ?? []).filter(Boolean));
    const query = String(filters.query ?? "").trim().toLocaleLowerCase();
    const filtered = changes.filter((change) => {
      if (filters.groupID && change.groupID !== filters.groupID) {
        return false;
      }
      if (typeSet.size && !typeSet.has(change.type)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return `${change.oldText || ""}\n${change.newText || ""}\n${change.locationLabel || ""}`.toLocaleLowerCase().includes(query);
    });
    return renderMarkdownSingleVersion(context.version, filtered);
  }

  async buildCompleteVersionMarkdownForVersion(version, filters = {}) {
    if (!version?.repoPath) {
      return this.formatSingleVersionSummaryMarkdown(version);
    }
    return this.buildCompleteVersionMarkdown({ repoPath: version.repoPath }, version, filters);
  }

  async resolveDiffContext(item, version) {
    if (item?.repoPath) {
      const metadata = item.metadata ?? await this.metadataStore.read(item.repoPath);
      const target = findMetadataVersion(metadata, version) || version;
      return { repoPath: item.repoPath, metadata, version: { ...target, repoPath: item.repoPath } };
    }
    const { repoPath, metadata } = await this.requireEnabledAttachment(item);
    const target = findMetadataVersion(metadata, version) || version;
    return { repoPath, metadata, version: { ...target, repoPath } };
  }

  async rebuildVersionDiff(repoPath, metadata, version) {
    const versions = metadata.versions ?? [];
    const index = versions.findIndex((candidate) => sameVersion(candidate, version));
    const target = index >= 0 ? versions[index] : version;
    const previous = index >= 0 ? versions[index + 1] ?? null : null;
    if (!target?.contentSnapshot) {
      return { version: target, index: createLegacyDiffIndex(target) };
    }
    const changeSummary = summarizeDocxChange({
      current: target.contentSnapshot,
      currentContentHash: target.contentHash,
      previousVersion: previous,
      fileChanged: true
    });
    const completeDiff = completeDiffFromSummary(changeSummary, previous);
    if (!completeDiff || !target.commitHash) {
      return { version: target, index: createLegacyDiffIndex({ ...target, changeSummary: compactChangeSummary(changeSummary) }) };
    }
    const diffRef = await this.diffStore.writeVersionDiff(repoPath, target.commitHash, completeDiff);
    const updatedVersion = { ...target, changeSummary: compactChangeSummary(changeSummary), diffRef };
    if (index >= 0) {
      const updatedVersions = [...versions];
      updatedVersions[index] = updatedVersion;
      await this.metadataStore.write(repoPath, { ...metadata, versions: updatedVersions });
    }
    return { version: { ...updatedVersion, repoPath }, index: await this.diffStore.readIndex(repoPath, diffRef) };
  }

  async loadVersionHistory(repoPath, metadata, attachment) {
    const history = await this.gitBackend.listHistory(repoPath);
    return this.mergeHistoryWithMetadata(history, metadata, attachment)
      .map((version) => ({ ...version, repoPath }));
  }

  async checkCurrentChange(item) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    const git = await this.requireGitAvailable();
    const previousVersion = this.getLatestVersion(metadata);
    const analysis = await this.contentAnalyzer.analyze(attachment.filePath, previousVersion, { repoPath });
    const trackedFile = await this.writeWorkingTreeSnapshot(attachment, repoPath, analysis.fileBytes);
    const workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    const diffRef = await this.storeCurrentDiff(repoPath, analysis, previousVersion);
    const lastCheck = this.createLastCheck({
      attachment,
      analysis,
      checkedAt: new Date().toISOString(),
      previousVersion,
      workingTree,
      diffRef
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

  async buildCreateVersionPreview(item) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    const git = await this.requireGitAvailable();
    const previousVersion = this.getLatestVersion(metadata);
    const analysis = await this.contentAnalyzer.analyze(attachment.filePath, previousVersion, { repoPath });
    let workingTree = null;
    try {
      workingTree = await this.gitBackend.getWorkingTreeStatus(repoPath);
    }
    catch (error) {
      workingTree = { clean: false, entries: [], summary: error.message || String(error) };
    }
    return {
      attachment,
      repoPath,
      git,
      previousVersion,
      workingTree,
      trackingMode: attachment.extension === ".docx" ? UI_TEXT.contentModeDocx : UI_TEXT.contentModeFileOnly,
      ...analysis
    };
  }

  async createVersion(item, note, options = {}) {
    const { attachment, repoPath, metadata } = await this.requireEnabledAttachment(item);
    const previousVersion = this.getLatestVersion(metadata);
    const analysis = await this.contentAnalyzer.analyze(attachment.filePath, previousVersion, { repoPath });

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
    const trackedFile = await this.writeWorkingTreeSnapshot(attachment, repoPath, analysis.fileBytes);
    const { trackedRelativePath } = trackedFile;

    const commit = await this.gitBackend.commitSnapshot(repoPath, {
      note: normalizedNote,
      sourceFileName: attachment.fileName,
      trackedRelativePath,
      kind: options.kind ?? "manual",
      createdAt,
      changeSummary: compactChangeSummary(analysis.changeSummary)
    });

    const diffRef = await this.storeVersionDiff(repoPath, commit.hash, analysis, previousVersion);

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
      changeSummary: compactChangeSummary(analysis.changeSummary),
      diffRef,
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
      workingTree,
      diffRef
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
    this.contentAnalyzer.invalidate?.(repoPath);

    return { ...record, repoPath };
  }

  async buildRestorePreflight(item, versionRecord, options = {}) {
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
    const paths = this.createRestorePaths({ attachment, repoPath, targetVersion, stamp: options.stamp });
    const checks = [];
    const add = (id, label, status, detail = "") => checks.push({ id, label, status, detail });
    let currentFileHash = "";

    if (!(await this.safeExists(attachment.filePath))) {
      add("current-file", UI_TEXT.currentFile, "error", UI_TEXT.restorePreflightMissing);
    }
    else {
      try {
        currentFileHash = await this.platform.hashFile(attachment.filePath);
        await this.platform.stat(attachment.filePath);
        add("current-file", UI_TEXT.currentFile, "ok", `${attachment.fileName}${UI_TEXT.colon}${currentFileHash}`);
      }
      catch (error) {
        add("current-file", UI_TEXT.currentFile, "error", `${UI_TEXT.restorePreflightUnreadable} ${error.message || String(error)}`);
      }
    }

    const probePath = `${attachment.filePath}.git4zotero-write-test-${Date.now()}.tmp`;
    try {
      await this.platform.writeText(probePath, "git4zotero restore preflight");
      add("writable", UI_TEXT.restorePreflightWritable, "ok", this.dirname(attachment.filePath));
    }
    catch (error) {
      add("writable", UI_TEXT.restorePreflightWritable, "error", `${UI_TEXT.restorePreflightUnwritable} ${error.message || String(error)}`);
    }
    finally {
      await this.removeFileQuietly(probePath);
    }

    const git = await this.gitBackend.checkAvailability();
    add("git", "Git", git.available ? "ok" : "error", git.detail || git.error || UI_TEXT.gitUnavailableDetail);

    try {
      const gitDir = this.joinPath(repoPath, ".git");
      add("git-repo", UI_TEXT.gitRepository, await this.safeExists(gitDir) ? "ok" : "error", await this.safeExists(gitDir) ? UI_TEXT.repositoryInitialized : UI_TEXT.repositoryGitDirMissing);
      const workingTree = git.available ? await this.gitBackend.getWorkingTreeStatus(repoPath) : null;
      if (workingTree) {
        add("working-tree", UI_TEXT.workingTree, workingTree.clean ? "ok" : "warning", workingTree.summary || UI_TEXT.workingTreeClean);
      }
    }
    catch (error) {
      add("working-tree", UI_TEXT.workingTree, "error", `${UI_TEXT.gitStatusFailed} ${error.message || String(error)}`);
    }

    if (!targetVersion.fileHash) {
      add("target-hash", UI_TEXT.restoreTargetHash, "warning", UI_TEXT.restoreTargetHashUnknown);
    }
    else {
      add("target-hash", UI_TEXT.restoreTargetHash, "ok", targetVersion.fileHash);
    }

    add("backup-path", UI_TEXT.backupPathLabel, "ok", paths.backupPath);
    const errorCount = checks.filter((check) => check.status === "error").length;
    const warningCount = checks.filter((check) => check.status === "warning").length;
    return {
      attachment,
      repoPath,
      targetVersion,
      currentFileHash,
      targetFileHash: targetVersion.fileHash || "",
      backupPath: paths.backupPath,
      stagedPath: paths.stagedPath,
      stamp: paths.stamp,
      checks,
      ok: errorCount === 0,
      errorCount,
      warningCount,
      summary: errorCount
        ? UI_TEXT.restorePreflightBlocked
        : (warningCount ? UI_TEXT.restorePreflightWarning : UI_TEXT.restorePreflightOk)
    };
  }

  async restoreVersion(item, versionRecord, options = {}) {
    const preflight = options.preflight ?? await this.buildRestorePreflight(item, versionRecord);
    const { attachment, repoPath, targetVersion } = preflight;
    this.assertRestorePreflightAllowed(preflight);
    await this.validateRestorePreflight(preflight);
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
      targetVersion,
      preflight
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
    this.contentAnalyzer.invalidate?.(repoPath);

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

  async writeWorkingTreeSnapshot(attachment, repoPath, fileBytes = null) {
    if (!(await this.platform.exists(attachment.filePath))) {
      throw new Error(formatText("fileDoesNotExist", { path: attachment.filePath }));
    }

    const trackedFileName = buildTrackedFileName(attachment.filePath);
    const trackedRelativePath = `tracked/${trackedFileName}`;
    const trackedPath = this.platform.join(repoPath, "tracked", trackedFileName);
    await this.gitBackend.ensureRepo(repoPath);
    if (fileBytes) {
      await this.platform.writeBytes(trackedPath, fileBytes);
    }
    else {
      await this.platform.copyFile(attachment.filePath, trackedPath);
    }
    return { trackedRelativePath, trackedFileName };
  }

  async storeCurrentDiff(repoPath, analysis, previousVersion) {
    if (!analysis.completeDiff) {
      return null;
    }
    try {
      return await this.diffStore.writeCurrentDiff(repoPath, {
        ...analysis.completeDiff,
        baseCommitHash: previousVersion?.commitHash ?? null
      });
    }
    catch (error) {
      this.platform.Zotero?.debug?.(`git4zotero: current diff storage failed: ${error?.stack || error}`);
      return this.diffStore.createSummaryOnlyRef({
        scope: "check-current",
        path: ".git4zotero/diffs/check-current/index.json",
        quality: analysis.completeDiff.quality,
        baseCommitHash: previousVersion?.commitHash ?? null,
        totalChanges: analysis.changeSummary?.totalParagraphChanges ?? 0,
        groupCount: analysis.changeSummary?.groupedChangeCount ?? 0
      });
    }
  }

  async storeVersionDiff(repoPath, commitHash, analysis, previousVersion) {
    if (!analysis.completeDiff) {
      return null;
    }
    try {
      return await this.diffStore.writeVersionDiff(repoPath, commitHash, {
        ...analysis.completeDiff,
        baseCommitHash: previousVersion?.commitHash ?? null
      });
    }
    catch (error) {
      this.platform.Zotero?.debug?.(`git4zotero: version diff storage failed: ${error?.stack || error}`);
      return this.diffStore.createSummaryOnlyRef({
        scope: "version",
        path: `.git4zotero/diffs/versions/${String(commitHash).replace(/[^a-zA-Z0-9._-]+/g, "-")}/index.json`,
        quality: analysis.completeDiff.quality,
        baseCommitHash: previousVersion?.commitHash ?? null,
        totalChanges: analysis.changeSummary?.totalParagraphChanges ?? 0,
        groupCount: analysis.changeSummary?.groupedChangeCount ?? 0
      });
    }
  }

  assertRestorePreflightAllowed(preflight) {
    if (!preflight?.ok) {
      throw new Error(`${UI_TEXT.restorePreflightBlocked}\n${formatPreflightChecks(preflight?.checks ?? [])}`);
    }
  }

  async validateRestorePreflight(preflight) {
    if (!(await this.safeExists(preflight.attachment.filePath))) {
      throw new Error(UI_TEXT.restorePreflightMissing);
    }
    const currentHash = await this.platform.hashFile(preflight.attachment.filePath);
    if (preflight.currentFileHash && currentHash !== preflight.currentFileHash) {
      throw new Error(UI_TEXT.restorePreflightChanged);
    }
  }

  createRestorePaths({ attachment, repoPath, targetVersion, stamp = null }) {
    const finalStamp = stamp || `${Date.now()}-${sanitizeForPath(targetVersion.shortHash || "version")}`;
    const safeFileName = sanitizeForPath(attachment.fileName);
    const restoreDir = this.joinPath(repoPath, ".git4zotero", "restore-backups");
    return {
      stamp: finalStamp,
      backupPath: this.joinPath(restoreDir, `${finalStamp}-current-${safeFileName}`),
      stagedPath: this.joinPath(restoreDir, `${finalStamp}-restore-${safeFileName}`)
    };
  }

  async restoreFileWithRollback({ attachment, repoPath, sourcePath, targetVersion, preflight = null }) {
    if (!(await this.safeExists(sourcePath))) {
      throw new Error(formatText("restoreSourceMissing", { path: sourcePath }));
    }

    const sourceHash = await this.platform.hashFile(sourcePath);
    const paths = preflight?.backupPath && preflight?.stagedPath
      ? { backupPath: preflight.backupPath, stagedPath: preflight.stagedPath }
      : this.createRestorePaths({ attachment, repoPath, targetVersion });
    const { backupPath, stagedPath } = paths;

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

    const summaryOnlyDiffs = metadataVersions.filter((version) => version.diffRef?.status === "summary-only").length
      + (metadata.lastCheck?.diffRef?.status === "summary-only" ? 1 : 0);
    if (summaryOnlyDiffs) {
      add(
        "diff-storage",
        UI_TEXT.diffStorageHealth,
        "warning",
        formatText("diffStorageSummaryOnly", { count: summaryOnlyDiffs })
      );
    }
    let missingDiffFiles = 0;
    for (const version of metadataVersions) {
      if (version.diffRef?.status === "complete"
          && !(await this.safeExists(this.pathFromRelative(repoPath, version.diffRef.path)))) {
        missingDiffFiles += 1;
      }
    }
    if (metadata.lastCheck?.diffRef?.status === "complete"
        && !(await this.safeExists(this.pathFromRelative(repoPath, metadata.lastCheck.diffRef.path)))) {
      missingDiffFiles += 1;
    }
    if (missingDiffFiles) {
      add(
        "diff-storage-missing",
        UI_TEXT.diffStorageHealth,
        "warning",
        formatText("diffStorageMissing", { count: missingDiffFiles })
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

  createLastCheck({ attachment, analysis, checkedAt, previousVersion, workingTree, diffRef = null }) {
    return {
      checkedAt,
      fileName: attachment.fileName,
      fileHash: analysis.fileHash,
      fileSize: analysis.fileSize,
      contentHash: analysis.contentHash,
      contentSummary: analysis.contentSummary,
      changeSummary: compactChangeSummary(analysis.changeSummary),
      diffRef,
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

  dirname(path) {
    if (typeof this.platform.dirname === "function") {
      return this.platform.dirname(path);
    }
    return String(path).replace(/[\\/][^\\/]*$/, "");
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
      diffRef: version.diffRef ?? null,
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

  shutdown() {
    this.contentAnalyzer.shutdown?.();
  }
}

function compactChangeSummary(changeSummary) {
  if (!changeSummary || typeof changeSummary !== "object") {
    return changeSummary ?? null;
  }
  const previews = (changeSummary.paragraphChanges ?? changeSummary.displayChanges ?? []).slice(0, 3);
  let remainingPreviews = 3;
  const groups = (changeSummary.changeGroups ?? []).map((group) => {
    const changes = (group.changes ?? []).slice(0, remainingPreviews);
    remainingPreviews -= changes.length;
    return {
      key: group.key,
      label: group.label,
      areaType: group.areaType,
      sourceLabel: group.sourceLabel,
      headingPath: group.headingPath ?? [],
      tableIndex: group.tableIndex ?? null,
      addedParagraphs: group.addedParagraphs || 0,
      deletedParagraphs: group.deletedParagraphs || 0,
      modifiedParagraphs: group.modifiedParagraphs || 0,
      movedParagraphs: group.movedParagraphs || 0,
      totalChanges: group.totalChanges || group.changes?.length || 0,
      summary: group.summary || "",
      changes
    };
  });
  return {
    ...changeSummary,
    paragraphChanges: previews,
    displayChanges: previews,
    changeGroups: groups,
    omittedChanges: Math.max(0, (changeSummary.totalParagraphChanges ?? previews.length) - previews.length)
  };
}

function completeDiffFromSummary(changeSummary, previousVersion) {
  if (!changeSummary?.totalParagraphChanges) {
    return null;
  }
  return {
    quality: changeSummary.quality === "approximate" ? "approximate" : "exact",
    baseCommitHash: previousVersion?.commitHash ?? null,
    counts: {
      added: changeSummary.addedParagraphs || 0,
      deleted: changeSummary.deletedParagraphs || 0,
      modified: changeSummary.modifiedParagraphs || 0,
      moved: changeSummary.movedParagraphs || 0
    },
    groups: (changeSummary.changeGroups ?? []).map((group, index) => ({
      ...group,
      id: `group-${index + 1}`
    }))
  };
}

function findMetadataVersion(metadata, version) {
  return (metadata?.versions ?? []).find((candidate) => sameVersion(candidate, version)) ?? null;
}

function sameVersion(left, right) {
  if (!left || !right) {
    return false;
  }
  return !!(
    (left.commitHash && right.commitHash && left.commitHash === right.commitHash)
    || (left.id && right.id && left.id === right.id)
  );
}

function createLegacyDiffIndex(version) {
  const summary = version?.changeSummary ?? {};
  const groups = summary.changeGroups?.length
    ? summary.changeGroups.map((group, index) => ({
      ...group,
      id: group.id || `legacy-${index + 1}`,
      pages: [],
      changes: group.changes ?? [],
      totalChanges: group.totalChanges ?? group.changes?.length ?? 0
    }))
    : [{
      id: "legacy-document",
      key: "document",
      label: UI_TEXT.concreteChanges,
      pages: [],
      changes: summary.paragraphChanges ?? summary.displayChanges ?? [],
      totalChanges: summary.totalParagraphChanges ?? summary.paragraphChanges?.length ?? 0
    }];
  return {
    schemaVersion: 1,
    scope: "version",
    legacy: true,
    quality: summary.quality === "approximate" ? "approximate" : "exact",
    totalChanges: summary.totalParagraphChanges ?? groups.reduce((total, group) => total + group.totalChanges, 0),
    groupCount: groups.length,
    groups
  };
}

function searchLegacyDiff(index, options = {}) {
  const query = String(options.query ?? "").trim().toLocaleLowerCase();
  const types = new Set((options.types ?? []).filter(Boolean));
  const start = Math.max(0, Number(options.cursor) || 0);
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 100));
  const changes = index.groups
    .filter((group) => !options.groupID || group.id === options.groupID)
    .flatMap((group) => group.changes ?? [])
    .filter((change) => {
      if (types.size && !types.has(change.type)) {
        return false;
      }
      return !query || `${change.oldText || ""}\n${change.newText || ""}\n${change.locationLabel || ""}`.toLocaleLowerCase().includes(query);
    });
  return {
    total: changes.length,
    cursor: start,
    nextCursor: start + limit < changes.length ? start + limit : null,
    changes: changes.slice(start, start + limit)
  };
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

function buildSingleVersionExportFileName(version, extension) {
  const baseName = String(version?.fileName || "manuscript").replace(/\.[^.\\/]+$/, "");
  const file = (sanitizeForPath(baseName) || "manuscript").slice(0, 64);
  const hash = (sanitizeForPath(version?.shortHash || version?.commitHash || version?.id || "version") || "version").slice(0, 16);
  const rawTime = version?.createdAt ? new Date(version.createdAt) : new Date();
  const timestamp = Number.isFinite(rawTime.getTime()) ? rawTime.toISOString().replace(/[:.]/g, "-") : new Date().toISOString().replace(/[:.]/g, "-");
  return `git4zotero-version-${file}-${hash}-${timestamp}${extension}`;
}

function renderMarkdownSingleVersion(version, completeChanges = null) {
  const lines = [
    `# git4zotero ${UI_TEXT.exportTitleSingleVersion}`,
    "",
    ...renderMarkdownVersion(version, completeChanges)
  ];
  return `${lines.join("\n").trimEnd()}\n`;
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

function renderMarkdownVersion(version, completeChanges = null) {
  const lines = [
    `## ${version.note || UI_TEXT.defaultNote}`,
    "",
    `- ${UI_TEXT.exportFieldTime}${UI_TEXT.colon}${version.createdAt || UI_TEXT.unknown}`,
    `- Hash${UI_TEXT.colon}${version.commitHash || version.id || UI_TEXT.unknown}`,
    `- ${UI_TEXT.exportFieldFile}${UI_TEXT.colon}${version.fileName || UI_TEXT.unknown}`,
    `- ${UI_TEXT.exportFieldSize}${UI_TEXT.colon}${formatByteSize(version.fileSize)}`,
    `- ${UI_TEXT.exportFieldType}${UI_TEXT.colon}${formatVersionKind(version)}`,
    `- ${UI_TEXT.safetyBackupLabel}${UI_TEXT.colon}${version.kind === "safety" ? UI_TEXT.yes : UI_TEXT.no}`,
    `- ${UI_TEXT.exportFieldSummary}${UI_TEXT.colon}${version.changeSummary?.summary || UI_TEXT.actionCompleted}`,
    ""
  ];
  if (Array.isArray(completeChanges)) {
    if (completeChanges.length) {
      lines.push(
        `### ${UI_TEXT.concreteChanges}`,
        "",
        ...completeChanges.map((change) => `- ${formatParagraphChange(change)}`)
      );
    }
  }
  else {
    lines.push(...renderMarkdownChangeSummary(version.changeSummary));
  }
  return lines;
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
  if (change.type === "moved") {
    return `${location}${UI_TEXT.changeKindMoved}${UI_TEXT.colon}${change.moveFrom ?? change.oldIndex ?? ""} -> ${change.moveTo ?? change.newIndex ?? ""}${UI_TEXT.semicolon}${change.newText || change.oldText || ""}`;
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

function formatPreflightChecks(checks) {
  return (checks ?? [])
    .map((check) => {
      const mark = check.status === "ok" ? "OK" : (check.status === "warning" ? "WARN" : "ERROR");
      return `- [${mark}] ${check.label}${UI_TEXT.colon}${check.detail || ""}`;
    })
    .join("\n");
}
