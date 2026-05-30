import { PREFS, UI_TEXT } from "./constants.mjs";
import { isSafeRepoRelativePath } from "./cleanup.mjs";
import { METADATA_SCHEMA_VERSION } from "./metadata.mjs";
import { formatText } from "./localization.mjs";

export const ERROR_CATEGORIES = Object.freeze({
  userActionable: "user-actionable",
  git: "git",
  fileState: "file-state",
  internal: "internal"
});

export function classifyError(error, context = {}) {
  const rawMessage = errorMessage(error);
  const haystack = `${context.operation || ""}\n${rawMessage}`.toLowerCase();
  let category = ERROR_CATEGORIES.internal;

  if (matchesAny(haystack, [
    "git",
    "git.exe",
    "git unavailable",
    "git 不可用",
    "git 路径",
    "git path",
    "subprocess",
    "rev-parse",
    "status --short"
  ])) {
    category = ERROR_CATEGORIES.git;
  }
  else if (matchesAny(haystack, [
    "select",
    "selection",
    "not enabled",
    "no manageable",
    "no changes",
    "尚未启用",
    "未启用",
    "请选择",
    "只选择",
    "条目",
    "未找到可管理",
    "未检测到修改",
    "尚未检查"
  ])) {
    category = ERROR_CATEGORIES.userActionable;
  }
  else if (matchesAny(haystack, [
    "file",
    "path",
    "read",
    "write",
    "copy",
    "remove",
    "restore",
    "backup",
    "hash",
    "permission",
    "access",
    "占用",
    "保存",
    "不可读",
    "不可写",
    "不存在",
    "论文文件",
    "附件"
  ])) {
    category = ERROR_CATEGORIES.fileState;
  }

  const labels = categoryLabels(category);
  return {
    category,
    title: labels.title,
    message: rawMessage,
    suggestion: labels.suggestion,
    rawMessage
  };
}

export class LastErrorStore {
  constructor(platform) {
    this.platform = platform;
  }

  read() {
    const raw = this.platform?.getPref?.(PREFS.lastError, "") || "";
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    }
    catch (_error) {
      return null;
    }
  }

  write(error, context = {}) {
    const classified = classifyError(error, context);
    const entry = {
      time: new Date().toISOString(),
      category: classified.category,
      title: classified.title,
      operation: String(context.operation || UI_TEXT.operationFailed),
      message: classified.message,
      suggestion: classified.suggestion,
      rawMessage: classified.rawMessage,
      stack: sanitizeStack(error?.stack, this.platform)
    };
    this.platform?.setPref?.(PREFS.lastError, JSON.stringify(entry));
    return entry;
  }
}

export function recordLastError(platform, error, context = {}) {
  try {
    return new LastErrorStore(platform).write(error, context);
  }
  catch (storeError) {
    platform?.Zotero?.debug?.(`git4zotero: failed to store last error: ${storeError?.stack || storeError}`);
    return null;
  }
}

export function formatClassifiedError(error, context = {}) {
  const classified = classifyError(error, context);
  return `${classified.title}\n${classified.message}\n${classified.suggestion}`;
}

export class DiagnosticService {
  constructor({
    platform,
    cleanupService = null,
    metadataStore = null,
    versionService = null,
    pluginVersion = ""
  }) {
    this.platform = platform;
    this.cleanupService = cleanupService;
    this.metadataStore = metadataStore;
    this.versionService = versionService;
    this.pluginVersion = pluginVersion;
    this.lastErrorStore = new LastErrorStore(platform);
  }

  async buildReport({ redactPaths = true } = {}) {
    const git = await this.safeGitAvailability();
    const dataDirectory = this.safePluginDataDirectory();
    const currentItem = await this.getCurrentItemStatus();
    const lastError = this.lastErrorStore.read();
    const redact = (value) => redactPaths ? this.redact(value) : String(value ?? "");

    const lines = [
      "git4zotero Diagnostics",
      "",
      `Plugin version: ${this.pluginVersion || this.platform.getPluginVersion?.() || "unknown"}`,
      `Zotero version: ${this.platform.getAppVersion?.() || "unknown"}`,
      `System: ${this.platform.getSystemInfo?.() || "unknown"}`,
      `Locale: ${this.platform.getLocale?.() || this.platform.Zotero?.locale || "unknown"}`,
      `Git command: ${redact(git.command || this.platform.getGitExecutable?.() || "git")}`,
      `Git version: ${git.available ? (git.version || git.detail || "available") : `unavailable: ${git.detail || git.error || "unknown"}`}`,
      `Data directory: ${redact(dataDirectory || "unknown")}`,
      "",
      "Current item:",
      ...indentLines(currentItem.lines.map((line) => redact(line))),
      "",
      "Recent error:",
      ...indentLines(this.formatLastError(lastError).map((line) => redact(line)))
    ];

    return lines.join("\n");
  }

  async runHealthCheck() {
    const checks = [];
    checks.push(await this.checkGit());
    checks.push(await this.checkDataDirectory());
    checks.push(await this.checkWritePermission());
    checks.push(await this.checkDeletedHistory());
    checks.push(await this.checkMetadataSchema());
    return {
      checks,
      okCount: checks.filter((check) => check.status === "ok").length,
      warningCount: checks.filter((check) => check.status === "warning").length,
      errorCount: checks.filter((check) => check.status === "error").length,
      skippedCount: checks.filter((check) => check.status === "skipped").length
    };
  }

  async checkGit() {
    const result = await this.safeGitAvailability();
    return {
      id: "git",
      label: this.text("healthCheckGit"),
      status: result.available ? "ok" : "error",
      detail: result.available
        ? this.text("healthGitAvailable", { detail: result.version || result.detail || result.command || "git" })
        : this.text("healthGitUnavailable", { detail: result.detail || result.error || UI_TEXT.gitUnavailableDetail }),
      suggestion: result.available ? "" : UI_TEXT.errorGitSuggestion
    };
  }

  async checkDataDirectory() {
    try {
      const dataDir = this.platform.getPluginDataDirectory();
      await this.platform.makeDirectory(dataDir);
      return {
        id: "data-directory",
        label: this.text("healthCheckDataDirectory"),
        status: "ok",
        detail: this.text("healthDataDirectoryReady", { path: this.redact(dataDir) }),
        suggestion: ""
      };
    }
    catch (error) {
      return {
        id: "data-directory",
        label: this.text("healthCheckDataDirectory"),
        status: "error",
        detail: this.text("healthDataDirectoryFailed", { message: errorMessage(error) }),
        suggestion: UI_TEXT.errorInternalSuggestion
      };
    }
  }

  async checkWritePermission() {
    try {
      const probePath = await this.platform.writeTempProbeFile();
      return {
        id: "write-permission",
        label: this.text("healthCheckWritePermission"),
        status: "ok",
        detail: this.text("healthWritePermissionReady", { path: this.redact(probePath) }),
        suggestion: ""
      };
    }
    catch (error) {
      return {
        id: "write-permission",
        label: this.text("healthCheckWritePermission"),
        status: "error",
        detail: this.text("healthWritePermissionFailed", { message: errorMessage(error) }),
        suggestion: UI_TEXT.errorFileStateSuggestion
      };
    }
  }

  async checkDeletedHistory() {
    if (!this.cleanupService?.scanOrphanRepositories) {
      return {
        id: "deleted-history",
        label: this.text("healthCheckDeletedHistory"),
        status: "skipped",
        detail: UI_TEXT.missingIOUtilsGetChildren,
        suggestion: ""
      };
    }

    try {
      const scan = await this.cleanupService.scanOrphanRepositories();
      return {
        id: "deleted-history",
        label: this.text("healthCheckDeletedHistory"),
        status: scan.count ? "warning" : "ok",
        detail: scan.count
          ? this.text("healthDeletedHistoryFound", { count: scan.count })
          : this.text("healthDeletedHistoryNone"),
        suggestion: scan.count ? this.text("cleanDeletedHistory") : ""
      };
    }
    catch (error) {
      return {
        id: "deleted-history",
        label: this.text("healthCheckDeletedHistory"),
        status: "error",
        detail: errorMessage(error),
        suggestion: UI_TEXT.errorInternalSuggestion
      };
    }
  }

  async checkMetadataSchema() {
    const dataDir = this.safePluginDataDirectory();
    if (!dataDir || !(await this.safeExists(dataDir))) {
      return {
        id: "metadata-schema",
        label: this.text("healthCheckMetadataSchema"),
        status: "skipped",
        detail: this.text("healthMetadataSchemaSkipped"),
        suggestion: ""
      };
    }

    const issues = [];
    let checkedCount = 0;
    for (const repoPath of await this.listRepositoryPaths(dataDir)) {
      checkedCount += 1;
      const relativePath = this.relativeRepoPath(dataDir, repoPath);
      const metadataPath = this.metadataStore?.getMetadataPath
        ? this.metadataStore.getMetadataPath(repoPath)
        : this.platform.join(repoPath, ".git4zotero", "versions.json");
      if (!(await this.safeExists(metadataPath))) {
        issues.push(`${relativePath}: missing versions.json`);
        continue;
      }
      try {
        const parsed = JSON.parse(await this.platform.readText(metadataPath));
        if (!Array.isArray(parsed.versions)) {
          issues.push(`${relativePath}: versions is not an array`);
        }
        if ((parsed.schemaVersion ?? 1) !== METADATA_SCHEMA_VERSION) {
          issues.push(`${relativePath}: schema ${parsed.schemaVersion ?? 1} -> ${METADATA_SCHEMA_VERSION}`);
        }
      }
      catch (error) {
        issues.push(`${relativePath}: ${errorMessage(error)}`);
      }
    }

    return {
      id: "metadata-schema",
      label: this.text("healthCheckMetadataSchema"),
      status: issues.length ? "warning" : "ok",
      detail: issues.length
        ? this.text("healthMetadataSchemaIssues", {
          count: issues.length,
          details: issues.slice(0, 5).join("; ")
        })
        : this.text("healthMetadataSchemaOk", { count: checkedCount }),
      suggestion: issues.length ? UI_TEXT.errorInternalSuggestion : ""
    };
  }

  async getCurrentItemStatus() {
    try {
      const items = this.getSelectedItems();
      if (!items.length) {
        return { lines: [UI_TEXT.noItem] };
      }
      if (items.length > 1) {
        return { lines: [UI_TEXT.menuMultiSelectUnsupported] };
      }
      const item = items[0];
      const lines = [
        `Item ID: ${item.id ?? "unknown"}`,
        `Item key: ${item.key ?? "unknown"}`,
        `Library ID: ${item.libraryID ?? "unknown"}`
      ];

      if (!this.versionService?.getPanelState) {
        return { lines: [...lines, "Panel state: unavailable"] };
      }

      const state = await this.versionService.getPanelState(item);
      if (!state.attachment) {
        return { lines: [...lines, UI_TEXT.noDocument] };
      }
      lines.push(`Attachment: ${state.attachment.fileName || state.attachment.attachmentKey || "unknown"}`);
      lines.push(`Repository: ${state.repoPath || "not created"}`);
      if (!state.enabled) {
        lines.push(UI_TEXT.notEnabled);
        return { lines };
      }
      if (state.git && !state.git.available) {
        lines.push(`${UI_TEXT.gitUnavailable}: ${state.git.detail || state.git.error || UI_TEXT.gitUnavailableDetail}`);
      }
      else {
        lines.push(`${UI_TEXT.stateEnabled}: ${formatText("stateVersionCount", { count: state.versions?.length ?? 0 })}`);
      }
      lines.push(`${UI_TEXT.lastCheck}: ${state.lastCheck?.checkedAt || UI_TEXT.neverChecked}`);
      if (state.health?.summary) {
        lines.push(`${UI_TEXT.repositoryHealth}: ${state.health.summary}`);
      }
      return { lines };
    }
    catch (error) {
      return { lines: [`${UI_TEXT.operationFailed}: ${errorMessage(error)}`] };
    }
  }

  getSelectedItems() {
    const pane = this.platform.Zotero?.getActiveZoteroPane?.();
    const items = pane?.getSelectedItems?.();
    return Array.isArray(items) ? items.filter(Boolean) : [];
  }

  async safeGitAvailability() {
    try {
      return await this.platform.checkGitAvailability();
    }
    catch (error) {
      return {
        available: false,
        command: this.platform.getGitExecutable?.() || "git",
        detail: errorMessage(error),
        error: errorMessage(error)
      };
    }
  }

  safePluginDataDirectory() {
    try {
      return this.platform.getPluginDataDirectory();
    }
    catch (_error) {
      return "";
    }
  }

  async listRepositoryPaths(dataDir) {
    const repos = [];
    for (const libraryPath of await this.safeList(dataDir)) {
      const libraryName = pathName(libraryPath);
      if (!libraryName.startsWith("library-")) {
        continue;
      }
      for (const itemPath of await this.safeList(libraryPath)) {
        const relativePath = `${libraryName}/${pathName(itemPath)}`;
        if (isSafeRepoRelativePath(relativePath)) {
          repos.push(itemPath);
        }
      }
    }
    return repos;
  }

  async safeList(path) {
    try {
      return await this.platform.listDirectory(path);
    }
    catch (_error) {
      return [];
    }
  }

  async safeExists(path) {
    try {
      return !!(path && await this.platform.exists(path));
    }
    catch (_error) {
      return false;
    }
  }

  relativeRepoPath(dataDir, repoPath) {
    const normalizedBase = String(dataDir).replace(/[\\\/]+$/g, "");
    return String(repoPath).slice(normalizedBase.length).replace(/^[\\\/]+/, "").replace(/\\/g, "/") || pathName(repoPath);
  }

  formatLastError(entry) {
    if (!entry) {
      return [this.text("lastErrorNone")];
    }
    return [
      `${entry.time || "unknown"} · ${entry.title || entry.category || "unknown"} · ${entry.operation || ""}`,
      entry.message || entry.rawMessage || "",
      entry.suggestion ? `${this.text("healthStatusWarning")}: ${entry.suggestion}` : ""
    ].filter(Boolean);
  }

  text(key, values = {}) {
    return formatTemplate(UI_TEXT.preferences?.[key] ?? UI_TEXT[key] ?? key, values);
  }

  redact(value) {
    return this.platform.redactPath ? this.platform.redactPath(value) : String(value ?? "");
  }
}

function categoryLabels(category) {
  if (category === ERROR_CATEGORIES.userActionable) {
    return { title: UI_TEXT.errorUserActionableTitle, suggestion: UI_TEXT.errorUserActionableSuggestion };
  }
  if (category === ERROR_CATEGORIES.git) {
    return { title: UI_TEXT.errorGitTitle, suggestion: UI_TEXT.errorGitSuggestion };
  }
  if (category === ERROR_CATEGORIES.fileState) {
    return { title: UI_TEXT.errorFileStateTitle, suggestion: UI_TEXT.errorFileStateSuggestion };
  }
  return { title: UI_TEXT.errorInternalTitle, suggestion: UI_TEXT.errorInternalSuggestion };
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern.toLowerCase()));
}

function errorMessage(error) {
  return String(error?.message || error || UI_TEXT.operationFailed);
}

function sanitizeStack(stack, platform) {
  if (!stack) {
    return "";
  }
  const redacted = platform?.redactPath ? platform.redactPath(stack) : String(stack);
  return redacted.split(/\r?\n/).slice(0, 12).join("\n");
}

function indentLines(lines) {
  return (lines.length ? lines : [""]).map((line) => `- ${line}`);
}

function pathName(value) {
  return String(value ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";
}

function formatTemplate(template, values = {}) {
  return String(template ?? "").replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
  });
}
