import { PREFS, UI_TEXT } from "./constants.mjs";
import { diffParagraphTokens } from "./content-diff.mjs";
import { formatText } from "./localization.mjs";
import { ReviewStateStore } from "./review-state-store.mjs";

export class ReviewWindowManager {
  constructor({ platform, service, aiReviewService = null, reviewStateStore = null }) {
    this.platform = platform;
    this.service = service;
    this.aiReviewService = aiReviewService;
    this.reviewStateStore = reviewStateStore ?? new ReviewStateStore(platform);
    this.windows = new Map();
  }

  async open(version, item = null) {
    if (!version?.repoPath) {
      throw new Error(UI_TEXT.reviewWindowUnavailable);
    }
    const key = `${version.repoPath}:${version.commitHash || version.id}`;
    const existing = this.windows.get(key);
    if (existing && !existing.closed) {
      existing.focus?.();
      return existing;
    }
    const mainWindow = this.platform.Zotero?.getMainWindow?.()
      || this.platform.Zotero?.getMainWindows?.()?.[0]
      || null;
    if (typeof mainWindow?.openDialog !== "function") {
      throw new Error(UI_TEXT.reviewWindowUnavailable);
    }
    const payload = this.createPayload(version, key, item);
    const reviewWindow = mainWindow.openDialog(
      "chrome://git4zotero/content/review.xhtml",
      `git4zotero-review-${sanitizeWindowKey(key)}`,
      "chrome,dialog=no,resizable,centerscreen,width=1180,height=780",
      payload
    );
    if (!reviewWindow) {
      throw new Error(UI_TEXT.reviewWindowUnavailable);
    }
    this.windows.set(key, reviewWindow);
    reviewWindow.addEventListener?.("unload", () => {
      if (this.windows.get(key) === reviewWindow) {
        this.windows.delete(key);
      }
    }, { once: true });
    return reviewWindow;
  }

  createPayload(version, key, item = null) {
    const context = { repoPath: version.repoPath };
    let activeVersion = version;
    const scopeKey = () => String(activeVersion?.commitHash || activeVersion?.id || activeVersion?.diffRef?.path || key);
    return {
      key,
      version,
      aiAvailable: !!this.aiReviewService?.isAvailable?.() && this.platform.getPref(PREFS.aiEnabled, false) === true,
      labels: {
        title: UI_TEXT.reviewWindowTitle,
        sections: UI_TEXT.reviewSections,
        search: UI_TEXT.reviewSearch,
        filterLabel: UI_TEXT.reviewFilterLabel,
        all: UI_TEXT.reviewFilterAll,
        modified: UI_TEXT.reviewFilterModified,
        added: UI_TEXT.reviewFilterAdded,
        deleted: UI_TEXT.reviewFilterDeleted,
        moved: UI_TEXT.reviewFilterMoved,
        previous: UI_TEXT.reviewPreviousPage,
        next: UI_TEXT.reviewNextPage,
        page: UI_TEXT.reviewPage,
        copyFiltered: UI_TEXT.reviewCopyFiltered,
        copyAll: UI_TEXT.reviewCopyAll,
        exportMarkdown: UI_TEXT.reviewExportMarkdown,
        noChanges: UI_TEXT.versionDetailNoChanges,
        qualityExact: UI_TEXT.diffQualityExact,
        qualityApproximate: UI_TEXT.diffQualityApproximate,
        simplified: UI_TEXT.diffSimplified,
        changeBefore: UI_TEXT.changeBefore,
        changeAfter: UI_TEXT.changeAfter,
        copySuccess: UI_TEXT.versionDetailCopySuccess,
        selectPage: UI_TEXT.reviewSelectPage,
        clearSelection: UI_TEXT.reviewClearSelection,
        selectedCount: UI_TEXT.reviewSelectedCount,
        hideMinor: UI_TEXT.reviewHideMinor,
        nextUnreviewed: UI_TEXT.reviewNextUnreviewed,
        statusUnreviewed: UI_TEXT.reviewStatusUnreviewed,
        statusConfirmed: UI_TEXT.reviewStatusConfirmed,
        statusActionRequired: UI_TEXT.reviewStatusActionRequired,
        bookmark: UI_TEXT.reviewBookmark,
        notePlaceholder: UI_TEXT.reviewNotePlaceholder,
        compareBaseline: UI_TEXT.compareBaseline,
        compareTarget: UI_TEXT.compareTarget,
        compareRun: UI_TEXT.compareRun,
        aiGenerate: UI_TEXT.aiReviewGenerate,
        aiPreviewTitle: UI_TEXT.aiReviewPreviewTitle,
        aiPrivacyWarning: UI_TEXT.aiReviewPrivacyWarning,
        aiConfirm: UI_TEXT.aiReviewConfirm,
        aiCancel: UI_TEXT.aiReviewCancel,
        aiClose: UI_TEXT.aiReviewClose,
        aiGenerating: UI_TEXT.aiReviewGenerating,
        aiDisclaimer: UI_TEXT.aiReviewDisclaimer,
        aiReportTitle: UI_TEXT.aiReviewReportTitle,
        aiReportMeta: UI_TEXT.aiReviewReportMeta,
        aiCached: UI_TEXT.aiReviewCached,
        aiFresh: UI_TEXT.aiReviewFresh,
        aiCopyReport: UI_TEXT.aiReviewCopyReport,
        aiExportReport: UI_TEXT.aiReviewExportReport,
        aiReportCopied: UI_TEXT.aiReviewReportCopied,
        aiCopyNote: UI_TEXT.aiReviewCopyNote,
        aiNoteCopied: UI_TEXT.aiReviewNoteCopied,
        aiSummary: UI_TEXT.aiReviewSummary,
        aiSectionSummaries: UI_TEXT.aiReviewSectionSummaries,
        aiKeyChanges: UI_TEXT.aiReviewKeyChanges,
        aiRisks: UI_TEXT.aiReviewRisks,
        aiVerification: UI_TEXT.aiReviewVerification,
        aiReferences: UI_TEXT.aiReviewReferences,
        aiNoRisks: UI_TEXT.aiReviewNoRisks,
        aiLevelHigh: UI_TEXT.aiLevelHigh,
        aiLevelMedium: UI_TEXT.aiLevelMedium,
        aiLevelLow: UI_TEXT.aiLevelLow,
        aiLimitations: UI_TEXT.aiReviewLimitations,
        aiSuggestedNote: UI_TEXT.aiReviewSuggestedNote,
        aiNoSelection: UI_TEXT.aiReviewNoSelection,
        aiProviderMeta: UI_TEXT.aiReviewProviderMeta,
        aiClearCache: UI_TEXT.aiReviewClearCache,
        aiCacheCleared: UI_TEXT.aiReviewCacheCleared
      },
      format: (key, values) => formatText(key, values),
      loadIndex: () => this.service.getVersionDiffIndex(context, activeVersion, { rebuild: true }),
      search: (options) => this.service.searchVersionDiff(context, activeVersion, options),
      tokenDiff: (oldText, newText) => diffParagraphTokens(oldText, newText),
      loadReviewStates: (changeIDs) => this.reviewStateStore.load(version.repoPath, scopeKey(), changeIDs),
      saveReviewState: (changeID, patch) => this.reviewStateStore.update(version.repoPath, scopeKey(), changeID, patch),
      loadComparisonCandidates: async () => item ? this.service.getComparisonCandidates(item) : { candidates: [] },
      compareVersions: async (baseID, targetID) => {
        if (!item) {
          throw new Error(UI_TEXT.compareVersionUnavailable);
        }
        activeVersion = await this.service.compareVersions(item, baseID, targetID);
        return {
          version: activeVersion,
          index: await this.service.getVersionDiffIndex(context, activeVersion, { rebuild: false })
        };
      },
      previewAI: (changeIDs) => this.aiReviewService.preview(context, activeVersion, {
        changeIDs,
        language: UI_TEXT.locale
      }),
      createAbortController: () => this.aiReviewService.createAbortController(),
      generateAI: (changeIDs, signal) => this.aiReviewService.generateSummary(context, activeVersion, {
        changeIDs,
        language: UI_TEXT.locale,
        signal
      }),
      copyAIReview: (record) => {
        const content = this.aiReviewService.formatMarkdown(record, UI_TEXT);
        this.platform.copyTextToClipboard(content);
        return content;
      },
      exportAIReview: async (record) => {
        const content = this.aiReviewService.formatMarkdown(record, UI_TEXT);
        const versionKey = sanitizeWindowKey(scopeKey());
        const path = await this.platform.saveTextFile({
          title: UI_TEXT.aiReviewExportTitle,
          defaultFileName: `git4zotero-ai-review-${versionKey}.md`,
          content,
          initialDirectory: this.platform?.getPref?.(PREFS.archiveExportDirectory, "") || ""
        });
        return path ? { path, content } : null;
      },
      copyText: (content) => this.platform.copyTextToClipboard(String(content || "")),
      clearAI: () => this.aiReviewService.clearCache(context, activeVersion),
      copyMarkdown: async (filters) => {
        const content = await this.service.buildCompleteVersionMarkdown(context, activeVersion, filters);
        this.platform.copyTextToClipboard(content);
        return content;
      },
      exportMarkdown: (filters) => this.service.exportSingleVersionSummary(activeVersion, {
        filters,
        initialDirectory: this.platform?.getPref?.(PREFS.archiveExportDirectory, "") || ""
      })
    };
  }

  shutdown() {
    for (const reviewWindow of this.windows.values()) {
      try {
        reviewWindow.close?.();
      }
      catch {
        // Ignore windows already being destroyed by Zotero shutdown.
      }
    }
    this.windows.clear();
  }
}

function sanitizeWindowKey(value) {
  return String(value ?? "review").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(-100) || "review";
}
