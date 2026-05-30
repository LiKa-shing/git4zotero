"use strict";

var Git4ZoteroPreferenceL10n = (() => {
  const zhCN = {
    locale: "zh-CN",
    colon: "：",
    defaultNote: "论文版本",
    gitSettingsTitle: "Git 设置",
    gitSettingsDescription: "git4zotero 使用本机 Git 在 Zotero 配置目录中保存论文附件版本。",
    gitPathLabel: "Git 可执行文件路径",
    testGit: "测试 Git",
    gitPathHelp: "留空表示使用系统 PATH 中的 git。Windows 可填写 C:\\Program Files\\Git\\cmd\\git.exe。",
    currentInput: "当前输入",
    savedPath: "已保存路径",
    notSaved: "尚未保存",
    gitStatusInitial: "尚未测试 Git。",
    versionBehaviorTitle: "版本行为",
    defaultNoteLabel: "默认版本说明",
    defaultNoteHelp: "创建版本时说明为空，将使用该默认文本。",
    autoSafetyLabel: "恢复旧版本前自动创建安全版本",
    autoSafetyHelp: "建议保持开启，恢复前会先保存当前文件，降低误覆盖风险。",
    statusTitle: "状态与排错",
    pluginVersion: "插件版本",
    supportedFormats: "支持格式",
    supportedFormatsValue: ".docx 正文级识别；.doc 文件级跟踪",
    dataDirectory: "数据目录",
    dataDirectoryFallback: "Zotero 配置目录中的 git4zotero 文件夹",
    trackingHelp: "是否跟踪某个条目由条目列表右键菜单中的“论文版本”操作控制；右侧面板仅显示状态。",
    diagnosticsTitle: "诊断与健康检查",
    diagnosticsDescription: "复制诊断信息可用于提交 issue；健康检查只读取状态，不会自动修复或清理历史。",
    copyDiagnostics: "复制诊断信息",
    runHealthCheck: "运行健康检查",
    diagnosticsInitial: "尚未复制诊断信息。",
    diagnosticsBuilding: "正在生成诊断信息...",
    diagnosticsCopied: "诊断信息已复制到剪贴板。",
    diagnosticsCopyFallback: "无法写入剪贴板，请手动复制下方诊断信息：\n{report}",
    diagnosticsFailed: "诊断信息生成失败：{message}",
    healthInitial: "尚未运行健康检查。",
    healthRunning: "正在运行健康检查...",
    healthFailed: "健康检查失败：{message}",
    healthSummary: "健康检查完成：正常 {okCount} 项，需要处理 {warningCount} 项，错误 {errorCount} 项，跳过 {skippedCount} 项。\n{details}",
    lastErrorTitle: "最近错误",
    lastErrorNone: "尚未记录错误。",
    lastErrorSummary: "{time} · {category} · {operation}\n{message}\n建议：{suggestion}",
    healthStatusOk: "正常",
    healthStatusWarning: "需要处理",
    healthStatusError: "错误",
    healthStatusSkipped: "跳过",
    healthCheckGit: "测试 Git",
    healthCheckDataDirectory: "检查数据目录",
    healthCheckWritePermission: "检查写权限",
    healthCheckDeletedHistory: "扫描已删除条目历史",
    healthCheckMetadataSchema: "检查 metadata schema",
    healthGitAvailable: "Git 可用：{detail}",
    healthGitUnavailable: "Git 不可用：{detail}",
    healthDataDirectoryReady: "数据目录可用：{path}",
    healthDataDirectoryFailed: "数据目录不可用：{message}",
    healthWritePermissionReady: "写权限正常：{path}",
    healthWritePermissionFailed: "写权限检查失败：{message}",
    healthDeletedHistoryNone: "未发现已删除条目留下的版本历史。",
    healthDeletedHistoryFound: "发现 {count} 个已删除条目留下的版本历史。",
    healthMetadataSchemaOk: "metadata schema 正常，已检查 {count} 个仓库。",
    healthMetadataSchemaIssues: "发现 {count} 个 metadata 问题：{details}",
    healthMetadataSchemaSkipped: "数据目录不存在，已跳过 metadata schema 检查。",
    checkDeletedHistory: "检查已删除条目的历史",
    cleanDeletedHistory: "清理已删除条目的历史",
    orphanInitial: "尚未检查是否有已删除条目留下的版本历史。",
    orphanHelp: "条目移入 Zotero 回收站时，版本历史会保留，方便恢复条目后继续使用。若条目已被永久删除或清空回收站，插件会清理对应历史；此工具可检查并清理升级前遗留的无对应条目的历史。",
    testingGit: "正在测试 Git...",
    gitAvailable: "Git 可用：{detail}\n已测试路径：{testedPath}\n已保存路径：{savedPath}",
    gitUnavailable: "Git 不可用：{detail}",
    gitPathCheckHint: "请检查 Git 路径。",
    gitTestFailed: "Git 测试失败：{message}",
    orphanChecking: "正在检查是否有已删除条目留下的版本历史...",
    orphanCheckFailed: "已删除条目的历史检查失败：{message}",
    orphanNone: "未发现需要清理的历史。",
    orphanNoneSkipped: "未发现需要清理的历史。{count} 个仓库因路径或元数据异常被跳过。",
    orphanFound: "发现 {count} 个已删除条目留下的版本历史：\n{paths}{more}\n确认这些条目不再需要恢复后，可点击“清理已删除条目的历史”。",
    orphanMore: "\n...另有 {count} 个。",
    orphanCleanTitle: "清理已删除条目的历史",
    orphanCleanConfirm: "将删除 {count} 个 Zotero 中已找不到对应条目的 git4zotero 版本历史。此操作只删除插件保存的历史，不会修改 Zotero 数据库，也不会删除当前论文附件。确定继续吗？",
    orphanCleanCanceled: "已取消清理已删除条目的历史。",
    orphanCleaning: "正在清理已删除条目的历史...",
    orphanCleanFailed: "已删除条目的历史清理失败：{message}",
    orphanCleanSkipped: "已清理 {cleanedCount} 个历史，{skippedCount} 个因安全校验未通过而跳过。",
    orphanCleaned: "已清理 {count} 个已删除条目的版本历史。"
  };

  const bundles = {
    "zh-CN": zhCN,
    "zh-TW": {
      ...zhCN,
      locale: "zh-TW",
      defaultNote: "論文版本",
      gitSettingsTitle: "Git 設定",
      gitSettingsDescription: "git4zotero 使用本機 Git 在 Zotero 設定目錄中儲存論文附件版本。",
      gitPathLabel: "Git 可執行檔路徑",
      testGit: "測試 Git",
      gitPathHelp: "留空表示使用系統 PATH 中的 git。Windows 可填寫 C:\\Program Files\\Git\\cmd\\git.exe。",
      currentInput: "目前輸入",
      savedPath: "已儲存路徑",
      notSaved: "尚未儲存",
      gitStatusInitial: "尚未測試 Git。",
      versionBehaviorTitle: "版本行為",
      defaultNoteLabel: "預設版本說明",
      defaultNoteHelp: "建立版本時說明為空，將使用此預設文字。",
      autoSafetyLabel: "還原舊版本前自動建立安全版本",
      autoSafetyHelp: "建議保持開啟，還原前會先儲存目前檔案，降低誤覆蓋風險。",
      statusTitle: "狀態與排錯",
      pluginVersion: "插件版本",
      supportedFormats: "支援格式",
      supportedFormatsValue: ".docx 正文級識別；.doc 檔案級追蹤",
      dataDirectory: "資料目錄",
      dataDirectoryFallback: "Zotero 設定目錄中的 git4zotero 資料夾",
      trackingHelp: "是否追蹤某個條目由條目清單右鍵選單中的「論文版本」操作控制；右側面板僅顯示狀態。",
      diagnosticsTitle: "診斷與健康檢查",
      diagnosticsDescription: "複製診斷資訊可用於提交 issue；健康檢查只讀取狀態，不會自動修復或清理歷史。",
      copyDiagnostics: "複製診斷資訊",
      runHealthCheck: "執行健康檢查",
      diagnosticsInitial: "尚未複製診斷資訊。",
      diagnosticsBuilding: "正在產生診斷資訊...",
      diagnosticsCopied: "診斷資訊已複製到剪貼簿。",
      diagnosticsCopyFallback: "無法寫入剪貼簿，請手動複製下方診斷資訊：\n{report}",
      diagnosticsFailed: "診斷資訊產生失敗：{message}",
      healthInitial: "尚未執行健康檢查。",
      healthRunning: "正在執行健康檢查...",
      healthFailed: "健康檢查失敗：{message}",
      healthSummary: "健康檢查完成：正常 {okCount} 項，需要處理 {warningCount} 項，錯誤 {errorCount} 項，跳過 {skippedCount} 項。\n{details}",
      lastErrorTitle: "最近錯誤",
      lastErrorNone: "尚未記錄錯誤。",
      lastErrorSummary: "{time} · {category} · {operation}\n{message}\n建議：{suggestion}",
      healthStatusOk: "正常",
      healthStatusWarning: "需要處理",
      healthStatusError: "錯誤",
      healthStatusSkipped: "跳過",
      healthCheckGit: "測試 Git",
      healthCheckDataDirectory: "檢查資料目錄",
      healthCheckWritePermission: "檢查寫入權限",
      healthCheckDeletedHistory: "掃描已刪除條目歷史",
      healthCheckMetadataSchema: "檢查 metadata schema",
      healthGitAvailable: "Git 可用：{detail}",
      healthGitUnavailable: "Git 不可用：{detail}",
      healthDataDirectoryReady: "資料目錄可用：{path}",
      healthDataDirectoryFailed: "資料目錄不可用：{message}",
      healthWritePermissionReady: "寫入權限正常：{path}",
      healthWritePermissionFailed: "寫入權限檢查失敗：{message}",
      healthDeletedHistoryNone: "未發現已刪除條目留下的版本歷史。",
      healthDeletedHistoryFound: "發現 {count} 個已刪除條目留下的版本歷史。",
      healthMetadataSchemaOk: "metadata schema 正常，已檢查 {count} 個倉庫。",
      healthMetadataSchemaIssues: "發現 {count} 個 metadata 問題：{details}",
      healthMetadataSchemaSkipped: "資料目錄不存在，已跳過 metadata schema 檢查。",
      checkDeletedHistory: "檢查已刪除條目的歷史",
      cleanDeletedHistory: "清理已刪除條目的歷史",
      orphanInitial: "尚未檢查是否有已刪除條目留下的版本歷史。",
      orphanHelp: "條目移入 Zotero 回收站時，版本歷史會保留，方便恢復條目後繼續使用。若條目已被永久刪除或清空回收站，插件會清理對應歷史；此工具可檢查並清理升級前遺留的無對應條目的歷史。",
      testingGit: "正在測試 Git...",
      gitAvailable: "Git 可用：{detail}\n已測試路徑：{testedPath}\n已儲存路徑：{savedPath}",
      gitUnavailable: "Git 不可用：{detail}",
      gitPathCheckHint: "請檢查 Git 路徑。",
      gitTestFailed: "Git 測試失敗：{message}",
      orphanChecking: "正在檢查是否有已刪除條目留下的版本歷史...",
      orphanCheckFailed: "已刪除條目的歷史檢查失敗：{message}",
      orphanNone: "未發現需要清理的歷史。",
      orphanNoneSkipped: "未發現需要清理的歷史。{count} 個倉庫因路徑或元資料異常被跳過。",
      orphanFound: "發現 {count} 個已刪除條目留下的版本歷史：\n{paths}{more}\n確認這些條目不再需要恢復後，可點擊「清理已刪除條目的歷史」。",
      orphanMore: "\n...另有 {count} 個。",
      orphanCleanTitle: "清理已刪除條目的歷史",
      orphanCleanConfirm: "將刪除 {count} 個 Zotero 中已找不到對應條目的 git4zotero 版本歷史。此操作只刪除插件儲存的歷史，不會修改 Zotero 資料庫，也不會刪除目前論文附件。確定繼續嗎？",
      orphanCleanCanceled: "已取消清理已刪除條目的歷史。",
      orphanCleaning: "正在清理已刪除條目的歷史...",
      orphanCleanFailed: "已刪除條目的歷史清理失敗：{message}",
      orphanCleanSkipped: "已清理 {cleanedCount} 個歷史，{skippedCount} 個因安全校驗未通過而跳過。",
      orphanCleaned: "已清理 {count} 個已刪除條目的版本歷史。"
    },
    "en-US": {
      ...zhCN,
      locale: "en-US",
      colon: ": ",
      defaultNote: "Paper version",
      gitSettingsTitle: "Git Settings",
      gitSettingsDescription: "git4zotero uses local Git to save manuscript attachment versions in the Zotero profile directory.",
      gitPathLabel: "Git executable path",
      testGit: "Test Git",
      gitPathHelp: "Leave blank to use git from the system PATH. On Windows, you can enter C:\\Program Files\\Git\\cmd\\git.exe.",
      currentInput: "Current input",
      savedPath: "Saved path",
      notSaved: "Not saved",
      gitStatusInitial: "Git has not been tested yet.",
      versionBehaviorTitle: "Version Behavior",
      defaultNoteLabel: "Default version note",
      defaultNoteHelp: "If the version note is empty when creating a version, this default text will be used.",
      autoSafetyLabel: "Automatically create a safety version before restoring an old version",
      autoSafetyHelp: "Recommended. The current file is saved before restore to reduce accidental overwrite risk.",
      statusTitle: "Status and Troubleshooting",
      pluginVersion: "Plugin version",
      supportedFormats: "Supported formats",
      supportedFormatsValue: ".docx content-level diff; .doc file-level tracking",
      dataDirectory: "Data directory",
      dataDirectoryFallback: "git4zotero folder in the Zotero profile directory",
      trackingHelp: "Tracking is controlled by the Paper Versions context menu in the item list; the right pane only displays status.",
      diagnosticsTitle: "Diagnostics and Health Check",
      diagnosticsDescription: "Copy diagnostics for issue reports; the health check only reads status and will not repair or clean history automatically.",
      copyDiagnostics: "Copy Diagnostics",
      runHealthCheck: "Run Health Check",
      diagnosticsInitial: "Diagnostics have not been copied yet.",
      diagnosticsBuilding: "Building diagnostics...",
      diagnosticsCopied: "Diagnostics copied to the clipboard.",
      diagnosticsCopyFallback: "Clipboard write failed. Copy the diagnostics below manually:\n{report}",
      diagnosticsFailed: "Diagnostics failed: {message}",
      healthInitial: "Health check has not run yet.",
      healthRunning: "Running health check...",
      healthFailed: "Health check failed: {message}",
      healthSummary: "Health check complete: {okCount} normal, {warningCount} need attention, {errorCount} errors, {skippedCount} skipped.\n{details}",
      lastErrorTitle: "Recent Error",
      lastErrorNone: "No error has been recorded yet.",
      lastErrorSummary: "{time} · {category} · {operation}\n{message}\nSuggestion: {suggestion}",
      healthStatusOk: "Normal",
      healthStatusWarning: "Needs attention",
      healthStatusError: "Error",
      healthStatusSkipped: "Skipped",
      healthCheckGit: "Test Git",
      healthCheckDataDirectory: "Check data directory",
      healthCheckWritePermission: "Check write permission",
      healthCheckDeletedHistory: "Scan history for deleted items",
      healthCheckMetadataSchema: "Check metadata schema",
      healthGitAvailable: "Git available: {detail}",
      healthGitUnavailable: "Git unavailable: {detail}",
      healthDataDirectoryReady: "Data directory is available: {path}",
      healthDataDirectoryFailed: "Data directory is unavailable: {message}",
      healthWritePermissionReady: "Write permission is available: {path}",
      healthWritePermissionFailed: "Write permission check failed: {message}",
      healthDeletedHistoryNone: "No version history left by deleted items was found.",
      healthDeletedHistoryFound: "Found {count} version histories left by deleted items.",
      healthMetadataSchemaOk: "Metadata schema is normal; checked {count} repositories.",
      healthMetadataSchemaIssues: "Found {count} metadata issues: {details}",
      healthMetadataSchemaSkipped: "Data directory does not exist; metadata schema check was skipped.",
      checkDeletedHistory: "Check History for Deleted Items",
      cleanDeletedHistory: "Clean History for Deleted Items",
      orphanInitial: "History left by deleted items has not been checked yet.",
      orphanHelp: "When an item is moved to the Zotero trash, version history is kept so it can continue to be used if the item is restored. If an item is permanently deleted or the trash is emptied, git4zotero cleans its history. This tool checks and cleans legacy history that no longer has a matching item.",
      testingGit: "Testing Git...",
      gitAvailable: "Git available: {detail}\nTested path: {testedPath}\nSaved path: {savedPath}",
      gitUnavailable: "Git unavailable: {detail}",
      gitPathCheckHint: "Check the Git path.",
      gitTestFailed: "Git test failed: {message}",
      orphanChecking: "Checking for version history left by deleted items...",
      orphanCheckFailed: "History check for deleted items failed: {message}",
      orphanNone: "No history needs cleanup.",
      orphanNoneSkipped: "No history needs cleanup. {count} repositories were skipped because the path or metadata was abnormal.",
      orphanFound: "Found {count} version histories left by deleted items:\n{paths}{more}\nAfter confirming these items no longer need to be restored, click \"Clean History for Deleted Items\".",
      orphanMore: "\n...and {count} more.",
      orphanCleanTitle: "Clean History for Deleted Items",
      orphanCleanConfirm: "This will delete {count} git4zotero version histories whose corresponding Zotero items can no longer be found. This only deletes plugin-saved history; it will not modify the Zotero database or delete current manuscript attachments. Continue?",
      orphanCleanCanceled: "Cleanup of history for deleted items was canceled.",
      orphanCleaning: "Cleaning history for deleted items...",
      orphanCleanFailed: "Cleanup of history for deleted items failed: {message}",
      orphanCleanSkipped: "Cleaned {cleanedCount} histories; {skippedCount} were skipped because safety checks failed.",
      orphanCleaned: "Cleaned {count} version histories left by deleted items."
    }
  };

  let currentText = null;

  function resolve(locale) {
    const normalized = String(locale || "").trim().toLowerCase();
    if (normalized === "zh-cn" || normalized === "zh-sg" || normalized.startsWith("zh-hans")) {
      return "zh-CN";
    }
    if (normalized === "zh-tw" || normalized === "zh-hk" || normalized === "zh-mo" || normalized.startsWith("zh-hant")) {
      return "zh-TW";
    }
    if (normalized.startsWith("zh")) {
      return "zh-CN";
    }
    return "en-US";
  }

  function current() {
    if (!currentText) {
      const locale = typeof Zotero !== "undefined" ? Zotero.locale : "";
      currentText = bundles[resolve(locale)] || bundles["en-US"];
    }
    return currentText;
  }

  function format(key, values = {}) {
    return String(current()[key] ?? key).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
      return Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match;
    });
  }

  function apply(doc) {
    const text = current();
    doc?.querySelectorAll?.("[data-git4zotero-i18n]")?.forEach((node) => {
      const key = node.getAttribute("data-git4zotero-i18n");
      node.textContent = text[key] ?? key;
    });
    doc?.querySelectorAll?.("[data-git4zotero-i18n-placeholder]")?.forEach((node) => {
      const key = node.getAttribute("data-git4zotero-i18n-placeholder");
      node.setAttribute("placeholder", text[key] ?? key);
    });
  }

  return { apply, current, format, resolve };
})();

var Git4ZoteroPreferences = {
  initialized: false,
  testing: false,
  retryTimer: null,
  platform: null,
  cleanupService: null,
  diagnosticService: null,
  lastOrphanScan: null,

  init(event = null) {
    if (this.initialized) {
      return;
    }

    const doc = this.getDocument(event);
    if (!this.requiredElementsReady(doc)) {
      this.scheduleInit(doc);
      return;
    }

    this.initialized = true;
    Git4ZoteroPreferenceL10n.apply(doc);
    const gitInput = document.getElementById("git4zotero-git-path");
    if (gitInput && !gitInput.value) {
      gitInput.value = this.getSavedGitPath();
    }
    this.refreshResolvedGit();
    this.refreshSavedGit();
    this.refreshDataDirectory();
    this.setStatus(this.getStatusText() || this.text("gitStatusInitial"), "");
    this.refreshLastErrorStatus();

    gitInput?.addEventListener("input", () => {
      this.refreshResolvedGit();
      this.refreshSavedGit();
    });

    const testButton = document.getElementById("git4zotero-test-git");
    testButton?.addEventListener("click", () => {
      this.testGit();
    });
    document.getElementById("git4zotero-check-orphans")?.addEventListener("click", (clickEvent) => {
      this.checkOrphanHistory(clickEvent);
    });
    document.getElementById("git4zotero-clean-orphans")?.addEventListener("click", (clickEvent) => {
      this.cleanupOrphanHistory(clickEvent);
    });
    document.getElementById("git4zotero-copy-diagnostics")?.addEventListener("click", (clickEvent) => {
      this.copyDiagnostics(clickEvent);
    });
    document.getElementById("git4zotero-run-health-check")?.addEventListener("click", (clickEvent) => {
      this.runHealthCheck(clickEvent);
    });

    this.defer(() => this.refreshResolvedGit());
  },

  async testGit(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    if (this.testing) {
      return;
    }

    const button = document.getElementById("git4zotero-test-git");
    if (button) {
      button.disabled = true;
    }
    this.testing = true;
    this.refreshResolvedGit();
    this.setStatus(this.text("testingGit"), "");

    try {
      const platform = this.getPlatform();
      const result = await platform.checkGitAvailability(this.getGitInputValue(), { persist: true });

      if (result.available) {
        this.setGitInputValue(result.command);
        this.refreshResolvedGit();
        this.refreshSavedGit();
        this.setStatus(
          this.text("gitAvailable", {
            detail: result.version || result.detail || result.command,
            testedPath: result.command,
            savedPath: this.getSavedGitPath() || result.command
          }),
          "success"
        );
      }
      else {
        this.recordPreferenceError(new Error(result.error || result.detail || this.text("gitPathCheckHint")), "test Git");
        this.setStatus(this.text("gitUnavailable", {
          detail: result.error || result.detail || this.text("gitPathCheckHint")
        }), "error");
      }
    }
    catch (error) {
      this.recordPreferenceError(error, "test Git");
      this.setStatus(this.text("gitTestFailed", { message: error.message || String(error) }), "error");
      try {
        Zotero.debug?.(`git4zotero: Git preference test failed: ${error?.stack || error}`);
      }
      catch (_debugError) {
        // Ignore missing Zotero debug API in unusual preference contexts.
      }
    }
    finally {
      this.testing = false;
      if (button) {
        button.disabled = false;
      }
    }
  },

  async checkOrphanHistory(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setOrphanButtonsDisabled(true);
    this.setOrphanStatus(this.text("orphanChecking"), "");

    try {
      const scan = await this.getCleanupService().scanOrphanRepositories();
      this.lastOrphanScan = scan;
      this.setOrphanStatus(this.formatOrphanScan(scan), scan.count ? "warning" : "success");
    }
    catch (error) {
      this.recordPreferenceError(error, "check deleted item history");
      this.setOrphanStatus(this.text("orphanCheckFailed", { message: error.message || String(error) }), "error");
      this.debug(`orphan history check failed: ${error?.stack || error}`);
    }
    finally {
      this.setOrphanButtonsDisabled(false);
    }
  },

  async cleanupOrphanHistory(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setOrphanButtonsDisabled(true);

    try {
      const service = this.getCleanupService();
      const scan = this.lastOrphanScan ?? await service.scanOrphanRepositories();
      if (!scan.count) {
        this.lastOrphanScan = scan;
        this.setOrphanStatus(this.text("orphanNone"), "success");
        return;
      }

      const confirmed = this.getPlatform().confirm(
        this.text("orphanCleanTitle"),
        this.text("orphanCleanConfirm", { count: scan.count })
      );
      if (!confirmed) {
        this.setOrphanStatus(this.text("orphanCleanCanceled"), "");
        return;
      }

      this.setOrphanStatus(this.text("orphanCleaning"), "");
      const result = await service.cleanupOrphanRepositories();
      this.lastOrphanScan = null;
      this.setOrphanStatus(this.formatOrphanCleanup(result), result.skipped.length ? "warning" : "success");
    }
    catch (error) {
      this.recordPreferenceError(error, "clean deleted item history");
      this.setOrphanStatus(this.text("orphanCleanFailed", { message: error.message || String(error) }), "error");
      this.debug(`orphan history cleanup failed: ${error?.stack || error}`);
    }
    finally {
      this.setOrphanButtonsDisabled(false);
    }
  },

  async copyDiagnostics(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setDiagnosticsButtonsDisabled(true);
    this.setDiagnosticsStatus(this.text("diagnosticsBuilding"), "");
    this.setDiagnosticsOutput("", true);

    try {
      const report = await this.getDiagnosticService().buildReport({ redactPaths: true });
      try {
        this.getPlatform().copyTextToClipboard(report);
        this.setDiagnosticsStatus(this.text("diagnosticsCopied"), "success");
      }
      catch (_copyError) {
        this.setDiagnosticsStatus(this.text("diagnosticsCopyFallback", { report }), "warning");
        this.setDiagnosticsOutput(report, false);
      }
    }
    catch (error) {
      this.recordPreferenceError(error, "copy diagnostics");
      this.setDiagnosticsStatus(this.text("diagnosticsFailed", { message: error.message || String(error) }), "error");
      this.debug(`copy diagnostics failed: ${error?.stack || error}`);
    }
    finally {
      this.setDiagnosticsButtonsDisabled(false);
    }
  },

  async runHealthCheck(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setDiagnosticsButtonsDisabled(true);
    this.setHealthStatus(this.text("healthRunning"), "");

    try {
      const result = await this.getDiagnosticService().runHealthCheck();
      const details = this.formatHealthCheck(result.checks);
      const tone = result.errorCount ? "error" : (result.warningCount ? "warning" : "success");
      this.setHealthStatus(this.text("healthSummary", {
        okCount: result.okCount,
        warningCount: result.warningCount,
        errorCount: result.errorCount,
        skippedCount: result.skippedCount,
        details
      }), tone);
    }
    catch (error) {
      this.recordPreferenceError(error, "run health check");
      this.setHealthStatus(this.text("healthFailed", { message: error.message || String(error) }), "error");
      this.debug(`health check failed: ${error?.stack || error}`);
    }
    finally {
      this.setDiagnosticsButtonsDisabled(false);
      this.refreshLastErrorStatus();
    }
  },

  getPlatform() {
    if (this.platform) {
      return this.platform;
    }
    const module = ChromeUtils.importESModule("chrome://git4zotero/content/src/platform.mjs");
    this.platform = new module.ZoteroPlatform({
      Zotero,
      Services: typeof Services !== "undefined" ? Services : null,
      Cc: typeof Cc !== "undefined" ? Cc : null,
      Ci: typeof Ci !== "undefined" ? Ci : null,
      ChromeUtils,
      IOUtils: typeof IOUtils !== "undefined" ? IOUtils : null,
      PathUtils: typeof PathUtils !== "undefined" ? PathUtils : null
    });
    return this.platform;
  },

  getCleanupService() {
    if (this.cleanupService) {
      return this.cleanupService;
    }
    const cleanupModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/cleanup.mjs");
    const metadataModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/metadata.mjs");
    const platform = this.getPlatform();
    const indexStore = new cleanupModule.RepositoryIndexStore(platform);
    const metadataStore = new metadataModule.MetadataStore(platform);
    this.cleanupService = new cleanupModule.RepositoryCleanupService({
      platform,
      metadataStore,
      indexStore
    });
    return this.cleanupService;
  },

  getDiagnosticService() {
    if (this.diagnosticService) {
      return this.diagnosticService;
    }
    const diagnosticsModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/diagnostics.mjs");
    const attachmentModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/attachments.mjs");
    const gitModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/git-backend.mjs");
    const metadataModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/metadata.mjs");
    const cleanupModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/cleanup.mjs");
    const versionModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/version-service.mjs");
    const platform = this.getPlatform();
    const attachmentFinder = new attachmentModule.AttachmentFinder({ Zotero });
    const gitBackend = new gitModule.GitBackend(platform);
    const metadataStore = new metadataModule.MetadataStore(platform);
    const indexStore = new cleanupModule.RepositoryIndexStore(platform);
    const versionService = new versionModule.VersionService({
      platform,
      attachmentFinder,
      gitBackend,
      metadataStore,
      indexStore,
      pluginVersion: platform.getPluginVersion?.() || ""
    });
    this.diagnosticService = new diagnosticsModule.DiagnosticService({
      platform,
      cleanupService: this.getCleanupService(),
      metadataStore,
      versionService,
      pluginVersion: platform.getPluginVersion?.() || ""
    });
    return this.diagnosticService;
  },

  getDocument(event = null) {
    return event?.target?.ownerDocument ?? document;
  },

  requiredElementsReady(doc = document) {
    return !!(
      doc?.getElementById?.("git4zotero-git-path")
      && doc.getElementById("git4zotero-test-git")
      && doc.getElementById("git4zotero-git-status")
      && doc.getElementById("git4zotero-orphan-status")
      && doc.getElementById("git4zotero-diagnostics-status")
      && doc.getElementById("git4zotero-health-status")
    );
  },

  scheduleInit(_doc = document) {
    if (this.retryTimer) {
      return;
    }
    this.retryTimer = this.defer(() => {
      this.retryTimer = null;
      this.init();
    });
  },

  defer(callback) {
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
      return window.setTimeout(callback, 0);
    }
    if (typeof setTimeout === "function") {
      return setTimeout(callback, 0);
    }
    callback();
    return null;
  },

  getGitExecutable() {
    return this.normalizeExecutablePath(this.getGitInputValue()) || "git";
  },

  getGitInputValue() {
    const input = document.getElementById("git4zotero-git-path");
    return input?.value ?? this.getSavedGitPath();
  },

  setGitInputValue(value) {
    const input = document.getElementById("git4zotero-git-path");
    if (input) {
      input.value = value || "";
    }
  },

  getSavedGitPath() {
    return this.normalizeExecutablePath(Zotero.Prefs.get("extensions.git4zotero.gitPath", true));
  },

  normalizeExecutablePath(value) {
    const trimmed = String(value || "").trim();
    if (trimmed.length >= 2) {
      const first = trimmed[0];
      const last = trimmed[trimmed.length - 1];
      if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
        return trimmed.slice(1, -1).trim();
      }
    }
    return trimmed;
  },

  refreshResolvedGit() {
    const current = document.getElementById("git4zotero-current-git");
    if (current) {
      current.textContent = this.getGitExecutable();
    }
  },

  refreshSavedGit() {
    const saved = document.getElementById("git4zotero-saved-git");
    if (saved) {
      saved.textContent = this.getSavedGitPath() || this.text("notSaved");
    }
  },

  refreshDataDirectory() {
    const target = document.getElementById("git4zotero-data-dir");
    if (!target) {
      return;
    }

    try {
      if (typeof Services !== "undefined" && typeof Ci !== "undefined") {
        const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
        const separator = profileDir.includes("\\") ? "\\" : "/";
        target.textContent = `${profileDir}${separator}git4zotero`;
      }
    }
    catch (_error) {
      target.textContent = this.text("dataDirectoryFallback");
    }
  },

  setStatus(message, tone) {
    const status = document.getElementById("git4zotero-git-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone || "";
  },

  setOrphanStatus(message, tone) {
    const status = document.getElementById("git4zotero-orphan-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone || "";
  },

  setDiagnosticsStatus(message, tone) {
    const status = document.getElementById("git4zotero-diagnostics-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone || "";
  },

  setHealthStatus(message, tone) {
    const status = document.getElementById("git4zotero-health-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone || "";
  },

  setLastErrorStatus(message, tone) {
    const status = document.getElementById("git4zotero-last-error-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone || "";
  },

  setDiagnosticsOutput(message, hidden) {
    const output = document.getElementById("git4zotero-diagnostics-output");
    if (!output) {
      return;
    }
    output.textContent = message;
    output.hidden = hidden;
  },

  setOrphanButtonsDisabled(disabled) {
    for (const id of ["git4zotero-check-orphans", "git4zotero-clean-orphans"]) {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = disabled;
      }
    }
  },

  setDiagnosticsButtonsDisabled(disabled) {
    for (const id of ["git4zotero-copy-diagnostics", "git4zotero-run-health-check"]) {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = disabled;
      }
    }
  },

  formatOrphanScan(scan) {
    if (!scan.count) {
      return scan.skipped?.length
        ? this.text("orphanNoneSkipped", { count: scan.skipped.length })
        : this.text("orphanNone");
    }
    const paths = scan.repositories
      .slice(0, 5)
      .map((entry) => `- ${entry.repoRelativePath}`)
      .join("\n");
    const more = scan.count > 5 ? this.text("orphanMore", { count: scan.count - 5 }) : "";
    return this.text("orphanFound", { count: scan.count, paths, more });
  },

  formatOrphanCleanup(result) {
    const cleanedCount = result.cleaned?.length ?? 0;
    const skippedCount = result.skipped?.length ?? 0;
    if (!cleanedCount && !skippedCount) {
      return this.text("orphanNone");
    }
    return skippedCount
      ? this.text("orphanCleanSkipped", { cleanedCount, skippedCount })
      : this.text("orphanCleaned", { count: cleanedCount });
  },

  formatHealthCheck(checks) {
    return checks.map((check) => {
      const label = this.text(`healthStatus${this.capitalizeStatus(check.status)}`);
      const colon = this.text("colon");
      const stop = this.text("locale") === "en-US" ? "." : "。";
      const suggestion = check.suggestion ? ` ${check.suggestion}` : "";
      return `- ${check.label}${colon}${label}${stop}${check.detail || ""}${suggestion}`;
    }).join("\n");
  },

  capitalizeStatus(status) {
    if (status === "ok") {
      return "Ok";
    }
    if (status === "warning") {
      return "Warning";
    }
    if (status === "error") {
      return "Error";
    }
    return "Skipped";
  },

  refreshLastErrorStatus() {
    try {
      const diagnosticsModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/diagnostics.mjs");
      const entry = new diagnosticsModule.LastErrorStore(this.getPlatform()).read();
      if (!entry) {
        this.setLastErrorStatus(this.text("lastErrorNone"), "");
        return;
      }
      this.setLastErrorStatus(this.text("lastErrorSummary", {
        time: entry.time || "",
        category: entry.title || entry.category || "",
        operation: entry.operation || "",
        message: entry.message || entry.rawMessage || "",
        suggestion: entry.suggestion || ""
      }), "warning");
    }
    catch (_error) {
      this.setLastErrorStatus(this.text("lastErrorNone"), "");
    }
  },

  recordPreferenceError(error, operation) {
    try {
      const diagnosticsModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/diagnostics.mjs");
      diagnosticsModule.recordLastError(this.getPlatform(), error, { operation });
      this.refreshLastErrorStatus();
    }
    catch (storeError) {
      this.debug(`last error record failed: ${storeError?.stack || storeError}`);
    }
  },

  text(key, values = {}) {
    return Git4ZoteroPreferenceL10n.format(key, values);
  },

  debug(message) {
    try {
      Zotero.debug?.(`git4zotero: ${message}`);
    }
    catch (_debugError) {
      // Ignore missing Zotero debug API in unusual preference contexts.
    }
  },

  getStatusText() {
    const status = document.getElementById("git4zotero-git-status");
    return status?.textContent?.trim?.() ?? "";
  }
};

window.Git4ZoteroPreferences = Git4ZoteroPreferences;

function initializeGit4ZoteroPreferences() {
  window.Git4ZoteroPreferences.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGit4ZoteroPreferences, { once: true });
  window.addEventListener("load", initializeGit4ZoteroPreferences, { once: true });
}
else {
  initializeGit4ZoteroPreferences();
}
