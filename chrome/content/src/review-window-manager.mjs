import { PREFS, UI_TEXT } from "./constants.mjs";
import { diffParagraphTokens } from "./content-diff.mjs";

export class ReviewWindowManager {
  constructor({ platform, service }) {
    this.platform = platform;
    this.service = service;
    this.windows = new Map();
  }

  async open(version) {
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
    const payload = this.createPayload(version, key);
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

  createPayload(version, key) {
    const context = { repoPath: version.repoPath };
    return {
      key,
      version,
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
        copySuccess: UI_TEXT.versionDetailCopySuccess
      },
      loadIndex: () => this.service.getVersionDiffIndex(context, version, { rebuild: true }),
      search: (options) => this.service.searchVersionDiff(context, version, options),
      tokenDiff: (oldText, newText) => diffParagraphTokens(oldText, newText),
      copyMarkdown: async (filters) => {
        const content = await this.service.buildCompleteVersionMarkdown(context, version, filters);
        this.platform.copyTextToClipboard(content);
        return content;
      },
      exportMarkdown: (filters) => this.service.exportSingleVersionSummary(version, {
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
