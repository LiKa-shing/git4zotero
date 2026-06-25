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
    firstUseGuideSubtitle: "按步骤检查必要环境，并可直接执行安全配置和诊断操作。",
    guideClose: "关闭",
    guidePrevious: "上一步",
    guideNext: "下一步",
    guideFinish: "完成",
    guideStatusOk: "正常",
    guideStatusWarning: "需处理",
    guideStatusError: "错误",
    guideStatusPending: "待检查",
    guideStatusChecking: "检查中",
    guideGitStepTitle: "Git 准备",
    guideGitStepDescription: "确认 Git 可执行文件路径和可用状态。git4zotero 只使用本机 Git 保存版本历史。",
    guideGitChecking: "正在检测 Git：{path}",
    guideGitReady: "Git 可用：{detail}\n当前 Git 路径：{path}",
    guideGitMissing: "Git 暂不可用：{detail}\n当前 Git 路径：{path}",
    guideDataStepTitle: "数据目录",
    guideDataStepDescription: "确认插件数据目录位置和写入权限。版本历史保存在这里，不改变 Zotero 原始附件。",
    guideDataReady: "插件数据目录：{path}",
    guideDataFailed: "无法读取插件数据目录：{message}",
    guideDataWriteChecking: "正在检查数据目录写权限...",
    guideDataWriteReady: "写权限正常：{path}",
    guideDataWriteFailed: "写权限检查失败：{message}",
    guideDataActionCheckWrite: "检查写权限",
    guideArchiveStepTitle: "迁移备份",
    guideArchiveStepDescription: "配置条目级版本历史 ZIP 和版本摘要导出的默认目录；导入/导出请在具体条目的右键“论文版本”菜单中执行。",
    guideArchiveReady: "迁移导出目录：{path}",
    guideArchiveUnset: "未指定迁移导出目录；导出时将使用系统保存对话框默认位置。",
    guideArchiveUnavailable: "迁移导出目录不可用：{message}",
    guideArchiveActionChoose: "选择目录",
    guideTroubleshootingStepTitle: "排错准备",
    guideTroubleshootingStepDescription: "生成健康检查和诊断信息，方便定位 Git、数据目录和版本仓库问题。",
    guideTroubleshootingReady: "可运行健康检查，或复制脱敏诊断信息和 issue 模板。",
    guideTroubleshootingHealthReady: "健康检查状态：\n{summary}",
    guideActionFailed: "操作失败：{message}",
    lowRiskActionsTitle: "支持工具",
    openDataDirectory: "打开数据目录",
    copyIssueTemplate: "复制 issue 模板",
    openGitGuide: "打开 Git 安装指南",
    aboutTitle: "关于",
    aboutMeta: "git4zotero 版本 0.4.2 · LiKa-shing/git4zotero · MIT · Zotero 8.0-9.0.* · .docx/.doc",
    aboutOpenHomepage: "Homepage",
    aboutOpenGitHub: "GitHub",
    aboutOpenFeedback: "Bug Report, Feature Request",
    aboutOpenQA: "Q&A",
    aboutLinkOpened: "已打开项目链接：{label}",
    aboutLinkOpenFailed: "无法打开项目链接：{message}",
    aboutUnknownLink: "未知的项目链接。",
    dataDirectoryOpened: "已打开数据目录：{path}",
    dataDirectoryOpenFailed: "无法打开数据目录：{message}",
    issueTemplateCopied: "issue 模板已复制到剪贴板。",
    issueTemplateFallback: "无法写入剪贴板，请手动复制下方 issue 模板：\n{template}",
    gitGuideOpened: "已打开 Git 安装指南。",
    gitGuideOpenFailed: "无法打开 Git 安装指南：{message}",
    archiveActionsTitle: "版本历史备份与迁移",
    archiveActionsDescription: "条目级导入/导出请在 Zotero 条目列表中右键具体论文条目或附件，选择“论文版本”菜单执行。这里设置条目级历史 ZIP 和版本摘要导出的默认目录。",
    archiveExportDirectoryLabel: "迁移导出目录",
    archiveExportDirectoryHelp: "可直接粘贴目录路径，按 Enter 或离开输入框后自动保存，也可用“选择目录...”辅助选择；条目级历史 ZIP 和版本摘要导出都会默认写入该目录，并自动生成文件名，不影响导入位置、Zotero 原始附件或插件数据目录。",
    archiveExportDirectoryPlaceholder: "可粘贴目录路径；留空使用系统保存对话框默认位置",
    archiveExportDirectoryCurrent: "当前迁移导出目录",
    archiveExportDirectoryChoose: "选择目录...",
    archiveExportDirectoryClear: "清空",
    archiveExportDirectoryChooseTitle: "选择迁移导出目录",
    archiveExportDirectorySaved: "迁移导出目录已保存：{path}",
    archiveExportDirectoryCleared: "已清空迁移导出目录，将使用系统保存对话框默认位置。",
    archiveChooseDirectoryFailed: "选择迁移导出目录失败：{message}\n可直接粘贴目录路径，按 Enter 或离开输入框后自动保存。",
    archiveSaveDirectoryFailed: "自动保存迁移导出目录失败：{message}",
    exportAllHistory: "导出全部版本历史...",
    importHistory: "导入版本历史...",
    archiveStatusInitial: "条目级版本历史导入/导出请从右键“论文版本”菜单执行。",
    archiveExporting: "正在导出版本历史...",
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
    healthNextStepsTitle: "下一步建议",
    healthNoNextSteps: "未发现需要处理的事项。健康检查不会自动修复或清理历史。",
    checkDeletedHistory: "检查已删除条目的历史",
    cleanDeletedHistory: "清理已删除条目的历史",
    orphanInitial: "尚未检查是否有已删除条目留下的版本历史。",
    orphanHelp: "条目移入 Zotero 回收站时，版本历史会保留，方便恢复条目后继续使用。若条目已被永久删除或清空回收站，插件会清理对应历史；此工具可检查并清理升级前遗留的无对应条目的历史。",
    testingGit: "正在测试 Git...",
    gitAvailable: "Git 可用：{detail}\n已测试路径：{testedPath}\n已保存路径：{savedPath}",
    gitUnavailable: "Git 不可用：{detail}",
    gitCandidateSelectTitle: "选择 Git 可执行文件",
    gitCandidateSelectMessage: "检测到多个可用 Git，请选择要保存并使用的路径。",
    gitCandidateSelectionCanceled: "已取消 Git 路径选择。",
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
      firstUseGuideSubtitle: "按步驟檢查必要環境，並可直接執行安全設定和診斷操作。",
      guideClose: "關閉",
      guidePrevious: "上一步",
      guideNext: "下一步",
      guideFinish: "完成",
      guideStatusOk: "正常",
      guideStatusWarning: "需處理",
      guideStatusError: "錯誤",
      guideStatusPending: "待檢查",
      guideStatusChecking: "檢查中",
      guideGitStepTitle: "Git 準備",
      guideGitStepDescription: "確認 Git 可執行檔路徑和可用狀態。git4zotero 只使用本機 Git 儲存版本歷史。",
      guideGitChecking: "正在偵測 Git：{path}",
      guideGitReady: "Git 可用：{detail}\n目前 Git 路徑：{path}",
      guideGitMissing: "Git 暫不可用：{detail}\n目前 Git 路徑：{path}",
      guideDataStepTitle: "資料目錄",
      guideDataStepDescription: "確認插件資料目錄位置和寫入權限。版本歷史儲存在這裡，不改變 Zotero 原始附件。",
      guideDataReady: "插件資料目錄：{path}",
      guideDataFailed: "無法讀取插件資料目錄：{message}",
      guideDataWriteChecking: "正在檢查資料目錄寫入權限...",
      guideDataWriteReady: "寫入權限正常：{path}",
      guideDataWriteFailed: "寫入權限檢查失敗：{message}",
      guideDataActionCheckWrite: "檢查寫入權限",
      guideArchiveStepTitle: "遷移備份",
      guideArchiveStepDescription: "設定條目級版本歷史 ZIP 和版本摘要匯出的預設目錄；匯入/匯出請在具體條目的右鍵「論文版本」選單中執行。",
      guideArchiveReady: "遷移匯出目錄：{path}",
      guideArchiveUnset: "未指定遷移匯出目錄；匯出時將使用系統儲存對話框預設位置。",
      guideArchiveUnavailable: "遷移匯出目錄不可用：{message}",
      guideArchiveActionChoose: "選擇目錄",
      guideTroubleshootingStepTitle: "排錯準備",
      guideTroubleshootingStepDescription: "產生健康檢查和診斷資訊，方便定位 Git、資料目錄和版本倉庫問題。",
      guideTroubleshootingReady: "可執行健康檢查，或複製脫敏診斷資訊和 issue 範本。",
      guideTroubleshootingHealthReady: "健康檢查狀態：\n{summary}",
      guideActionFailed: "操作失敗：{message}",
      lowRiskActionsTitle: "支援工具",
      openDataDirectory: "開啟資料目錄",
      copyIssueTemplate: "複製 issue 範本",
      openGitGuide: "開啟 Git 安裝指南",
      aboutTitle: "關於",
      aboutMeta: "git4zotero 版本 0.4.2 · LiKa-shing/git4zotero · MIT · Zotero 8.0-9.0.* · .docx/.doc",
      aboutOpenHomepage: "Homepage",
      aboutOpenGitHub: "GitHub",
      aboutOpenFeedback: "Bug Report, Feature Request",
      aboutOpenQA: "Q&A",
      aboutLinkOpened: "已開啟專案連結：{label}",
      aboutLinkOpenFailed: "無法開啟專案連結：{message}",
      aboutUnknownLink: "未知的專案連結。",
      dataDirectoryOpened: "已開啟資料目錄：{path}",
      dataDirectoryOpenFailed: "無法開啟資料目錄：{message}",
      issueTemplateCopied: "issue 範本已複製到剪貼簿。",
      issueTemplateFallback: "無法寫入剪貼簿，請手動複製下方 issue 範本：\n{template}",
      gitGuideOpened: "已開啟 Git 安裝指南。",
      gitGuideOpenFailed: "無法開啟 Git 安裝指南：{message}",
      archiveActionsTitle: "版本歷史備份與遷移",
      archiveActionsDescription: "條目級匯入/匯出請在 Zotero 條目列表中右鍵具體論文條目或附件，選擇「論文版本」選單執行。這裡設定條目級歷史 ZIP 和版本摘要匯出的預設目錄。",
      archiveExportDirectoryLabel: "遷移匯出目錄",
      archiveExportDirectoryHelp: "可直接貼上目錄路徑，按 Enter 或離開輸入框後自動儲存，也可用「選擇目錄...」輔助選擇；條目級歷史 ZIP 和版本摘要匯出都會預設寫入該目錄，並自動產生檔名，不影響匯入位置、Zotero 原始附件或插件資料目錄。",
      archiveExportDirectoryPlaceholder: "可貼上目錄路徑；留空使用系統儲存對話框預設位置",
      archiveExportDirectoryCurrent: "目前遷移匯出目錄",
      archiveExportDirectoryChoose: "選擇目錄...",
      archiveExportDirectoryClear: "清空",
      archiveExportDirectoryChooseTitle: "選擇遷移匯出目錄",
      archiveExportDirectorySaved: "遷移匯出目錄已儲存：{path}",
      archiveExportDirectoryCleared: "已清空遷移匯出目錄，將使用系統儲存對話框預設位置。",
      archiveChooseDirectoryFailed: "選擇遷移匯出目錄失敗：{message}\n可直接貼上目錄路徑，按 Enter 或離開輸入框後自動儲存。",
      archiveSaveDirectoryFailed: "自動儲存遷移匯出目錄失敗：{message}",
      exportAllHistory: "匯出全部版本歷史...",
      importHistory: "匯入版本歷史...",
      archiveStatusInitial: "條目級版本歷史匯入/匯出請從右鍵「論文版本」選單執行。",
      archiveExporting: "正在匯出版本歷史...",
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
      healthNextStepsTitle: "下一步建議",
      healthNoNextSteps: "未發現需要處理的事項。健康檢查不會自動修復或清理歷史。",
      checkDeletedHistory: "檢查已刪除條目的歷史",
      cleanDeletedHistory: "清理已刪除條目的歷史",
      orphanInitial: "尚未檢查是否有已刪除條目留下的版本歷史。",
      orphanHelp: "條目移入 Zotero 回收站時，版本歷史會保留，方便恢復條目後繼續使用。若條目已被永久刪除或清空回收站，插件會清理對應歷史；此工具可檢查並清理升級前遺留的無對應條目的歷史。",
      testingGit: "正在測試 Git...",
      gitAvailable: "Git 可用：{detail}\n已測試路徑：{testedPath}\n已儲存路徑：{savedPath}",
      gitUnavailable: "Git 不可用：{detail}",
      gitCandidateSelectTitle: "選擇 Git 可執行檔",
      gitCandidateSelectMessage: "偵測到多個可用 Git，請選擇要儲存並使用的路徑。",
      gitCandidateSelectionCanceled: "已取消 Git 路徑選擇。",
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
      firstUseGuideSubtitle: "Check the required environment step by step and run safe setup or diagnostic actions directly.",
      guideClose: "Close",
      guidePrevious: "Previous",
      guideNext: "Next",
      guideFinish: "Finish",
      guideStatusOk: "OK",
      guideStatusWarning: "Needs attention",
      guideStatusError: "Error",
      guideStatusPending: "Pending",
      guideStatusChecking: "Checking",
      guideGitStepTitle: "Git Setup",
      guideGitStepDescription: "Confirm the Git executable path and availability. git4zotero only uses local Git to save version history.",
      guideGitChecking: "Checking Git: {path}",
      guideGitReady: "Git is available: {detail}\nCurrent Git path: {path}",
      guideGitMissing: "Git is not available yet: {detail}\nCurrent Git path: {path}",
      guideDataStepTitle: "Data Directory",
      guideDataStepDescription: "Confirm the plugin data directory and write permission. Version history is stored here without changing original Zotero attachments.",
      guideDataReady: "Plugin data directory: {path}",
      guideDataFailed: "Could not read the plugin data directory: {message}",
      guideDataWriteChecking: "Checking data directory write permission...",
      guideDataWriteReady: "Write permission is available: {path}",
      guideDataWriteFailed: "Write permission check failed: {message}",
      guideDataActionCheckWrite: "Check Write Permission",
      guideArchiveStepTitle: "Migration Backup",
      guideArchiveStepDescription: "Configure the default directory for item-level version-history ZIP and version-summary exports; import and export are run from the selected item's Paper Versions context menu.",
      guideArchiveReady: "Migration export directory: {path}",
      guideArchiveUnset: "No migration export directory is set; exports will use the system save dialog default.",
      guideArchiveUnavailable: "Migration export directory is unavailable: {message}",
      guideArchiveActionChoose: "Choose Directory",
      guideTroubleshootingStepTitle: "Troubleshooting",
      guideTroubleshootingStepDescription: "Generate health checks and diagnostics to locate Git, data directory, and version repository issues.",
      guideTroubleshootingReady: "You can run a health check, or copy redacted diagnostics and the issue template.",
      guideTroubleshootingHealthReady: "Health check status:\n{summary}",
      guideActionFailed: "Action failed: {message}",
      lowRiskActionsTitle: "Support Tools",
      openDataDirectory: "Open Data Directory",
      copyIssueTemplate: "Copy Issue Template",
      openGitGuide: "Open Git Install Guide",
      aboutTitle: "About",
      aboutMeta: "git4zotero version 0.4.2 · LiKa-shing/git4zotero · MIT · Zotero 8.0-9.0.* · .docx/.doc",
      aboutOpenHomepage: "Homepage",
      aboutOpenGitHub: "GitHub",
      aboutOpenFeedback: "Bug Report, Feature Request",
      aboutOpenQA: "Q&A",
      aboutLinkOpened: "Opened project link: {label}",
      aboutLinkOpenFailed: "Could not open project link: {message}",
      aboutUnknownLink: "Unknown project link.",
      dataDirectoryOpened: "Opened data directory: {path}",
      dataDirectoryOpenFailed: "Could not open data directory: {message}",
      issueTemplateCopied: "Issue template copied to the clipboard.",
      issueTemplateFallback: "Clipboard write failed. Copy the issue template below manually:\n{template}",
      gitGuideOpened: "Opened the Git install guide.",
      gitGuideOpenFailed: "Could not open the Git install guide: {message}",
      archiveActionsTitle: "Version History Backup and Migration",
      archiveActionsDescription: "Run item-level import/export from the Paper Versions context menu on a specific Zotero item or attachment. This pane configures the default directory for exported history ZIP files and version summaries.",
      archiveExportDirectoryLabel: "Migration export directory",
      archiveExportDirectoryHelp: "Paste a directory path directly, then press Enter or leave the input to save it automatically; you can also use Choose Directory... as a helper. Item-level history ZIP and version-summary exports are written there by default with generated file names and do not affect imports, original Zotero attachments, or the plugin data directory.",
      archiveExportDirectoryPlaceholder: "Paste a directory path, or leave blank to use the system save dialog default",
      archiveExportDirectoryCurrent: "Current migration export directory",
      archiveExportDirectoryChoose: "Choose Directory...",
      archiveExportDirectoryClear: "Clear",
      archiveExportDirectoryChooseTitle: "Choose Migration Export Directory",
      archiveExportDirectorySaved: "Migration export directory saved: {path}",
      archiveExportDirectoryCleared: "Migration export directory cleared; the system save dialog default will be used.",
      archiveChooseDirectoryFailed: "Could not choose the migration export directory: {message}\nYou can paste a directory path directly, then press Enter or leave the input to save it automatically.",
      archiveSaveDirectoryFailed: "Could not auto-save the migration export directory: {message}",
      exportAllHistory: "Export All Version History...",
      importHistory: "Import Version History...",
      archiveStatusInitial: "Run item-level version-history import/export from the Paper Versions context menu.",
      archiveExporting: "Exporting version history...",
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
      healthNextStepsTitle: "Next Steps",
      healthNoNextSteps: "No action is needed. Health checks do not repair repositories or clean history automatically.",
      checkDeletedHistory: "Check History for Deleted Items",
      cleanDeletedHistory: "Clean History for Deleted Items",
      orphanInitial: "History left by deleted items has not been checked yet.",
      orphanHelp: "When an item is moved to the Zotero trash, version history is kept so it can continue to be used if the item is restored. If an item is permanently deleted or the trash is emptied, git4zotero cleans its history. This tool checks and cleans legacy history that no longer has a matching item.",
      testingGit: "Testing Git...",
      gitAvailable: "Git available: {detail}\nTested path: {testedPath}\nSaved path: {savedPath}",
      gitUnavailable: "Git unavailable: {detail}",
      gitCandidateSelectTitle: "Choose Git Executable",
      gitCandidateSelectMessage: "Multiple usable Git executables were detected. Choose the path to save and use.",
      gitCandidateSelectionCanceled: "Git path selection was canceled.",
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

const FIRST_USE_GUIDE_STEPS = Object.freeze([
  {
    id: "git",
    titleKey: "guideGitStepTitle",
    descriptionKey: "guideGitStepDescription",
    actions: [
      { id: "test-git", labelKey: "testGit" },
      { id: "open-git-guide", labelKey: "openGitGuide" }
    ]
  },
  {
    id: "data",
    titleKey: "guideDataStepTitle",
    descriptionKey: "guideDataStepDescription",
    actions: [
      { id: "open-data-directory", labelKey: "openDataDirectory" },
      { id: "check-write-permission", labelKey: "guideDataActionCheckWrite" }
    ]
  },
  {
    id: "archive",
    titleKey: "guideArchiveStepTitle",
    descriptionKey: "guideArchiveStepDescription",
    actions: [
      { id: "choose-archive-directory", labelKey: "guideArchiveActionChoose" },
      { id: "clear-archive-directory", labelKey: "archiveExportDirectoryClear" }
    ]
  },
  {
    id: "troubleshooting",
    titleKey: "guideTroubleshootingStepTitle",
    descriptionKey: "guideTroubleshootingStepDescription",
    actions: [
      { id: "run-health-check", labelKey: "runHealthCheck" },
      { id: "copy-diagnostics", labelKey: "copyDiagnostics" },
      { id: "copy-issue-template", labelKey: "copyIssueTemplate" }
    ]
  }
]);

const PROJECT_LINKS = Object.freeze({
  homepage: {
    labelKey: "aboutOpenHomepage",
    url: "https://github.com/LiKa-shing/"
  },
  github: {
    labelKey: "aboutOpenGitHub",
    url: "https://github.com/LiKa-shing/git4zotero"
  },
  feedback: {
    labelKey: "aboutOpenFeedback",
    url: "https://github.com/LiKa-shing/git4zotero/issues"
  },
  qa: {
    labelKey: "aboutOpenQA",
    url: "https://github.com/LiKa-shing/git4zotero/issues"
  }
});

var Git4ZoteroPreferences = {
  initialized: false,
  testing: false,
  retryTimer: null,
  platform: null,
  cleanupService: null,
  diagnosticService: null,
  lastOrphanScan: null,
  confirmedArchiveExportDirectory: null,
  guideStepIndex: 0,
  guideStepStates: null,

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
    this.refreshArchiveExportDirectory();
    this.refreshDataDirectory();
    this.setStatus(this.getStatusText() || this.text("gitStatusInitial"), "");
    this.refreshLastErrorStatus();

    gitInput?.addEventListener("input", () => {
      this.refreshResolvedGit();
      this.refreshSavedGit();
    });

    const archiveExportDirectoryInput = document.getElementById("git4zotero-archive-export-directory");
    archiveExportDirectoryInput?.addEventListener("change", (changeEvent) => {
      return this.autoSaveArchiveExportDirectory(changeEvent);
    });
    archiveExportDirectoryInput?.addEventListener("blur", (blurEvent) => {
      return this.autoSaveArchiveExportDirectory(blurEvent);
    });
    archiveExportDirectoryInput?.addEventListener("keydown", (keyEvent) => {
      return this.autoSaveArchiveExportDirectory(keyEvent);
    });

    this.bindFirstUseGuideControls();

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
      let gitInputValue = this.getGitInputValue();
      if (!gitInputValue && typeof platform.listGitExecutableCandidates === "function") {
        const candidates = await platform.listGitExecutableCandidates();
        if (candidates.length > 1) {
          const selected = platform.selectFromList(
            this.text("gitCandidateSelectTitle"),
            this.text("gitCandidateSelectMessage"),
            candidates.map((candidate) => [
              candidate.version || candidate.detail || "Git",
              candidate.command
            ].filter(Boolean).join(" — "))
          );
          if (selected < 0) {
            this.setStatus(this.text("gitCandidateSelectionCanceled"), "");
            return;
          }
          gitInputValue = candidates[selected]?.command || "";
          this.setGitInputValue(gitInputValue);
        }
        else if (candidates.length === 1) {
          gitInputValue = candidates[0].command;
          this.setGitInputValue(gitInputValue);
        }
      }
      const result = await platform.checkGitAvailability(gitInputValue, { persist: true });

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

  async openFirstUseGuide(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setFirstUseOutput("", true);
    this.guideStepIndex = 0;
    this.ensureFirstUseGuideState();
    this.setFirstUseGuideDialogVisible(true);
    this.renderFirstUseGuide();
    await this.refreshFirstUseGuideState();
  },

  closeFirstUseGuide(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.setFirstUseGuideDialogVisible(false);
  },

  async showFirstUseGuideStep(index, event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    const maxIndex = FIRST_USE_GUIDE_STEPS.length - 1;
    this.guideStepIndex = Math.max(0, Math.min(Number(index) || 0, maxIndex));
    this.renderFirstUseGuide();
    await this.refreshFirstUseGuideState(FIRST_USE_GUIDE_STEPS[this.guideStepIndex]?.id);
  },

  bindFirstUseGuideControls() {
    document.getElementById("git4zotero-guide-close")?.addEventListener("click", (clickEvent) => {
      this.closeFirstUseGuide(clickEvent);
    });
    document.getElementById("git4zotero-guide-backdrop")?.addEventListener("click", (clickEvent) => {
      this.closeFirstUseGuide(clickEvent);
    });
    document.getElementById("git4zotero-guide-prev")?.addEventListener("click", (clickEvent) => {
      this.showFirstUseGuideStep(this.guideStepIndex - 1, clickEvent);
    });
    document.getElementById("git4zotero-guide-next")?.addEventListener("click", (clickEvent) => {
      this.showFirstUseGuideStep(this.guideStepIndex + 1, clickEvent);
    });
    document.getElementById("git4zotero-guide-done")?.addEventListener("click", (clickEvent) => {
      this.closeFirstUseGuide(clickEvent);
    });

    for (const id of [
      "git4zotero-guide-primary-action",
      "git4zotero-guide-secondary-action",
      "git4zotero-guide-tertiary-action"
    ]) {
      document.getElementById(id)?.addEventListener("click", (clickEvent) => {
        const actionID = clickEvent?.target?.dataset?.action || clickEvent?.target?.getAttribute?.("data-action");
        this.runFirstUseGuideAction(actionID, clickEvent);
      });
    }
  },

  ensureFirstUseGuideState() {
    if (!this.guideStepStates) {
      this.guideStepStates = {};
    }
    for (const step of FIRST_USE_GUIDE_STEPS) {
      if (!this.guideStepStates[step.id]) {
        this.guideStepStates[step.id] = {
          status: "pending",
          detail: ""
        };
      }
    }
  },

  setFirstUseGuideDialogVisible(visible) {
    const dialog = document.getElementById("git4zotero-first-use-dialog");
    if (!dialog) {
      return;
    }
    this.setElementHidden(dialog, !visible);
  },

  isFirstUseGuideOpen() {
    const dialog = document.getElementById("git4zotero-first-use-dialog");
    return !!dialog && !dialog.hidden;
  },

  renderFirstUseGuide() {
    this.ensureFirstUseGuideState();
    const step = FIRST_USE_GUIDE_STEPS[this.guideStepIndex] || FIRST_USE_GUIDE_STEPS[0];
    const state = this.guideStepStates[step.id] || { status: "pending", detail: "" };
    this.renderFirstUseGuideStepList();

    const title = document.getElementById("git4zotero-guide-step-title");
    if (title) {
      title.textContent = this.text(step.titleKey);
    }

    const status = document.getElementById("git4zotero-guide-step-status");
    if (status) {
      status.textContent = this.text(`guideStatus${this.capitalizeStatus(state.status)}`);
      status.dataset.tone = this.guideToneForStatus(state.status);
    }

    const detail = document.getElementById("git4zotero-guide-step-detail");
    if (detail) {
      const description = this.text(step.descriptionKey);
      detail.textContent = state.detail ? `${description}\n\n${state.detail}` : description;
    }

    this.renderFirstUseGuideActions(step);
    this.renderFirstUseGuideNavigation();
  },

  renderFirstUseGuideStepList() {
    const list = document.getElementById("git4zotero-guide-step-list");
    if (!list) {
      return;
    }
    this.clearChildren(list);
    FIRST_USE_GUIDE_STEPS.forEach((step, index) => {
      const state = this.guideStepStates[step.id] || { status: "pending" };
      const item = this.createHTMLElement("li");
      const button = this.createHTMLElement("button");
      const name = this.createHTMLElement("span");
      const badge = this.createHTMLElement("span");

      button.type = "button";
      button.className = "git4zotero-guide-step-button";
      button.setAttribute?.("aria-current", index === this.guideStepIndex ? "step" : "false");
      button.addEventListener?.("click", (clickEvent) => {
        this.showFirstUseGuideStep(index, clickEvent);
      });
      name.className = "git4zotero-guide-step-name";
      name.textContent = this.text(step.titleKey);
      badge.className = "git4zotero-guide-step-badge";
      badge.textContent = this.text(`guideStatus${this.capitalizeStatus(state.status)}`);
      badge.dataset.tone = this.guideToneForStatus(state.status);
      button.append?.(name, badge);
      item.append?.(button);
      list.append?.(item);
    });
  },

  renderFirstUseGuideActions(step) {
    const buttonIDs = [
      "git4zotero-guide-primary-action",
      "git4zotero-guide-secondary-action",
      "git4zotero-guide-tertiary-action"
    ];
    buttonIDs.forEach((id, index) => {
      const button = document.getElementById(id);
      if (!button) {
        return;
      }
      const action = step.actions[index];
      this.setElementHidden(button, !action);
      button.disabled = false;
      if (action) {
        button.textContent = this.text(action.labelKey);
        button.dataset.action = action.id;
        button.setAttribute?.("data-action", action.id);
      }
      else {
        button.textContent = "";
        button.dataset.action = "";
        button.removeAttribute?.("data-action");
      }
    });
  },

  renderFirstUseGuideNavigation() {
    const prev = document.getElementById("git4zotero-guide-prev");
    const next = document.getElementById("git4zotero-guide-next");
    const done = document.getElementById("git4zotero-guide-done");
    if (prev) {
      prev.disabled = this.guideStepIndex <= 0;
    }
    if (next) {
      this.setElementHidden(next, this.guideStepIndex >= FIRST_USE_GUIDE_STEPS.length - 1);
    }
    if (done) {
      this.setElementHidden(done, this.guideStepIndex < FIRST_USE_GUIDE_STEPS.length - 1);
    }
  },

  async refreshFirstUseGuideState(stepID = null) {
    this.ensureFirstUseGuideState();
    const steps = stepID
      ? FIRST_USE_GUIDE_STEPS.filter((step) => step.id === stepID)
      : FIRST_USE_GUIDE_STEPS;
    for (const step of steps) {
      if (step.id === "git") {
        await this.refreshGuideGitState();
      }
      else if (step.id === "data") {
        this.refreshGuideDataState();
      }
      else if (step.id === "archive") {
        await this.refreshGuideArchiveState();
      }
      else if (step.id === "troubleshooting") {
        this.refreshGuideTroubleshootingState();
      }
    }
    this.renderFirstUseGuide();
  },

  async refreshGuideGitState() {
    const path = this.getGitExecutable();
    this.setFirstUseGuideStepState("git", "checking", this.text("guideGitChecking", { path }));
    try {
      const result = await this.getPlatform().checkGitAvailability(this.getGitInputValue(), { persist: false });
      this.setFirstUseGuideStepState(
        "git",
        result.available ? "ok" : "error",
        result.available
          ? this.text("guideGitReady", { detail: result.detail || result.version || "", path: result.command || path })
          : this.text("guideGitMissing", { detail: result.error || result.detail || this.text("gitPathCheckHint"), path: result.command || path })
      );
    }
    catch (error) {
      this.setFirstUseGuideStepState("git", "error", this.text("guideGitMissing", {
        detail: error.message || String(error),
        path
      }));
    }
  },

  refreshGuideDataState() {
    try {
      const dataDir = this.getPlatform().getPluginDataDirectory();
      this.setFirstUseGuideStepState("data", "ok", this.text("guideDataReady", { path: dataDir }));
    }
    catch (error) {
      this.setFirstUseGuideStepState("data", "error", this.text("guideDataFailed", { message: error.message || String(error) }));
    }
  },

  async refreshGuideArchiveState() {
    const directory = this.getArchiveExportDirectory();
    if (!directory) {
      this.setFirstUseGuideStepState("archive", "warning", this.text("guideArchiveUnset"));
      return;
    }
    try {
      const platform = this.getPlatform();
      if (typeof platform.assertDirectoryAvailable === "function") {
        await platform.assertDirectoryAvailable(directory);
      }
      this.setFirstUseGuideStepState("archive", "ok", this.text("guideArchiveReady", { path: directory }));
    }
    catch (error) {
      this.setFirstUseGuideStepState("archive", "error", this.text("guideArchiveUnavailable", { message: error.message || String(error) }));
    }
  },

  refreshGuideTroubleshootingState() {
    const healthStatus = document.getElementById("git4zotero-health-status");
    const healthText = healthStatus?.textContent?.trim?.() || "";
    if (healthText && healthText !== this.text("healthInitial") && healthText !== this.text("healthRunning")) {
      this.setFirstUseGuideStepState("troubleshooting", this.guideStatusFromTone(healthStatus?.dataset?.tone), this.text("guideTroubleshootingHealthReady", { summary: healthText }));
      return;
    }
    this.setFirstUseGuideStepState("troubleshooting", "pending", this.text("guideTroubleshootingReady"));
  },

  async runFirstUseGuideAction(actionID, event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!actionID) {
      return;
    }
    this.init(event);
    this.setFirstUseGuideActionsDisabled(true);
    try {
      if (actionID === "test-git") {
        await this.testGit();
        this.syncGuideStateFromStatusElement("git", "git4zotero-git-status");
      }
      else if (actionID === "open-git-guide") {
        this.openGitGuide();
        this.syncGuideStateFromStatusElement("troubleshooting", "git4zotero-diagnostics-status");
      }
      else if (actionID === "open-data-directory") {
        await this.openDataDirectory();
        this.syncGuideStateFromStatusElement("data", "git4zotero-diagnostics-status");
      }
      else if (actionID === "check-write-permission") {
        await this.checkGuideWritePermission();
      }
      else if (actionID === "choose-archive-directory") {
        await this.chooseArchiveExportDirectory();
        await this.refreshGuideArchiveState();
      }
      else if (actionID === "clear-archive-directory") {
        this.clearArchiveExportDirectory();
        await this.refreshGuideArchiveState();
      }
      else if (actionID === "run-health-check") {
        await this.runHealthCheck();
        this.refreshGuideTroubleshootingState();
      }
      else if (actionID === "copy-diagnostics") {
        await this.copyDiagnostics();
        this.syncGuideStateFromStatusElement("troubleshooting", "git4zotero-diagnostics-status");
      }
      else if (actionID === "copy-issue-template") {
        await this.copyIssueTemplate();
        this.syncGuideStateFromStatusElement("troubleshooting", "git4zotero-diagnostics-status");
      }
    }
    catch (error) {
      const currentStep = FIRST_USE_GUIDE_STEPS[this.guideStepIndex] || FIRST_USE_GUIDE_STEPS[0];
      this.setFirstUseGuideStepState(currentStep.id, "error", this.text("guideActionFailed", { message: error.message || String(error) }));
    }
    finally {
      this.setFirstUseGuideActionsDisabled(false);
      this.renderFirstUseGuide();
    }
  },

  async checkGuideWritePermission() {
    this.setFirstUseGuideStepState("data", "checking", this.text("guideDataWriteChecking"));
    try {
      const platform = this.getPlatform();
      const probePath = await platform.writeTempProbeFile();
      this.setFirstUseGuideStepState("data", "ok", this.text("guideDataWriteReady", { path: probePath }));
    }
    catch (error) {
      this.recordPreferenceError(error, "check data directory write permission");
      this.setFirstUseGuideStepState("data", "error", this.text("guideDataWriteFailed", { message: error.message || String(error) }));
    }
  },

  setFirstUseGuideStepState(stepID, status, detail) {
    this.ensureFirstUseGuideState();
    this.guideStepStates[stepID] = {
      status: status || "pending",
      detail: detail || ""
    };
    if (this.isFirstUseGuideOpen()) {
      this.renderFirstUseGuide();
    }
  },

  syncGuideStateFromStatusElement(stepID, elementID) {
    const element = document.getElementById(elementID);
    const detail = element?.textContent?.trim?.() || "";
    this.setFirstUseGuideStepState(stepID, this.guideStatusFromTone(element?.dataset?.tone), detail);
  },

  setFirstUseGuideActionsDisabled(disabled) {
    for (const id of [
      "git4zotero-guide-primary-action",
      "git4zotero-guide-secondary-action",
      "git4zotero-guide-tertiary-action"
    ]) {
      const button = document.getElementById(id);
      if (button && !button.hidden) {
        button.disabled = disabled;
      }
    }
  },

  createHTMLElement(tagName) {
    if (typeof document.createElementNS === "function") {
      return document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
    }
    return document.createElement(tagName);
  },

  clearChildren(element) {
    if (typeof element.replaceChildren === "function") {
      element.replaceChildren();
      return;
    }
    element.textContent = "";
  },

  setElementHidden(element, hidden) {
    if (!element) {
      return;
    }
    element.hidden = !!hidden;
    if (hidden) {
      element.setAttribute?.("hidden", "hidden");
    }
    else {
      element.removeAttribute?.("hidden");
    }
  },

  guideStatusFromTone(tone) {
    if (tone === "success") {
      return "ok";
    }
    if (tone === "error") {
      return "error";
    }
    if (tone === "warning") {
      return "warning";
    }
    if (tone === "checking") {
      return "checking";
    }
    return "pending";
  },

  guideToneForStatus(status) {
    if (status === "ok") {
      return "success";
    }
    if (status === "error") {
      return "error";
    }
    if (status === "warning") {
      return "warning";
    }
    if (status === "checking") {
      return "checking";
    }
    return "pending";
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

  openProjectLink(linkID, event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);

    const link = PROJECT_LINKS[String(linkID || "")];
    if (!link) {
      this.setAboutStatus(this.text("aboutUnknownLink"), "error");
      return;
    }

    try {
      this.getPlatform().openURL(link.url);
      this.setAboutStatus(this.text("aboutLinkOpened", { label: this.text(link.labelKey) }), "success");
    }
    catch (error) {
      this.recordPreferenceError(error, `open project link: ${linkID || "unknown"}`);
      this.setAboutStatus(this.text("aboutLinkOpenFailed", { message: error.message || String(error) }), "error");
    }
  },

  async chooseArchiveExportDirectory(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setArchiveButtonsDisabled(true);
    try {
      const directory = await this.getPlatform().pickDirectoryViaSaveDialog(this.text("archiveExportDirectoryChooseTitle"));
      if (!directory) {
        this.setArchiveStatus(this.text("archiveCanceled"), "");
        return;
      }
      this.setArchiveExportDirectoryValue(directory);
      await this.persistArchiveExportDirectoryValue();
    }
    catch (error) {
      this.recordPreferenceError(error, "choose archive export directory");
      this.setArchiveStatus(this.text("archiveChooseDirectoryFailed", { message: error.message || String(error) }), "error");
    }
    finally {
      this.setArchiveButtonsDisabled(false);
    }
  },

  async autoSaveArchiveExportDirectory(event = null) {
    const isEnterKey = event?.key === "Enter" || event?.code === "Enter" || event?.code === "NumpadEnter";
    if (event?.type === "keydown" && !isEnterKey) {
      return false;
    }
    if (event?.type === "keydown") {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }
    this.init(event);
    this.setArchiveButtonsDisabled(true);
    try {
      return await this.savePendingArchiveExportDirectory();
    }
    finally {
      this.setArchiveButtonsDisabled(false);
    }
  },

  async savePendingArchiveExportDirectory() {
    const directory = this.getArchiveExportDirectoryInputValue();
    if (directory === this.getArchiveExportDirectory()) {
      return true;
    }
    try {
      await this.persistArchiveExportDirectoryValue();
      return true;
    }
    catch (error) {
      this.recordPreferenceError(error, "auto-save archive export directory");
      this.setArchiveStatus(this.text("archiveSaveDirectoryFailed", { message: error.message || String(error) }), "error");
      return false;
    }
  },

  async persistArchiveExportDirectoryValue() {
    const directory = this.getArchiveExportDirectoryInputValue();
    if (!directory) {
      Zotero.Prefs.set("extensions.git4zotero.archiveExportDirectory", "");
      this.applyArchiveExportDirectoryDisplay("");
      this.setArchiveStatus(this.text("archiveExportDirectoryCleared"), "success");
      return;
    }

    await this.getPlatform().assertDirectoryAvailable(directory);
    Zotero.Prefs.set("extensions.git4zotero.archiveExportDirectory", directory);
    this.applyArchiveExportDirectoryDisplay(directory);
    this.setArchiveStatus(this.text("archiveExportDirectorySaved", { path: directory }), "success");
  },

  clearArchiveExportDirectory(event = null) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.init(event);
    this.setArchiveExportDirectoryValue("");
    Zotero.Prefs.set("extensions.git4zotero.archiveExportDirectory", "");
    this.applyArchiveExportDirectoryDisplay("");
    this.setArchiveStatus(this.text("archiveExportDirectoryCleared"), "success");
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
      PathUtils: typeof PathUtils !== "undefined" ? PathUtils : null,
      window: typeof window !== "undefined" ? window : null
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
      && doc.getElementById("git4zotero-first-use-dialog")
      && doc.getElementById("git4zotero-guide-step-list")
      && doc.getElementById("git4zotero-guide-step-title")
      && doc.getElementById("git4zotero-archive-export-directory")
      && doc.getElementById("git4zotero-current-archive-export-directory")
      && doc.getElementById("git4zotero-archive-status")
      && doc.getElementById("git4zotero-about-status")
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

  getSavedArchiveExportDirectory() {
    return this.normalizeExecutablePath(Zotero.Prefs.get("extensions.git4zotero.archiveExportDirectory", true));
  },

  getArchiveExportDirectory() {
    if (this.confirmedArchiveExportDirectory !== null) {
      return this.normalizeExecutablePath(this.confirmedArchiveExportDirectory);
    }
    return this.getSavedArchiveExportDirectory();
  },

  getArchiveExportDirectoryInputValue() {
    const input = document.getElementById("git4zotero-archive-export-directory");
    return this.normalizeExecutablePath(input?.value ?? this.getArchiveExportDirectory());
  },

  setArchiveExportDirectoryValue(value) {
    const input = document.getElementById("git4zotero-archive-export-directory");
    if (input) {
      input.value = this.normalizeExecutablePath(value);
    }
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

  refreshArchiveExportDirectory() {
    const directory = this.getSavedArchiveExportDirectory();
    this.applyArchiveExportDirectoryDisplay(directory);
  },

  applyArchiveExportDirectoryDisplay(directoryValue) {
    const directory = this.normalizeExecutablePath(directoryValue);
    this.confirmedArchiveExportDirectory = directory;
    this.setArchiveExportDirectoryValue(directory);
    const current = document.getElementById("git4zotero-current-archive-export-directory");
    if (current) {
      current.textContent = directory || this.text("archiveExportDirectoryPlaceholder");
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

  setAboutStatus(message, tone) {
    const status = document.getElementById("git4zotero-about-status");
    if (!status) {
      return;
    }
    status.textContent = message;
    status.dataset.tone = tone || "";
    status.hidden = !message;
    if (message) {
      status.removeAttribute?.("hidden");
    }
    else {
      status.setAttribute?.("hidden", "hidden");
    }
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
    for (const id of [
      "git4zotero-choose-archive-export-directory",
      "git4zotero-clear-archive-export-directory"
    ]) {
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
    const details = checks.map((check) => {
      const label = this.text(`healthStatus${this.capitalizeStatus(check.status)}`);
      const colon = this.text("colon");
      const stop = this.text("locale") === "en-US" ? "." : "。";
      return `- ${check.label}${colon}${label}${stop}${check.detail || ""}`;
    });
    const suggestions = checks
      .filter((check) => check.suggestion)
      .map((check) => `- ${check.label}${this.text("colon")}${check.suggestion}`);
    return [
      ...details,
      "",
      this.text("healthNextStepsTitle"),
      ...(suggestions.length ? suggestions : [`- ${this.text("healthNoNextSteps")}`])
    ].join("\n");
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
    if (status === "pending") {
      return "Pending";
    }
    if (status === "checking") {
      return "Checking";
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
