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
    firstUseTitle: "首次使用向导",
    firstUseDescription: "适合第一次安装插件或第一次在新电脑上使用。向导只显示说明和检查结果，不会修改论文文件。",
    openFirstUseGuide: "打开首次使用向导",
    firstUseGuideTitle: "git4zotero 首次使用向导",
    firstUseGuideBody: "1. 安装并测试 Git：本插件只用 Git 在本机保存版本历史，不要求你会写代码。\n2. 数据目录：版本历史保存在 Zotero 配置目录下的 git4zotero 文件夹，不上传云端。\n3. 启用版本管理：在 Zotero 条目列表中右键论文条目或附件，选择“论文版本 → 启用版本管理”。\n4. 保存后创建版本：先在 Word/WPS/LibreOffice 中保存论文，再右键选择“检查修改”和“创建版本...”。\n5. 格式差异：.docx 支持正文级差异；.doc 只能做文件级跟踪。",
    lowRiskActionsTitle: "低风险工具",
    openDataDirectory: "打开数据目录",
    copyIssueTemplate: "复制 issue 模板",
    openGitGuide: "打开 Git 安装指南",
    dataDirectoryOpened: "已打开数据目录：{path}",
    dataDirectoryOpenFailed: "无法打开数据目录：{message}",
    issueTemplateCopied: "issue 模板已复制到剪贴板。",
    issueTemplateFallback: "无法写入剪贴板，请手动复制下方 issue 模板：\n{template}",
    gitGuideOpened: "已打开 Git 安装指南。",
    gitGuideOpenFailed: "无法打开 Git 安装指南：{message}",
    archiveActionsTitle: "版本历史备份与迁移",
    archiveActionsDescription: "导出/导入只处理 git4zotero 保存的本地版本历史，不包含 Zotero 原始附件文件。导入时只合并缺失仓库，不覆盖已有历史。",
    exportAllHistory: "导出全部版本历史...",
    importHistory: "导入版本历史...",
    archiveStatusInitial: "尚未导入或导出版本历史。",
    archiveExporting: "正在导出全部版本历史...",
    archiveImporting: "正在导入版本历史...",
    archiveCanceled: "已取消操作。",
    archiveExportFailed: "导出版本历史失败：{message}",
    archiveImportFailed: "导入版本历史失败：{message}",
    archiveExportSuccess: "版本历史已导出：{path}\n包含 {repoCount} 个仓库，{fileCount} 个文件。",
    archiveImportSuccess: "版本历史导入完成：导入 {importedCount} 个，跳过 {skippedCount} 个，失败 {failedCount} 个。",
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
    healthCheckRepositoryConsistency: "检查 Git/index/metadata 一致性",
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
    healthRepositoryConsistencyOk: "Git/index/metadata 一致性正常，已检查 {count} 个仓库。",
    healthRepositoryConsistencyIssues: "发现 {count} 个一致性问题：{details}",
    healthRepositoryConsistencySkipped: "数据目录不存在，已跳过一致性检查。",
    healthSuggestionGit: "建议安装 Git，或在设置页填写正确的 git.exe 路径后重新测试。",
    healthSuggestionDataDirectory: "建议检查 Zotero profile 是否可写，或复制诊断信息提交 issue。",
    healthSuggestionWritePermission: "建议关闭可能占用目录的安全软件或同步软件，确认 Zotero profile 可写后重试。",
    healthSuggestionDeletedHistory: "确认条目已不需要恢复后，可使用“清理已删除条目的历史”显式清理。",
    healthSuggestionMetadata: "建议先不要手动修改仓库文件，复制诊断信息并提交 issue。",
    healthSuggestionConsistency: "建议先不要手动修复仓库；复制诊断信息提交 issue，后续可按明确修复入口处理。",
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
      firstUseTitle: "首次使用向導",
      firstUseDescription: "適合第一次安裝插件或第一次在新電腦上使用。向導只顯示說明和檢查結果，不會修改論文檔案。",
      openFirstUseGuide: "開啟首次使用向導",
      firstUseGuideTitle: "git4zotero 首次使用向導",
      firstUseGuideBody: "1. 安裝並測試 Git：本插件只用 Git 在本機儲存版本歷史，不要求你會寫程式。\n2. 資料目錄：版本歷史儲存在 Zotero 設定目錄下的 git4zotero 資料夾，不上傳雲端。\n3. 啟用版本管理：在 Zotero 條目清單中右鍵論文條目或附件，選擇「論文版本 → 啟用版本管理」。\n4. 儲存後建立版本：先在 Word/WPS/LibreOffice 中儲存論文，再右鍵選擇「檢查修改」和「建立版本...」。\n5. 格式差異：.docx 支援正文級差異；.doc 只能做檔案級追蹤。",
      lowRiskActionsTitle: "低風險工具",
      openDataDirectory: "開啟資料目錄",
      copyIssueTemplate: "複製 issue 範本",
      openGitGuide: "開啟 Git 安裝指南",
      dataDirectoryOpened: "已開啟資料目錄：{path}",
      dataDirectoryOpenFailed: "無法開啟資料目錄：{message}",
      issueTemplateCopied: "issue 範本已複製到剪貼簿。",
      issueTemplateFallback: "無法寫入剪貼簿，請手動複製下方 issue 範本：\n{template}",
      gitGuideOpened: "已開啟 Git 安裝指南。",
      gitGuideOpenFailed: "無法開啟 Git 安裝指南：{message}",
      archiveActionsTitle: "版本歷史備份與遷移",
      archiveActionsDescription: "匯出/匯入只處理 git4zotero 儲存的本機版本歷史，不包含 Zotero 原始附件檔案。匯入時只合併缺失倉庫，不覆蓋既有歷史。",
      exportAllHistory: "匯出全部版本歷史...",
      importHistory: "匯入版本歷史...",
      archiveStatusInitial: "尚未匯入或匯出版本歷史。",
      archiveExporting: "正在匯出全部版本歷史...",
      archiveImporting: "正在匯入版本歷史...",
      archiveCanceled: "已取消操作。",
      archiveExportFailed: "匯出版本歷史失敗：{message}",
      archiveImportFailed: "匯入版本歷史失敗：{message}",
      archiveExportSuccess: "版本歷史已匯出：{path}\n包含 {repoCount} 個倉庫，{fileCount} 個檔案。",
      archiveImportSuccess: "版本歷史匯入完成：匯入 {importedCount} 個，跳過 {skippedCount} 個，失敗 {failedCount} 個。",
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
      healthCheckRepositoryConsistency: "檢查 Git/index/metadata 一致性",
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
      healthRepositoryConsistencyOk: "Git/index/metadata 一致性正常，已檢查 {count} 個倉庫。",
      healthRepositoryConsistencyIssues: "發現 {count} 個一致性問題：{details}",
      healthRepositoryConsistencySkipped: "資料目錄不存在，已跳過一致性檢查。",
      healthSuggestionGit: "建議安裝 Git，或在設定頁填寫正確的 git.exe 路徑後重新測試。",
      healthSuggestionDataDirectory: "建議檢查 Zotero profile 是否可寫，或複製診斷資訊提交 issue。",
      healthSuggestionWritePermission: "建議關閉可能占用目錄的安全軟體或同步軟體，確認 Zotero profile 可寫後重試。",
      healthSuggestionDeletedHistory: "確認條目已不需要恢復後，可使用「清理已刪除條目的歷史」明確清理。",
      healthSuggestionMetadata: "建議先不要手動修改倉庫檔案，複製診斷資訊並提交 issue。",
      healthSuggestionConsistency: "建議先不要手動修復倉庫；複製診斷資訊提交 issue，後續可按明確修復入口處理。",
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
      firstUseTitle: "First-Use Guide",
      firstUseDescription: "Use this when installing the plugin for the first time or setting up a new computer. The guide only shows instructions and checks; it does not modify manuscript files.",
      openFirstUseGuide: "Open First-Use Guide",
      firstUseGuideTitle: "git4zotero First-Use Guide",
      firstUseGuideBody: "1. Install and test Git: this plugin only uses Git to save local version history; you do not need to write code.\n2. Data directory: version history is stored in the git4zotero folder under your Zotero profile and is not uploaded to the cloud.\n3. Enable version management: in the Zotero item list, right-click the manuscript item or attachment and choose \"Paper Versions -> Enable Version Management\".\n4. Create versions after saving: save the manuscript in Word/WPS/LibreOffice, then right-click and choose \"Check Changes\" and \"Create Version...\".\n5. Format limits: .docx supports content-level diffs; .doc is file-level tracking only.",
      lowRiskActionsTitle: "Low-Risk Tools",
      openDataDirectory: "Open Data Directory",
      copyIssueTemplate: "Copy Issue Template",
      openGitGuide: "Open Git Install Guide",
      dataDirectoryOpened: "Opened data directory: {path}",
      dataDirectoryOpenFailed: "Could not open data directory: {message}",
      issueTemplateCopied: "Issue template copied to the clipboard.",
      issueTemplateFallback: "Clipboard write failed. Copy the issue template below manually:\n{template}",
      gitGuideOpened: "Opened the Git install guide.",
      gitGuideOpenFailed: "Could not open the Git install guide: {message}",
      archiveActionsTitle: "Version History Backup and Migration",
      archiveActionsDescription: "Export/import handles only local version history saved by git4zotero and does not include Zotero's original attachment files. Import only merges missing repositories and never overwrites existing history.",
      exportAllHistory: "Export All Version History...",
      importHistory: "Import Version History...",
      archiveStatusInitial: "Version history has not been imported or exported yet.",
      archiveExporting: "Exporting all version history...",
      archiveImporting: "Importing version history...",
      archiveCanceled: "Operation canceled.",
      archiveExportFailed: "Version history export failed: {message}",
      archiveImportFailed: "Version history import failed: {message}",
      archiveExportSuccess: "Version history exported: {path}\nIncluded {repoCount} repositories and {fileCount} files.",
      archiveImportSuccess: "Version history import complete: {importedCount} imported, {skippedCount} skipped, {failedCount} failed.",
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
      healthCheckRepositoryConsistency: "Check Git/index/metadata consistency",
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
      healthRepositoryConsistencyOk: "Git/index/metadata consistency is normal; checked {count} repositories.",
      healthRepositoryConsistencyIssues: "Found {count} consistency issues: {details}",
      healthRepositoryConsistencySkipped: "Data directory does not exist; consistency check was skipped.",
      healthSuggestionGit: "Install Git, or enter the correct git.exe path in settings and test again.",
      healthSuggestionDataDirectory: "Check whether the Zotero profile is writable, or copy diagnostics and file an issue.",
      healthSuggestionWritePermission: "Close security or sync software that may be locking the directory, confirm the Zotero profile is writable, then retry.",
      healthSuggestionDeletedHistory: "After confirming the item no longer needs to be restored, use \"Clean History for Deleted Items\" to clean it explicitly.",
      healthSuggestionMetadata: "Do not edit repository files manually; copy diagnostics and file an issue.",
      healthSuggestionConsistency: "Do not repair the repository manually; copy diagnostics and file an issue so a future explicit repair action can be designed.",
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
  archiveService: null,
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
    document.getElementById("git4zotero-first-use-guide")?.addEventListener("click", (clickEvent) => {
      this.openFirstUseGuide(clickEvent);
    });
    document.getElementById("git4zotero-open-data-dir")?.addEventListener("click", (clickEvent) => {
      this.openDataDirectory(clickEvent);
    });
    document.getElementById("git4zotero-copy-issue-template")?.addEventListener("click", (clickEvent) => {
      this.copyIssueTemplate(clickEvent);
    });
    document.getElementById("git4zotero-open-git-guide")?.addEventListener("click", (clickEvent) => {
      this.openGitGuide(clickEvent);
    });
    document.getElementById("git4zotero-export-history")?.addEventListener("click", (clickEvent) => {
      this.exportHistoryArchive(clickEvent);
    });
    document.getElementById("git4zotero-import-history")?.addEventListener("click", (clickEvent) => {
      this.importHistoryArchive(clickEvent);
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

  openFirstUseGuide(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setFirstUseOutput(`${this.text("firstUseGuideTitle")}\n\n${this.text("firstUseGuideBody")}`, false);
  },

  async openDataDirectory(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    try {
      const platform = this.getPlatform();
      const dataDir = platform.getPluginDataDirectory();
      await platform.makeDirectory(dataDir);
      platform.openPath(dataDir);
      this.setDiagnosticsStatus(this.text("dataDirectoryOpened", { path: dataDir }), "success");
    }
    catch (error) {
      this.recordPreferenceError(error, "open data directory");
      this.setDiagnosticsStatus(this.text("dataDirectoryOpenFailed", { message: error.message || String(error) }), "error");
    }
  },

  async copyIssueTemplate(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setDiagnosticsButtonsDisabled(true);
    this.setDiagnosticsStatus(this.text("diagnosticsBuilding"), "");
    this.setDiagnosticsOutput("", true);
    try {
      const template = await this.getDiagnosticService().buildIssueTemplate();
      try {
        this.getPlatform().copyTextToClipboard(template);
        this.setDiagnosticsStatus(this.text("issueTemplateCopied"), "success");
      }
      catch (_copyError) {
        this.setDiagnosticsStatus(this.text("issueTemplateFallback", { template }), "warning");
        this.setDiagnosticsOutput(template, false);
      }
    }
    catch (error) {
      this.recordPreferenceError(error, "copy issue template");
      this.setDiagnosticsStatus(this.text("diagnosticsFailed", { message: error.message || String(error) }), "error");
    }
    finally {
      this.setDiagnosticsButtonsDisabled(false);
    }
  },

  openGitGuide(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    try {
      this.getPlatform().openURL("https://github.com/LiKa-shing/git4zotero/blob/main/docs/GIT-INSTALL-zh.md");
      this.setDiagnosticsStatus(this.text("gitGuideOpened"), "success");
    }
    catch (error) {
      this.recordPreferenceError(error, "open Git guide");
      this.setDiagnosticsStatus(this.text("gitGuideOpenFailed", { message: error.message || String(error) }), "error");
    }
  },

  async exportHistoryArchive(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setArchiveButtonsDisabled(true);
    this.setArchiveStatus(this.text("archiveExporting"), "");
    try {
      const result = await this.getArchiveService().exportRepositoryArchive();
      if (!result?.path) {
        this.setArchiveStatus(this.text("archiveCanceled"), "");
        return;
      }
      this.setArchiveStatus(this.text("archiveExportSuccess", {
        path: result.path,
        repoCount: result.repositoryCount,
        fileCount: result.fileCount
      }), "success");
    }
    catch (error) {
      this.recordPreferenceError(error, "export version history archive");
      this.setArchiveStatus(this.text("archiveExportFailed", { message: error.message || String(error) }), "error");
    }
    finally {
      this.setArchiveButtonsDisabled(false);
    }
  },

  async importHistoryArchive(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setArchiveButtonsDisabled(true);
    this.setArchiveStatus(this.text("archiveImporting"), "");
    try {
      const result = await this.getArchiveService().importRepositoryArchive();
      if (!result) {
        this.setArchiveStatus(this.text("archiveCanceled"), "");
        return;
      }
      this.setArchiveStatus(this.text("archiveImportSuccess", {
        importedCount: result.imported?.length ?? 0,
        skippedCount: result.skipped?.length ?? 0,
        failedCount: result.failed?.length ?? 0
      }), result.failed?.length ? "warning" : "success");
    }
    catch (error) {
      this.recordPreferenceError(error, "import version history archive");
      this.setArchiveStatus(this.text("archiveImportFailed", { message: error.message || String(error) }), "error");
    }
    finally {
      this.setArchiveButtonsDisabled(false);
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

  getArchiveService() {
    if (this.archiveService) {
      return this.archiveService;
    }
    const archiveModule = ChromeUtils.importESModule("chrome://git4zotero/content/src/archive.mjs");
    this.archiveService = new archiveModule.RepositoryArchiveService({
      platform: this.getPlatform(),
      cleanupService: this.getCleanupService(),
      pluginVersion: this.getPlatform().getPluginVersion?.() || ""
    });
    return this.archiveService;
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
      && doc.getElementById("git4zotero-archive-status")
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

  setFirstUseOutput(message, hidden) {
    const output = document.getElementById("git4zotero-first-use-output");
    if (!output) {
      return;
    }
    output.textContent = message;
    output.hidden = hidden;
  },

  setArchiveStatus(message, tone) {
    const status = document.getElementById("git4zotero-archive-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone || "";
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
    for (const id of ["git4zotero-copy-diagnostics", "git4zotero-run-health-check", "git4zotero-copy-issue-template"]) {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = disabled;
      }
    }
  },

  setArchiveButtonsDisabled(disabled) {
    for (const id of ["git4zotero-export-history", "git4zotero-import-history"]) {
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
